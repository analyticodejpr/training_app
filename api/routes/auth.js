const express = require('express');
const axios   = require('axios');
const crypto  = require('crypto');

const router = express.Router();

// ── WHOOP state: HMAC-signed token (no cookie/session storage needed) ─────────
// Survives serverless cold-starts and cross-domain redirect chains.

function makeWhoopState() {
  const ts    = Date.now().toString(36);
  const nonce = crypto.randomBytes(12).toString('hex');
  const data  = `${ts}.${nonce}`;
  const sig   = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev-secret')
                      .update(data).digest('hex').slice(0, 16);
  return `${data}.${sig}`;
}

function verifyWhoopState(state) {
  if (!state) return false;
  const parts = state.split('.');
  if (parts.length !== 3) return false;
  const [ts, nonce, sig] = parts;
  const data     = `${ts}.${nonce}`;
  const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev-secret')
                         .update(data).digest('hex').slice(0, 16);
  if (sig !== expected) return false;
  const age = Date.now() - parseInt(ts, 36);
  return age < 15 * 60 * 1000; // 15-minute window
}

function makeWhoopParams(state) {
  return new URLSearchParams({
    client_id:     process.env.WHOOP_CLIENT_ID,
    redirect_uri:  process.env.WHOOP_REDIRECT_URI,
    response_type: 'code',
    scope: 'read:profile read:body_measurement read:cycles read:recovery read:sleep read:workout offline',
    state,
  });
}

// ── Strava OAuth ──────────────────────────────────────────────────────────────

router.get('/strava/connect', (req, res) => {
  const params = new URLSearchParams({
    client_id:       process.env.STRAVA_CLIENT_ID,
    redirect_uri:    process.env.STRAVA_REDIRECT_URI,
    response_type:   'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all,profile:read_all',
  });
  res.redirect(`https://www.strava.com/oauth/authorize?${params}`);
});

router.get('/strava/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.redirect(`${process.env.FRONTEND_URL}/?error=strava_denied`);

  try {
    const { data } = await axios.post('https://www.strava.com/oauth/token', {
      client_id:     process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    });

    req.session.strava = {
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    data.expires_at,
      athlete_id:    String(data.athlete?.id || ''),
      scope:         data.scope || '',
    };

    res.redirect(`${process.env.FRONTEND_URL}/?connected=strava`);
  } catch (err) {
    console.error('Strava callback error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL}/?error=strava_token`);
  }
});

// ── WHOOP OAuth ───────────────────────────────────────────────────────────────

router.get('/whoop/connect', (req, res) => {
  const state = makeWhoopState();
  res.redirect(`https://api.prod.whoop.com/oauth/oauth2/auth?${makeWhoopParams(state)}`);
});

router.get('/whoop/callback', async (req, res) => {
  const { code, error, error_description, state } = req.query;

  if (error) {
    console.error('WHOOP OAuth denied:', error, error_description);
    return res.redirect(
      `${process.env.FRONTEND_URL}/?error=whoop_denied&whoop_error=${encodeURIComponent(error)}&whoop_desc=${encodeURIComponent(error_description || '')}`
    );
  }

  if (!verifyWhoopState(state)) {
    return res.redirect(`${process.env.FRONTEND_URL}/?error=whoop_denied&whoop_error=state_mismatch`);
  }

  try {
    const params = new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  process.env.WHOOP_REDIRECT_URI,
      client_id:     process.env.WHOOP_CLIENT_ID,
      client_secret: process.env.WHOOP_CLIENT_SECRET,
    });

    const { data } = await axios.post(
      'https://api.prod.whoop.com/oauth/oauth2/token',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    req.session.whoop = {
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      scope:         data.scope || '',
    };

    res.redirect(`${process.env.FRONTEND_URL}/?connected=whoop`);
  } catch (err) {
    console.error('WHOOP callback error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL}/?error=whoop_token`);
  }
});

// ── Status & Disconnect ───────────────────────────────────────────────────────

router.get('/status', (req, res) => {
  res.json({
    strava: !!req.session.strava,
    whoop:  !!req.session.whoop,
  });
});

router.delete('/strava/disconnect', (req, res) => {
  req.session.strava = null;
  res.json({ ok: true });
});

router.delete('/whoop/disconnect', (req, res) => {
  req.session.whoop = null;
  res.json({ ok: true });
});

module.exports = router;
