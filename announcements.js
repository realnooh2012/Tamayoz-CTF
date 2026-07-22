const express = require('express');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/admin');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const announcements = db.prepare('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50').all();
  res.json({ announcements });
});

router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });

  const info = db.prepare('INSERT INTO announcements (title, content) VALUES (?, ?)').run(title, content);
  const announcement = db.prepare('SELECT * FROM announcements WHERE id = ?').get(info.lastInsertRowid);

  const io = req.app.get('io');
  if (io) io.emit('announcement', announcement);

  res.status(201).json({ announcement });
});

router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
