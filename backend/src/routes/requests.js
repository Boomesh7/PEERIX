const express = require('express');
const User = require('../models/User');
const LearningRequest = require('../models/LearningRequest');
const { requireAuth } = require('../middleware/auth');
const { rankMentors } = require('../services/matching');

const router = express.Router();
router.use(requireAuth);

// POST /api/requests - learner describes what they want to learn
router.post('/', async (req, res) => {
  try {
    const { skill, level, goal, slots } = req.body;
    if (!skill || !level) return res.status(400).json({ error: 'skill and level are required' });
    const request = await LearningRequest.create({ learner: req.userId, skill, level, goal, slots });
    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ error: 'Could not create request' });
  }
});

// GET /api/requests/mine
router.get('/mine', async (req, res) => {
  const list = await LearningRequest.find({ learner: req.userId }).sort({ createdAt: -1 });
  res.json(list);
});

// GET /api/requests/:id/matches - Reverse Matching: ranked mentor suggestions
router.get('/:id/matches', async (req, res) => {
  try {
    const request = await LearningRequest.findOne({ _id: req.params.id, learner: req.userId });
    if (!request) return res.status(404).json({ error: 'Request not found' });

    // Only users who list the requested skill are candidates (case-insensitive).
    const candidates = await User.find({
      _id: { $ne: req.userId },
      'skills.name': new RegExp(`^${escapeRegex(request.skill)}$`, 'i'),
    });

    const mentors = candidates.map((u) => ({
      id: String(u._id),
      name: u.name,
      skills: u.skills.map((s) => s.toObject()),
      availability: u.availability.map((a) => a.toObject()),
      reputation: u.reputation,
    }));

    const ranked = rankMentors(
      {
        learnerId: req.userId,
        skill: request.skill,
        level: request.level,
        goal: request.goal,
        slots: request.slots.map((s) => s.toObject()),
      },
      mentors,
      { limit: Number(req.query.limit) || 10 }
    );
    res.json(ranked);
  } catch (err) {
    res.status(500).json({ error: 'Could not compute matches' });
  }
});

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = router;
