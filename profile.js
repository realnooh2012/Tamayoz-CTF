const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/:username', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, bio, avatar, points, created_at FROM users WHERE username = ?').get(req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const solves = db.prepare(`
    SELECT c.title, c.points, s.created_at, cat.name as category
    FROM solves s
    JOIN challenges c ON s.challenge_id = c.id
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
  `).all(user.id);

  res.json({ user, solves });
});

router.put('/me', authMiddleware, (req, res) => {
  const { bio, avatar } = req.body;
  db.prepare('UPDATE users SET bio = ?, avatar = ? WHERE id = ?').run(bio || '', avatar || '', req.user.id);
  res.json({ success: true });
});

router.put('/me/password', authMiddleware, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password)) return res.status(401).json({ error: 'Current password is incorrect' });

  const hashed = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id);
  res.json({ success: true });
});

module.exports = router;
