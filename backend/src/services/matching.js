/**
 * Reverse Matching engine.
 *
 * The learner describes what they want to learn (skill, current level, goal,
 * preferred schedule). We score every candidate mentor and return a ranked
 * list with a per-factor breakdown so the recommendation is explainable.
 *
 * Score = weighted sum of factors, each normalised to 0..1:
 *   proficiency  - mentor is above the learner, ideally by 1-2 levels
 *   availability - overlap between learner's preferred slots and mentor's slots
 *   reputation   - average peer rating, damped for mentors with few sessions
 *   goal         - keyword overlap between learner goal and mentor skill tags
 *
 * A mentor who does not teach the requested skill is excluded outright.
 */

const DEFAULT_WEIGHTS = {
  proficiency: 0.3,
  availability: 0.3,
  reputation: 0.2,
  goal: 0.2,
};

// Skill levels: 1 = beginner, 2 = intermediate, 3 = advanced, 4 = expert
const MAX_LEVEL = 4;

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function normalizeName(s) {
  return String(s || '').trim().toLowerCase();
}

function tokenize(text) {
  return new Set(
    String(text || '')
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/)
      .filter((t) => t.length > 2)
  );
}

/** Mentor must be above the learner. Gap of 1-2 is ideal; larger gaps taper off. */
function proficiencyScore(learnerLevel, mentorLevel) {
  const gap = mentorLevel - learnerLevel;
  if (gap <= 0) return 0;
  if (gap === 1 || gap === 2) return 1;
  // gap 3 (e.g. beginner with expert): still useful but less relatable
  return clamp01(1 - (gap - 2) * 0.25);
}

/** Total overlapping hours divided by hours the learner asked for. */
function availabilityScore(learnerSlots, mentorSlots) {
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
 * prior so one 5-star rating does not beat a long track record.
 */
function reputationScore(reputation, priorRating = 3, priorWeight = 5) {
  const rating = reputation && Number.isFinite(reputation.rating) ? reputation.rating : priorRating;
  const sessions = reputation && Number.isFinite(reputation.sessions) ? reputation.sessions : 0;
  const damped = (rating * sessions + priorRating * priorWeight) / (sessions + priorWeight);
  return clamp01(damped / 5);
}

/** Jaccard overlap between goal text and the mentor's tags/bio for that skill. */
function goalScore(goalText, mentorSkill) {
  const goal = tokenize(goalText);
  if (goal.size === 0) return 0.5; // nothing to compare against
  const mentorTerms = tokenize([...(mentorSkill.tags || []), mentorSkill.description || ''].join(' '));
  if (mentorTerms.size === 0) return 0;

  let shared = 0;
  for (const t of goal) if (mentorTerms.has(t)) shared++;
  const union = goal.size + mentorTerms.size - shared;
  return union === 0 ? 0 : clamp01(shared / union);
}

/**
 * @param {object} request  { learnerId, skill, level, goal, slots: [{day,startHour,endHour}] }
 * @param {object[]} mentors [{ id, name, skills:[{name,level,tags,description}], availability, reputation:{rating,sessions} }]
 * @param {object} [opts]   { weights, limit, minScore }
 * @returns {object[]} ranked [{ mentorId, name, score, breakdown }]
 */
function rankMentors(request, mentors, opts = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...(opts.weights || {}) };
  const limit = opts.limit ?? 10;
  const minScore = opts.minScore ?? 0;
  const wantedSkill = normalizeName(request.skill);

  const results = [];
  for (const mentor of mentors) {
    if (String(mentor.id) === String(request.learnerId)) continue; // never match someone with themselves

    const skill = (mentor.skills || []).find((s) => normalizeName(s.name) === wantedSkill);
    if (!skill) continue;

    const proficiency = proficiencyScore(request.level, skill.level);
    if (proficiency === 0) continue; // mentor is not above the learner

    const breakdown = {
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
      results.push({ mentorId: mentor.id, name: mentor.name, score: Number(score.toFixed(4)), breakdown });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

module.exports = {
  rankMentors,
  proficiencyScore,
  availabilityScore,
  reputationScore,
  goalScore,
  DEFAULT_WEIGHTS,
  MAX_LEVEL,
};
