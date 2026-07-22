const express = require('express');
const path = require('path');
const db = require('../db/database');
const authMiddleware = require('../middleware/auth');
const { submitLimiter } = require('../middleware/rateLimit');
const { recalculateUserPoints } = require('../utils/scoring');

const router = express.Router();

// Get all visible challenges (with solved status for current user)
router.get('/', authMiddleware, (req, res) => {
  const challenges = db.prepare(`
    SELECT c.id, c.title, c.category_id, cat.name as category, cat.color as category_color,
           c.points, c.difficulty, c.file_path,
           (SELECT COUNT(*) FROM solves WHERE challenge_id = c.id) as solve_count
    FROM challenges c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.visible = 1
    ORDER BY c.points ASC
  `).all();

  const solvedIds = new Set(
    db.prepare('SELECT challenge_id FROM solves WHERE user_id = ?').all(req.user.id).map(r => r.challenge_id)
  );

  const result = challenges.map(c => ({ ...c, solved: solvedIds.has(c.id) }));
  res.json({ challenges: result });
});

router.get('/categories', authMiddleware, (req, res) => {
  const categories = db.prepare('SELECT * FROM categories ORDER BY name').all();
  res.json({ categories });
});

// Get single challenge detail (flag omitted)
router.get('/:id', authMiddleware, (req, res) => {
  const challenge = db.prepare(`
    SELECT c.id, c.title, c.category_id, cat.name as category, cat.color as category_color,
           c.description, c.points, c.difficulty, c.file_path, c.visible
    FROM challenges c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.id = ?
  `).get(req.params.id);

  if (!challenge || (!challenge.visible && !req.user.is_admin)) {
    return res.status(404).json({ error: 'Challenge not found' });
  }

  const solved = !!db.prepare('SELECT id FROM solves WHERE user_id = ? AND challenge_id = ?').get(req.user.id, challenge.id);
  const hints = db.prepare('SELECT id, cost FROM hints WHERE challenge_id = ?').all(challenge.id);
  const unlockedIds = new Set(
    db.prepare(`SELECT hint_id FROM unlocked_hints WHERE user_id = ?`).all(req.user.id).map(r => r.hint_id)
  );
  const hintsWithContent = hints.map(h => {
    const unlocked = unlockedIds.has(h.id);
    const full = unlocked ? db.prepare('SELECT content FROM hints WHERE id = ?').get(h.id).content : null;
    return { id: h.id, cost: h.cost, unlocked, content: full };
  });

  const firstBlood = db.prepare(`
    SELECT u.username FROM solves s JOIN users u ON s.user_id = u.id
    WHERE s.challenge_id = ? AND s.first_blood = 1
  `).get(challenge.id);

  res.json({ challenge: { ...challenge, solved, hints: hintsWithContent, first_blood: firstBlood ? firstBlood.username : null } });
});

// Submit flag
router.post('/:id/submit', authMiddleware, submitLimiter, (req, res) => {
  const { flag } = req.body;
  if (!flag || typeof flag !== 'string') return res.status(400).json({ error: 'Flag is required' });

  const challenge = db.prepare('SELECT * FROM challenges WHERE id = ?').get(req.params.id);
  if (!challenge || !challenge.visible) return res.status(404).json({ error: 'Challenge not found' });

  const alreadySolved = db.prepare('SELECT id FROM solves WHERE user_id = ? AND challenge_id = ?').get(req.user.id, challenge.id);
  if (alreadySolved) return res.status(400).json({ error: 'You already solved this challenge', correct: true, already: true });

  const correct = flag.trim() === challenge.flag.trim();

  db.prepare('INSERT INTO attempts (user_id, challenge_id, correct) VALUES (?, ?, ?)').run(req.user.id, challenge.id, correct ? 1 : 0);

  if (!correct) {
    return res.json({ correct: false, message: 'Incorrect flag. Keep trying!' });
  }

  const isFirstBlood = !db.prepare('SELECT id FROM solves WHERE challenge_id = ?').get(challenge.id);

  db.prepare('INSERT INTO solves (user_id, challenge_id, points, first_blood) VALUES (?, ?, ?, ?)')
    .run(req.user.id, challenge.id, challenge.points, isFirstBlood ? 1 : 0);

  const newTotal = recalculateUserPoints(req.user.id);

  const io = req.app.get('io');
  if (io) {
    io.emit('solve', {
      username: req.user.username,
      challenge: challenge.title,
      points: challenge.points,
      firstBlood: isFirstBlood
    });
    io.emit('scoreboard:update');
  }

  res.json({
    correct: true,
    message: isFirstBlood ? 'Correct! First Blood!' : 'Correct! Well done.',
    firstBlood: isFirstBlood,
    pointsAwarded: challenge.points,
    totalPoints: newTotal
  });
});

// Unlock a hint (costs points)
router.post('/hints/:hintId/unlock', authMiddleware, (req, res) => {
  const hint = db.prepare('SELECT * FROM hints WHERE id = ?').get(req.params.hintId);
  if (!hint) return res.status(404).json({ error: 'Hint not found' });

  const already = db.prepare('SELECT id FROM unlocked_hints WHERE user_id = ? AND hint_id = ?').get(req.user.id, hint.id);
  if (already) {
    return res.json({ content: hint.content, alreadyUnlocked: true });
  }

  if (req.user.points < hint.cost) {
    return res.status(400).json({ error: 'Not enough points to unlock this hint' });
  }

  db.prepare('INSERT INTO unlocked_hints (user_id, hint_id) VALUES (?, ?)').run(req.user.id, hint.id);
  db.prepare('UPDATE users SET points = points - ? WHERE id = ?').run(hint.cost, req.user.id);

  res.json({ content: hint.content, costPaid: hint.cost });
});

module.exports = router;
