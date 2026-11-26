/** Progress tracking for a Learning Room. */

/** Share of plan items marked done, 0-100, whole number. */
export function progressPercent(plan: Array<{ done: boolean }> | undefined | null): number {
  if (!Array.isArray(plan) || plan.length === 0) return 0;
  const done = plan.filter((item) => item && item.done).length;
  return Math.round((done / plan.length) * 100);
}

export interface RoomSummary {
  progress: number;
  completedSessions: number;
  upcomingSessions: number;
}

/** Summary shown on the room card and room page. */
export function roomSummary(room: {
  plan_items?: Array<{ done: boolean }>;
  room_sessions?: Array<{ status: string }>;
}): RoomSummary {
  const sessions = room.room_sessions ?? [];
  return {
    progress: progressPercent(room.plan_items),
    completedSessions: sessions.filter((s) => s.status === 'completed').length,
    upcomingSessions: sessions.filter((s) => s.status === 'scheduled').length,
  };
}

/** The other person in a room, from the viewer's side. */
export function otherParty(
  room: { mentor_id: string; mentor: { name: string } | null; learner: { name: string } | null },
  userId: string
): { role: 'mentor' | 'learner'; name: string } {
  return room.mentor_id === userId
    ? { role: 'learner', name: room.learner?.name ?? 'Learner' }
    : { role: 'mentor', name: room.mentor?.name ?? 'Mentor' };
}
