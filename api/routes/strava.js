const express = require('express');
const strava  = require('../services/stravaService');
const { importLast90Days, importRecent } = require('../services/stravaSync');
const { requireSupabaseUser } = require('../middleware/requireSupabaseUser');
const { supabase } = require('../db/supabase');

const router = express.Router();

// ── Existing live-fetch routes (session-token authenticated) ──────────────────

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

router.get('/athlete',        handle((req, ts) => strava.getAthlete(ts)));
router.get('/activities',     handle((req, ts) => strava.getActivities(ts, {
  page:    Number(req.query.page)    || 1,
  perPage: Number(req.query.perPage) || 30,
  before:  req.query.before ? Number(req.query.before) : undefined,
  after:   req.query.after  ? Number(req.query.after)  : undefined,
})));
router.get('/activities/:id', handle((req, ts) => strava.getActivityDetail(ts, req.params.id)));
router.get('/stats',          handle(async (req, ts) => {
  const athlete = await strava.getAthlete(ts);
  return strava.getAthleteStats(ts, athlete.id);
}));
router.get('/weekly',         handle((req, ts) => strava.getWeeklySummary(ts)));

// ── Supabase-authenticated routes (require X-Supabase-Token header) ───────────

/**
 * GET /api/strava/connection
 * Returns the Strava connection status for the authenticated user.
 * Response: { connected, lastSyncedAt, athleteId }
 */
router.get('/connection', requireSupabaseUser, async (req, res) => {
  try {
    const { data: conn, error } = await supabase
      .from('provider_connections')
      .select('status, last_synced_at, provider_user_id, created_at')
      .eq('user_id', req.supabaseUser.id)
      .eq('provider', 'strava')
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Failed to load connection status' });
    }

    res.json({
      connected:    !!conn && conn.status === 'active',
      lastSyncedAt: conn?.last_synced_at  || null,
      athleteId:    conn?.provider_user_id || null,
      connectedAt:  conn?.created_at      || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/strava/import-90
 * Triggers a manual import of the last 90 days of Strava activities.
 * Idempotent — safe to run multiple times without creating duplicates.
 * Response: { ok: true, imported: number }
 */
router.post('/import-90', requireSupabaseUser, async (req, res) => {
  try {
    const result = await importLast90Days(req.supabaseUser.id);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[import-90]', err.message);
    const status = err.message.includes('not connected') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * POST /api/strava/import-recent
 * Imports only the last 7 days — fast catch-up for missed webhook events.
 * This is the default import button action; use import-90 for a full backfill.
 */
router.post('/import-recent', requireSupabaseUser, async (req, res) => {
  try {
    const result = await importRecent(req.supabaseUser.id, 7);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[import-recent]', err.message);
    const status = err.message.includes('not connected') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * DELETE /api/strava/disconnect
 * Soft-disconnects Strava: removes only the provider_connections row so future
 * syncs stop, but preserves all existing activities and source_records data.
 *
 * Returns an updated session token (strava cleared) so the frontend stays in sync.
 */
router.delete('/disconnect', requireSupabaseUser, async (req, res) => {
  const userId = req.supabaseUser.id;
  try {
    const { error: connErr } = await supabase
      .from('provider_connections')
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'strava');
    if (connErr) throw new Error(`provider_connections delete: ${connErr.message}`);

    // Return a new session token with strava cleared so TopBar updates immediately
    res.setSession({ ...req.session, strava: null });
    console.log(`[strava/disconnect] disconnected Strava for user ${userId} (data preserved)`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[strava/disconnect]', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
