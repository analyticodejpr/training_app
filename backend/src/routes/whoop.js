const express = require('express');
const whoop   = require('../services/whoopService');

const router = express.Router();

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

router.get('/profile',    handle((req, ts) => whoop.getProfile(ts)));
router.get('/body',       handle((req, ts) => whoop.getBodyMeasurement(ts)));
router.get('/cycles',     handle((req, ts) => whoop.getCycles(ts, { start: req.query.start, end: req.query.end })));
router.get('/recoveries', handle((req, ts) => whoop.getRecoveries(ts, { start: req.query.start, end: req.query.end })));
router.get('/sleep',      handle((req, ts) => whoop.getSleepData(ts, { start: req.query.start, end: req.query.end })));
router.get('/workouts',   handle((req, ts) => whoop.getWorkouts(ts, { start: req.query.start, end: req.query.end })));
router.get('/daily',      handle((req, ts) => whoop.getDailySummary(ts, Number(req.query.days) || 60)));

module.exports = router;
