const express = require('express');
const LearningRoom = require('../models/LearningRoom');
const LearningRequest = require('../models/LearningRequest');
const Doubt = require('../models/Doubt');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { roomSummary, isParticipant } = require('../services/progress');

const router = express.Router();
router.use(requireAuth);

// Loads a room and makes sure the caller belongs to it.
async function loadRoom(req, res) {
  const room = await LearningRoom.findById(req.params.id);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return null;
  }
  if (!isParticipant(room, req.userId)) {
    res.status(403).json({ error: 'You are not part of this room' });
    return null;
  }
  return room;
}

// POST /api/rooms  { requestId, mentorId } - learner connects with a chosen mentor
router.post('/', async (req, res) => {
  try {
    const { requestId, mentorId } = req.body;
    const request = await LearningRequest.findOne({ _id: requestId, learner: req.userId });
    if (!request) return res.status(404).json({ error: 'Request not found' });

    const mentor = await User.findById(mentorId);
    if (!mentor) return res.status(404).json({ error: 'Mentor not found' });
    if (String(mentor._id) === req.userId) return res.status(400).json({ error: 'You cannot mentor yourself' });

    const room = await LearningRoom.create({
      mentor: mentor._id,
      learner: req.userId,
      request: request._id,
      skill: request.skill,
    });
    request.status = 'matched';
    await request.save();
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ error: 'Could not create room' });
  }
});

// GET /api/rooms/mine
router.get('/mine', async (req, res) => {
  const rooms = await LearningRoom.find({ $or: [{ mentor: req.userId }, { learner: req.userId }] }).sort({ updatedAt: -1 });
  res.json(rooms.map((r) => ({ ...r.toObject(), summary: roomSummary(r) })));
});

// GET /api/rooms/:id
router.get('/:id', async (req, res) => {
  const room = await loadRoom(req, res);
  if (room) res.json({ ...room.toObject(), summary: roomSummary(room) });
});

// POST /api/rooms/:id/plan  { title }
router.post('/:id/plan', async (req, res) => {
  const room = await loadRoom(req, res);
  if (!room) return;
  if (!req.body.title) return res.status(400).json({ error: 'title is required' });
  room.plan.push({ title: req.body.title });
  await room.save();
  res.status(201).json({ ...room.toObject(), summary: roomSummary(room) });
});

// PATCH /api/rooms/:id/plan/:itemId  { done }
router.patch('/:id/plan/:itemId', async (req, res) => {
  const room = await loadRoom(req, res);
  if (!room) return;
  const item = room.plan.id(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Plan item not found' });
  item.done = Boolean(req.body.done);
  await room.save();
  res.json({ ...room.toObject(), summary: roomSummary(room) });
});

// POST /api/rooms/:id/sessions  { scheduledAt, durationMins, notes }
router.post('/:id/sessions', async (req, res) => {
  const room = await loadRoom(req, res);
  if (!room) return;
  const when = new Date(req.body.scheduledAt);
  if (Number.isNaN(when.getTime())) return res.status(400).json({ error: 'Valid scheduledAt is required' });
  room.sessions.push({ scheduledAt: when, durationMins: req.body.durationMins, notes: req.body.notes });
  await room.save();
  res.status(201).json({ ...room.toObject(), summary: roomSummary(room) });
});

// PATCH /api/rooms/:id/sessions/:sessionId  { status, notes }
router.patch('/:id/sessions/:sessionId', async (req, res) => {
  const room = await loadRoom(req, res);
  if (!room) return;
  const session = room.sessions.id(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (['scheduled', 'completed', 'cancelled'].includes(req.body.status)) session.status = req.body.status;
  if (typeof req.body.notes === 'string') session.notes = req.body.notes;
  await room.save();
  res.json({ ...room.toObject(), summary: roomSummary(room) });
});

// ---- Doubt Corner (persists after sessions end) ----

// GET /api/rooms/:id/doubts
router.get('/:id/doubts', async (req, res) => {
  const room = await loadRoom(req, res);
  if (!room) return;
  res.json(await Doubt.find({ room: room._id }).sort({ createdAt: -1 }));
});

// POST /api/rooms/:id/doubts  { text }
router.post('/:id/doubts', async (req, res) => {
  const room = await loadRoom(req, res);
  if (!room) return;
  if (!req.body.text) return res.status(400).json({ error: 'text is required' });
  const doubt = await Doubt.create({ room: room._id, author: req.userId, text: req.body.text });
  res.status(201).json(doubt);
});

// POST /api/rooms/:id/doubts/:doubtId/replies  { text }
router.post('/:id/doubts/:doubtId/replies', async (req, res) => {
  const room = await loadRoom(req, res);
  if (!room) return;
  const doubt = await Doubt.findOne({ _id: req.params.doubtId, room: room._id });
  if (!doubt) return res.status(404).json({ error: 'Doubt not found' });
  if (!req.body.text) return res.status(400).json({ error: 'text is required' });
  doubt.replies.push({ author: req.userId, text: req.body.text });
  await doubt.save();
  res.status(201).json(doubt);
});

// PATCH /api/rooms/:id/doubts/:doubtId/resolve - only the person who asked can resolve
router.patch('/:id/doubts/:doubtId/resolve', async (req, res) => {
  const room = await loadRoom(req, res);
  if (!room) return;
  const doubt = await Doubt.findOne({ _id: req.params.doubtId, room: room._id });
  if (!doubt) return res.status(404).json({ error: 'Doubt not found' });
  if (String(doubt.author) !== req.userId) return res.status(403).json({ error: 'Only the asker can resolve a doubt' });
  doubt.resolved = true;
  await doubt.save();
  res.json(doubt);
});

module.exports = router;
