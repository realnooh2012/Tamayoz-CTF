const db = require('../db/database');

function recalculateUserPoints(userId) {
  const total = db.prepare(`SELECT COALESCE(SUM(points), 0) as total FROM solves WHERE user_id = ?`).get(userId).total;
  db.prepare('UPDATE users SET points = ? WHERE id = ?').run(total, userId);
  return total;
}

function getScoreboard(limit = 100) {
  const users = db.prepare(`
    SELECT u.id, u.username, u.points, u.avatar,
      (SELECT COUNT(*) FROM solves s WHERE s.user_id = u.id) as solve_count,
      (SELECT MAX(created_at) FROM solves s WHERE s.user_id = u.id) as last_solve
    FROM users u
    WHERE u.is_admin = 0
    ORDER BY u.points DESC, last_solve ASC
    LIMIT ?
  `).all(limit);

  return users.map((u, i) => ({ ...u, rank: i + 1 }));
}

module.exports = { recalculateUserPoints, getScoreboard };
