require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./database');

function seed() {
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount > 0) {
    console.log('Database already seeded. Skipping.');
    return;
  }

  console.log('Seeding TamayozCTF database...');

  const adminPass = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 10);
  db.prepare(`INSERT INTO users (username, email, password, is_admin, points) VALUES (?, ?, ?, 1, 0)`)
    .run(process.env.ADMIN_USERNAME || 'admin', process.env.ADMIN_EMAIL || 'admin@tamayoz.local', adminPass);

  const demoPass = bcrypt.hashSync('Password123!', 10);
  db.prepare(`INSERT INTO users (username, email, password, is_admin, points) VALUES (?, ?, ?, 0, 0)`)
    .run('player1', 'player1@tamayoz.local', demoPass);

  const categories = ['Web', 'Crypto', 'Pwn', 'Reverse Engineering', 'Forensics', 'Misc'];
  const colors = ['#22d3ee', '#a78bfa', '#f472b6', '#fb923c', '#4ade80', '#facc15'];
  const catIds = {};
  categories.forEach((name, i) => {
    const info = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)').run(name, colors[i]);
    catIds[name] = info.lastInsertRowid;
  });

  const challenges = [
    {
      title: 'Welcome to Tamayoz',
      category: 'Misc',
      description: 'Every great hacker starts somewhere. The flag is hidden in plain sight:\n\n`TAMAYOZ{w3lc0m3_h4ck3r}`',
      points: 50,
      flag: 'TAMAYOZ{w3lc0m3_h4ck3r}',
      difficulty: 'easy'
    },
    {
      title: 'Basic Auth Bypass',
      category: 'Web',
      description: 'A login form that trusts the client a bit too much. Can you get in without valid credentials?',
      points: 150,
      flag: 'TAMAYOZ{cl13nt_s1d3_1s_n0t_s3cur1ty}',
      difficulty: 'easy'
    },
    {
      title: 'Caesar\'s Secret',
      category: 'Crypto',
      description: 'Julius left us a message: `PJTBGXKF{px6f4k_pbqxe6}`\nRotate to find the flag (flag format TAMAYOZ{...}).',
      points: 100,
      flag: 'TAMAYOZ{easy_cipher}',
      difficulty: 'easy'
    },
    {
      title: 'Stack Smash 101',
      category: 'Pwn',
      description: 'A classic buffer overflow awaits. Download the binary and overwrite the return address.',
      points: 300,
      flag: 'TAMAYOZ{buff3r_0v3rfl0w_101}',
      difficulty: 'medium'
    },
    {
      title: 'Reversed Intentions',
      category: 'Reverse Engineering',
      description: 'This binary checks your input character by character. Reverse it to find the valid flag.',
      points: 250,
      flag: 'TAMAYOZ{r3v3rs1ng_1s_fun}',
      difficulty: 'medium'
    },
    {
      title: 'Hidden in Pixels',
      category: 'Forensics',
      description: 'An innocent-looking image hides more than meets the eye. Extract the embedded data.',
      points: 200,
      flag: 'TAMAYOZ{st3g0_m4st3r}',
      difficulty: 'medium'
    },
    {
      title: 'SQL Injection Basics',
      category: 'Web',
      description: 'The login query concatenates user input directly. Bypass authentication with SQLi.',
      points: 200,
      flag: 'TAMAYOZ{1_0r_1_eq_1}',
      difficulty: 'medium'
    },
    {
      title: 'RSA Whisperer',
      category: 'Crypto',
      description: 'Small primes make for weak keys. Factor n and decrypt the ciphertext.',
      points: 350,
      flag: 'TAMAYOZ{f4ct0r1z4t10n_wins}',
      difficulty: 'hard'
    }
  ];

  const insertChallenge = db.prepare(`INSERT INTO challenges (title, category_id, description, points, flag, visible, difficulty) VALUES (?, ?, ?, ?, ?, 1, ?)`);
  const insertHint = db.prepare(`INSERT INTO hints (challenge_id, content, cost) VALUES (?, ?, ?)`);

  challenges.forEach((c) => {
    const info = insertChallenge.run(c.title, catIds[c.category], c.description, c.points, c.flag, c.difficulty);
    insertHint.run(info.lastInsertRowid, 'Read the challenge description carefully, the answer is closer than you think.', Math.max(10, Math.floor(c.points * 0.1)));
  });

  db.prepare('INSERT INTO announcements (title, content) VALUES (?, ?)').run(
    'Welcome to TamayozCTF!',
    'The competition is now live. Good luck and have fun. Remember: no attacking the infrastructure itself, only the challenges!'
  );

  console.log('Seed complete.');
  console.log(`Admin login -> username: ${process.env.ADMIN_USERNAME || 'admin'} / password: ${process.env.ADMIN_PASSWORD || 'ChangeMe123!'}`);
  console.log('Demo player -> username: player1 / password: Password123!');
}

seed();
