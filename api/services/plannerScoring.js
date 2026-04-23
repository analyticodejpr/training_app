/**
 * plannerScoring.js
 *
 * Deterministic planner scoring inputs.
 *
 * Computes three interpretable, independent scoring components:
 *   readiness     — how recovered/ready the athlete is for hard work
 *   loadTolerance — how well the athlete can absorb training load
 *   confidence    — how reliable our scoring signals are (data quality)
 *
 * These are inputs to buildSchedule() and scoreCandidate().
 * They do NOT own scheduling decisions — code retains final authority.
 *
 * All functions are null-safe and degrade gracefully to sensible defaults
 * when features data is missing (low-data users, no WHOOP/Strava).
 */
'use strict';

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function toTier(score) {
  if (score >= 67) return 'high';
  if (score >= 34) return 'moderate';
  return 'low';
}

// ── Readiness score ───────────────────────────────────────────────────────────

/**
 * Compute readiness score (0–100) from available features.
 *
 * High score  = athlete is well-recovered, ready for hard work.
 * Low score   = athlete needs lighter, lower-cost sessions.
 *
 * Signal priority:
 *   1. WHOOP avg_recovery_28d  — direct physiological readiness signal (0–100)
 *   2. hrv_trend               — proxy: improving/stable/declining
 *   3. Default 50              — no useful signal; scheduler uses plan defaults unchanged
 *
 * @param {object|null} features — derived_training_features row (or null)
 * @returns {{ score: number, tier: 'low'|'moderate'|'high', source: string }}
 */
function computeReadinessScore(features) {
  if (!features) {
    return { score: 50, tier: 'moderate', source: 'default' };
  }

  // WHOOP recovery score is the best available readiness signal
  if (features.avg_recovery_28d != null) {
    const score = clamp(Math.round(features.avg_recovery_28d), 0, 100);
    return { score, tier: toTier(score), source: 'whoop_recovery' };
  }

  // HRV trend as secondary proxy (WHOOP only, but trend can be inferred)
  if (features.hrv_trend) {
    const score = features.hrv_trend === 'improving' ? 70
      : features.hrv_trend === 'stable' ? 50
      : 30; // declining
    return { score, tier: toTier(score), source: 'hrv_trend' };
  }

  // Recovery trend from recovery_score series
  if (features.recovery_trend) {
    const score = features.recovery_trend === 'improving' ? 70
      : features.recovery_trend === 'stable' ? 50
      : 30; // declining
    return { score, tier: toTier(score), source: 'recovery_trend' };
  }

  return { score: 50, tier: 'moderate', source: 'default' };
}

// ── Load tolerance score ──────────────────────────────────────────────────────

/**
 * Compute load tolerance score (0–100) from consistency and volume features.
 *
 * High score  = athlete is well-adapted, can absorb planned load.
 * Low score   = athlete is deconditioned or inconsistent — be more conservative.
 *
 * Signal composition:
 *   - consistency_score (0–100) as base
 *   - sessions_per_week: bonus for ≥4, penalty for <2
 *   - volume_28d_hours: penalty for very low total volume
 *
 * @param {object|null} features
 * @returns {{ score: number, tier: 'low'|'moderate'|'high', source: string }}
 */
function computeLoadTolerance(features) {
  if (!features || features.consistency_score == null) {
    return { score: 50, tier: 'moderate', source: 'default' };
  }

  let score = features.consistency_score; // already 0–100

  // Sessions per week adjustment
  if (features.sessions_per_week != null) {
    if (features.sessions_per_week >= 4) score += 10;
    else if (features.sessions_per_week < 2) score -= 10;
  }

  // Very low volume penalty (< 2 hours across 28 days = barely training)
  if (features.volume_28d_hours != null && features.volume_28d_hours < 2) {
    score -= 15;
  }

  score = clamp(Math.round(score), 0, 100);
  return { score, tier: toTier(score), source: 'consistency' };
}

// ── Confidence score ──────────────────────────────────────────────────────────

/**
 * Compute confidence score (0–100): how reliable our scoring signals are.
 *
 * High confidence = we have good data, scoring adjustments should be applied.
 * Low confidence  = sparse or absent data; trust the plan defaults instead.
 *
 * This gates hardSessionCapReduction in computeSchedulingContext:
 * when confidence is low, we don't reduce hard sessions based on guesses.
 *
 * Signal composition:
 *   - Base 30
 *   - has_whoop connected: +30 (direct physiology signal)
 *   - has_strava connected: +20 (activity history)
 *   - sessions_28d >= 8: +20 (enough activity data to estimate load)
 *   - sessions_28d 4–7: +10 (some data)
 *   - sessions_28d < 4: no bonus (too sparse)
 *
 * @param {object|null} features
 * @returns {{ score: number, tier: 'low'|'moderate'|'high', source: string }}
 */
function computeConfidenceScore(features) {
  if (!features) {
    return { score: 30, tier: 'low', source: 'no_data' };
  }

  let score = 30; // base: some confidence from the goal intake alone
  const sources = [];

  if (features.has_whoop) { score += 30; sources.push('whoop'); }
  if (features.has_strava) { score += 20; sources.push('strava'); }

  if (features.sessions_28d != null) {
    if (features.sessions_28d >= 8)      { score += 20; sources.push('activity_rich'); }
    else if (features.sessions_28d >= 4) { score += 10; sources.push('activity_some'); }
  }

  score = clamp(score, 0, 100);
  return {
    score,
    tier:   toTier(score),
    source: sources.length ? sources.join('+') : 'no_data',
  };
}

// ── Scheduling context ────────────────────────────────────────────────────────

/**
 * Compute a combined scheduling context from features.
 *
 * This is the single object passed from schedulerOrchestrator into buildSchedule.
 * It contains all scoring inputs that influence scheduling decisions this week.
 *
 * buildSchedule uses:
 *   - readiness.tier / readinessTier → cap safeHard when 'low'; quality type downgrade
 *   - loadTolerance.tier / loadToleranceTier → reduce long session target; score fit
 *   - confidence.tier    → gate cap adjustments (low confidence = trust plan)
 *   - hardSessionCapReduction → how many quality sessions to subtract (0 or 1)
 *   - intensityCapReason → human-readable reason (logging + future UI)
 *
 * Never throws — always returns safe defaults.
 *
 * @param {object|null} features — full derived_training_features row
 * @returns {object}             — schedulingContext
 */
function computeSchedulingContext(features) {
  const readiness     = computeReadinessScore(features);
  const loadTolerance = computeLoadTolerance(features);
  const confidence    = computeConfidenceScore(features);

  // Gate intensity cap on confidence:
  // If we have no reliable signals, trust the plan rather than guessing.
  let hardSessionCapReduction = 0;
  const capReasons = [];

  if (confidence.tier !== 'low') {
    if (readiness.tier === 'low') {
      hardSessionCapReduction = Math.max(hardSessionCapReduction, 1);
      capReasons.push(`low readiness (score ${readiness.score}, source: ${readiness.source})`);
    }
    if (loadTolerance.tier === 'low') {
      hardSessionCapReduction = Math.max(hardSessionCapReduction, 1);
      capReasons.push(`low load tolerance (score ${loadTolerance.score}, source: ${loadTolerance.source})`);
    }
  }

  return {
    readiness,
    loadTolerance,
    confidence,
    // How many quality sessions to subtract from the week plan's target (0 = no change)
    hardSessionCapReduction,
    // Human-readable rationale (for logging and future UI display)
    intensityCapReason: capReasons.length ? capReasons.join('; ') : null,
    // Convenience shorthands passed through to scoreCandidate / scheduler
    readinessTier:     readiness.tier,
    loadToleranceTier: loadTolerance.tier,
  };
}

module.exports = {
  computeReadinessScore,
  computeLoadTolerance,
  computeConfidenceScore,
  computeSchedulingContext,
};
