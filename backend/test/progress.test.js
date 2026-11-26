const test = require('node:test');
const assert = require('node:assert');
const { progressPercent, roomSummary, isParticipant } = require('../src/services/progress');

test('progress: empty or missing plan is 0%', () => {
  assert.strictEqual(progressPercent([]), 0);
  assert.strictEqual(progressPercent(undefined), 0);
});

test('progress: share of done items, rounded', () => {
  assert.strictEqual(progressPercent([{ done: true }, { done: false }, { done: false }]), 33);
  assert.strictEqual(progressPercent([{ done: true }, { done: true }]), 100);
});

test('roomSummary counts sessions by status', () => {
  const s = roomSummary({
    plan: [{ done: true }, { done: false }],
    sessions: [{ status: 'completed' }, { status: 'scheduled' }, { status: 'cancelled' }],
  });
  assert.deepStrictEqual(s, { progress: 50, completedSessions: 1, upcomingSessions: 1 });
});

test('isParticipant only allows the mentor or learner', () => {
  const room = { mentor: 'a1', learner: 'b2' };
  assert.ok(isParticipant(room, 'a1'));
  assert.ok(isParticipant(room, 'b2'));
  assert.ok(!isParticipant(room, 'c3'));
});
