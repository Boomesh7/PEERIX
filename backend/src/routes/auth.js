const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validateInstitutionalEmail, parseAllowedDomains } = require('../utils/institutionalEmail');

const router = express.Router();

function signToken(user) {
  return jwt.sign({ sub: String(user._id) }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/register  - only official institutional emails are accepted
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, department, year } = req.body;
    if (!name || !password) return res.status(400).json({ error: 'Name and password are required' });
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const check = validateInstitutionalEmail(email, parseAllowedDomains(process.env.ALLOWED_EMAIL_DOMAINS));
    if (!check.valid) return res.status(400).json({ error: check.reason });

    if (await User.findOne({ email: check.email })) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email: check.email, passwordHash, department, year });
    res.status(201).json({ token: signToken(user), user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: String(email || '').trim().toLowerCase() });
    const ok = user && (await bcrypt.compare(String(password || ''), user.passwordHash));
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });
    res.json({ token: signToken(user), user: user.toPublic() });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;
