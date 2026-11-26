const test = require('node:test');
const assert = require('node:assert');
const {
  rankMentors,
  proficiencyScore,
  availabilityScore,
  reputationScore,
  goalScore,
} = require('../src/services/matching');

const mentors = [
  {
    id: 'm1',
    name: 'Asha',
    skills: [{ name: 'Python', level: 3, tags: ['pandas', 'data', 'analysis'], description: 'Data analysis' }],
    availability: [{ day: 'Mon', startHour: 18, endHour: 20 }],
    reputation: { rating: 4.8, sessions: 30 },
  },
  {
    id: 'm2',
    name: 'Ravi',
    skills: [{ name: 'python', level: 2, tags: ['flask', 'web'], description: 'Web backends' }],
    availability: [{ day: 'Tue', startHour: 10, endHour: 12 }],
    reputation: { rating: 5, sessions: 1 },
  },
  {
    id: 'm3',
    name: 'Meena',
    skills: [{ name: 'Java', level: 4, tags: [], description: '' }],
    availability: [{ day: 'Mon', startHour: 18, endHour: 20 }],
    reputation: { rating: 5, sessions: 50 },
  },
  {
    id: 'm4',
    name: 'Karan',
    skills: [{ name: 'Python', level: 1, tags: [], description: '' }],
    availability: [{ day: 'Mon', startHour: 18, endHour: 20 }],
    reputation: { rating: 5, sessions: 50 },
  },
];

test('proficiency: mentor must be above learner; gap 1-2 is ideal', () => {
  assert.strictEqual(proficiencyScore(2, 2), 0);
  assert.strictEqual(proficiencyScore(2, 1), 0);
  assert.strictEqual(proficiencyScore(1, 2), 1);
  assert.strictEqual(proficiencyScore(1, 3), 1);
  assert.strictEqual(proficiencyScore(1, 4), 0.75);
});

test('availability: partial overlap is proportional', () => {
  const learner = [{ day: 'Mon', startHour: 18, endHour: 20 }];
  assert.strictEqual(availabilityScore(learner, [{ day: 'Mon', startHour: 19, endHour: 21 }]), 0.5);
  assert.strictEqual(availabilityScore(learner, [{ day: 'Tue', startHour: 18, endHour: 20 }]), 0);
  assert.strictEqual(availabilityScore([], []), 0.5);
});

test('reputation: few sessions are pulled toward the neutral prior', () => {
  const oneReview = reputationScore({ rating: 5, sessions: 1 });
  const proven = reputationScore({ rating: 4.8, sessions: 30 });
  assert.ok(proven > oneReview);
});

test('goal: overlapping keywords score higher than none', () => {
  const skill = { tags: ['pandas', 'data'], description: 'Data analysis' };
  assert.ok(goalScore('learn data analysis with pandas', skill) > goalScore('build mobile games', skill));
});

test('rankMentors: excludes wrong skill, non-senior mentors and self', () => {
  const request = {
    learnerId: 'learner1',
    skill: 'Python',
    level: 1,
    goal: 'data analysis with pandas',
    slots: [{ day: 'Mon', startHour: 18, endHour: 20 }],
  };
  const ranked = rankMentors(request, mentors);
  const ids = ranked.map((r) => r.mentorId);
  assert.deepStrictEqual(ids, ['m1', 'm2']); // Java mentor and same-level mentor excluded
});

test('rankMentors: best fit ranks first and returns an explainable breakdown', () => {
  const ranked = rankMentors(
    {
      learnerId: 'x',
      skill: 'python',
      level: 1,
      goal: 'data analysis with pandas',
      slots: [{ day: 'Mon', startHour: 18, endHour: 20 }],
    },
    mentors
  );
  assert.strictEqual(ranked[0].mentorId, 'm1');
  assert.ok(ranked[0].breakdown.availability === 1);
  assert.ok(ranked[0].score > ranked[1].score);
});

test('rankMentors: never matches a user with themselves', () => {
  const ranked = rankMentors({ learnerId: 'm1', skill: 'Python', level: 1, goal: '', slots: [] }, mentors);
  assert.ok(!ranked.some((r) => r.mentorId === 'm1'));
});

test('rankMentors: respects limit', () => {
  const ranked = rankMentors({ learnerId: 'x', skill: 'Python', level: 1, goal: '', slots: [] }, mentors, { limit: 1 });
  assert.strictEqual(ranked.length, 1);
});
