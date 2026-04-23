/**
 * athleteContext.js
 *
 * Builds a normalized athlete context object from Supabase app tables.
 * This is the single point of truth consumed by the feature generator and planner.
 * Never reads raw provider payloads — only normalized app tables.
 *
 * Returns:
 *   {
 *     userId, profile,
 *     hasStrava, hasWhoop,
 *     dataMode: 'full' | 'partial' | 'low',
 *     activities: [...],       // last 90d normalized rows
 *     dailyMetrics: [...],     // last 90d daily_metrics rows
 *     windowDays: 90,
 *   }
 */
'use strict';

const { supabase } = require('../db/supabase');

const WINDOW_DAYS = 90;

/**
 * Build an athlete context snapshot for the given user.
 * All data comes from normalized Supabase tables — never raw provider payloads.
 *
 * @param {string} userId  - Supabase auth user ID
 * @returns {object}       - normalized context object
 */
async function buildAthleteContext(userId) {
  const cutoff = new Date(Date.now() - WINDOW_DAYS * 24 * 3600 * 1000)
    .toISOString()
    .split('T')[0];

  // Run all DB fetches in parallel
  const [profileRes, connectionsRes, activitiesRes, metricsRes] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
    supabase.from('provider_connections')
      .select('provider, status, last_synced_at')
      .eq('user_id', userId)
      .eq('status', 'active'),
    supabase.from('activities')
      .select('starts_at, sport_type, moving_time_s, distance_m, avg_hr, max_hr')
      .eq('user_id', userId)
      .gte('starts_at', cutoff + 'T00:00:00Z')
      .order('starts_at', { ascending: false })
      .limit(500),
    supabase.from('daily_metrics')
      .select('day, recovery_score, hrv, resting_hr, sleep_score, strain_score')
      .eq('user_id', userId)
      .gte('day', cutoff)
      .order('day', { ascending: true })
      .limit(500),
  ]);

  if (profileRes.error) throw new Error(`profile fetch: ${profileRes.error.message}`);
  if (connectionsRes.error) throw new Error(`connections fetch: ${connectionsRes.error.message}`);
  if (activitiesRes.error) throw new Error(`activities fetch: ${activitiesRes.error.message}`);
  if (metricsRes.error) throw new Error(`metrics fetch: ${metricsRes.error.message}`);

  const connections = connectionsRes.data || [];
  const hasStrava = connections.some(c => c.provider === 'strava');
  const hasWhoop  = connections.some(c => c.provider === 'whoop');

  const activities    = activitiesRes.data  || [];
  const dailyMetrics  = metricsRes.data     || [];

  // data_mode: full = both providers, partial = one provider, low = neither
  let dataMode = 'low';
  if (hasStrava && hasWhoop) dataMode = 'full';
  else if (hasStrava || hasWhoop) dataMode = 'partial';

  return {
    userId,
    profile:      profileRes.data || {},
    hasStrava,
    hasWhoop,
    dataMode,
    activities,
    dailyMetrics,
    windowDays:   WINDOW_DAYS,
    snapshotAt:   new Date().toISOString(),
  };
}

module.exports = { buildAthleteContext };
