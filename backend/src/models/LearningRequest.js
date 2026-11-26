const mongoose = require('mongoose');

const learningRequestSchema = new mongoose.Schema(
  {
    learner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skill: { type: String, required: true, trim: true },
    level: { type: Number, min: 1, max: 4, required: true }, // learner's current proficiency
    goal: { type: String, default: '' },
    slots: [
      {
        day: { type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
        startHour: { type: Number, min: 0, max: 23 },
        endHour: { type: Number, min: 1, max: 24 },
        _id: false,
      },
    ],
    status: { type: String, enum: ['open', 'matched', 'closed'], default: 'open' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LearningRequest', learningRequestSchema);
