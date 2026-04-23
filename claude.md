# CLAUDE.md

## Project Overview

This repo is a training dashboard app that combines **Strava** and **WHOOP** data, with **Supabase** as the source of truth.

The app already supports:
- auth / login
- Google sign-in
- protected dashboard routes
- Strava OAuth + manual import
- WHOOP OAuth + manual import
- webhook infrastructure for Strava and WHOOP
- incremental sync behavior
- dashboard pages reading normalized Supabase data

The current product expansion is an **AI training planner**, but it is intentionally a **hybrid planner**, not a freeform AI coach.

---

## Core Architecture Rules

These rules are non-negotiable unless explicitly changed.

### Source of truth
- Supabase is the source of truth.
- Provider data is synced into Supabase.
- Raw provider payloads are stored for backup, debugging, and reprocessing.
- Normalized app tables power the app.
- Dashboard pages read from Supabase, not directly from live provider APIs.
- Planner data must remain user-scoped and protected by RLS.

### Planner architecture
Use the **hybrid engine** model:

- **Code owns**
  - plan structure
  - progression logic
  - constraints
  - safety
  - validation
  - scheduling
  - workout filtering
  - workout scoring
  - adaptation rules
  - deterministic matching logic later

- **AI owns**
  - naming
  - explanations
  - summaries
  - rationale
  - bounded personalization only

### Hard constraints
- Do **not** send raw provider tables directly into planner logic.
- Stable features must be computed first and used as planner inputs.
- Workout sessions must come from a **bounded parameterized workout library**.
- AI must **not** invent freeform workout logic.
- The app shows the **full plan at week level**.
- Only the **current 7 days** should be detailed.
- Future weeks remain high-level.
- Support:
  - full-data users
  - partial-data users
  - low-data users

---

## Current Product State

Assume this is already implemented unless the code clearly contradicts it.

### Phase 1 — Planning foundation
Completed:
- goal intake
- athlete context snapshots
- stable feature generation
- deterministic cycle / block / week planner
- plan persistence at cycle / block / week level
- planner overview UI

Planner tables:
- `training_goals`
- `athlete_context_snapshots`
- `derived_training_features`
- `training_plan_cycles`
- `training_plan_blocks`
- `training_plan_weeks`

### Phase 2A — Current-week scheduler foundation
Completed:
- scheduling tables are in use:
  - `workout_library`
  - `training_plan_days`
  - `training_plan_sessions`

`workout_library` includes scheduler metadata:
- `slot_type`
- `week_types`
- `recovery_cost`
- `equipment_requirements`
- `contraindications`
- `progression_family`

Workout library coverage has already been expanded to 41 templates.

Completed scheduler / selection work:
- `pickWorkout()` takes:
  - `sport`
  - `slotType`
  - `sessionType`
  - `blockType`
  - `weekType`
  - `level`
- selection already uses slot/week-aware filtering and fallback
- scheduler uses `slot_type` on day rows
- recovery week days use `slot_type = 'recovery'`

Completed lifecycle work:
- lifecycle states:
  - `pre_start`
  - `active`
  - `completed`
- schedule generation is lifecycle-aware
- non-active plans block schedule generation with explicit errors
- routes and UI already handle lifecycle-aware schedule states

Completed tests:
- workout library tests
- lifecycle tests

### Phase 3 — First scoring slice
Already completed:
- `api/services/plannerScoring.js`
- `computeReadinessScore(features)`:
  - derives score / tier / source from recovery-related signals
- `computeLoadTolerance(features)`:
  - derives score / tier / source from consistency, sessions per week, and low-volume penalties
- `computeSchedulingContext(features)`:
  - combines readiness + load tolerance into current-week scheduling context
  - includes `hardSessionCapReduction`
  - includes `readinessTier`

Scheduler integration already completed:
- `buildSchedule()` accepts optional `scoringCtx`
- low readiness / low load tolerance can reduce weekly hard sessions by 1
- `readinessTier` is passed into workout selection
- low readiness biases selection toward lower recovery-cost workouts
- existing behavior is preserved when `scoringCtx` is null

Testing already exists for:
- readiness scoring
- load tolerance scoring
- scheduling context
- scheduler integration for the current cap behavior

### Important current state
The system already has:
- deterministic week-level planning
- deterministic current-week scheduling
- bounded workout library selection
- lifecycle-aware schedule generation
- initial score-aware scheduling
- no AI dependency for valid schedule generation

---

## Current Development Focus

The repo is now in **Phase 3 — Scoring and adaptation**.

The next work should stay inside Phase 3 before moving to execution feedback.

### Preferred next implementation slice
Unless the code clearly shows a better immediate gap, the next step should be:

1. add **confidence / resilience scoring**
2. refactor selection toward explicit **session suitability scoring**
3. deepen current-week adaptation slightly beyond the initial hard-session cap
4. keep all logic deterministic, interpretable, and bounded

### What should still be added in Phase 3
Target additions:
- `confidence / resilience` score
- component-based session suitability scoring
- more explicit candidate scoring breakdown
- inspectable current-week adaptation reasons
- limited adaptation of:
  - quality density
  - long-session aggressiveness
  - lower-cost / lower-risk workout preference

### What “session suitability scoring” should mean
Move toward explicit candidate scoring components, for example:
- week objective fit
- day slot fit
- athlete level fit
- readiness / recovery fit
- load tolerance fit
- confidence / resilience fit
- equipment fit
- contraindication penalty
- progression-family alignment
- recent training fit

Code must retain final authority.
Filtering and validation remain code-driven.

### What “deepen adaptation” should mean
Stay narrow and current-week only. Examples:
- reduce long-session target when load tolerance is weak
- prefer lower-risk quality variants when readiness is low
- keep existing quality-session cap behavior unless a cleaner equivalent is clearly better
- make adaptation reasons inspectable for logging and future UI

---

## Intentionally Out of Scope Right Now

Do not drift into these areas unless the task explicitly requires them.

- activity-to-plan matching
- compliance tracking
- session completion workflow
- webhook-driven adaptation
- automatic rescheduling from new readiness signals
- future-week daily scheduling
- polished coaching chat UX
- large speculative schema redesign

These belong later, primarily in execution feedback phases.

---

## Coding Principles For This Repo

### 1. Verify before changing
Before making changes:
- inspect the relevant code paths
- verify what is already implemented
- do not re-implement completed milestones
- do not broaden scope unnecessarily

### 2. Prefer narrow, high-value slices
When choosing the next step:
- prefer backend-first
- prefer deterministic logic
- prefer the smallest slice that materially improves scheduling quality
- avoid speculative abstractions unless already justified by the repo

### 3. Preserve architecture
Do not:
- bypass Supabase
- move planner logic into prompts
- make AI responsible for scheduling correctness
- introduce freeform workout generation
- generate long-range rigid daily plans

### 4. Keep planner logic interpretable
When adding scoring or selection logic:
- use multiple interpretable components
- avoid a single black-box master score
- make rationale inspectable in code and tests
- keep final authority in deterministic code

### 5. Support missing-data users
Planner logic must degrade gracefully across:
- full-data mode
- partial-data mode
- low-data mode

Do not assume both Strava and WHOOP are available.

---

## Expectations For Claude When Working In This Repo

When responding to a task:
1. Read the repo and this file first.
2. Confirm what is already implemented.
3. Identify what is missing.
4. Recommend the narrowest sensible next step.
5. List exact files to change before coding.
6. Call out schema impact explicitly.
7. Implement with tests.
8. Report clearly what changed and what was intentionally deferred.

### Preferred response structure before implementation
- What is already implemented
- What is missing
- Recommended next slice
- Why it comes next
- Files to change
- Schema impact
- Risks / tradeoffs

### Preferred response structure after implementation
- What changed
- Why
- Files changed
- Migration details
- Tests added / updated
- Deferred follow-ups

---

## Non-Negotiable Product Rules

These are settled decisions unless explicitly changed later:

- use the hybrid engine
- global plan and progression are code-driven
- AI is used for descriptions, explanations, naming, and bounded ranking only
- support 7-day detailed scheduling
- use multiple interpretable scores, not one black-box score
- support users with full, partial, or no provider data
- use a parameterized workout library
- code filters and scores candidate workouts
- AI may rank among valid candidates later, but code stays in control
- future activity-to-plan matching will be deterministic backend logic

---

## If You Notice More Is Already Built

If the code already contains more than this document suggests:
- do not ignore it
- update your assessment
- build on the real codebase state
- keep the architecture constraints intact