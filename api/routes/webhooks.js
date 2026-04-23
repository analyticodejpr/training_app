/**
 * webhooks.js — Inbound provider webhook handlers.
 *
 * Called by Strava/WHOOP servers, not by the frontend.
 * No user-session auth on these routes — security is provider-specific:
 *
 *   Strava:  hub.verify_token challenge validation on subscription setup;
 *            owner_id DB lookup to scope event processing to a known user.
 *
 *   WHOOP:   Optional HMAC-SHA256 signature verification via WHOOP_WEBHOOK_SECRET.
 *            WHOOP user_id DB lookup to find the connected user.
 *
 * Processing pattern:
 *   1. Respond 200 immediately (providers retry on timeout/non-200)
 *   2. Log the raw event to webhook_events for observability
 *   3. Resolve provider user_id → our Supabase user_id via provider_connections
 *   4. Trigger the smallest safe incremental sync
 *   5. Update webhook_events row with outcome
 */

'use strict';

const express = require('express');
const crypto  = require('crypto');
const { supabase }                           = require('../db/supabase');
const { importSingleActivity, deleteActivity } = require('../services/stravaSync');
const { importDateWindow }                   = require('../services/whoopSync');

const router = express.Router();

// ── Observability helpers ─────────────────────────────────────────────────────

async function logEvent(provider, eventType, objectId, providerUserId, payload) {
  if (!supabase) return null;
  const { data } = await supabase
    .from('webhook_events')
    .insert({
      provider,
      event_type:         eventType || null,
      provider_object_id: objectId        != null ? String(objectId)        : null,
      provider_user_id:   providerUserId  != null ? String(providerUserId)  : null,
      payload,
      status: 'pending',
    })
    .select('id')
    .single();
  return data?.id || null;
}

async function markEvent(id, status, error = null) {
  if (!supabase || !id) return;
  await supabase
    .from('webhook_events')
    .update({
      status,
      error:        error ? String(error).slice(0, 500) : null,
      processed_at: new Date().toISOString(),
    })
    .eq('id', id);
}

// ── Strava — subscription validation (GET) ────────────────────────────────────
//
// Strava sends a GET with hub.mode, hub.challenge, and hub.verify_token when you
// create a webhook subscription. Respond with the challenge to prove ownership.
//
// Setup (run once via Strava API):
//   POST https://www.strava.com/api/v3/push_subscriptions
//   client_id, client_secret, callback_url, verify_token: $STRAVA_WEBHOOK_VERIFY_TOKEN

router.get('/strava', (req, res) => {
  const mode      = req.query['hub.mode'];
  const challenge = req.query['hub.challenge'];
  const token     = req.query['hub.verify_token'];

  if (mode === 'subscribe' && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    console.log('[webhook/strava] subscription validated');
    return res.json({ 'hub.challenge': challenge });
  }

  console.warn('[webhook/strava] validation rejected — token mismatch or unexpected mode');
  return res.status(403).json({ error: 'Forbidden' });
});

// ── Strava — event ingestion (POST) ───────────────────────────────────────────
//
// Strava sends POST events for:
//   object_type: "activity", aspect_type: "create" | "update" | "delete"
//   object_type: "athlete",  aspect_type: "update", updates: { authorized: "false" }
//
// Strava expects a 200 within 2 seconds; processing happens after the response.

router.post('/strava', async (req, res) => {
  res.sendStatus(200); // respond first, process after

  const body       = req.body || {};
  const objectType = body.object_type;
  const aspectType = body.aspect_type;
  const objectId   = body.object_id;  // Strava activity or athlete ID
  const ownerId    = body.owner_id;   // Strava athlete ID — maps to provider_user_id
  const updates    = body.updates || {};

  const eventType = `${objectType}.${aspectType}`;
  const logId = await logEvent('strava', eventType, objectId, ownerId, body);

  try {
    if (!ownerId) {
      return await markEvent(logId, 'ignored', 'Missing owner_id in payload');
    }

    // Resolve Strava athlete ID → our user_id via provider_connections
    const { data: conn } = await supabase
      .from('provider_connections')
      .select('user_id, status')
      .eq('provider', 'strava')
      .eq('provider_user_id', String(ownerId))
      .maybeSingle();

    if (!conn) {
      return await markEvent(logId, 'ignored', `No connection for Strava athlete ${ownerId}`);
    }

    const { user_id: userId, status } = conn;

    // ── Revoke ───────────────────────────────────────────────────────────────
    if (objectType === 'athlete' && updates.authorized === 'false') {
      await supabase
        .from('provider_connections')
        .update({ status: 'revoked', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('provider', 'strava');
      console.log(`[webhook/strava] revoked access for user ${userId}`);
      return await markEvent(logId, 'processed');
    }

    if (status !== 'active') {
      return await markEvent(logId, 'ignored', `Connection status is '${status}'`);
    }

    // ── Activity events ──────────────────────────────────────────────────────
    if (objectType === 'activity') {
      if (aspectType === 'create' || aspectType === 'update') {
        await importSingleActivity(userId, objectId);
        console.log(`[webhook/strava] upserted activity ${objectId} for user ${userId}`);
        return await markEvent(logId, 'processed');
      }

      if (aspectType === 'delete') {
        await deleteActivity(userId, objectId);
        console.log(`[webhook/strava] deleted activity ${objectId} for user ${userId}`);
        return await markEvent(logId, 'processed');
      }
    }

    await markEvent(logId, 'ignored', `Unhandled event type: ${eventType}`);
  } catch (err) {
    console.error(`[webhook/strava] error processing ${eventType}:`, err.message);
    await markEvent(logId, 'failed', err.message);
  }
});

// ── WHOOP — event ingestion (POST) ────────────────────────────────────────────
//
// WHOOP sends POST events for: recovery.updated, sleep.updated, workout.updated,
// v2.body_measurement.updated. Payload: { event, trace_id, data: { user_id, ... } }
//
// Optional signature verification: set WHOOP_WEBHOOK_SECRET to the shared secret
// configured in your WHOOP webhook subscription. The signature arrives in the
// X-Whoop-Signature header as an HMAC-SHA256 hex digest of the raw request body.

router.post('/whoop', async (req, res) => {
  const secret = process.env.WHOOP_WEBHOOK_SECRET;

  if (secret) {
    const sig      = req.headers['x-whoop-signature'];
    const expected = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody || Buffer.from(JSON.stringify(req.body)))
      .digest('hex');

    if (!sig || sig !== expected) {
      console.warn('[webhook/whoop] invalid HMAC signature — rejecting');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  res.sendStatus(200); // respond first, process after

  const body           = req.body || {};
  const eventType      = body.event || body.type || 'unknown';
  const providerUserId = body.data?.user_id ?? body.user_id ?? null;
  const objectId       = body.data?.id ?? null;

  const logId = await logEvent('whoop', eventType, objectId, providerUserId, body);

  try {
    if (!providerUserId) {
      return await markEvent(logId, 'ignored', 'No user_id in WHOOP payload');
    }

    // Resolve WHOOP user_id → our Supabase user_id via provider_connections
    const { data: conn } = await supabase
      .from('provider_connections')
      .select('user_id, status')
      .eq('provider', 'whoop')
      .eq('provider_user_id', String(providerUserId))
      .maybeSingle();

    if (!conn) {
      return await markEvent(logId, 'ignored', `No connection for WHOOP user ${providerUserId}`);
    }

    if (conn.status !== 'active') {
      return await markEvent(logId, 'ignored', `Connection status is '${conn.status}'`);
    }

    const userId = conn.user_id;

    // For recovery/sleep/workout events: refresh the last 2 days of data so the
    // affected date's aggregated daily_metrics row is updated. A 2-day window is
    // sufficient because WHOOP cycles can span midnight and the event may reference
    // data from either of the two most recent days.
    const refreshable = [
      'recovery.updated',
      'sleep.updated',
      'workout.updated',
      'v2.body_measurement.updated',
    ];

    if (refreshable.includes(eventType)) {
      const end   = new Date().toISOString();
      const start = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();
      await importDateWindow(userId, start, end);
      console.log(`[webhook/whoop] refreshed 2-day window for user ${userId} on ${eventType}`);
      return await markEvent(logId, 'processed');
    }

    await markEvent(logId, 'ignored', `Unhandled WHOOP event: ${eventType}`);
  } catch (err) {
    console.error(`[webhook/whoop] error processing ${eventType}:`, err.message);
    await markEvent(logId, 'failed', err.message);
  }
});

module.exports = router;
