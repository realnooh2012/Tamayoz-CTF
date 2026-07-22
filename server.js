require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const { apiLimiter } = require('./middleware/rateLimit');

const authRoutes = require('./routes/auth');
const challengeRoutes = require('./routes/challenges');
const scoreboardRoutes = require('./routes/scoreboard');
const adminRoutes = require('./routes/admin');
const announcementRoutes = require('./routes/announcements');
const teamRoutes = require('./routes/teams');
const profileRoutes = require('./routes/profile');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] }
});
app.set('io', io);

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/scoreboard', scoreboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/profile', profileRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', name: 'TamayozCTF API' }));

io.on('connection', (socket) => {
  socket.on('disconnect', () => {});
});

// 404 handler
app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`TamayozCTF API running on port ${PORT}`);
});
