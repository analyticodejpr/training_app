const express  = require('express');
const axios    = require('axios');
const crypto   = require('crypto');
const { encrypt, decrypt } = require('../tokenCrypto');
const { supabase, getUserFromToken } = require('../db/supabase');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

// WHOOP CSRF: HMAC-signed ts.nonce — survives serverless cold-starts.
function makeHmacState() {
  const ts    = Date.now().toString(36);
  const nonce = crypto.randomBytes(12).toString('hex');
  const data  = `${ts}.${nonce}`;
  const sig   = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev-secret')
                      .update(data).digest('hex').slice(0, 16);
  return `${ts}.${nonce}.${sig}`;
}

function verifyHmacState(hmacPart) {
  if (!hmacPart) return false;
  const parts = hmacPart.split('.');
  if (parts.length !== 3) return false;
  const [ts, nonce, sig] = parts;
  const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET || 'dev-secret')
                         .update(`${ts}.${nonce}`).digest('hex').slice(0, 16);
  if (sig !== expected) return false;
  return (Date.now() - parseInt(ts, 36)) < 15 * 60 * 1000;
}

// Encode existing session token into state so callback can merge sessions.
// Format: "<hmac_or_platform>|<existing_token_or_empty>"
function encodeState(hmacPart, existingToken) {
  return `${hmacPart}|${existingToken || ''}`;
}

function decodeState(state) {
  const idx = state.lastIndexOf('|');
  if (idx === -1) return { hmacPart: state, existingToken: '' };
  return { hmacPart: state.slice(0, idx), existingToken: state.slice(idx + 1) };
}

// Merge new platform data into existing session (if any).
function mergeSession(existingToken, newData) {
  const existing = existingToken ? (decrypt(existingToken) || {}) : {};
  return { ...existing, ...newData };
}

function redirectWithToken(res, session, platform) {
  const token = encrypt(session);
  res.redirect(`${process.env.FRONTEND_URL}/?connected=${platform}#tok=${token}`);
}

// ── Strava OAuth ──────────────────────────────────────────────────────────────

// Strava connect — requires a valid Supabase user JWT (sbToken param).
// We verify the JWT here once, then embed the user_id in the encrypted state.
// The callback reads user_id from state so it never needs to re-verify the JWT.
router.get('/strava/connect', async (req, res) => {
  const { t: existingToken, sbToken } = req.query;

  // Verify Supabase identity before starting the OAuth flow
  if (!sbToken) {
    return res.redirect(`${process.env.FRONTEND_URL}/?error=strava_no_auth`);
  }
  const user = await getUserFromToken(sbToken);
  if (!user) {
    return res.redirect(`${process.env.FRONTEND_URL}/?error=strava_unauth`);
  }

  // Build tamper-proof encrypted state containing verified user_id + nonce
  const state = encrypt({
    supabaseUserId: user.id,
    existingToken:  existingToken || '',
    nonce:          crypto.randomBytes(16).toString('hex'),
    ts:             Date.now(),
  });

  const params = new URLSearchParams({
    client_id:       process.env.STRAVA_CLIENT_ID,
    redirect_uri:    process.env.STRAVA_REDIRECT_URI,
    response_type:   'code',
    approval_prompt: 'auto',
    scope:           'read,activity:read_all,profile:read_all',
    state,
  });
  res.redirect(`https://www.strava.com/oauth/authorize?${params}`);
});

router.get('/strava/callback', async (req, res) => {
  const { code, error, state } = req.query;
  if (error) return res.redirect(`${process.env.FRONTEND_URL}/?error=strava_denied`);

  // Decrypt and validate state
  const stateData = decrypt(state || '');
  if (!stateData || Date.now() - stateData.ts > 15 * 60 * 1000) {
    return res.redirect(`${process.env.FRONTEND_URL}/?error=strava_state`);
  }

  const { supabaseUserId, existingToken } = stateData;

  try {
    // Exchange the authorization code for tokens
    const { data } = await axios.post('https://www.strava.com/oauth/token', {
      client_id:     process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    });

    // ── Save connection to Supabase ─────────────────────────────────────────
    // Columns are named *_encrypted; we store plaintext here since the DB encrypts
    // at rest via Supabase Vault. Add pgsodium column-level encryption when ready.
    if (supabase && supabaseUserId) {
      const { error: upsertErr } = await supabase
        .from('provider_connections')
        .upsert({
          user_id:                  supabaseUserId,
          provider:                 'strava',
          provider_user_id:         String(data.athlete?.id || ''),
          access_token_encrypted:   data.access_token,
          refresh_token_encrypted:  data.refresh_token,
          token_expires_at:         new Date(data.expires_at * 1000).toISOString(),
          scopes:                   (data.scope || '').split(',').filter(Boolean),
          status:                   'active',
          updated_at:               new Date().toISOString(),
        }, {
          onConflict: 'user_id,provider',
        });

      if (upsertErr) {
        console.error('[strava/callback] Supabase upsert error:', upsertErr.message);
        // Non-fatal — continue so the user still gets their session token
      }
    }

    // ── Also persist to the encrypted session token (existing mechanism) ────
    const session = mergeSession(existingToken, {
      strava: {
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
        expires_at:    data.expires_at,
        athlete_id:    String(data.athlete?.id || ''),
        scope:         data.scope || '',
      },
    });

    redirectWithToken(res, session, 'strava');
  } catch (err) {
    console.error('Strava callback error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL}/?error=strava_token`);
  }
});

// ── WHOOP OAuth ───────────────────────────────────────────────────────────────

// WHOOP connect — requires a valid Supabase user JWT (sbToken param).
// Uses the same encrypted state pattern as Strava so the callback can recover
// the verified user_id without re-verifying the JWT.
router.get('/whoop/connect', async (req, res) => {
  const { t: existingToken, sbToken } = req.query;

  if (!sbToken) {
    return res.redirect(`${process.env.FRONTEND_URL}/?error=whoop_no_auth`);
  }
  const user = await getUserFromToken(sbToken);
  if (!user) {
    return res.redirect(`${process.env.FRONTEND_URL}/?error=whoop_unauth`);
  }

  const state = encrypt({
    supabaseUserId: user.id,
    existingToken:  existingToken || '',
    nonce:          crypto.randomBytes(16).toString('hex'),
    ts:             Date.now(),
  });

  const params = new URLSearchParams({
    client_id:     process.env.WHOOP_CLIENT_ID,
    redirect_uri:  process.env.WHOOP_REDIRECT_URI,
    response_type: 'code',
    scope: 'read:profile read:body_measurement read:cycles read:recovery read:sleep read:workout offline',
    state,
  });
  res.redirect(`https://api.prod.whoop.com/oauth/oauth2/auth?${params}`);
});

router.get('/whoop/callback', async (req, res) => {
  const { code, error, state } = req.query;

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL}/?error=whoop_denied`);
  }

  // Decrypt and validate state (same pattern as Strava callback)
  const stateData = decrypt(state || '');
  if (!stateData || Date.now() - stateData.ts > 15 * 60 * 1000) {
    return res.redirect(`${process.env.FRONTEND_URL}/?error=whoop_state`);
  }

  const { supabaseUserId, existingToken } = stateData;

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

    const expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in || 3600);

    // Fetch the WHOOP user ID from the profile endpoint — needed for webhook routing.
    // The token response does not include it; this extra call is required once at connect time.
    let whoopUserId = '';
    try {
      const profileResp = await axios.get(
        'https://api.prod.whoop.com/developer/v1/user/profile/basic',
        { headers: { Authorization: `Bearer ${data.access_token}` } }
      );
      whoopUserId = String(profileResp.data.user_id || '');
    } catch (profileErr) {
      // Non-fatal — webhook routing won't work until reconnected, but import still works
      console.warn('[whoop/callback] failed to fetch WHOOP profile for provider_user_id:', profileErr.message);
    }

    // ── Save connection to Supabase ─────────────────────────────────────────
    if (supabase && supabaseUserId) {
      const { error: upsertErr } = await supabase
        .from('provider_connections')
        .upsert({
          user_id:                  supabaseUserId,
          provider:                 'whoop',
          provider_user_id:         whoopUserId,
          access_token_encrypted:   data.access_token,
          refresh_token_encrypted:  data.refresh_token,
          token_expires_at:         new Date(expiresAt * 1000).toISOString(),
          scopes:                   (data.scope || '').split(' ').filter(Boolean),
          status:                   'active',
          updated_at:               new Date().toISOString(),
        }, { onConflict: 'user_id,provider' });

      if (upsertErr) console.error('[whoop/callback] Supabase upsert error:', upsertErr.message);
    }

    // ── Also persist to encrypted session token (backward compat) ────────
    const session = mergeSession(existingToken, {
      whoop: {
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
        expires_at:    expiresAt,
        scope:         data.scope || '',
      },
    });

    redirectWithToken(res, session, 'whoop');
  } catch (err) {
    console.error('WHOOP callback error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL}/?error=whoop_token`);
  }
});

// ── Status & Disconnect ───────────────────────────────────────────────────────

router.get('/status', async (req, res) => {
  const fromSession = {
    strava: !!req.session.strava,
    whoop:  !!req.session.whoop,
  };

  // If both providers are already in the session token, return immediately.
  if (fromSession.strava && fromSession.whoop) {
    return res.json(fromSession);
  }

  // Fall back to Supabase provider_connections for providers missing from the
  // session token (e.g. after a fresh Google login where no th_session exists yet).
  const sbToken = (req.headers['x-sb-token'] || '').trim();
  if (!sbToken || !supabase) {
    return res.json(fromSession);
  }

  const user = await getUserFromToken(sbToken);
  if (!user) return res.json(fromSession);

  const { data: conns } = await supabase
    .from('provider_connections')
    .select('provider')
    .eq('user_id', user.id)
    .eq('status', 'active');

  const dbProviders = new Set((conns || []).map(c => c.provider));

  res.json({
    strava: fromSession.strava || dbProviders.has('strava'),
    whoop:  fromSession.whoop  || dbProviders.has('whoop'),
  });
});

router.delete('/strava/disconnect', (req, res) => {
  const session = { ...req.session, strava: null };
  res.json({ ok: true, token: encrypt(session) });
});

router.delete('/whoop/disconnect', (req, res) => {
  const session = { ...req.session, whoop: null };
  res.json({ ok: true, token: encrypt(session) });
});

module.exports = router;
