-- Fix for projects that already ran 20261126000000_init.sql before it granted
-- table access. New Supabase projects give the API roles no access to new tables,
-- so the app saw "permission denied" everywhere. Safe to run more than once.

grant usage on schema public to anon, authenticated;
grant select on public.college_domains to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.skills, public.availability,
  public.learning_requests, public.rooms, public.plan_items, public.room_sessions,
  public.doubts, public.doubt_replies
  to authenticated;

-- Narrow the access again exactly as the init migration does.
revoke all on public.profiles, public.skills, public.availability, public.learning_requests,
  public.rooms, public.plan_items, public.room_sessions, public.doubts, public.doubt_replies
  from anon;
revoke insert, update, delete on public.college_domains from anon, authenticated;

revoke all on public.profiles from authenticated;
grant select (id, name, department, year, bio, rating, sessions_count, created_at)
  on public.profiles to authenticated;
grant update (name, department, year, bio) on public.profiles to authenticated;

revoke update on public.learning_requests from authenticated;
grant update (status) on public.learning_requests to authenticated;

revoke insert, update, delete on public.rooms from authenticated;
grant update (status) on public.rooms to authenticated;

revoke update on public.plan_items from authenticated;
grant update (title, done) on public.plan_items to authenticated;

revoke update, delete on public.room_sessions from authenticated;
grant update (scheduled_at, duration_mins, notes, status) on public.room_sessions to authenticated;

revoke update, delete on public.doubts from authenticated;
grant update (resolved) on public.doubts to authenticated;

revoke update, delete on public.doubt_replies from authenticated;
