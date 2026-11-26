# PEERIX - Learn. Teach. Pass It On.

A verified peer-to-peer skill exchange and learning platform for college students.

## Phase 1 scope (Review 1)
- **Verified sign-up**: passwordless email login codes, restricted to official institutional email IDs
- **Mentor profiles**: students list the skills they can teach, their level and when they are free
- **Learning requests**: a learner posts a skill, current level, goal and preferred times
- **Reverse Matching**: ranked mentor suggestions with an explainable score breakdown
- **Learning Rooms**: shared study plan, scheduled sessions and progress tracking
- **Doubt Corner**: threaded doubts per room, updated live, that stay open after sessions end

Planned for later phases: ratings and reputation, skill assessments, skill credits,
Teach-to-Learn prompts, moderation and reporting.

## Tech stack (₹0 to build and host)

| Layer | Technology | Role |
|---|---|---|
| Mobile app | React Native, Expo SDK 58, Expo Router, TypeScript | Android, iOS and web from one codebase |
| Data loading | TanStack Query | Caching and refetching |
| Database | Supabase (PostgreSQL) | Tables, functions, row level security |
| Auth | Supabase Auth (email OTP) | 6-digit login codes, college domains only |
| Realtime | Supabase Realtime | Live Doubt Corner |
| Tests | Vitest, PGlite (in-memory Postgres) | Logic tests and database security tests |

## Project layout

```
supabase/migrations/        database schema, security rules and RPCs
mobile/src/app/             screens (Expo Router): login, Learn, Rooms, Profile tabs,
                            requests/[id] (matches), rooms/[id] (plan, sessions, Doubt Corner)
mobile/src/lib/             Supabase client, data access, matching, progress, email check
mobile/src/components/ui.tsx  shared UI building blocks
mobile/tests/db.test.ts     runs the migration on PGlite and checks every security rule
```

## Set up

1. Create a free project at [supabase.com](https://supabase.com).
2. In the project's **SQL Editor**, run `supabase/migrations/20261126000000_init.sql`.
   It allows `loyolacollege.edu` sign-ups; add other domains with
   `insert into college_domains values ('your.college.edu');`.
3. **Authentication → Email templates → Magic Link**: include `{{ .Token }}` so the email
   contains the 6-digit code. Supabase's built-in email sender is limited to a few emails an
   hour; for a pilot, set a free SMTP provider under **Authentication → SMTP Settings**.
4. Copy `mobile/.env.example` to `mobile/.env` and fill in the project URL and publishable (anon) key
   from **Project Settings → API**.
5. Run the app:

```
cd mobile
npm install
npx expo start     # scan the QR code with Expo Go on your phone, or press w for web
npm test           # logic + database security tests (no Supabase project needed)
npm run typecheck
```

## How access is enforced

Every rule lives in the database, so it holds no matter which client calls the API:

- Sign-up fails unless the email is on an allowed domain (or its subdomain); look-alikes such as `evilloyolacollege.edu` are refused.
- Students can see each other's name, department, year, bio and reputation, never email addresses.
- Students edit only their own profile, skills and free times, and can never change their own reputation.
- A learning request is visible only to its learner and to mentors connected to it.
- Rooms are created only through `create_room()`, which checks the mentor teaches the skill above the learner's level.
- Plan items, sessions and doubts are visible only to the room's learner and mentor.
- Only the student who asked a doubt can mark it resolved.

## Reverse Matching score

Score = 0.30 proficiency + 0.30 availability + 0.20 reputation + 0.20 goal fit

- **Proficiency**: mentor must be above the learner; a gap of 1-2 levels is ideal.
- **Availability**: overlap of the learner's preferred times with the mentor's free times.
- **Reputation**: peer rating, damped for mentors with few sessions; unrated mentors get a neutral score.
- **Goal fit**: keyword overlap between the learner's goal and the mentor's skill topics.

Mentors who do not teach the requested skill, or are not above the learner, are excluded.
`match_candidates()` returns the candidates from the database and `mobile/src/lib/matching.ts`
ranks them, so every score's breakdown is shown to the learner.
