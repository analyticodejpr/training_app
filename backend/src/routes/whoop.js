const express = require('express');
const whoop   = require('../services/whoopService');

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

router.get('/profile',      handle(() => whoop.getProfile()));
router.get('/body',         handle(() => whoop.getBodyMeasurement()));
router.get('/cycles',       handle(req => whoop.getCycles({ start: req.query.start, end: req.query.end })));
router.get('/recoveries',   handle(req => whoop.getRecoveries({ start: req.query.start, end: req.query.end })));
router.get('/sleep',        handle(req => whoop.getSleepData({ start: req.query.start, end: req.query.end })));
router.get('/workouts',     handle(req => whoop.getWorkouts({ start: req.query.start, end: req.query.end })));
router.get('/daily',        handle(req => whoop.getDailySummary(Number(req.query.days) || 60)));

module.exports = router;
