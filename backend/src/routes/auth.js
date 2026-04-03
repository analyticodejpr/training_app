const express  = require('express');
const axios    = require('axios');
const crypto   = require('crypto');
const { saveTokens, deleteTokens, getTokens } = require('../db/database');

const router = express.Router();

let _whoopState = null;

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
    client_id:     process.env.STRAVA_CLIENT_ID,
    redirect_uri:  process.env.STRAVA_REDIRECT_URI,
    response_type: 'code',
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

    saveTokens('strava', {
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    data.expires_at,
      athlete_id:    String(data.athlete?.id || ''),
      scope:         data.scope || '',
    });

    res.redirect(`${process.env.FRONTEND_URL}/?connected=strava`);
  } catch (err) {
    console.error('Strava callback error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL}/?error=strava_token`);
  }
});

// ── WHOOP OAuth ───────────────────────────────────────────────────────────────

router.get('/whoop/connect', (req, res) => {
  _whoopState = crypto.randomBytes(16).toString('hex');
  res.redirect(`https://api.prod.whoop.com/oauth/oauth2/auth?${makeWhoopParams(_whoopState)}`);
});

router.get('/whoop/callback', async (req, res) => {
  const { code, error, error_description, state } = req.query;
  if (error) {
    console.error('WHOOP OAuth denied:', error, error_description);
    return res.redirect(`${process.env.FRONTEND_URL}/?error=whoop_denied&whoop_error=${encodeURIComponent(error)}&whoop_desc=${encodeURIComponent(error_description || '')}`);
  }
  if (!state || state !== _whoopState) {
    return res.redirect(`${process.env.FRONTEND_URL}/?error=whoop_denied&whoop_error=state_mismatch`);
  }
  _whoopState = null;

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

    saveTokens('whoop', {
      access_token:  data.access_token,
      refresh_token: data.refresh_token,
      expires_at:    Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
      athlete_id:    '',
      scope:         data.scope || '',
    });

    res.redirect(`${process.env.FRONTEND_URL}/?connected=whoop`);
  } catch (err) {
    console.error('WHOOP callback error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL}/?error=whoop_token`);
  }
});

// Return OAuth URLs as JSON (avoids proxy-redirect issues in dev)
router.get('/whoop/url', (req, res) => {
  _whoopState = crypto.randomBytes(16).toString('hex');
  res.json({ url: `https://api.prod.whoop.com/oauth/oauth2/auth?${makeWhoopParams(_whoopState)}` });
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

// ── Status & Disconnect ───────────────────────────────────────────────────────

router.get('/status', (req, res) => {
  const strava = getTokens('strava');
  const whoop  = getTokens('whoop');
  res.json({
    strava: !!strava,
    whoop:  !!whoop,
  });
});

router.delete('/strava/disconnect', (req, res) => {
  deleteTokens('strava');
  res.json({ ok: true });
});

router.delete('/whoop/disconnect', (req, res) => {
  deleteTokens('whoop');
  res.json({ ok: true });
});

module.exports = router;
