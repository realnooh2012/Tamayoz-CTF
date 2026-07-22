const express = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');
const upload = require('../middleware/upload');
const { challengeValidation, handleValidation } = require('../utils/validators');

const router = express.Router();

router.use(authMiddleware, adminMiddleware);

// ---- Stats ----
router.get('/stats', (req, res) => {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE is_admin = 0').get().c;
  const challengeCount = db.prepare('SELECT COUNT(*) as c FROM challenges').get().c;
  const solveCount = db.prepare('SELECT COUNT(*) as c FROM solves').get().c;
  const teamCount = db.prepare('SELECT COUNT(*) as c FROM teams').get().c;
  res.json({ userCount, challengeCount, solveCount, teamCount });
});

// ---- Challenges CRUD ----
router.get('/challenges', (req, res) => {
  const challenges = db.prepare(`
    SELECT c.*, cat.name as category_name FROM challenges c
    LEFT JOIN categories cat ON c.category_id = cat.id
    ORDER BY c.id DESC
  `).all();
  res.json({ challenges });
});

router.post('/challenges', upload.single('file'), challengeValidation, handleValidation, (req, res) => {
  const { title, category_id, description, points, flag, difficulty, visible } = req.body;
  const file_path = req.file ? `/uploads/${req.file.filename}` : null;

  const info = db.prepare(`
    INSERT INTO challenges (title, category_id, description, points, flag, file_path, difficulty, visible)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title, category_id || null, description, points, flag, file_path, difficulty || 'easy', visible === 'false' ? 0 : 1);

  res.status(201).json({ challenge: db.prepare('SELECT * FROM challenges WHERE id = ?').get(info.lastInsertRowid) });
});

router.put('/challenges/:id', upload.single('file'), (req, res) => {
  const existing = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Challenge not found' });

  const { title, category_id, description, points, flag, difficulty, visible } = req.body;
  const file_path = req.file ? `/uploads/${req.file.filename}` : existing.file_path;

  db.prepare(`
    UPDATE challenges SET title = ?, category_id = ?, description = ?, points = ?, flag = ?,
      file_path = ?, difficulty = ?, visible = ? WHERE id = ?
  `).run(
    title ?? existing.title,
    category_id ?? existing.category_id,
    description ?? existing.description,
    points ?? existing.points,
    flag ?? existing.flag,
    file_path,
    difficulty ?? existing.difficulty,
    visible === undefined ? existing.visible : (visible === 'false' || visible === false ? 0 : 1),
    req.params.id
  );

  res.json({ challenge: db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id) });
});

router.delete('/challenges/:id', (req, res) => {
  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

  if (challenge.file_path) {
    const filePath = path.join(__dirname, '..', challenge.file_path.replace('/uploads/', 'uploads/'));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM challenges WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ---- Hints ----
router.post('/challenges/:id/hints', (req, res) => {
  const { content, cost } = req.body;
  if (!content) return res.status(400).json({ error: 'Hint content is required' });
  const info = db.prepare('INSERT INTO hints (challenge_id, content, cost) VALUES (?, ?, ?)').run(req.params.id, content, cost || 10);
  res.status(201).json({ hint: db.prepare('SELECT * FROM hints WHERE id = ?').get(info.lastInsertRowid) });
});

router.delete('/hints/:id', (req, res) => {
  db.prepare('DELETE FROM hints WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ---- Categories ----
router.post('/categories', (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name required' });
  try {
    const info = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)').run(name, color || '#22d3ee');
    res.status(201).json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid) });
  } catch (err) {
    res.status(409).json({ error: 'Category already exists' });
  }
});

router.delete('/categories/:id', (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ---- Users management ----
router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, username, email, is_admin, team_id, points, created_at FROM users ORDER BY points DESC').all();
  res.json({ users });
});

router.delete('/users/:id', (req, res) => {
  if (parseInt(req.params.id) === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.put('/users/:id/admin', (req, res) => {
  const { is_admin } = req.body;
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(is_admin ? 1 : 0, req.params.id);
  res.json({ success: true });
});

// ---- Scoreboard management ----
router.post('/scoreboard/reset', (req, res) => {
  db.prepare('DELETE FROM solves').run();
  db.prepare('DELETE FROM attempts').run();
  db.prepare('DELETE FROM unlocked_hints').run();
  db.prepare('UPDATE users SET points = 0').run();
  db.prepare('UPDATE teams SET points = 0').run();

  const io = req.app.get('io');
  if (io) io.emit('scoreboard:update');

  res.json({ success: true, message: 'Scoreboard has been reset' });
});

// ---- Export database ----
router.get('/export', (req, res) => {
  const data = {
    users: db.prepare('SELECT id, username, email, is_admin, team_id, points, created_at FROM users').all(),
    teams: db.prepare('SELECT * FROM teams').all(),
    categories: db.prepare('SELECT * FROM categories').all(),
    challenges: db.prepare('SELECT * FROM challenges').all(),
    solves: db.prepare('SELECT * FROM solves').all(),
    hints: db.prepare('SELECT * FROM hints').all(),
    announcements: db.prepare('SELECT * FROM announcements').all(),
    exported_at: new Date().toISOString()
  };
  res.setHeader('Content-Disposition', 'attachment; filename=tamayoz_export.json');
  res.json(data);
});

module.exports = router;
