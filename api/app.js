require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const { decrypt } = require('./tokenCrypto');

const authRoutes    = require('./routes/auth');
const stravaRoutes  = require('./routes/strava');
const whoopRoutes   = require('./routes/whoop');
const webhookRoutes = require('./routes/webhooks');
const plannerRoutes = require('./routes/planner');
const { stravaLimiter, whoopLimiter } = require('./middleware/rateLimiter');

const app = express();
app.set('trust proxy', 1);

// ── CORS ──────────────────────────────────────────────────────────────────────
// In production FRONTEND_URL is the single allowed origin.
// In local dev, also allow :3000–:3002 in case Vite falls back to a different port.
const allowedOrigins = new Set(
  [process.env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002']
    .filter(Boolean)
);
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.has(origin)),
  credentials: true,
}));

// Capture the raw request body for WHOOP webhook HMAC verification.
// The Buffer is stored as req.rawBody before express.json() consumes the stream.
app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));

// ── Session from Bearer token ─────────────────────────────────────────────────
// The frontend stores an encrypted session token in localStorage and sends it
// as "Authorization: Bearer <token>" on every request. We decrypt it here and
// attach the result to req.session so routes work the same way as before.
app.use((req, res, next) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  req.session = token ? (decrypt(token) || {}) : {};
  // Provide a way for auth routes to send back an updated token
  res.setSession = (data) => {
    res.setHeader('X-Session-Token', require('./tokenCrypto').encrypt(data));
  };
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/strava',   stravaLimiter, stravaRoutes);
app.use('/api/whoop',    whoopLimiter,  whoopRoutes);
// Webhook routes: no rate limiter, no session middleware — called by Strava/WHOOP servers
app.use('/api/webhooks', webhookRoutes);
app.use('/api/planner',  plannerRoutes);

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
