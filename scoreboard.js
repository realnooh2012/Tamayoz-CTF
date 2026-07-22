const express = require('express');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { getScoreboard } = require('../utils/scoring');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  res.json({ scoreboard: getScoreboard(100) });
});

router.get('/teams', authMiddleware, (req, res) => {
  const teams = db.prepare(`
    SELECT t.id, t.name, t.points,
      (SELECT COUNT(*) FROM users WHERE team_id = t.id) as member_count
    FROM teams t
    ORDER BY t.points DESC
  `).all();
  res.json({ teams });
});

module.exports = router;
