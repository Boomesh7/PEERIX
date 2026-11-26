-- PEERIX - Learn. Teach. Pass It On.
-- Phase 1 schema: verified sign-up, mentor profiles, learning requests,
-- Reverse Matching candidates, Learning Rooms and the Doubt Corner.
-- Every permission is enforced here with row level security (RLS).

-- ---------------------------------------------------------------------------
-- Institutional email verification
-- ---------------------------------------------------------------------------

create table public.college_domains (
  domain text primary key check (domain = lower(domain) and domain like '%.%')
);

insert into public.college_domains (domain) values ('loyolacollege.edu');

-- True for an address on an allowed domain or one of its subdomains
-- (student.loyolacollege.edu). Look-alikes such as evilloyolacollege.edu fail.
create or replace function public.is_college_email(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.college_domains d,
         lower(split_part(coalesce(p_email, ''), '@', 2)) as e(domain)
    where e.domain = d.domain
       or right(e.domain, length(d.domain) + 1) = '.' || d.domain
  );
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user, created by the sign-up trigger)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null check (length(trim(name)) between 1 and 80),
  department text not null default '' check (length(department) <= 80),
  year int check (year between 1 and 6),
  bio text not null default '' check (length(bio) <= 500),
  -- Reputation. Written by the platform only (ratings arrive in phase 2).
  rating numeric(3, 2) not null default 0 check (rating between 0 and 5),
  sessions_count int not null default 0 check (sessions_count >= 0),
  created_at timestamptz not null default now()
);

-- Supabase email OTP proves the student owns the address. This trigger makes
-- sure only institutional addresses can create an account at all.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_college_email(new.email) then
    raise exception 'Please use your official institutional email ID'
      using errcode = 'check_violation';
  end if;

  insert into public.profiles (id, email, name)
  values (
    new.id,
    lower(new.email),
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)), 80)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Mentor profile: skills a student can teach and when they are free
-- ---------------------------------------------------------------------------

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  level int not null check (level between 1 and 4), -- 1 beginner .. 4 expert
  tags text[] not null default '{}',
  description text not null default '' check (length(description) <= 300)
);

create unique index skills_profile_name_key on public.skills (profile_id, lower(name));
create index skills_lower_name_idx on public.skills (lower(name));

create table public.availability (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day text not null check (day in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')),
  start_hour int not null check (start_hour between 0 and 23),
  end_hour int not null check (end_hour between 1 and 24),
  check (end_hour > start_hour)
);

create index availability_profile_idx on public.availability (profile_id);

-- ---------------------------------------------------------------------------
-- Learning requests (the learner describes what they need)
-- ---------------------------------------------------------------------------

create table public.learning_requests (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  skill text not null check (length(trim(skill)) between 1 and 60),
  level int not null check (level between 1 and 4), -- learner's current level
  goal text not null default '' check (length(goal) <= 500),
  -- Preferred slots: [{ "day": "Mon", "startHour": 16, "endHour": 18 }]
  slots jsonb not null default '[]' check (jsonb_typeof(slots) = 'array'),
  status text not null default 'open' check (status in ('open', 'matched', 'closed')),
  created_at timestamptz not null default now()
);

create index learning_requests_learner_idx on public.learning_requests (learner_id);

-- ---------------------------------------------------------------------------
-- Learning Rooms (one per learner-mentor connection)
-- ---------------------------------------------------------------------------

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.learning_requests (id) on delete cascade,
  mentor_id uuid not null references public.profiles (id) on delete cascade,
  learner_id uuid not null references public.profiles (id) on delete cascade,
  skill text not null,
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  check (mentor_id <> learner_id),
  unique (request_id, mentor_id)
);

create index rooms_mentor_idx on public.rooms (mentor_id);
create index rooms_learner_idx on public.rooms (learner_id);

create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create index plan_items_room_idx on public.plan_items (room_id);

create table public.room_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_mins int not null default 60 check (duration_mins between 15 and 240),
  notes text not null default '' check (length(notes) <= 1000),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index room_sessions_room_idx on public.room_sessions (room_id);

-- ---------------------------------------------------------------------------
-- Doubt Corner (stays open after sessions end)
-- ---------------------------------------------------------------------------

create table public.doubts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create index doubts_room_idx on public.doubts (room_id);

create table public.doubt_replies (
  id uuid primary key default gen_random_uuid(),
  doubt_id uuid not null references public.doubts (id) on delete cascade,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index doubt_replies_doubt_idx on public.doubt_replies (doubt_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Security definer so room policies can check membership without recursion.
create or replace function public.is_room_member(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room and auth.uid() in (r.mentor_id, r.learner_id)
  );
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.college_domains enable row level security;
alter table public.profiles enable row level security;
alter table public.skills enable row level security;
alter table public.availability enable row level security;
alter table public.learning_requests enable row level security;
alter table public.rooms enable row level security;
alter table public.plan_items enable row level security;
alter table public.room_sessions enable row level security;
alter table public.doubts enable row level security;
alter table public.doubt_replies enable row level security;

-- Signed-out visitors may only read the allowed domains (for the login form).
revoke all on public.profiles, public.skills, public.availability, public.learning_requests,
  public.rooms, public.plan_items, public.room_sessions, public.doubts, public.doubt_replies
  from anon;
revoke insert, update, delete on public.college_domains from anon, authenticated;

create policy "domains are public" on public.college_domains
  for select to anon, authenticated using (true);

-- Profiles: students see each other's public details, never email or the
-- right to change their own reputation.
revoke all on public.profiles from authenticated;
grant select (id, name, department, year, bio, rating, sessions_count, created_at)
  on public.profiles to authenticated;
grant update (name, department, year, bio) on public.profiles to authenticated;

create policy "profiles readable by students" on public.profiles
  for select to authenticated using (true);
create policy "edit own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Skills and availability: public to students, editable by their owner.
create policy "skills readable" on public.skills
  for select to authenticated using (true);
create policy "add own skills" on public.skills
  for insert to authenticated with check (profile_id = auth.uid());
create policy "edit own skills" on public.skills
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "remove own skills" on public.skills
  for delete to authenticated using (profile_id = auth.uid());

create policy "availability readable" on public.availability
  for select to authenticated using (true);
create policy "add own availability" on public.availability
  for insert to authenticated with check (profile_id = auth.uid());
create policy "edit own availability" on public.availability
  for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "remove own availability" on public.availability
  for delete to authenticated using (profile_id = auth.uid());

-- Learning requests: the learner, plus mentors already connected to it.
revoke update on public.learning_requests from authenticated;
grant update (status) on public.learning_requests to authenticated;

create policy "see own or connected requests" on public.learning_requests
  for select to authenticated using (
    learner_id = auth.uid()
    or exists (
      select 1 from public.rooms r
      where r.request_id = learning_requests.id and r.mentor_id = auth.uid()
    )
  );
create policy "post own requests" on public.learning_requests
  for insert to authenticated with check (learner_id = auth.uid() and status = 'open');
create policy "update own requests" on public.learning_requests
  for update to authenticated using (learner_id = auth.uid()) with check (learner_id = auth.uid());
create policy "delete own requests" on public.learning_requests
  for delete to authenticated using (learner_id = auth.uid());

-- Rooms: created only through create_room(); members can mark them completed.
revoke insert, update, delete on public.rooms from authenticated;
grant update (status) on public.rooms to authenticated;

create policy "members see room" on public.rooms
  for select to authenticated using (auth.uid() in (mentor_id, learner_id));
create policy "members update room" on public.rooms
  for update to authenticated
  using (auth.uid() in (mentor_id, learner_id))
  with check (auth.uid() in (mentor_id, learner_id));

-- Plan items and sessions: room members only.
revoke update on public.plan_items from authenticated;
grant update (title, done) on public.plan_items to authenticated;

create policy "members see plan" on public.plan_items
  for select to authenticated using (public.is_room_member(room_id));
create policy "members add plan" on public.plan_items
  for insert to authenticated with check (public.is_room_member(room_id));
create policy "members edit plan" on public.plan_items
  for update to authenticated using (public.is_room_member(room_id)) with check (public.is_room_member(room_id));
create policy "members remove plan" on public.plan_items
  for delete to authenticated using (public.is_room_member(room_id));

revoke update, delete on public.room_sessions from authenticated;
grant update (scheduled_at, duration_mins, notes, status) on public.room_sessions to authenticated;

create policy "members see sessions" on public.room_sessions
  for select to authenticated using (public.is_room_member(room_id));
create policy "members schedule sessions" on public.room_sessions
  for insert to authenticated with check (public.is_room_member(room_id) and status = 'scheduled');
create policy "members update sessions" on public.room_sessions
  for update to authenticated using (public.is_room_member(room_id)) with check (public.is_room_member(room_id));

-- Doubts: room members post and reply; only the asker can mark one resolved.
revoke update, delete on public.doubts from authenticated;
grant update (resolved) on public.doubts to authenticated;

create policy "members see doubts" on public.doubts
  for select to authenticated using (public.is_room_member(room_id));
create policy "members ask doubts" on public.doubts
  for insert to authenticated
  with check (author_id = auth.uid() and resolved = false and public.is_room_member(room_id));
create policy "asker resolves doubt" on public.doubts
  for update to authenticated
  using (author_id = auth.uid() and public.is_room_member(room_id))
  with check (author_id = auth.uid());

revoke update, delete on public.doubt_replies from authenticated;

create policy "members see replies" on public.doubt_replies
  for select to authenticated using (
    exists (select 1 from public.doubts d where d.id = doubt_id and public.is_room_member(d.room_id))
  );
create policy "members reply" on public.doubt_replies
  for insert to authenticated with check (
    author_id = auth.uid()
    and exists (select 1 from public.doubts d where d.id = doubt_id and public.is_room_member(d.room_id))
  );

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Reverse Matching candidates for one of the caller's requests: everyone else
-- who lists the requested skill, with the data the scorer needs. The ranking
-- itself (src/lib/matching.ts) runs in the app so the breakdown is explainable
-- and unit-tested.
create or replace function public.match_candidates(p_request_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'department', p.department,
    'year', p.year,
    'reputation', jsonb_build_object('rating', p.rating, 'sessions', p.sessions_count),
    'skills', (
      select jsonb_agg(jsonb_build_object(
        'name', s.name, 'level', s.level, 'tags', to_jsonb(s.tags), 'description', s.description))
      from public.skills s where s.profile_id = p.id
    ),
    'availability', coalesce((
      select jsonb_agg(jsonb_build_object('day', a.day, 'startHour', a.start_hour, 'endHour', a.end_hour))
      from public.availability a where a.profile_id = p.id
    ), '[]'::jsonb)
  )), '[]'::jsonb)
  from public.profiles p
  where p.id <> auth.uid()
    and exists (
      select 1
      from public.learning_requests r
      join public.skills s on lower(s.name) = lower(r.skill)
      where r.id = p_request_id and r.learner_id = auth.uid() and s.profile_id = p.id
    );
$$;

-- Learner connects with a chosen mentor. The mentor must teach the skill at a
-- higher level than the learner. Calling it twice returns the same room.
create or replace function public.create_room(p_request_id uuid, p_mentor_id uuid)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.learning_requests;
  v_room public.rooms;
begin
  select * into v_request
  from public.learning_requests
  where id = p_request_id and learner_id = auth.uid();
  if not found then
    raise exception 'Request not found' using errcode = 'no_data_found';
  end if;

  if p_mentor_id = auth.uid() then
    raise exception 'You cannot mentor yourself' using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from public.skills s
    where s.profile_id = p_mentor_id
      and lower(s.name) = lower(v_request.skill)
      and s.level > v_request.level
  ) then
    raise exception 'This mentor does not teach % above your level', v_request.skill
      using errcode = 'check_violation';
  end if;

  insert into public.rooms (request_id, mentor_id, learner_id, skill)
  values (v_request.id, p_mentor_id, v_request.learner_id, v_request.skill)
  on conflict (request_id, mentor_id) do update set status = public.rooms.status
  returning * into v_room;

  update public.learning_requests set status = 'matched' where id = v_request.id;
  return v_room;
end;
$$;

revoke execute on function public.create_room(uuid, uuid) from public, anon;
grant execute on function public.create_room(uuid, uuid) to authenticated;
revoke execute on function public.match_candidates(uuid) from public, anon;
grant execute on function public.match_candidates(uuid) to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: Doubt Corner updates appear without refreshing
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.doubts, public.doubt_replies;
  end if;
end;
$$;
