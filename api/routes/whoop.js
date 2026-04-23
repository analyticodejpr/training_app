const express = require('express');
const whoop   = require('../services/whoopService');
const { importLast90Days } = require('../services/whoopSync');
const { requireSupabaseUser } = require('../middleware/requireSupabaseUser');
const { supabase } = require('../db/supabase');

const router = express.Router();

// ── Existing live-fetch routes (session-token authenticated) ──────────────────

function makeTokenStore(req, res) {
  return {
    get:  (provider) => req.session[provider] || null,
    save: (provider, data) => {
      req.session[provider] = data;
      res.setSession({ ...req.session, [provider]: data });
    },
  };
}

function handle(fn) {
  return async (req, res) => {
    try {
      const data = await fn(req, makeTokenStore(req, res));
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

// ── Supabase-authenticated routes (require X-Supabase-Token header) ───────────

/**
 * GET /api/whoop/connection
 * Returns WHOOP connection status for the authenticated user.
 */
router.get('/connection', requireSupabaseUser, async (req, res) => {
  try {
    const { data: conn, error } = await supabase
      .from('provider_connections')
      .select('status, last_synced_at, created_at')
      .eq('user_id', req.supabaseUser.id)
      .eq('provider', 'whoop')
      .maybeSingle();

    if (error) return res.status(500).json({ error: 'Failed to load connection status' });

    res.json({
      connected:    !!conn && conn.status === 'active',
      lastSyncedAt: conn?.last_synced_at || null,
      connectedAt:  conn?.created_at     || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/whoop/import-90
 * Triggers a manual import of the last 90 days of WHOOP data.
 * Idempotent — safe to run multiple times.
 */
router.post('/import-90', requireSupabaseUser, async (req, res) => {
  try {
    const result = await importLast90Days(req.supabaseUser.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[whoop/import-90]', err.message);
    const status = err.message.includes('not connected') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * DELETE /api/whoop/disconnect
 * Removes the WHOOP connection and deletes all WHOOP-owned data for the user:
 *   - daily_metrics    (all rows — WHOOP is the only source for this table)
 *   - source_records   (provider = 'whoop')
 *   - provider_connections (provider = 'whoop')
 *
 * Requires a valid Supabase user JWT. Uses the service-role client.
 */
router.delete('/disconnect', requireSupabaseUser, async (req, res) => {
  const userId = req.supabaseUser.id;
  try {
    // 1. Delete normalized daily metrics (WHOOP is the sole source)
    const { error: metricsErr } = await supabase
      .from('daily_metrics')
      .delete()
      .eq('user_id', userId);
    if (metricsErr) throw new Error(`daily_metrics delete: ${metricsErr.message}`);

    // 2. Delete raw source payloads
    const { error: srcErr } = await supabase
      .from('source_records')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'whoop');
    if (srcErr) throw new Error(`source_records delete: ${srcErr.message}`);

    // 3. Remove the connection row itself
    const { error: connErr } = await supabase
      .from('provider_connections')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'whoop');
    if (connErr) throw new Error(`provider_connections delete: ${connErr.message}`);

    console.log(`[whoop/disconnect] removed all WHOOP data for user ${userId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[whoop/disconnect]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
