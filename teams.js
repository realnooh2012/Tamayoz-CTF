const express = require('express');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, (req, res) => {
  const { name } = req.body;
  if (!name || name.trim().length < 3) return res.status(400).json({ error: 'Team name must be at least 3 characters' });

  const existing = db.prepare('SELECT id FROM teams WHERE name = ?').get(name);
  if (existing) return res.status(409).json({ error: 'Team name already taken' });

  const info = db.prepare('INSERT INTO teams (name, captain_id) VALUES (?, ?)').run(name.trim(), req.user.id);
  db.prepare('UPDATE users SET team_id = ? WHERE id = ?').run(info.lastInsertRowid, req.user.id);

  res.status(201).json({ team: db.prepare('SELECT * FROM teams WHERE id = ?').get(info.lastInsertRowid) });
});

router.post('/:id/join', authMiddleware, (req, res) => {
  const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });

  db.prepare('UPDATE users SET team_id = ? WHERE id = ?').run(team.id, req.user.id);
  res.json({ success: true, team });
});

router.post('/leave', authMiddleware, (req, res) => {
  db.prepare('UPDATE users SET team_id = NULL WHERE id = ?').run(req.user.id);
  res.json({ success: true });
});

module.exports = router;
