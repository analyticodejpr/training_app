# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Development Commands

### Backend (Express API)

```bash
# Run locally (loads env from backend/.env)
node api/server.js

# Run all tests (Node built-in test runner — no Jest)
npm test
# "npm test" = node --test api/services/__tests__/**/*.test.js

# Run a single test file
node --test api/services/__tests__/scheduler.test.js
node --test api/services/__tests__/plannerScoring.test.js

# Named test subsets
npm run test:features   # featureGenerator.test.js
npm run test:planner    # planner.test.js
```

### Frontend (Vite + React)

```bash
cd frontend
npm run dev      # Vite dev server (hot reload)
npm run build    # Production build → frontend/dist/
npm run preview  # Preview the production build locally
```

### Deployment

- **Frontend** → Vercel (auto-deploys from GitHub `main` via `vercel-build` script)
- **Backend** → Railway (NOT connected to GitHub; must deploy manually):
  ```bash
  railway up --service training-api
  ```
  The Railway service runs `node api/server.js`. Never use the "Redeploy" button — it only restarts the existing container without pushing new code.

### Environment

- Backend reads `backend/.env` — contains `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY`, `STRAVA_CLIENT_ID/SECRET`, `WHOOP_CLIENT_ID/SECRET`, `TOKEN_ENCRYPTION_KEY`, `FRONTEND_URL`.
- Frontend reads `frontend/.env.local` — contains `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL`.

---

## Architecture Overview

### Two-service split

```
frontend/   React 18 + Vite SPA        → Vercel
api/        Express REST API            → Railway (via api/server.js locally, api/[...path].js on Vercel)
backend/    Legacy backend (not in use) — ignore
```

The frontend and backend are **separate deployments** that communicate over HTTP. The frontend calls `VITE_API_URL/api/...` with a Bearer session token. The backend mounts all routes under `/api/`.

### Authentication flow

Supabase Auth handles login (Google OAuth via PKCE). After sign-in the frontend holds a Supabase session. Every API request sends `X-Supabase-Token: <supabase_jwt>`. The `requireSupabaseUser` middleware (`api/middleware/requireSupabaseUser.js`) validates the JWT against Supabase and attaches `req.supabaseUser`. Provider OAuth tokens (Strava, WHOOP) are encrypted with AES and stored in a session blob returned as `X-Session-Token` in responses.

### Data pipeline

```
Strava / WHOOP APIs
  → api/services/stravaSync.js / whoopSync.js   (normalise + upsert raw payloads)
  → Supabase tables: activities, whoop_daily_metrics, raw_*
  → api/services/featureGenerator.js            (compute derived_training_features)
  → api/services/plannerOrchestrator.js         (generate plan: cycle → blocks → weeks)
  → api/services/schedulerOrchestrator.js       (generate current-week days + sessions)
  → Frontend reads directly from Supabase via hooks
```

Frontend **never** reads live provider APIs — it reads only from Supabase.

### Frontend data hooks

All Supabase reads go through hooks in `frontend/src/hooks/`:
- `useSupabaseMetrics` — WHOOP daily metrics
- `useSupabaseActivities` — Strava activities
- `usePlanner` — plan goal, current-week schedule (`usePlannerGoal`, `useCurrentWeekSchedule`)
- `useDesktop` — responsive breakpoint (≥1024px = desktop layout)
- `useTheme` — light/dark theme, persisted to `localStorage`, applies `data-theme` on `<html>`

### Responsive layout

`App.jsx` (`AuthedApp`) uses `useDesktop()` to branch:
- **Desktop (≥1024px)**: `DesktopSidebar` (220px fixed) + scrollable main. Route `/` renders `DesktopDashboard`.
- **Mobile (<1024px)**: `MobileHeader` + `BottomNav` shell. Route `/` renders `DashboardPage`.

All other routes (`/activities`, `/training`, `/account`, etc.) share the same page components across both layouts.

### Theme system

CSS design tokens live in `frontend/src/index.css` under `:root` (light) and `[data-theme="dark"]`. The dark palette is already fully defined — components must use `var(--surface)`, `var(--border)`, `var(--text)`, `var(--text-muted)` etc. rather than hardcoded hex to participate in the theme. `useTheme` writes `data-theme` to `document.documentElement`.

### Planner service layer (backend)

All planner logic is deterministic code — AI is not involved in scheduling:

| File | Responsibility |
|------|---------------|
| `featureGenerator.js` | Computes `derived_training_features` from raw activity + WHOOP data |
| `athleteState.js` | Derives athlete level, data mode (full / partial / low) |
| `plannerScoring.js` | `computeReadinessScore`, `computeLoadTolerance`, `computeSchedulingContext` |
| `planner.js` | Generates cycle → blocks → weeks (macro structure) |
| `plannerOrchestrator.js` | End-to-end plan generation + Supabase persistence |
| `scheduler.js` | Assigns workouts to days for the current week using `pickWorkout()` |
| `schedulerOrchestrator.js` | Lifecycle check + schedule generation + persistence |
| `workoutLibrary.js` | 41-template bounded workout library; slug-keyed |

Orchestrators are the **only** modules that write to Supabase. Service files are pure logic.

### Key Supabase tables

**Auth / user:** `profiles`

**Provider data:** `activities` (Strava), `whoop_daily_metrics`, raw backup tables

**Planner:** `training_goals` → `training_plan_cycles` → `training_plan_blocks` → `training_plan_weeks` → `training_plan_days` → `training_plan_sessions`

**Computed:** `derived_training_features`, `athlete_context_snapshots`

**Library:** `workout_library`

All planner tables have RLS scoped to `user_id`. The backend uses the service-role key (bypasses RLS) but always scopes writes to the verified `supabaseUser.id`.

### API routes

```
/api/auth/*       — Supabase token verification, Strava/WHOOP OAuth callbacks
/api/strava/*     — Import recent, import 90 days, disconnect
/api/whoop/*      — Import recent, import 90 days, disconnect
/api/planner/*    — Generate plan, get schedule, lifecycle operations
/api/webhooks/*   — Strava + WHOOP inbound webhooks (HMAC verified)
```

### Test runner

Tests use **Node's built-in `node:test` module** (no Jest, no Mocha). Files live in `api/services/__tests__/`. Run individual files with `node --test <path>`.

---

## Current Development Phase

The planner is in **Phase 3 — Scoring and adaptation**. Do not add execution feedback, compliance tracking, activity-to-plan matching, or future-week daily scheduling — those are explicitly out of scope. Phase 3 targets:

- confidence / resilience scoring component
- explicit session suitability scoring (replacing opaque `pickWorkout` fallbacks)
- deeper current-week adaptation (long-session aggressiveness, quality density)

All scoring must use multiple interpretable components, not a single master score.
