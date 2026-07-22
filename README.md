# TamayozCTF

A full-stack, production-ready Capture The Flag competition platform, inspired by CTFd and HackTheBox.

## Stack

- **Frontend:** React + Vite, TailwindCSS, React Router, Axios, Framer Motion, react-hot-toast, Socket.IO client
- **Backend:** Node.js, Express, better-sqlite3, JWT auth, bcryptjs, Multer, Socket.IO
- **Database:** SQLite

## Features

- User registration/login with JWT auth and bcrypt password hashing
- Challenge browser with category filters, search, difficulty badges
- Flag submission with animated correct/incorrect feedback and rate limiting
- Automatic scoring, First Blood detection, live scoreboard via Socket.IO
- Hint system (point-cost unlocking)
- Teams (create/join/leave)
- Announcements broadcast live to all connected users
- Profile pages with solve history
- Admin panel: create/edit/delete challenges, upload attachments, manage users, post announcements, reset scoreboard, export database as JSON
- Dark theme, responsive, animated UI
- 404 page, countdown timer, settings page

## Project Structure

```
TamayozCTF/
├── client/         # React + Vite frontend
├── server/         # Express backend + SQLite
├── docker-compose.yml
└── README.md
```

## Local Development

### 1. Backend

```bash
cd server
cp .env.example .env      # edit JWT_SECRET and admin credentials
npm install
npm run seed               # creates DB, admin user, demo challenges
npm run dev                 # http://localhost:5000
```

### 2. Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

Default admin login (from seed, unless overridden in `.env`):
```
username: admin
password: ChangeMe123!
```

Demo player login:
```
username: player1
password: Password123!
```

## Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000/api

Set `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_EMAIL` via a `.env` file at the project root or your shell environment before running compose.

## API Overview

| Method | Route | Description |
|---|---|---|
| POST | /api/auth/register | Register a new user |
| POST | /api/auth/login | Login, returns JWT |
| GET | /api/auth/me | Get current user |
| GET | /api/challenges | List visible challenges |
| GET | /api/challenges/:id | Challenge detail + hints |
| POST | /api/challenges/:id/submit | Submit a flag |
| POST | /api/challenges/hints/:hintId/unlock | Unlock a hint |
| GET | /api/scoreboard | Global scoreboard |
| GET | /api/announcements | List announcements |
| POST | /api/teams | Create a team |
| GET/PUT | /api/profile/:username, /api/profile/me | Profile management |
| * | /api/admin/* | Admin-only: challenges, users, categories, export, reset |

## Security Notes

- Passwords hashed with bcrypt (10 rounds)
- JWT-based auth with configurable expiry
- Rate limiting on auth and flag submission endpoints
- Server-side input validation via express-validator
- Admin routes protected by `admin` middleware in addition to `auth`
- Change `JWT_SECRET` and the default admin password before deploying

## License

MIT — built for educational and CTF hosting purposes.
