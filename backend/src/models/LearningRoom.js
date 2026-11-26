const mongoose = require('mongoose');

const planItemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  done: { type: Boolean, default: false },
});

const sessionSchema = new mongoose.Schema({
  scheduledAt: { type: Date, required: true },
  durationMins: { type: Number, default: 60, min: 15, max: 240 },
  notes: { type: String, default: '' },
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
});

// One room per mentor-learner connection.
const learningRoomSchema = new mongoose.Schema(
  {
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    learner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    request: { type: mongoose.Schema.Types.ObjectId, ref: 'LearningRequest', required: true },
    skill: { type: String, required: true },
    plan: [planItemSchema],
    sessions: [sessionSchema],
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LearningRoom', learningRoomSchema);
