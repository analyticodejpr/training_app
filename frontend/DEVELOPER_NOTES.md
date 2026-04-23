# Developer Notes — Performance Dashboard

## What Was Implemented

### New Components
| Component | Route | Purpose |
|-----------|-------|---------|
| `src/components/QuadrantScatter.jsx` | `/` (homepage) | Readiness vs Load quadrant scatter. X=recovery %, Y=WHOOP strain. One point per day. Dot color = sleep quality bucket. Dot size ∝ daily Strava volume. Four quadrant labels: Productive / Risk Zone / Unused Opportunity / Recovery Day. |
| `src/components/WeeklyLoadSummary.jsx` | `/training` | Weekly Load Structure panel. Period-level totals (sessions, hours, km) + bar/line ComposedChart showing session count per week (bars) and total hours per week (line). |

### Updated Pages
| File | Change |
|------|--------|
| `src/pages/DashboardPage.jsx` | Section 3 now uses `QuadrantScatter` instead of `ReadinessScatter` (which was a time-series chart, not the spec's quadrant scatter). |
| `src/pages/TrainingPage.jsx` | Layout reorganized to match spec: (1) WeeklyComposition → (2) WeeklyLoadSummary + SessionCostScatter → (3) PerformanceTrend + SportMix+Density → (4) ActivityList. SportMixCard now shows sessions/week density stat. |

### Updated Utilities
| File | Change |
|------|--------|
| `src/utils/metrics.js` | Added `computeSessionDensity(activities)` — returns sessions/week and avg session duration per sport type. Used by TrainingPage SportMix section. |

### Preserved (unchanged, already matched spec)
- `RecoveryHero` + CompanionCells (HRV / RHR / Sleep / Yesterday Strain)
- `SmallMultiplesPanel` (5-chart aligned time-series with sync)
- `AcuteChronicChart` (7-day vs 28-day strain + balanced zone)
- `HeatmapCalendar` (10-week grid)
- `RecoveryDriversChart` (heuristic decomposition using sleep, HRV, RHR, strain, respiratory rate)
- `SleepMatrixChart` (per-night stage composition)
- Sleep Consistency + Debt inline chart (RecoveryPage)
- Sleep → Performance scatter (RecoveryPage)
- `RecoveryLagChart` (D+0 to D+3 recovery after hard sessions)
- All ProgressPage charts (Cumulative, Monthly Balance, Consistency, Rec vs Volume, Pace/Speed trajectories)
- `DateRangeContext` global period filter (Today / 7d / 30d / 3M / All)
- `metrics.js` shared analytics layer
- `Nav.jsx` + `Header.jsx`
- `ReadinessScatter.jsx` (renamed conceptually to "Recovery Over Time" — preserved as component, no longer on homepage)

---

## Fallbacks Used

| Requested Feature | Limitation | Fallback Applied |
|---|---|---|
| Quadrant dot color = sport type | dailyGrain.types is a count map, not a single dominant sport; sport mix per day is ambiguous | Color by sleep quality bucket (≥70% green / 50–69% amber / <50% red) — more diagnostically useful for recovery decisions. Sport types shown in tooltip. |
| Quadrant dot size = session duration | `dailyGrain.totalTime` is the sum of all Strava sessions that day | Uses `totalTime` directly — accurate for single-session days, aggregated for multi-session days |
| Sleep bedtime regularity | `start_date_local` is available on Strava activities, but WHOOP daily summary does not include bedtime/wake timestamps | SleepMatrixChart shows duration + score + stage composition (from `sleep_rem_ms`, `sleep_slow_wave`) instead of timing visualization |
| Weekly Load Structure — WHOOP strain as load | WHOOP strain is available but plan calls for a training-load view (Strava sessions) | Uses Strava `moving_time` as volume proxy; WHOOP strain remains in AcuteChronicChart on homepage |

---

## Skipped / Feature-Flagged

| Requested Feature | Reason Skipped |
|---|---|
| `/context` page | No weather, temperature, altitude, or environment data exists in the codebase. This route was explicitly not created. |
| Weather-adjusted session performance chart | Same reason — no external context data. |
| HR zone breakdown | `average_heartrate` is available on Strava activities but zone thresholds (e.g., max HR, zone boundaries) are not configured. Zone-level analysis would require either athlete max HR from Strava stats or user-configured zones. |
| Power metrics | Not in Strava API response for this integration (no `watts` field confirmed). |
| Lap-level breakdowns | Requires `getActivityDetail(id)` per-activity fetch — not feasible at dashboard scale without pagination and per-request caching. |
| Swim-specific efficiency | Too few reliable data points for most users; pace for swims (distance/time) is technically feasible but excluded to avoid showing misleading metrics for short pool sets. |

---

## Data Field Reference

### WHOOP daily fields (confirmed in `getDailySummary`)
`date`, `recovery_score`, `hrv_rmssd`, `resting_hr`, `spo2`, `skin_temp`, `strain`, `kilojoules`, `avg_hr`, `max_hr`, `sleep_performance`, `sleep_duration_ms`, `sleep_rem_ms`, `sleep_slow_wave`, `sleep_awake_ms`, `disturbances`, `respiratory_rate`

### Strava activity fields (confirmed in `getActivities`)
`id`, `name`, `type`, `distance`, `moving_time`, `total_elevation_gain`, `start_date`, `start_date_local`, `average_heartrate`

### External / context fields
None. No weather or environment integration exists.

---

## Architecture Notes

All derived metrics are centralized in `src/utils/metrics.js`. Page components contain no business logic — they call utility functions and pass results to chart components. Chart components are pure presentation (data in → SVG out).

The global `DateRangeContext` drives all period filtering. Charts that use a fixed internal window (e.g., AcuteChronicChart using the full 90-day WHOOP history for its 28-day chronic baseline) document this in code comments.
