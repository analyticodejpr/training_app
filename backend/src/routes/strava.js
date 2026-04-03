const express = require('express');
const strava  = require('../services/stravaService');

const router = express.Router();

// Build a per-request token store backed by the user's cookie session.
// When the service refreshes a token, save() writes it back to req.session
// so the updated token is persisted in the cookie for the next request.
function makeTokenStore(req) {
  return {
    get:  (provider) => req.session[provider] || null,
    save: (provider, data) => { req.session[provider] = data; },
  };
}

function handle(fn) {
  return async (req, res) => {
    try {
      const data = await fn(req, makeTokenStore(req));
      res.json(data);
    } catch (err) {
      const status = err.message.includes('not connected') ? 401 : 500;
      res.status(status).json({ error: err.message });
    }
  };
}

router.get('/athlete',      handle((req, ts) => strava.getAthlete(ts)));
router.get('/activities',   handle((req, ts) => strava.getActivities(ts, {
  page:    Number(req.query.page)    || 1,
  perPage: Number(req.query.perPage) || 30,
  before:  req.query.before ? Number(req.query.before) : undefined,
  after:   req.query.after  ? Number(req.query.after)  : undefined,
})));
router.get('/activities/:id', handle((req, ts) => strava.getActivityDetail(ts, req.params.id)));
router.get('/stats',        handle(async (req, ts) => {
  const athlete = await strava.getAthlete(ts);
  return strava.getAthleteStats(ts, athlete.id);
}));
router.get('/weekly',       handle((req, ts) => strava.getWeeklySummary(ts)));

module.exports = router;
