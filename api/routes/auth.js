const express = require('express');
const axios   = require('axios');
const crypto  = require('crypto');

const router = express.Router();

// ── helpers ───────────────────────────────────────────────────────────────────

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

    // Store tokens in the user's encrypted cookie session
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

router.get('/strava/url', (req, res) => {
  const params = new URLSearchParams({
    client_id:       process.env.STRAVA_CLIENT_ID,
    redirect_uri:    process.env.STRAVA_REDIRECT_URI,
    response_type:   'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all,profile:read_all',
  });
  res.json({ url: `https://www.strava.com/oauth/authorize?${params}` });
});

// ── WHOOP OAuth ───────────────────────────────────────────────────────────────

router.get('/whoop/connect', (req, res) => {
  // Store CSRF state in session (per-user, not global)
  req.session.whoopState = crypto.randomBytes(16).toString('hex');
  res.redirect(`https://api.prod.whoop.com/oauth/oauth2/auth?${makeWhoopParams(req.session.whoopState)}`);
});

router.get('/whoop/url', (req, res) => {
  req.session.whoopState = crypto.randomBytes(16).toString('hex');
  res.json({ url: `https://api.prod.whoop.com/oauth/oauth2/auth?${makeWhoopParams(req.session.whoopState)}` });
});

router.get('/whoop/callback', async (req, res) => {
  const { code, error, error_description, state } = req.query;

  if (error) {
    console.error('WHOOP OAuth denied:', error, error_description);
    return res.redirect(
      `${process.env.FRONTEND_URL}/?error=whoop_denied&whoop_error=${encodeURIComponent(error)}&whoop_desc=${encodeURIComponent(error_description || '')}`
    );
  }

  if (!state || state !== req.session.whoopState) {
    return res.redirect(`${process.env.FRONTEND_URL}/?error=whoop_denied&whoop_error=state_mismatch`);
  }

  // Clear used state
  req.session.whoopState = null;

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

    // Store tokens in the user's encrypted cookie session
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
