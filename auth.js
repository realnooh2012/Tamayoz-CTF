const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { registerValidation, loginValidation, handleValidation } = require('../utils/validators');

const router = express.Router();

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username, is_admin: user.is_admin },
    process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

router.post('/register', authLimiter, registerValidation, handleValidation, (req, res) => {
  const { username, email, password } = req.body;
  try {
    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) return res.status(409).json({ error: 'Username or email already taken' });

    const hashed = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)').run(username, email, hashed);
    const user = db.prepare('SELECT id, username, email, is_admin, points FROM users WHERE id = ?').get(info.lastInsertRowid);
    const token = signToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed', detail: err.message });
  }
});

router.post('/login', authLimiter, loginValidation, handleValidation, (req, res) => {
  const { username, password } = req.body;
  try {
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = bcrypt.compareSync(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);
    delete user.password;
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
