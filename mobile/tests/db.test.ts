/**
 * Runs the real Supabase migration on an in-memory Postgres (PGlite) and checks
 * the security rules as signed-in students. Supabase's auth schema, roles and
 * default grants are stubbed to match a hosted project.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite, type Transaction } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const MIGRATIONS = join(__dirname, '..', '..', 'supabase', 'migrations');

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  grant usage on schema auth to anon, authenticated;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  -- Hosted Supabase grants new public tables and functions to the API roles.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

let db: PGlite;

async function signUp(email: string, name?: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    'insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id',
    [email, JSON.stringify(name ? { name } : {})]
  );
  return r.rows[0].id;
}

/** Runs queries as a signed-in student (or signed out when uid is null). */
async function as<T>(uid: string | null, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.query(`set local role ${uid ? 'authenticated' : 'anon'}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
    return fn(tx);
  });
}

async function rows<T>(uid: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  return as(uid, async (tx) => (await tx.query<T>(sql, params)).rows);
}

async function count(uid: string | null, sql: string, params: unknown[] = []): Promise<number> {
  return as(uid, async (tx) => (await tx.query(sql, params)).affectedRows ?? 0);
}

let learner: string;
let mentor: string;
let junior: string;
let outsider: string;
let requestId: string;
let roomId: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  }

  learner = await signUp('learner@loyolacollege.edu', 'Lena');
  mentor = await signUp('Mentor@Student.LoyolaCollege.edu', 'Mani');
  junior = await signUp('junior@loyolacollege.edu');
  outsider = await signUp('outsider@loyolacollege.edu', 'Omar');

  await as(mentor, async (tx) => {
    await tx.query(`insert into skills (name, level, tags, description) values ('Python', 3, '{pandas,data}', 'Data analysis')`);
    await tx.query(`insert into availability (day, start_hour, end_hour) values ('Mon', 16, 18)`);
  });
  await as(junior, (tx) => tx.query(`insert into skills (name, level) values ('python', 1)`));

  const r = await rows<{ id: string }>(
    learner,
    `insert into learning_requests (skill, level, goal, slots)
     values ('python', 1, 'data analysis with pandas', '[{"day":"Mon","startHour":17,"endHour":19}]')
     returning id`
  );
  requestId = r[0].id;
});

describe('sign-up', () => {
  it('creates a profile for an institutional email, using the given name', async () => {
    const p = await db.query<{ email: string; name: string }>('select email, name from profiles where id = $1', [mentor]);
    expect(p.rows[0]).toEqual({ email: 'mentor@student.loyolacollege.edu', name: 'Mani' });
  });

  it('falls back to the email name when none is given', async () => {
    const p = await db.query<{ name: string }>('select name from profiles where id = $1', [junior]);
    expect(p.rows[0].name).toBe('junior');
  });

  it('rejects personal and look-alike domains', async () => {
    await expect(signUp('someone@gmail.com')).rejects.toThrow(/institutional email/);
    await expect(signUp('a@evilloyolacollege.edu')).rejects.toThrow(/institutional email/);
    await expect(signUp('a@loyolacollege.edu.evil.com')).rejects.toThrow(/institutional email/);
  });

  it('lets signed-out visitors read only the allowed domains', async () => {
    expect(await rows(null, 'select domain from college_domains')).toEqual([{ domain: 'loyolacollege.edu' }]);
    await expect(rows(null, 'select id from profiles')).rejects.toThrow(/permission denied/);
  });
});

describe('profiles', () => {
  it('hides other students’ email addresses', async () => {
    await expect(rows(learner, 'select email from profiles')).rejects.toThrow(/permission denied/);
    expect(await rows(learner, 'select name from profiles where id = $1', [mentor])).toEqual([{ name: 'Mani' }]);
  });

  it('lets students edit their own details but not their reputation', async () => {
    expect(await count(learner, `update profiles set department = 'CS' where id = $1`, [learner])).toBe(1);
    expect(await count(learner, `update profiles set name = 'X' where id = $1`, [mentor])).toBe(0);
    await expect(rows(learner, `update profiles set rating = 5 where id = $1`, [learner])).rejects.toThrow(/permission denied/);
  });

  it('only lets students add skills to their own profile', async () => {
    await expect(
      rows(learner, `insert into skills (profile_id, name, level) values ($1, 'Java', 4)`, [mentor])
    ).rejects.toThrow(/row-level security/);
  });
});

describe('learning requests and matching', () => {
  it('keeps a request private to its learner', async () => {
    expect(await rows(outsider, 'select id from learning_requests')).toEqual([]);
    expect(await rows(learner, 'select id from learning_requests')).toHaveLength(1);
  });

  it('returns everyone else who lists the skill as candidates', async () => {
    const [{ c }] = await rows<{ c: Array<{ id: string; skills: unknown[]; availability: unknown[] }> }>(
      learner,
      'select match_candidates($1) as c',
      [requestId]
    );
    expect(c.map((m) => m.id).sort()).toEqual([mentor, junior].sort());
    const m = c.find((x) => x.id === mentor)!;
    expect(m.availability).toEqual([{ day: 'Mon', startHour: 16, endHour: 18 }]);
  });

  it('returns no candidates for someone else’s request', async () => {
    const [{ c }] = await rows<{ c: unknown[] }>(outsider, 'select match_candidates($1) as c', [requestId]);
    expect(c).toEqual([]);
  });
});

describe('learning rooms', () => {
  it('refuses a mentor who is not above the learner, or the learner themself', async () => {
    await expect(rows(learner, 'select create_room($1, $2)', [requestId, junior])).rejects.toThrow(/above your level/);
    await expect(rows(learner, 'select create_room($1, $2)', [requestId, learner])).rejects.toThrow(/mentor yourself/);
  });

  it('refuses someone else’s request', async () => {
    await expect(rows(outsider, 'select create_room($1, $2)', [requestId, mentor])).rejects.toThrow(/Request not found/);
  });

  it('creates a room and marks the request matched', async () => {
    const r = await rows<{ id: string }>(learner, 'select (create_room($1, $2)).id', [requestId, mentor]);
    roomId = r[0].id;
    const again = await rows<{ id: string }>(learner, 'select (create_room($1, $2)).id', [requestId, mentor]);
    expect(again[0].id).toBe(roomId);
    expect(await rows(learner, 'select status from learning_requests')).toEqual([{ status: 'matched' }]);
  });

  it('lets the connected mentor see the request', async () => {
    expect(await rows(mentor, 'select goal from learning_requests')).toEqual([{ goal: 'data analysis with pandas' }]);
  });

  it('blocks direct room inserts and outsiders', async () => {
    await expect(
      rows(learner, 'insert into rooms (request_id, mentor_id, learner_id, skill) values ($1, $2, $3, $4)', [
        requestId, mentor, learner, 'python',
      ])
    ).rejects.toThrow(/permission denied/);
    expect(await rows(outsider, 'select id from rooms')).toEqual([]);
  });

  it('lets members manage the plan and sessions, but not outsiders', async () => {
    await rows(mentor, `insert into plan_items (room_id, title) values ($1, 'Pandas basics')`, [roomId]);
    expect(await count(learner, 'update plan_items set done = true where room_id = $1', [roomId])).toBe(1);
    await expect(
      rows(outsider, `insert into plan_items (room_id, title) values ($1, 'Spam')`, [roomId])
    ).rejects.toThrow(/row-level security/);

    await rows(mentor, `insert into room_sessions (room_id, scheduled_at) values ($1, now() + interval '1 day')`, [roomId]);
    expect(await count(mentor, `update room_sessions set status = 'completed' where room_id = $1`, [roomId])).toBe(1);
    expect(await rows(outsider, 'select id from room_sessions')).toEqual([]);
  });
});

describe('doubt corner', () => {
  let doubtId: string;

  it('lets members ask and reply, and hides doubts from outsiders', async () => {
    const d = await rows<{ id: string }>(
      learner,
      `insert into doubts (room_id, body) values ($1, 'How do I merge two DataFrames?') returning id`,
      [roomId]
    );
    doubtId = d[0].id;
    await rows(mentor, `insert into doubt_replies (doubt_id, body) values ($1, 'Use pd.merge')`, [doubtId]);
    expect(await rows(learner, 'select body from doubt_replies')).toEqual([{ body: 'Use pd.merge' }]);
    expect(await rows(outsider, 'select id from doubts')).toEqual([]);
    await expect(
      rows(outsider, `insert into doubt_replies (doubt_id, body) values ($1, 'hi')`, [doubtId])
    ).rejects.toThrow(/row-level security/);
  });

  it('only lets the asker resolve a doubt', async () => {
    expect(await count(mentor, 'update doubts set resolved = true where id = $1', [doubtId])).toBe(0);
    expect(await count(learner, 'update doubts set resolved = true where id = $1', [doubtId])).toBe(1);
    await expect(rows(learner, `update doubts set body = 'edited' where id = $1`, [doubtId])).rejects.toThrow(
      /permission denied/
    );
  });
});
