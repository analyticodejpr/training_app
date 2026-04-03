require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes   = require('./routes/auth');
const stravaRoutes = require('./routes/strava');
const whoopRoutes  = require('./routes/whoop');
const { stravaLimiter, whoopLimiter } = require('./middleware/rateLimiter');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',   authRoutes);
app.use('/api/strava', stravaLimiter, stravaRoutes);
app.use('/api/whoop',  whoopLimiter,  whoopRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));

module.exports = app;
