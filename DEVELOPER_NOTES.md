# Developer Notes — Analytics Redesign

## What Was Implemented

### Architecture Changes

| Layer | Before | After |
|-------|--------|-------|
| Routing | `/` → login, `/dashboard` → single page | `/` daily, `/training`, `/recovery`, `/progress` |
| Navigation | Tab buttons inside DashboardPage | Sticky `Nav.jsx` with page links + date range |
| Date filter | Local state inside DashboardPage | `DateRangeContext` shared across all pages |
| Data fetching | Direct API calls in DashboardPage | `useWhoop` / `useStrava` hooks used in each page |
| Analytics | Inline ad-hoc computations | `src/utils/metrics.js` — all formulas centralised |

### New Files

```
src/
├── context/
│   └── DateRangeContext.jsx       — Global date range (Today / 7d / 30d / 90d / All)
├── utils/
│   └── metrics.js                 — All derived metric formulas (pure functions)
├── components/
│   ├── Nav.jsx                    — Sticky navigation + date range pills
│   ├── ConnectCard.jsx            — Reusable "connect platform" prompt
│   ├── SmallMultiplesPanel.jsx    — 5 aligned synced time-series mini-charts
│   ├── ReadinessScatter.jsx       — Quadrant scatter: recovery vs strain
│   ├── AcuteChronicChart.jsx      — 7d/28d load ratio with balanced zone band
│   ├── HeatmapCalendar.jsx        — 10-week strain heatmap + recovery borders
│   ├── WeeklyCompositionChart.jsx — Stacked sport bar, time/distance toggle
│   ├── SessionCostScatter.jsx     — Session size → next-day recovery delta
│   ├── PerformanceTrendChart.jsx  — Pace (runs) + speed (rides) weekly trend
│   ├── RecoveryDriversChart.jsx   — App-defined recovery decomposition bars
│   ├── SleepMatrixChart.jsx       — Per-night sleep stage strip matrix
│   └── RecoveryLagChart.jsx       — Avg recovery D+0 → D+3 after hard sessions
└── pages/
    ├── DashboardPage.jsx          — Refactored: summary strip + 4 chart sections
    ├── TrainingPage.jsx           — /training: composition, cost, performance, mix
    ├── RecoveryPage.jsx           — /recovery: drivers, sleep, lag
    └── ProgressPage.jsx           — /progress: cumulative, monthly, consistency
```

---

## Data Field Availability

### WHOOP daily fields used (confirmed in whoopService.js)

| Field | Used in |
|-------|---------|
| `recovery_score` | All pages |
| `hrv_rmssd` | Dashboard, Recovery, metrics.js |
| `resting_hr` | Dashboard, Recovery, metrics.js |
| `strain` | Dashboard, Training, AcuteChronicChart |
| `kilojoules` | (available but not charted — low user value vs strain) |
| `avg_hr`, `max_hr` | Available, not charted (no per-sport context) |
| `spo2` | Dashboard summary strip |
| `skin_temp` | Available in whoopService but not charted |
| `sleep_performance` | Dashboard, Recovery, all sleep charts |
| `sleep_duration_ms` | SleepMatrix, SleepConsistency |
| `sleep_rem_ms` | SleepMatrix |
| `sleep_slow_wave` | SleepMatrix |
| `sleep_awake_ms` | SleepMatrix |
| `disturbances` | SleepMatrix |
| `respiratory_rate` | RecoveryDrivers |

### Strava activity fields used (confirmed in stravaService.js)

| Field | Used in |
|-------|---------|
| `type` | All training charts, sport filtering |
| `distance` | Cumulative, pace, session cost, weekly composition |
| `moving_time` | All load and pace calculations |
| `total_elevation_gain` | SessionCostScatter (dot size), Cumulative |
| `start_date_local` | All date alignment |
| `average_heartrate` | SessionCostScatter tooltip (if available) |
| `name` | Activity table, tooltips |

---

## Charts With Fallbacks

### AcuteChronicChart
- **Primary**: WHOOP `strain` field
- **Fallback**: If strain is null for a day but Strava session time exists, uses `totalTime / 360` as a rough strain proxy (6h training ≈ strain 10)
- **Code**: `src/components/AcuteChronicChart.jsx`, line where `_isFallback` is set

### PerformanceTrendChart
- **Limitation**: Pace derived from `moving_time ÷ distance`. Open-water swims often have unreliable GPS distance — swim data excluded
- **Ride efficiency**: `distance ÷ moving_time → km/h`. Does not account for wind or gradient

### Sleep debt proxy (RecoveryPage)
- **Target**: 8 hours assumed as universal sleep need
- **WHOOP limitation**: The API does not expose individual sleep need or need-based debt
- **Documented**: inline comment in RecoveryPage.jsx

### RecoveryDriversChart
- Uses an **app-defined heuristic** with visible weights, not WHOOP's proprietary algorithm
- Explicitly documented in the component header and UI copy

### SessionCostScatter
- **Limitation**: Only shows sessions where the corresponding WHOOP data exists for both the session day and the next day
- Sessions without next-day WHOOP data are silently excluded

---

## Charts Skipped / Not Implemented

| Chart | Reason |
|-------|--------|
| Weather / Environment page | No weather data in the integration. Left as a pluggable adapter point. |
| HR zones breakdown | Strava `average_heartrate` is available but zone boundaries require user-configured HR max — not in the API response |
| Power analysis | Not exposed in the Strava activities list endpoint |
| Cadence, stride length | Not in the Strava activities list response |
| Swim pace | Excluded: open-water distance is unreliable in GPS data |
| WHOOP sleep timing (bed/wake time) | The `start` field exists in raw WHOOP sleep records but is not extracted in the current `whoopService.getDailySummary()` normalisation. Could be added. |
| PR / best effort engine | Activity stream endpoints would be needed for accurate segment-level PRs. Weekly best pace is used as a conservative proxy. |

---

## Strava Pagination Limitation

The current `stravaService.getActivities()` fetches a single page (`perPage` up to 200). For athletes with long history, the cumulative and monthly charts will only reflect the most recent 200 activities. To resolve this, implement multi-page fetching in `stravaService.js` and cache the result in SQLite.

---

## Adding Weather / Environment Data (Future)

To enable the skipped `/context` page or weather-adjusted performance charts:

1. Add a weather API (OpenWeatherMap, Tomorrow.io) to the backend
2. Fetch and store daily weather keyed by date in the SQLite cache
3. Expose a `GET /api/weather/daily` endpoint
4. Add `getWeatherDaily()` to `src/utils/api.js`
5. Merge into `buildDailyGrain()` in `metrics.js`

No frontend changes to chart logic are needed — the scatter and comparison charts already accept `dailyGrain` which can be extended with weather fields.
