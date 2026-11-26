/**
 * Progress tracking for a learning room.
 * Progress is the share of plan items marked done (0-100, whole number).
 */
function progressPercent(plan) {
  if (!Array.isArray(plan) || plan.length === 0) return 0;
  const done = plan.filter((item) => item && item.done).length;
  return Math.round((done / plan.length) * 100);
}

/** Summary used on the room dashboard. */
function roomSummary(room) {
  const sessions = room.sessions || [];
  return {
    progress: progressPercent(room.plan),
    completedSessions: sessions.filter((s) => s.status === 'completed').length,
    upcomingSessions: sessions.filter((s) => s.status === 'scheduled').length,
  };
}

/** A room participant is either its mentor or its learner. */
function isParticipant(room, userId) {
  const id = String(userId);
  return String(room.mentor) === id || String(room.learner) === id;
}

module.exports = { progressPercent, roomSummary, isParticipant };
