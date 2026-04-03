require('dotenv').config();
const express       = require('express');
const cors          = require('cors');
const cookieSession = require('cookie-session');

const authRoutes   = require('./routes/auth');
const stravaRoutes = require('./routes/strava');
const whoopRoutes  = require('./routes/whoop');
const { stravaLimiter, whoopLimiter } = require('./middleware/rateLimiter');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// ── Cookie session ────────────────────────────────────────────────────────────
app.use(cookieSession({
  name: 'thsess',
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
  maxAge: 60 * 24 * 60 * 60 * 1000, // 60 days
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
}));

app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
// Mount under /api so both local dev (proxied) and Vercel (full path) work.
app.use('/api/auth',   authRoutes);
app.use('/api/strava', stravaLimiter, stravaRoutes);
app.use('/api/whoop',  whoopLimiter,  whoopRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({
  ok: true,
  ts: new Date().toISOString(),
  env: {
    STRAVA_CLIENT_ID:     !!process.env.STRAVA_CLIENT_ID,
    STRAVA_CLIENT_SECRET: !!process.env.STRAVA_CLIENT_SECRET,
    STRAVA_REDIRECT_URI:  !!process.env.STRAVA_REDIRECT_URI,
    WHOOP_CLIENT_ID:      !!process.env.WHOOP_CLIENT_ID,
    WHOOP_CLIENT_SECRET:  !!process.env.WHOOP_CLIENT_SECRET,
    WHOOP_REDIRECT_URI:   !!process.env.WHOOP_REDIRECT_URI,
    SESSION_SECRET:       !!process.env.SESSION_SECRET,
    FRONTEND_URL:         !!process.env.FRONTEND_URL,
  },
}));

module.exports = app;
