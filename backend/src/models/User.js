const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    level: { type: Number, min: 1, max: 4, required: true }, // 1 beginner .. 4 expert
    tags: [{ type: String, trim: true }],
    description: { type: String, default: '' },
  },
  { _id: false }
);

const slotSchema = new mongoose.Schema(
  {
    day: { type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], required: true },
    startHour: { type: Number, min: 0, max: 23, required: true },
    endHour: { type: Number, min: 1, max: 24, required: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    department: { type: String, default: '' },
    year: { type: Number, min: 1, max: 6 },
    // Skills this student can teach (mentor profile). Learners become mentors over time.
    skills: [skillSchema],
    availability: [slotSchema],
    reputation: {
      rating: { type: Number, default: 0 },
      sessions: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    department: this.department,
    year: this.year,
    skills: this.skills,
    availability: this.availability,
    reputation: this.reputation,
  };
};

module.exports = mongoose.model('User', userSchema);
