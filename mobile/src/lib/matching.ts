/**
 * Reverse Matching engine.
 *
 * The learner describes what they want to learn (skill, current level, goal,
 * preferred schedule). Every candidate mentor gets a score with a per-factor
 * breakdown, so each recommendation can be explained.
 *
 * Score = weighted sum of factors, each normalised to 0..1:
 *   proficiency  - mentor is above the learner, ideally by 1-2 levels
 *   availability - overlap between the learner's preferred slots and the mentor's
 *   reputation   - average peer rating, damped for mentors with few sessions
 *   goal         - keyword overlap between the learner's goal and the mentor's skill tags
 *
 * A mentor who does not teach the requested skill, or is not above the
 * learner, is excluded outright.
 */
import type { Match, MatchBreakdown, MentorCandidate, Reputation, Skill, Slot } from './types';

export const DEFAULT_WEIGHTS: MatchBreakdown = {
  proficiency: 0.3,
  availability: 0.3,
  reputation: 0.2,
  goal: 0.2,
};

export const MAX_LEVEL = 4; // 1 beginner .. 4 expert

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const normalizeName = (s: string | undefined) => String(s ?? '').trim().toLowerCase();

function tokenize(text: string | undefined): Set<string> {
  return new Set(
    String(text ?? '')
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((t) => t.length > 2)
  );
}

/** Mentor must be above the learner. A gap of 1-2 is ideal; larger gaps taper off. */
export function proficiencyScore(learnerLevel: number, mentorLevel: number): number {
  const gap = mentorLevel - learnerLevel;
  if (gap <= 0) return 0;
  if (gap === 1 || gap === 2) return 1;
  return clamp01(1 - (gap - 2) * 0.25);
}

/** Total overlapping hours divided by the hours the learner asked for. */
export function availabilityScore(learnerSlots: Slot[] | undefined, mentorSlots: Slot[] | undefined): number {
  if (!learnerSlots || learnerSlots.length === 0) return 0.5; // no preference stated
  if (!mentorSlots || mentorSlots.length === 0) return 0;

  let wanted = 0;
  let overlap = 0;
  for (const l of learnerSlots) {
    wanted += l.endHour - l.startHour;
    for (const m of mentorSlots) {
      if (m.day !== l.day) continue;
      const start = Math.max(l.startHour, m.startHour);
      const end = Math.min(l.endHour, m.endHour);
      if (end > start) overlap += end - start;
    }
  }
  return wanted === 0 ? 0 : clamp01(overlap / wanted);
}

/**
 * Bayesian-style average: pulls mentors with few sessions toward a neutral
 * prior, so one 5-star rating does not beat a long track record. A mentor with
 * no ratings yet (rating 0) gets the neutral prior.
 */
export function reputationScore(reputation: Reputation | undefined, priorRating = 3, priorWeight = 5): number {
  const rated = reputation && Number.isFinite(reputation.rating) && reputation.rating > 0;
  const rating = rated ? Number(reputation.rating) : priorRating;
  const sessions = rated && Number.isFinite(reputation.sessions) ? Number(reputation.sessions) : 0;
  const damped = (rating * sessions + priorRating * priorWeight) / (sessions + priorWeight);
  return clamp01(damped / 5);
}

/** Jaccard overlap between the goal text and the mentor's tags and description for that skill. */
export function goalScore(goalText: string | undefined, mentorSkill: Pick<Skill, 'tags' | 'description'>): number {
  const goal = tokenize(goalText);
  if (goal.size === 0) return 0.5; // nothing to compare against
  const mentorTerms = tokenize([...(mentorSkill.tags ?? []), mentorSkill.description ?? ''].join(' '));
  if (mentorTerms.size === 0) return 0;

  let shared = 0;
  for (const t of goal) if (mentorTerms.has(t)) shared++;
  const union = goal.size + mentorTerms.size - shared;
  return union === 0 ? 0 : clamp01(shared / union);
}

export interface MatchRequest {
  learnerId: string;
  skill: string;
  level: number;
  goal?: string;
  slots?: Slot[];
}

export interface RankOptions {
  weights?: Partial<MatchBreakdown>;
  limit?: number;
  minScore?: number;
}

export function rankMentors(request: MatchRequest, mentors: MentorCandidate[], opts: RankOptions = {}): Match[] {
  const weights = { ...DEFAULT_WEIGHTS, ...(opts.weights ?? {}) };
  const limit = opts.limit ?? 10;
  const minScore = opts.minScore ?? 0;
  const wantedSkill = normalizeName(request.skill);

  const results: Match[] = [];
  for (const mentor of mentors) {
    if (String(mentor.id) === String(request.learnerId)) continue; // never match someone with themselves

    const skill = (mentor.skills ?? []).find((s) => normalizeName(s.name) === wantedSkill);
    if (!skill) continue;

    const proficiency = proficiencyScore(request.level, skill.level);
    if (proficiency === 0) continue; // mentor is not above the learner

    const breakdown: MatchBreakdown = {
      proficiency,
      availability: availabilityScore(request.slots, mentor.availability),
      reputation: reputationScore(mentor.reputation),
      goal: goalScore(request.goal, skill),
    };

    const score =
      weights.proficiency * breakdown.proficiency +
      weights.availability * breakdown.availability +
      weights.reputation * breakdown.reputation +
      weights.goal * breakdown.goal;

    if (score >= minScore) {
      results.push({ mentorId: mentor.id, name: mentor.name, score: Number(score.toFixed(4)), breakdown, skill });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
