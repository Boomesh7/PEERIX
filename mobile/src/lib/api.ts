/** Data access for PEERIX. Every call runs as the signed-in student; RLS decides what they may see or change. */
import { supabase } from './supabase';
import { rankMentors } from './matching';
import type {
  AvailabilityRow,
  Day,
  Doubt,
  LearningRequest,
  Match,
  MentorCandidate,
  Profile,
  Room,
  SkillRow,
  Slot,
} from './types';

// Profiles expose only these columns to other students (email stays private).
const PROFILE_COLUMNS = 'id, name, department, year, bio, rating, sessions_count';
const ROOM_SELECT =
  '*, mentor:profiles!rooms_mentor_id_fkey(name), learner:profiles!rooms_learner_id_fkey(name), plan_items(id, title, done, created_at), room_sessions(id, scheduled_at, duration_mins, notes, status)';

function unwrap<T>(result: { data: unknown; error: { message: string } | null }): T {
  if (result.error) throw new Error(friendlyError(result.error.message));
  return result.data as T;
}

/** Turns database errors into messages a student can act on. */
export function friendlyError(message: string): string {
  if (/database error saving new user/i.test(message)) return 'Please use your official institutional email ID';
  if (/row-level security|permission denied/i.test(message)) return 'You do not have access to do that';
  return message;
}

// ---- Auth ----

export async function getAllowedDomains(): Promise<string[]> {
  const rows = unwrap<Array<{ domain: string }>>(await supabase.from('college_domains').select('domain'));
  return rows.map((r) => r.domain);
}

export async function sendLoginCode(email: string, name?: string) {
  unwrap(
    await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true, data: name ? { name } : undefined },
    })
  );
}

export async function verifyLoginCode(email: string, token: string) {
  unwrap(await supabase.auth.verifyOtp({ email, token, type: 'email' }));
}

// ---- Profile, skills, availability ----

export async function getProfile(userId: string): Promise<Profile> {
  return unwrap(await supabase.from('profiles').select(PROFILE_COLUMNS).eq('id', userId).single());
}

export async function updateProfile(userId: string, patch: Partial<Pick<Profile, 'name' | 'department' | 'year' | 'bio'>>) {
  unwrap(await supabase.from('profiles').update(patch).eq('id', userId));
}

export async function listSkills(userId: string): Promise<SkillRow[]> {
  return unwrap(
    await supabase.from('skills').select('id, name, level, tags, description').eq('profile_id', userId).order('name')
  );
}

export async function addSkill(skill: { name: string; level: number; tags: string[]; description: string }) {
  unwrap(await supabase.from('skills').insert(skill));
}

export async function removeSkill(id: string) {
  unwrap(await supabase.from('skills').delete().eq('id', id));
}

export async function listAvailability(userId: string): Promise<AvailabilityRow[]> {
  return unwrap(
    await supabase.from('availability').select('id, day, start_hour, end_hour').eq('profile_id', userId)
  );
}

export async function addAvailability(slot: { day: Day; start_hour: number; end_hour: number }) {
  unwrap(await supabase.from('availability').insert(slot));
}

export async function removeAvailability(id: string) {
  unwrap(await supabase.from('availability').delete().eq('id', id));
}

// ---- Learning requests and Reverse Matching ----

export async function listMyRequests(userId: string): Promise<LearningRequest[]> {
  return unwrap(
    await supabase.from('learning_requests').select('*').eq('learner_id', userId).order('created_at', { ascending: false })
  );
}

export async function getRequest(id: string): Promise<LearningRequest> {
  return unwrap(await supabase.from('learning_requests').select('*').eq('id', id).single());
}

export async function createRequest(input: { skill: string; level: number; goal: string; slots: Slot[] }): Promise<LearningRequest> {
  return unwrap(await supabase.from('learning_requests').insert(input).select().single());
}

export async function setRequestStatus(id: string, status: LearningRequest['status']) {
  unwrap(await supabase.from('learning_requests').update({ status }).eq('id', id));
}

/** Candidates come from the database; ranking runs here so every score is explainable. */
export async function getMatches(request: LearningRequest): Promise<Match[]> {
  const candidates = unwrap<MentorCandidate[]>(await supabase.rpc('match_candidates', { p_request_id: request.id }));
  return rankMentors(
    { learnerId: request.learner_id, skill: request.skill, level: request.level, goal: request.goal, slots: request.slots },
    candidates
  );
}

// ---- Learning Rooms ----

export async function connectWithMentor(requestId: string, mentorId: string): Promise<{ id: string }> {
  return unwrap(await supabase.rpc('create_room', { p_request_id: requestId, p_mentor_id: mentorId }));
}

export async function listMyRooms(): Promise<Room[]> {
  return unwrap(await supabase.from('rooms').select(ROOM_SELECT).order('created_at', { ascending: false }));
}

export async function getRoom(id: string): Promise<Room> {
  const room = unwrap<Room>(await supabase.from('rooms').select(ROOM_SELECT).eq('id', id).single());
  room.plan_items.sort((a, b) => a.created_at.localeCompare(b.created_at));
  room.room_sessions.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  return room;
}

export async function setRoomStatus(id: string, status: Room['status']) {
  unwrap(await supabase.from('rooms').update({ status }).eq('id', id));
}

export async function addPlanItem(roomId: string, title: string) {
  unwrap(await supabase.from('plan_items').insert({ room_id: roomId, title }));
}

export async function setPlanItemDone(id: string, done: boolean) {
  unwrap(await supabase.from('plan_items').update({ done }).eq('id', id));
}

export async function scheduleSession(roomId: string, scheduledAt: string, durationMins: number, notes: string) {
  unwrap(
    await supabase
      .from('room_sessions')
      .insert({ room_id: roomId, scheduled_at: scheduledAt, duration_mins: durationMins, notes })
  );
}

export async function setSessionStatus(id: string, status: 'completed' | 'cancelled') {
  unwrap(await supabase.from('room_sessions').update({ status }).eq('id', id));
}

// ---- Doubt Corner ----

export async function listDoubts(roomId: string): Promise<Doubt[]> {
  const doubts = unwrap<Doubt[]>(
    await supabase
      .from('doubts')
      .select('*, author:profiles(name), doubt_replies(id, body, created_at, author_id, author:profiles(name))')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
  );
  for (const d of doubts) d.doubt_replies.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return doubts;
}

export async function askDoubt(roomId: string, body: string) {
  unwrap(await supabase.from('doubts').insert({ room_id: roomId, body }));
}

export async function replyToDoubt(doubtId: string, body: string) {
  unwrap(await supabase.from('doubt_replies').insert({ doubt_id: doubtId, body }));
}

export async function resolveDoubt(id: string) {
  unwrap(await supabase.from('doubts').update({ resolved: true }).eq('id', id));
}
