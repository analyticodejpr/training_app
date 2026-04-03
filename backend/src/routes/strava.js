const express = require('express');
const strava  = require('../services/stravaService');

const router = express.Router();

function handle(fn) {
  return async (req, res) => {
    try {
      const data = await fn(req);
      res.json(data);
    } catch (err) {
      const status = err.message.includes('not connected') ? 401 : 500;
      res.status(status).json({ error: err.message });
    }
  };
}

router.get('/athlete',      handle(() => strava.getAthlete()));
router.get('/activities',   handle(req => strava.getActivities({
  page:    Number(req.query.page)    || 1,
  perPage: Number(req.query.perPage) || 30,
  before:  req.query.before ? Number(req.query.before) : undefined,
  after:   req.query.after  ? Number(req.query.after)  : undefined,
})));
router.get('/activities/:id', handle(req => strava.getActivityDetail(req.params.id)));
router.get('/stats',        handle(async () => {
  const athlete = await strava.getAthlete();
  return strava.getAthleteStats(athlete.id);
}));
router.get('/weekly',       handle(() => strava.getWeeklySummary()));

module.exports = router;
