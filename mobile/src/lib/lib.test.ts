import { describe, expect, it } from 'vitest';
import { availabilityScore, goalScore, proficiencyScore, rankMentors, reputationScore } from './matching';
import { otherParty, progressPercent, roomSummary } from './progress';
import { parseAllowedDomains, validateInstitutionalEmail } from './email';
import type { MentorCandidate } from './types';

const mentors: MentorCandidate[] = [
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

const pandasRequest = {
  learnerId: 'learner1',
  skill: 'Python',
  level: 1,
  goal: 'data analysis with pandas',
  slots: [{ day: 'Mon' as const, startHour: 18, endHour: 20 }],
};

describe('matching', () => {
  it('proficiency: mentor must be above learner; gap 1-2 is ideal', () => {
    expect(proficiencyScore(2, 2)).toBe(0);
    expect(proficiencyScore(2, 1)).toBe(0);
    expect(proficiencyScore(1, 2)).toBe(1);
    expect(proficiencyScore(1, 3)).toBe(1);
    expect(proficiencyScore(1, 4)).toBe(0.75);
  });

  it('availability: partial overlap is proportional', () => {
    const learner = [{ day: 'Mon' as const, startHour: 18, endHour: 20 }];
    expect(availabilityScore(learner, [{ day: 'Mon', startHour: 19, endHour: 21 }])).toBe(0.5);
    expect(availabilityScore(learner, [{ day: 'Tue', startHour: 18, endHour: 20 }])).toBe(0);
    expect(availabilityScore([], [])).toBe(0.5);
  });

  it('reputation: few sessions are pulled toward the neutral prior', () => {
    expect(reputationScore({ rating: 4.8, sessions: 30 })).toBeGreaterThan(reputationScore({ rating: 5, sessions: 1 }));
  });

  it('reputation: an unrated mentor gets the neutral prior, not zero', () => {
    expect(reputationScore({ rating: 0, sessions: 0 })).toBeCloseTo(0.6);
    expect(reputationScore(undefined)).toBeCloseTo(0.6);
  });

  it('goal: overlapping keywords score higher than none', () => {
    const skill = { tags: ['pandas', 'data'], description: 'Data analysis' };
    expect(goalScore('learn data analysis with pandas', skill)).toBeGreaterThan(goalScore('build mobile games', skill));
  });

  it('excludes the wrong skill, non-senior mentors and self', () => {
    expect(rankMentors(pandasRequest, mentors).map((r) => r.mentorId)).toEqual(['m1', 'm2']);
  });

  it('ranks the best fit first with an explainable breakdown', () => {
    const ranked = rankMentors({ ...pandasRequest, learnerId: 'x', skill: 'python' }, mentors);
    expect(ranked[0].mentorId).toBe('m1');
    expect(ranked[0].breakdown.availability).toBe(1);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    expect(ranked[0].skill.level).toBe(3);
  });

  it('never matches a user with themselves', () => {
    const ranked = rankMentors({ learnerId: 'm1', skill: 'Python', level: 1, goal: '', slots: [] }, mentors);
    expect(ranked.some((r) => r.mentorId === 'm1')).toBe(false);
  });

  it('respects the limit', () => {
    expect(rankMentors({ learnerId: 'x', skill: 'Python', level: 1 }, mentors, { limit: 1 })).toHaveLength(1);
  });
});

describe('progress', () => {
  it('empty or missing plan is 0%', () => {
    expect(progressPercent([])).toBe(0);
    expect(progressPercent(undefined)).toBe(0);
  });

  it('share of done items, rounded', () => {
    expect(progressPercent([{ done: true }, { done: false }, { done: false }])).toBe(33);
    expect(progressPercent([{ done: true }, { done: true }])).toBe(100);
  });

  it('roomSummary counts sessions by status', () => {
    expect(
      roomSummary({
        plan_items: [{ done: true }, { done: false }],
        room_sessions: [{ status: 'completed' }, { status: 'scheduled' }, { status: 'cancelled' }],
      })
    ).toEqual({ progress: 50, completedSessions: 1, upcomingSessions: 1 });
  });

  it('otherParty shows the other person from the viewer’s side', () => {
    const room = { mentor_id: 'a', mentor: { name: 'Asha' }, learner: { name: 'Lena' } };
    expect(otherParty(room, 'a')).toEqual({ role: 'learner', name: 'Lena' });
    expect(otherParty(room, 'b')).toEqual({ role: 'mentor', name: 'Asha' });
  });
});

describe('institutional email', () => {
  const domains = parseAllowedDomains('loyolacollege.edu, Example.ac.in');

  it('accepts an allowed domain and normalises it', () => {
    expect(validateInstitutionalEmail('  Student@LoyolaCollege.edu ', domains)).toEqual({
      valid: true,
      email: 'student@loyolacollege.edu',
    });
  });

  it('accepts subdomains of an allowed domain', () => {
    expect(validateInstitutionalEmail('a@cs.loyolacollege.edu', domains).valid).toBe(true);
  });

  it('rejects personal providers and look-alike domains', () => {
    expect(validateInstitutionalEmail('a@gmail.com', domains).valid).toBe(false);
    expect(validateInstitutionalEmail('a@evilloyolacollege.edu', domains).valid).toBe(false);
    expect(validateInstitutionalEmail('a@loyolacollege.edu.evil.com', domains).valid).toBe(false);
  });

  it('rejects malformed input and missing config', () => {
    expect(validateInstitutionalEmail('not-an-email', domains).valid).toBe(false);
    expect(validateInstitutionalEmail(undefined, domains).valid).toBe(false);
    expect(validateInstitutionalEmail('a@loyolacollege.edu', []).valid).toBe(false);
  });

  it('accepts a list of domains as loaded from the database', () => {
    expect(parseAllowedDomains(['LoyolaCollege.edu ', ''])).toEqual(['loyolacollege.edu']);
  });
});
