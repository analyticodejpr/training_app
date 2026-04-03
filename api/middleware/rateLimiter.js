const rateLimit = require('express-rate-limit');

// Strava: 200 requests per 15 min per API consumer
// We stay well under by limiting our own server to 100/15-min
const stravaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many Strava requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// WHOOP: conservative 60 req/min
const whoopLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many WHOOP requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { stravaLimiter, whoopLimiter };
