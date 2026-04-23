/**
 * athleteState.js
 *
 * Derives a rich, planning-relevant athlete state from raw goal + features.
 * This is the primary input layer for block and week generation — it transforms
 * "what the athlete told us" (goal) and "what the data shows" (features) into
 * "what the planner should act on" (derived state).
 *
 * Key outputs consumed by planner.js:
 *   - primary_goal_family          → selects block blueprint sequence
 *   - needs_readiness_block        → whether to prepend a readiness phase
 *   - readiness_lead_in_weeks      → how many readiness weeks to add
 *   - chronic_load_28d             → volume anchor for week targets
 *   - max_single_session_28d       → long-session safety cap
 *   - readiness_tier               → load / intensity modifier
 *   - adherence_risk               → session count and complexity modifier
 *   - recovery_capacity_score      → recovery wave pattern selector
 *   - psychological_load_modifier  → sleep/recovery modifier on load targets
 *   - environment_preference_profile → modality and scheduling preferences
 *
 * All functions are deterministic and null-safe.
 * State degrades gracefully when data is sparse.
 */
'use strict';

// ── Goal family classification ────────────────────────────────────────────────

const GOAL_FAMILY = {
  base_fitness:        'fitness',
  general_performance: 'fitness',
  weight_loss:         'weight_loss',
  race_5k:             'endurance_race',
  race_10k:            'endurance_race',
  race_half_marathon:  'endurance_race',
  race_marathon:       'endurance_race',
  triathlon:           'triathlon',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Derive the full planning-relevant athlete state from goal and computed features.
 *
 * @param {object} goal     - training_goals row (user intent + constraints)
 * @param {object} features - computeFeatures() output (data-derived signals)
 * @returns {object}        - derived athlete state (rich planning inputs)
 */
function deriveAthleteState(goal, features) {
  const f = features || {};
  const g = goal     || {};

  // ── 1. Goal classification ──────────────────────────────────────────────────

  const primaryGoalFamily = GOAL_FAMILY[g.goal_type] || 'fitness';

  const goalSpecificity = g.event_date  ? 'event'
    : (g.goal_type && g.goal_type !== 'base_fitness' && g.goal_type !== 'general_performance')
      ? 'objective'
      : 'general';

  // Event pressure (0–100): urgency of approaching event
  let eventPressure = 0;
  let weeksToEvent  = null;
  if (g.event_date) {
    const today = new Date();
    const event = new Date(g.event_date + 'T00:00:00Z');
    weeksToEvent = Math.max(0, Math.round((event - today) / (7 * 24 * 3600 * 1000)));
    // Pressure ramps from 0 (>20 weeks away) up to 100 (<4 weeks away)
    if      (weeksToEvent <= 4)  eventPressure = 100;
    else if (weeksToEvent <= 8)  eventPressure = 80;
    else if (weeksToEvent <= 12) eventPressure = 60;
    else if (weeksToEvent <= 16) eventPressure = 40;
    else if (weeksToEvent <= 20) eventPressure = 20;
    else                         eventPressure = 0;
  }

  // ── 2. Schedule analysis ────────────────────────────────────────────────────

  const daysPerWeek = clamp(g.days_per_week || 4, 1, 7);

  // Estimate typical session duration from activity history
  const avgSessionHours =
    (f.sessions_28d && f.sessions_28d > 0 && f.volume_28d_hours != null)
      ? f.volume_28d_hours / f.sessions_28d
      : (f.sessions_7d  && f.sessions_7d  > 0 && f.volume_7d_hours  != null)
        ? f.volume_7d_hours / f.sessions_7d
        : null;

  // Time budget: realistic weekly training time (minutes)
  // Use observed session duration if available, else assume ~60 min/session
  const estimatedSessionMinutes = avgSessionHours
    ? Math.min(Math.round(avgSessionHours * 60), 150) // cap at 2.5h estimate
    : 60;
  const timeBudgetMinutes = daysPerWeek * estimatedSessionMinutes;

  // Schedule rigidity: how tightly constrained are the available days?
  const preferredDays = g.preferred_days || [];
  const scheduleRigidityScore = preferredDays.length > 0
    ? clamp(100 - (preferredDays.length - daysPerWeek) * 20, 20, 90)
    : 50; // neutral default — not specified

  // ── 3. Load history ─────────────────────────────────────────────────────────

  const baselineFrequency28d = f.sessions_per_week ?? 0;

  // Per-week volume averages
  const baselineVolume28d = (f.volume_28d_hours != null && f.volume_28d_hours > 0)
    ? parseFloat((f.volume_28d_hours / 4).toFixed(2))
    : null;

  const acuteLoad7d   = f.volume_7d_hours  ?? 0;
  const chronicLoad28d = baselineVolume28d ?? 0; // h/week

  // Acute-to-chronic ratio (ATL/CTL proxy)
  // < 0.8 = detraining, 0.8–1.3 = optimal, > 1.3 = spike risk
  const acuteToChronicRatio = (chronicLoad28d > 0.5 && acuteLoad7d > 0)
    ? parseFloat((acuteLoad7d / chronicLoad28d).toFixed(2))
    : null;

  // Max single session in 28d (hours) — used for long-session safety cap
  const maxSingleSession28d = f.longest_session_hours ?? 0;

  // For running goals: max long run is the longest session
  const primarySport = f.primary_sport || g.primary_sport || 'Run';
  const isRunningGoal = ['Run', 'running', 'Run/Walk'].includes(primarySport) ||
    ['race_5k','race_10k','race_half_marathon','race_marathon'].includes(g.goal_type);
  const maxLongRun28d = isRunningGoal ? maxSingleSession28d : null;

  // ── 4. Intensity profile ────────────────────────────────────────────────────

  const pctEasy     = f.pct_easy     ?? 70;
  const pctModerate = f.pct_moderate ?? 20;
  const pctHard     = f.pct_hard     ?? 10;

  let baselineIntensityProfile = 'unknown';
  if (f.pct_easy != null) {
    if (pctEasy >= 70 && pctHard >= 15 && pctModerate < 20)     baselineIntensityProfile = 'polarized';
    else if (pctModerate >= 30)                                   baselineIntensityProfile = 'threshold';
    else if (pctEasy >= 70 && pctModerate >= 15 && pctHard < 15) baselineIntensityProfile = 'pyramidal';
    else                                                          baselineIntensityProfile = 'mixed';
  }

  // ── 5. Recovery capacity ────────────────────────────────────────────────────

  let recoveryCapacityScore = 50;
  const rcSources = [];

  if (f.avg_recovery_28d != null) {
    // WHOOP recovery score is the most direct signal
    recoveryCapacityScore = clamp(Math.round(f.avg_recovery_28d), 0, 100);
    rcSources.push('whoop_recovery');
  } else {
    // Build from proxies
    let score = 50;
    if (f.hrv_trend === 'improving')  { score += 15; rcSources.push('hrv_trend+'); }
    if (f.hrv_trend === 'declining')  { score -= 15; rcSources.push('hrv_trend-'); }
    if (f.recovery_trend === 'declining') { score -= 10; rcSources.push('rec_trend-'); }
    if (f.avg_sleep_score_28d != null) {
      // sleep score 0–100: treat 70+ as good, 50 as neutral, below 50 as poor
      score += (f.avg_sleep_score_28d - 60) * 0.4;
      rcSources.push('sleep');
    }
    recoveryCapacityScore = clamp(Math.round(score), 0, 100);
  }

  // ── 6. Fatigue risk ─────────────────────────────────────────────────────────

  let fatigueRiskScore = 20; // default low risk

  // High ACR = recent spike in load relative to baseline
  if (acuteToChronicRatio != null) {
    if (acuteToChronicRatio > 1.5)      fatigueRiskScore += 50;
    else if (acuteToChronicRatio > 1.3) fatigueRiskScore += 30;
    else if (acuteToChronicRatio < 0.7) fatigueRiskScore += 10; // detraining also adds mild risk
  }
  if (recoveryCapacityScore < 34)       fatigueRiskScore += 20;
  if (f.recovery_trend === 'declining') fatigueRiskScore += 10;

  fatigueRiskScore = clamp(fatigueRiskScore, 0, 100);

  // ── 7. Readiness tier ───────────────────────────────────────────────────────

  let readinessTier;
  if      (recoveryCapacityScore >= 67 && fatigueRiskScore < 40) readinessTier = 'high';
  else if (recoveryCapacityScore <  34 || fatigueRiskScore >= 60) readinessTier = 'low';
  else                                                             readinessTier = 'moderate';

  // ── 8. Consistency and adherence risk ──────────────────────────────────────

  const consistencyScore = f.consistency_score ?? 50;
  const activeWeeksOf4   = f.active_weeks_of_last_4 ?? 2;

  let adherenceRisk;
  if      (consistencyScore >= 75 && activeWeeksOf4 >= 3) adherenceRisk = 'low';
  else if (consistencyScore <  40 || activeWeeksOf4 <= 1) adherenceRisk = 'high';
  else                                                     adherenceRisk = 'moderate';

  // ── 9. Training age proxy ───────────────────────────────────────────────────
  //
  // Derived from measurable proxies — not the same as the self-reported 'level'.
  // Used to gate quality session introduction and recovery wave pattern.

  let trainingAgeProxy;
  if (
    baselineFrequency28d >= 4 &&
    (baselineVolume28d || 0) >= 5 &&
    consistencyScore >= 75
  ) {
    trainingAgeProxy = 'experienced';
  } else if (
    baselineFrequency28d >= 2 &&
    (baselineVolume28d || 0) >= 2 &&
    consistencyScore >= 40
  ) {
    trainingAgeProxy = 'recreational';
  } else {
    trainingAgeProxy = 'novice';
  }

  // ── 10. Readiness lead-in calculation ──────────────────────────────────────

  const needsReadinessBlock = _computeNeedsReadinessBlock({
    primaryGoalFamily,
    goalSpecificity,
    goalType: g.goal_type,
    trainingAgeProxy,
    adherenceRisk,
    consistencyScore,
    readinessTier,
    baselineFrequency28d,
    maxLongRun28d,
  });

  let readinessLeadInWeeks = 0;
  if (needsReadinessBlock) {
    if      (trainingAgeProxy === 'novice' || adherenceRisk === 'high') readinessLeadInWeeks = 4;
    else if (readinessTier === 'low'       || adherenceRisk === 'moderate') readinessLeadInWeeks = 3;
    else                                                                    readinessLeadInWeeks = 2;
  }

  // ── 11. Sport-specific readiness ────────────────────────────────────────────

  const sportReadiness = _computeSportReadiness({
    primaryGoalFamily,
    primarySport,
    baselineFrequency28d,
    maxLongRun28d,
    sportMix: f.sport_mix || {},
  });

  // ── 12. Psychological / preference inputs ───────────────────────────────────

  const sleepQuality    = g.sleep_quality    || null; // 'poor'|'moderate'|'good'|null
  const recoveryQuality = g.recovery_quality || null; // 'poor'|'moderate'|'good'|null

  // Composite modifier: shifts load/intensity targets
  // Range: -2 (major reduction) to +1 (can push harder)
  let psychologicalLoadModifier = 0;
  if (sleepQuality    === 'poor')  psychologicalLoadModifier -= 1;
  if (sleepQuality    === 'good')  psychologicalLoadModifier += 0.5;
  if (recoveryQuality === 'poor')  psychologicalLoadModifier -= 1;
  if (recoveryQuality === 'good')  psychologicalLoadModifier += 0.5;
  psychologicalLoadModifier = clamp(psychologicalLoadModifier, -2, 1);

  const environmentPreferenceProfile = {
    indoor_preference:  g.indoor_preference  || 'neutral', // 'indoor'|'outdoor'|'neutral'
    routine_preference: g.routine_vs_variety || 'balanced', // 'routine'|'variety'|'balanced'
    prefers_routine:    g.routine_vs_variety === 'routine',
    prefers_variety:    g.routine_vs_variety === 'variety',
    prefers_indoor:     g.indoor_preference  === 'indoor',
    prefers_outdoor:    g.indoor_preference  === 'outdoor',
  };

  // ── 13. Recovery wave pattern ────────────────────────────────────────────────
  //
  // How frequently to insert recovery weeks within loading blocks:
  //   '2:1' = 2 hard weeks then 1 recovery (deconditioned / poor recovery)
  //   '3:1' = 3 hard weeks then 1 recovery (standard recreational)
  //   '3:1_flex' = 3 hard weeks, can extend to 4 (experienced + good recovery)

  let recoveryWavePattern;
  if (
    trainingAgeProxy === 'novice' ||
    adherenceRisk    === 'high'   ||
    recoveryCapacityScore < 40
  ) {
    recoveryWavePattern = '2:1';
  } else if (
    trainingAgeProxy === 'experienced' &&
    recoveryCapacityScore >= 67
  ) {
    recoveryWavePattern = '3:1_flex';
  } else {
    recoveryWavePattern = '3:1';
  }

  // ── 14. Effective level ──────────────────────────────────────────────────────
  //
  // We use both the self-reported level AND the training-age proxy.
  // When they conflict, defer to the more conservative interpretation.

  const selfReportedLevel = g.level || 'intermediate';
  const trainingAgeLevelMap = { novice: 'beginner', recreational: 'intermediate', experienced: 'advanced' };
  const inferredLevel = trainingAgeLevelMap[trainingAgeProxy];

  // Conservative: take the lower of the two for safety
  const levelOrder = { beginner: 0, intermediate: 1, advanced: 2 };
  const effectiveLevel = (levelOrder[inferredLevel] <= levelOrder[selfReportedLevel])
    ? inferredLevel
    : selfReportedLevel;

  // ── Assemble and return ──────────────────────────────────────────────────────

  return {
    // Goal classification
    primary_goal_family:     primaryGoalFamily,
    goal_specificity:        goalSpecificity,
    event_pressure:          eventPressure,
    weeks_to_event:          weeksToEvent,

    // Schedule
    days_per_week:           daysPerWeek,
    time_budget_minutes:     timeBudgetMinutes,
    schedule_rigidity_score: scheduleRigidityScore,

    // Load history (primary volume anchors)
    baseline_frequency_28d:  baselineFrequency28d,
    baseline_volume_28d:     baselineVolume28d,    // hours/week
    acute_load_7d:           acuteLoad7d,          // hours this week
    chronic_load_28d:        chronicLoad28d,        // hours/week (28d avg)
    acute_to_chronic_ratio:  acuteToChronicRatio,
    max_single_session_28d:  maxSingleSession28d,   // hours — long-session safety cap
    max_long_run_28d:        maxLongRun28d,         // hours (running goals only)

    // Intensity
    baseline_intensity_profile: baselineIntensityProfile,
    pct_easy:     pctEasy,
    pct_moderate: pctModerate,
    pct_hard:     pctHard,

    // Readiness & recovery
    recovery_capacity_score:    recoveryCapacityScore,
    recovery_capacity_sources:  rcSources,
    fatigue_risk_score:         fatigueRiskScore,
    readiness_tier:             readinessTier,

    // Adherence
    adherence_risk:          adherenceRisk,
    consistency_score:       consistencyScore,
    training_age_proxy:      trainingAgeProxy,
    recovery_wave_pattern:   recoveryWavePattern,

    // Readiness lead-in
    needs_readiness_block:   needsReadinessBlock,
    readiness_lead_in_weeks: readinessLeadInWeeks,

    // Sport readiness
    sport_readiness:         sportReadiness,
    primary_sport:           primarySport,

    // Preferences & psychology
    environment_preference_profile:  environmentPreferenceProfile,
    sleep_quality:                   sleepQuality,
    recovery_quality:                recoveryQuality,
    psychological_load_modifier:     psychologicalLoadModifier,

    // Effective planning level (conservative composite)
    effective_level:         effectiveLevel,
    level:                   selfReportedLevel,
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Determine whether the athlete needs a readiness lead-in block before the
 * event-specific plan begins.
 *
 * Rules:
 *  - Fitness and weight-loss goals don't need an extra lead-in (they start
 *    conservatively by definition).
 *  - For event goals, check if the athlete has the minimum conditioning
 *    foundation to handle event-specific demands from week 1.
 *  - Athletes with very low consistency, low readiness, or no base exposure
 *    should get a readiness block first.
 */
function _computeNeedsReadinessBlock({
  primaryGoalFamily,
  goalSpecificity,
  goalType,
  trainingAgeProxy,
  adherenceRisk,
  consistencyScore,
  readinessTier,
  baselineFrequency28d,
  maxLongRun28d,
}) {
  // Fitness and weight-loss plans already start with conservative base work
  if (primaryGoalFamily === 'fitness' || primaryGoalFamily === 'weight_loss') {
    return false;
  }

  // Objective (no event) — add readiness if truly deconditioned
  if (goalSpecificity === 'objective' || goalSpecificity === 'general') {
    return trainingAgeProxy === 'novice' && adherenceRisk === 'high';
  }

  // Event-specific checks by distance
  if (goalType === 'race_marathon') {
    // Marathon demands high base. Need: ≥3 runs/wk, recent long run, consistency
    return (
      trainingAgeProxy === 'novice'    ||
      baselineFrequency28d < 3         ||
      adherenceRisk        === 'high'  ||
      (maxLongRun28d != null && maxLongRun28d < 1.0) || // <1h long run in last 28d
      consistencyScore < 50
    );
  }

  if (goalType === 'race_half_marathon') {
    return (
      trainingAgeProxy === 'novice'    ||
      baselineFrequency28d < 2         ||
      adherenceRisk        === 'high'  ||
      consistencyScore < 40
    );
  }

  if (goalType === 'race_5k' || goalType === 'race_10k') {
    // Lower bar — only add lead-in if truly unready
    return (trainingAgeProxy === 'novice' && adherenceRisk !== 'low');
  }

  if (goalType === 'triathlon') {
    // Triathlon demands multi-discipline readiness
    return (
      trainingAgeProxy === 'novice'    ||
      baselineFrequency28d < 3         ||
      adherenceRisk        === 'high'  ||
      consistencyScore < 50
    );
  }

  // For any other event-specific goal with low readiness
  if (readinessTier === 'low' && consistencyScore < 40) return true;

  return false;
}

/**
 * Compute sport-specific readiness indicators.
 * Used to detect discipline limiters (especially for triathlon).
 */
function _computeSportReadiness({
  primaryGoalFamily,
  primarySport,
  baselineFrequency28d,
  maxLongRun28d,
  sportMix,
}) {
  const readiness = {
    primary_sport:                    primarySport,
    is_ready_for_event_specific_work: true,
    min_weekly_sessions_met:          baselineFrequency28d >= 2,
    notes:                            [],
  };

  if (primaryGoalFamily === 'triathlon') {
    readiness.run_ready  = (sportMix['Run']  || 0) >= 20;
    readiness.bike_ready = (sportMix['Ride'] || 0) >= 20;
    readiness.swim_ready = (sportMix['Swim'] || 0) >= 15;

    if (!readiness.run_ready)  readiness.notes.push('Run under-represented in recent training');
    if (!readiness.bike_ready) readiness.notes.push('Bike under-represented');
    if (!readiness.swim_ready) readiness.notes.push('Swim limiter detected — swim under-represented');

    readiness.is_ready_for_event_specific_work =
      readiness.run_ready && readiness.bike_ready;
  } else if (maxLongRun28d != null && maxLongRun28d < 0.75) {
    readiness.notes.push('Recent long run exposure low — gradual long-run progression required');
    readiness.is_ready_for_event_specific_work = baselineFrequency28d >= 2;
  }

  return readiness;
}

module.exports = { deriveAthleteState };
