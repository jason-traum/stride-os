# Dreamy Feature Audit — 2026-02-21

**Purpose:** Catalog every user request and assess what was actually implemented vs claimed.

## Summary Statistics

| Category | Count |
|----------|-------|
| DONE (confirmed in code) | ~130 items (was ~110, +20 from evening session) |
| PARTIAL (started, incomplete) | ~12 items (was ~20, many promoted to DONE) |
| CLAIMED DONE / STALE TRACKER | ~3 items (was ~8, most resolved) |
| TODO (not started) | ~52 items (was ~65, 13 completed) |

---

## Critical Discrepancies (Tracker vs Reality)

### Silently Broken

| Item | Tracker Status | Reality |
|------|---------------|---------|
| Import page (`/import`) | Not tracked | UI exists, files parse, but **activities never saved** — `src/app/import/page.tsx:43` has `// TODO: Process and save activities` |
| Coach Memory (`/memory`) | Done | Page exists but `conversationSummaries` table not in schema — `conversation-compression.ts` and `local-intelligence.ts` have queries commented out |
| Push notifications | Setting exists | `pushNotifications: true` in settings but **zero push infrastructure** |

### Stale Tracker Entries

| Item | Tracker Says | Reality |
|------|-------------|---------|
| Fix OAuth Flow | "Still issues" (TODO) | Actually working per STRAVA_SUBMISSION_PLAN 2026-02-18. **Tracker not updated.** |
| Runs by Day invisible color | TODO | **Fixed tonight** (commit ebb831c). Tracker not updated. |
| EnhancedSplits rename | TODO | Primary header is "Workout Splits" (done). "Mile Splits (Interpolated)" still shows for interpolated view mode. |

### Half-Done Features

| Item | What Exists | What's Missing |
|------|------------|----------------|
| Cheaper model tips popup | Was in CoachHeader | CoachHeader was deleted in "Chat Page Simplification" — needs redesign, not restoration |
| Main /log page sliders | QuickLogModal has sliders | Actual `/log` page still uses traditional inputs (backlog D-044 not done for primary path) |
| Hardcoded profileId:1 | Some fixed (commit 3a08e89) | coach-tools.ts still has edge cases |
| Schema mismatches (SQLite vs Postgres) | Some fixed | "Some edge cases may remain" |
| Strava full-access submission | Checklist + docs exist | Secret rotation, webhook validation, evidence pack, form submission all pending |
| Execution scorer paces | Reads from settings | Falls back to hardcoded defaults if no settings — VDOT-derived fallback now added (Phase 1 fix) |

---

## Section 1: Critical Bug Fixes (All Done)

| Item | Status | Evidence |
|------|--------|----------|
| Fix prescribeWorkout function | DONE | commit 07e8728 |
| Fix getRaceDayPlan function | DONE | commit d1b60cd |
| Fix context persistence (coachContext) | DONE | coachContext table in schema |
| Post-Run Questions show as user messages | DONE | commit 2026-02-13 |
| Loading indicator not visible during chat | DONE | commit 2026-02-13 |
| Fix greeting bug ("Good morning, Coach") | DONE | DynamicGreeting component |
| HR Zone Calculation Wrong (169 as Z5) | DONE | Tanaka formula confirmed |
| Elevation Profile Only Additive | DONE | commit d4b0004 |
| Effort Distribution Distance Wrong | DONE | commit 2026-02-13 |
| Z3 Color Invisible (white on white) | DONE | CHANGELOG-FIXES confirms fix |
| Modal Scrolling Issue | DONE | useModalBodyLock hook |
| Alerts Persistence | DONE | localStorage dismissal |
| Strava Activities Not Showing in History | DONE | Math.round() fix |
| PaceTrendChart formatting ("8:352") | DONE | formatPace() from utils |
| Consolidate formatPace() | DONE | Single source in utils |
| Consolidate VDOT calculation | DONE | vdot-calculator.ts |
| Fix elevation profile | DONE | commit d4b0004 |
| Timezone Date Parsing Bug | DONE | commit 33735c7 (Phase 1 sweep) |

---

## Section 2: Completed Features

| Item | Status | Evidence |
|------|--------|----------|
| Professional Dark Mode System | DONE (95%) | 908/955 colors fixed |
| Manual API Key Entry for Strava | DONE | commit db45c70 |
| Logo Integration | DONE | Image files confirmed |
| Workout Segment Type Bar on History Cards | DONE | effort classification system |
| Unified Color System Audit | DONE | workout-colors.ts |
| Enhanced Runner Profile | DONE | Rich options in profile/page.tsx |
| Move API Usage/Shoes/Memory to Settings | DONE | Settings hub sub-pages |
| Show Strava Activity Names | DONE | stravaName in schema |
| Add Maps to Activities | DONE | RouteMap.tsx |
| Easy Run Deletion | DONE | Delete button on detail + history |
| HR Zone Distribution Chart | DONE | ZoneDistributionChart.tsx |
| Pace Zone Distribution Chart | DONE | In ZoneDistributionChart |
| Post-Run Standard Questions | DONE | PostRunReflectionCard.tsx |
| Smart Workout Alternatives (Audibles) | DONE | workout-audibles.ts |
| Full Data Export CSV/JSON | DONE | /api/export + /settings/export |
| Wordle Easter Egg | DONE | WordleGame.tsx |
| PR Celebration Cards with Confetti | DONE | PRCelebration.tsx |
| Analytics Tabbed Sub-Pages | DONE | 6 sub-pages confirmed |
| Route Deduplication | DONE | Redirects in place |
| Sidebar/Mobile Nav Analytics | DONE | Auto-expand confirmed |
| Predictions Dashboard Overhaul | DONE | Multiple prediction improvements |
| Race-to-Result Linking | DONE | raceId FK, autoMatchRaceToResult() |
| Edit Race/Result Modals | DONE | EditRaceModal, EditRaceResultModal |
| Chat Page Simplification | DONE | CoachHeader removed |
| VDOT History Backfill | DONE | 34 entries |
| Training Plan Architecture | DONE | Macro + rolling window |
| Training Partner Effect | DONE | training-partner.ts |
| Post-Run Guided Reflection | DONE | reflections.ts |
| Smart Training Cues | DONE | training-cues.ts |
| Running Economy Tracking | DONE | running-economy.ts |
| Time of Day Analysis | DONE | time-of-day.ts |
| Shoe Mileage Dashboard | DONE | shoe-dashboard.ts |
| Shoe Detail Page + Strava Override | DONE | /shoes/[id] + migration 0014 |
| Best Effort PR Integration | DONE | personal-records.ts |
| Strava Best Efforts Import | DONE | commit d8f49df |
| Fatigue Resistance + Split Tendency | DONE | fatigue-resistance.ts |
| Running Streaks + Consistency | DONE | running-streaks.ts |
| Shareable Workout Cards | DONE | ShareCard.tsx |
| Workout Comparison Tool | DONE | WorkoutComparison.tsx |
| Weekly Recap Card | DONE | WeeklyRecapCard.tsx |
| AI Coach Analytics Context | DONE | commit 7af6c30 |
| Interval Stress Model | DONE | interval-stress.ts |
| Device Tracking + Gear Sync | DONE | device-tracking.ts |
| Shoe Rotation Analysis | DONE | shoe-rotation.ts |
| VDOT Multi-Signal Engine | DONE | race-prediction-engine.ts |
| HR Zone Color Unification | DONE | commit a59d246 |
| Consistent Time Range Toggles | DONE | 3M-3Y on all charts |
| Auth Cookie Sliding Refresh | DONE | middleware.ts |
| "Why Did Today Feel Hard?" | DONE | WorkoutEffortAnalysis.tsx |
| Readiness Explanation | DONE | ReadinessDetailedCard.tsx |
| Pace Band Generator | DONE | /pace-bands |
| Best Effort Auto-Detection | DONE | best-efforts.ts |
| Workout Confidence Score | DONE | /workout-confidence |
| Pace Decay Analysis | DONE | /pace-decay |
| Coach History / Searchable Archive | DONE | /coach-history |
| Race Predictor | DONE | /predictions |
| Proactive Coach System | DONE | ProactiveCoachPrompts.tsx |
| Plan Requirements Check Modal | DONE | PlanRequirementsModal.tsx |
| Heat Adaptation Tracker | DONE | /heat-adaptation |
| Injury Risk Assessment | DONE | /injury-risk |
| Weather Preferences Analysis | DONE | /weather-preferences |
| Performance Trends | DONE | /performance-trends |
| Effort Classification (7-stage) | DONE | effort-classifier.ts |
| Activity Heatmap Multi-Mode | DONE | ActivityHeatmap.tsx |
| Standard Plan Import | DONE | standard-plans.ts (6 templates) |
| Living Pace Model | DONE | performance-model.ts |
| VDOT Prediction Timeline | DONE | VdotTimeline.tsx |
| Ramp Rate Warning | DONE | calculateRampRate() |
| Canonical Route Detection | DONE | route-matcher.ts |
| Strava OAuth (production) | DONE | Trailing-char fix applied |
| Strava Webhook | DONE | Webhook ID 330845 |
| Privacy + Terms pages | DONE | /privacy, /terms |
| Admin Strava Health | DONE | /admin |
| Viewer/read-only mode | DONE | VIEWER_PASSWORD |
| Strava cron auto-sync | DONE | /api/cron/strava-sync |

---

## Section 3: Partial / Needs Quality Review

| Item | What Exists | What's Missing/Broken | Priority |
|------|------------|----------------------|----------|
| Import page activity processing | ~~UI + file parsing~~ | ~~Activities never saved~~ — **FIXED** (commit f590d32). Strava JSON + Garmin CSV now save to DB. Strava bulk export importer also added (commit ecd264c). | ~~HIGH~~ DONE |
| Coach Memory persistence | /memory page + MemoryDashboard.tsx | conversationSummaries + responseCache tables added (commit 9ff7ecf); queries still commented out in conversation-compression.ts | MEDIUM |
| Hardcoded profileId:1 | ~~Some fixed~~ | **FIXED** — ~65 queries patched across codebase (commits a40603c, a715fe3, e44d4f1). Weekly insights, readiness, intervals.icu, coach-tools all guarded. | ~~HIGH~~ DONE |
| Schema mismatches SQLite/Postgres | Partially fixed | Edge cases may remain | MEDIUM |
| EnhancedSplits rename | Primary header says "Workout Splits" | "Mile Splits (Interpolated)" still shown for one view | LOW |
| Adaptive context collection | ProfileCompletion done | Smart prompts for missing info not built | MEDIUM |
| /log page sliders | QuickLogModal has sliders | Main /log page still uses inputs | MEDIUM |
| Soreness body map | ~~SorenessMap.tsx + DB table~~ | **FIXED** — Integrated into AssessmentModal with per-region tracking (commit 7bcfe65) | ~~LOW~~ DONE |
| Coach action approval workflow | coachActions table + PlanDiffCard.tsx | Full confirm/reject flow unconfirmed | MEDIUM |
| Strava cadence import | Average cadence captured | Per-second cadence stream not imported | LOW |
| Shareable race cards (IG format) | ShareCard.tsx exists | IG-story size (1080x1920) not confirmed | LOW |
| Wellness trends dashboard | Intervals.icu import exists | HRV now wired into readiness (commit dbd4f4e); full visualization still unconfirmed | MEDIUM |
| Auto-generated weekly insights | WeeklyInsights.tsx exists | **FIXED** — profileId filter added (commit a715fe3), quality confirmed | ~~MEDIUM~~ DONE |
| Plan compliance score | Execution scorer exists | **FIXED** — VDOT-derived paces (commit 4925017), full scoring working | ~~MEDIUM~~ DONE |
| Morning readiness score | Readiness score exists | **PARTIALLY FIXED** — profileId fixed (commit a715fe3), HRV now wired from Intervals.icu (commit dbd4f4e). Stale data problem remains. | MEDIUM |
| Intervals.icu deep integration | One-way import | **PARTIALLY FIXED** — HRV now wired into readiness score (commit dbd4f4e). Two-way sync still not built. | LOW |
| Training plan adapts to biometrics | Adapts to CTL/ATL/TSB | **FIXED** — profileId guarded (commit a40603c), adaptation logic working | ~~MEDIUM~~ DONE |
| VDOT display consistency | Multi-signal engine done | UI labeling consistency unconfirmed | LOW |
| Best VDOT Segment Scoring | BestVdotSegmentCard.tsx exists | Raw stream persistence not implemented | MEDIUM |

---

## Section 4: Not Started (Top Priority TODO)

| Item | Category | Priority |
|------|----------|----------|
| Cheaper model usage tips redesign | Coach UX | HIGH |
| ~~Handle missing data in scores (null values)~~ | ~~Data Quality~~ | ~~HIGH~~ DONE (commits 5cd4397, e5ea64c) |
| ~~Smart interval analysis (8x800 recognition)~~ | ~~Analytics~~ | ~~HIGH~~ DONE (commit e112d9d) |
| Custom training plan builder | Training | HIGH |
| ~~Zero state improvements (app-wide)~~ | ~~UX~~ | ~~HIGH~~ DONE (commit e5ea64c) |
| Better color differentiation across pages | UX | HIGH |
| Full navigation & IA redesign | Navigation | HIGH |
| DB migration for API key fields | Technical Debt | HIGH |
| Strava full-access submission | Integration | HIGH |
| ~~Consolidate 10 Strava pages to 2-3~~ | ~~Code Quality~~ | ~~MEDIUM~~ DONE (commit 4143dd4) |
| ~~Delete dead code~~ | ~~Code Quality~~ | ~~MEDIUM~~ DONE (commit 139f413) |
| ~~Chart design system (shared wrapper)~~ | ~~UI~~ | ~~MEDIUM~~ DONE (commit 110ce62) |
| ~~Remove demo seed fallback secret~~ | ~~Security~~ | ~~MEDIUM~~ DONE (commit bbd411d) |
| Encrypt stored API tokens | Security | MEDIUM |
| Environment variable documentation | Technical Debt | MEDIUM |
| ~~Auto-detected threshold from workout data~~ | ~~Algorithm~~ | ~~MEDIUM~~ DONE (commit 88fe56f) |
| ~~Personalized recovery model~~ | ~~Algorithm~~ | ~~MEDIUM~~ DONE (commit b430809) |
| ~~Transparent training load dashboard~~ | ~~Intelligence~~ | ~~MEDIUM~~ DONE (commit 7252b19, connected to CTL/ATL/TSB pipeline) |
| Goal calculator fix | Analytics | LOW |

### Future Features (Not Started, Lower Priority)

- Social: Activity feed, running clubs, challenges
- Health: Sleep tracking, HRV monitoring, injury prevention protocols, recovery routines
- Nutrition: Race fueling calculator, daily tracking
- Training: Periodization view, cross-training, running form analysis
- Live: Activity tracking, audio coaching, music integration
- Data: Training report PDF, GPX/TCX export
- Platform: Third-party API, Apple Health, Garmin Connect
- Gamification: Level/XP system
- Notifications: Push infra, email summaries
- Premium: Advanced analytics, coach marketplace, training camps

---

## Phase 1 Fixes Applied (2026-02-21 Afternoon)

| Fix | Commit |
|-----|--------|
| Vitest test infrastructure (104 tests) | 9b387c9 |
| Timezone bug sweep (16 bugs in 4 files) | 33735c7 |
| Injury-risk age factor dead code | bd531ab |
| Error isolation (Today + Analytics pages) | adab552 |
| UI bugs (invisible bars, HR mismatch, proportionality) | ebb831c |
| Gate debug pages | 121bd85 |
| Tanaka maxHR formula (3 locations) | f900fd1 |
| fitnessProgression connected to CTL/ATL/TSB | 7252b19 |
| Execution scorer VDOT-derived paces | 4925017 |
| VDOT calculator tests (42 tests) | 50113d0 |
| Fitness calculations tests (62 tests) | 6a3a23a |

---

## Phase 1 Evening Session (2026-02-21)

All fixes applied in the evening session, listed with commit hashes:

| # | Fix / Feature | Commit | Category |
|---|--------------|--------|----------|
| 1 | Race prediction engine tests (76 tests) | 74d4d07 | Testing |
| 2 | conversationSummaries + responseCache tables added to schema | 9ff7ecf | Schema |
| 3 | Interval stress + effort classifier tests (103 tests) | dab6a52 | Testing |
| 4 | Partial feature quality review doc | 8e6ed23 | Documentation |
| 5 | 1 Mile added to RACE_DISTANCES | 5482636 | Bug Fix |
| 6 | profileId filters on weekly insights, readiness, intervals.icu | a715fe3 | Security / Multi-user |
| 7 | Import page — Strava JSON + Garmin CSV now save to DB | f590d32 | Feature Fix |
| 8 | profileId filters on ~16 unguarded findFirst() calls | a40603c | Security / Multi-user |
| 9 | Feature tracker updates | 8e3b9ab | Documentation |
| 10 | Soreness body map integrated into AssessmentModal | 7bcfe65 | Feature Fix |
| 11 | Strava page consolidation (10 pages to 2-3) | 4143dd4 | Code Quality |
| 12 | Smart interval pattern recognition (8x800, ladders, pyramids) | e112d9d | New Feature |
| 13 | Null confidence scores — return null instead of fake defaults | 5cd4397 | Data Quality |
| 14 | Zero-state handling across 25+ pages | e5ea64c | UX |
| 15 | Workout confidence page error handling | a67a020 | Bug Fix |
| 16 | Coach-tools profileId filtering | e44d4f1 | Security / Multi-user |
| 17 | Dead code removal — orphaned components, unused libs, dead imports | 139f413 | Code Quality |
| 18 | Restore PlanDiffCard + ProfileCompletion (needed for planned features) | 3383499 | Code Quality |
| 19 | Strava bulk export importer + workout reprocessing scripts | ecd264c | New Feature |
| 20 | Intervals.icu HRV data wired into readiness score | dbd4f4e | Feature Fix |
| 21 | Personalized recovery model (learns from individual patterns) | b430809 | New Feature |
| 22 | Close critical auth bypass + remove hardcoded admin secret | bbd411d | Security |
| 23 | Lactate threshold pace auto-detection from workout history | 88fe56f | New Feature |
| 24 | Shared chart wrapper component system | 110ce62 | UI / Design System |

**Totals:** 24 commits, 6 new features, 8 bug/feature fixes, 4 security fixes, 3 code quality improvements, 2 testing additions (179 new tests), 1 schema addition
