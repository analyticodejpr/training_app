/**
 * featureGenerator.js
 *
 * Computes stable derived training features from a normalized athlete context.
 * All inputs come from the context object — never raw provider payloads.
 * All outputs are deterministic pure functions of the input.
 *
 * Features computed:
 *   Volume:      volume_7d_hours, volume_28d_hours, sessions_7d, sessions_28d,
 *                sessions_per_week, longest_session_hours
 *   Consistency: consistency_score (0–100), active_weeks_of_last_4
 *   Intensity:   pct_easy, pct_moderate, pct_hard (distribution estimate)
 *   Recovery:    avg_recovery_28d, avg_hrv_28d, hrv_trend, avg_resting_hr_28d,
 *                avg_sleep_score_28d, recovery_trend
 *   Sport:       primary_sport, sport_mix
 *   Flags:       has_strava, has_whoop
 */
'use strict';

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysBefore(n) {
  return new Date(Date.now() - n * 24 * 3600 * 1000);
}

function toDate(str) {
  return new Date(str);
}

/** Filter activities to those starting within the last `days` days. */
function activitiesWithin(activities, days) {
  const cutoff = daysBefore(days);
  return activities.filter(a => toDate(a.starts_at) >= cutoff);
}

/** Total moving time in hours for a set of activities. */
function totalHours(activities) {
  return activities.reduce((s, a) => s + (a.moving_time_s || 0) / 3600, 0);
}

/**
 * Compute the number of distinct ISO-week windows (Mon–Sun) that had at least
 * one activity in the last `weeks` weeks.
 */
function activeWeeksInLast(activities, weeks) {
  const cutoff = daysBefore(weeks * 7);
  const recent = activities.filter(a => toDate(a.starts_at) >= cutoff);

  const weekKeys = new Set(
    recent.map(a => {
      const d = toDate(a.starts_at);
      // ISO week key: year-W#
      const jan4 = new Date(d.getFullYear(), 0, 4);
      const week = Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7);
      return `${d.getFullYear()}-W${week}`;
    })
  );
  return Math.min(weekKeys.size, weeks);
}

/**
 * Estimate intensity distribution based on average HR if available,
 * otherwise fall back to sport-based heuristics.
 *
 * Zones (rough approximation without max HR):
 *   easy     avg_hr < 140 or no HR
 *   moderate avg_hr 140–160
 *   hard     avg_hr > 160
 */
function computeIntensityDistribution(activities) {
  if (!activities.length) return { pctEasy: 70, pctModerate: 20, pctHard: 10 };

  let easy = 0, moderate = 0, hard = 0;

  for (const a of activities) {
    if (a.avg_hr && a.avg_hr > 0) {
      if (a.avg_hr < 140) easy++;
      else if (a.avg_hr <= 160) moderate++;
      else hard++;
    } else {
      // No HR data — treat as easy (conservative default)
      easy++;
    }
  }

  const total = easy + moderate + hard || 1;
  return {
    pctEasy:     Math.round((easy / total) * 100),
    pctModerate: Math.round((moderate / total) * 100),
    pctHard:     Math.round((hard / total) * 100),
  };
}

/**
 * Compute sport mix as { [sport]: pct } where values sum to ~100.
 * Returns primary sport and full mix object.
 */
function computeSportMix(activities) {
  if (!activities.length) return { primarySport: null, sportMix: {} };

  const counts = {};
  for (const a of activities) {
    const sport = a.sport_type || 'Other';
    counts[sport] = (counts[sport] || 0) + 1;
  }

  const total = activities.length;
  const sportMix = {};
  let primarySport = null;
  let maxCount = 0;

  for (const [sport, count] of Object.entries(counts)) {
    sportMix[sport] = Math.round((count / total) * 100);
    if (count > maxCount) { maxCount = count; primarySport = sport; }
  }

  return { primarySport, sportMix };
}

/**
 * Compute a simple linear trend from an array of numeric values.
 * Returns 'improving' | 'stable' | 'declining' based on slope of a 3-point window.
 * Higher values = better (recovery score, HRV). Lower values = better for resting HR.
 *
 * @param {number[]} values - ordered oldest→newest
 * @param {boolean}  higherIsBetter
 */
function computeTrend(values, higherIsBetter = true) {
  const clean = values.filter(v => v != null && !isNaN(v));
  if (clean.length < 5) return 'stable';

  // Compare last 2 vs first 2 of recent 10
  const recent = clean.slice(-10);
  const early  = recent.slice(0, Math.floor(recent.length / 2));
  const late   = recent.slice(Math.ceil(recent.length / 2));

  const avgEarly = early.reduce((s, v) => s + v, 0) / early.length;
  const avgLate  = late.reduce((s, v) => s + v, 0)  / late.length;

  const delta = avgLate - avgEarly;
  const threshold = avgEarly * 0.03; // 3% change threshold

  if (Math.abs(delta) < threshold) return 'stable';
  if (higherIsBetter) return delta > 0 ? 'improving' : 'declining';
  return delta < 0 ? 'improving' : 'declining'; // lower resting HR = improving
}

/** Mean of a numeric array, ignoring nulls. Returns null if no valid values. */
function mean(arr) {
  const clean = arr.filter(v => v != null && !isNaN(v));
  if (!clean.length) return null;
  return clean.reduce((s, v) => s + v, 0) / clean.length;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Compute all stable training features from a normalized athlete context.
 *
 * @param {object} context - output of buildAthleteContext()
 * @returns {object}       - all derived features (ready for DB persistence)
 */
function computeFeatures(context) {
  const { activities, dailyMetrics, hasStrava, hasWhoop } = context;

  // Volume
  const acts7d  = activitiesWithin(activities, 7);
  const acts28d = activitiesWithin(activities, 28);

  const volume7dHours   = parseFloat(totalHours(acts7d).toFixed(2));
  const volume28dHours  = parseFloat(totalHours(acts28d).toFixed(2));
  const sessions7d      = acts7d.length;
  const sessions28d     = acts28d.length;
  const sessionsPerWeek = parseFloat((sessions28d / 4).toFixed(1));

  const longestSessionHours = activities.length
    ? parseFloat((Math.max(...activities.map(a => (a.moving_time_s || 0) / 3600))).toFixed(2))
    : 0;

  // Consistency
  const activeWeeksOfLast4 = activeWeeksInLast(activities, 4);
  const consistencyScore   = parseFloat(((activeWeeksOfLast4 / 4) * 100).toFixed(1));

  // Intensity distribution
  const { pctEasy, pctModerate, pctHard } = computeIntensityDistribution(acts28d);

  // Recovery features (WHOOP-only, null when not connected)
  let avgRecovery28d    = null;
  let avgHrv28d         = null;
  let hrvTrend          = null;
  let avgRestingHr28d   = null;
  let avgSleepScore28d  = null;
  let recoveryTrend     = null;

  if (hasWhoop && dailyMetrics.length) {
    const metrics28d = dailyMetrics.filter(m => {
      const d = new Date(m.day);
      return d >= daysBefore(28);
    });

    avgRecovery28d   = mean(metrics28d.map(m => m.recovery_score));
    avgHrv28d        = mean(metrics28d.map(m => m.hrv));
    avgRestingHr28d  = mean(metrics28d.map(m => m.resting_hr));
    avgSleepScore28d = mean(metrics28d.map(m => m.sleep_score));

    if (avgRecovery28d != null) avgRecovery28d = parseFloat(avgRecovery28d.toFixed(1));
    if (avgHrv28d      != null) avgHrv28d      = parseFloat(avgHrv28d.toFixed(1));
    if (avgRestingHr28d != null) avgRestingHr28d = parseFloat(avgRestingHr28d.toFixed(1));
    if (avgSleepScore28d != null) avgSleepScore28d = parseFloat(avgSleepScore28d.toFixed(1));

    recoveryTrend = computeTrend(metrics28d.map(m => m.recovery_score), true);
    hrvTrend      = computeTrend(metrics28d.map(m => m.hrv), true);
  }

  // Sport mix
  const { primarySport, sportMix } = computeSportMix(activities);

  return {
    // Volume
    volume_7d_hours:       volume7dHours,
    volume_28d_hours:      volume28dHours,
    sessions_7d:           sessions7d,
    sessions_28d:          sessions28d,
    sessions_per_week:     sessionsPerWeek,
    longest_session_hours: longestSessionHours,
    // Consistency
    consistency_score:       consistencyScore,
    active_weeks_of_last_4:  activeWeeksOfLast4,
    // Intensity
    pct_easy:     pctEasy,
    pct_moderate: pctModerate,
    pct_hard:     pctHard,
    // Recovery
    avg_recovery_28d:    avgRecovery28d,
    avg_hrv_28d:         avgHrv28d,
    hrv_trend:           hrvTrend,
    avg_resting_hr_28d:  avgRestingHr28d,
    avg_sleep_score_28d: avgSleepScore28d,
    recovery_trend:      recoveryTrend,
    // Sport
    primary_sport: primarySport,
    sport_mix:     sportMix,
    // Flags
    has_strava: hasStrava,
    has_whoop:  hasWhoop,
  };
}

module.exports = { computeFeatures };
