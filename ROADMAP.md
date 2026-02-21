# Dreamy — Master Roadmap

> Generated: 2026-02-18
> 118K lines, 422 files, 55+ pages

---

## How This Is Organized

**5 Phases**, ordered by implementation sequence. Within each phase, items are ranked by importance (P0 = critical, P1 = high, P2 = medium, P3 = nice-to-have).

Dependencies are noted — some Phase 3 items require Phase 1 foundations.

---

## Phase 1: Fix What's Broken + Foundation

*Goal: Everything that exists today works correctly and consistently.*

### P0 — Critical Bugs

| # | Item | Location | Effort |
|---|------|----------|--------|
| 1.1 | **Fix PaceTrendChart formatting bug** — uses `seconds` instead of `secs`, displays garbage like "8:352" | `PaceTrendChart.tsx:27` | 5 min |
| 1.2 | **Consolidate formatPace()** — 4+ duplicate implementations, different import paths. One function in `utils.ts`, imported everywhere | `utils.ts`, `pace-utils.ts`, `PaceTrendChart.tsx`, `analytics/page.tsx`, `predictions/page.tsx` | 30 min |
| 1.3 | **Consolidate VDOT calculation** — 3 implementations (exponential, stepped, duplicate). Use `vdot-calculator.ts` everywhere, delete duplicates | `vdot-calculator.ts`, `performance-model.ts`, `race-predictor.ts` | 1 hr |
| 1.4 | **Fix schema mismatches (SQLite vs Postgres)** — `stravaActivityId` (int vs bigint), `elevationGainFeet` (int vs real), `effortLevel` (enum vs open text), missing `coachContext` table in Postgres | `schema.ts`, `schema.pg.ts` | 1 hr |
| 1.5 | **Fix elevation profile** — shows only cumulative gain, not actual ups and downs | Workout detail page | 2 hr |
| 1.6 | **Fix EnhancedSplits** — pace shows "8:3.2762", rename "Mile Splits" → "Workout Splits" (they're watch laps) | `EnhancedSplits.tsx` | 30 min |
| 1.7 | **Fix Runs by Day chart** — white color on white background makes data invisible | Analytics page | 15 min |

### P1 — Chart & Graphics Consistency

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 1.8 | **Unified color system** — Migrate all charts to use `workout-colors.ts` or theme CSS variables. Eliminate hardcoded hex in FitnessTrend, Elevation, VdotTimeline, HRTrend, TrainingLoadBar | All chart components | 3 hr |
| 1.9 | **Standardize time range selectors** — All analytical charts should offer 1M, 3M, 6M, 1Y. WeeklyMileage (fixed 12w) and TrainingFocus (fixed 90d) should get selectors | Chart components | 2 hr |
| 1.10 | **Chart design system** — Shared wrapper component with consistent: loading states, empty states, responsive sizing, axis formatting, tooltip styling | New component | 4 hr |
| 1.11 | **VDOT consistency** — Single confidence calculation method (use multi-signal engine). Clarify "Training VDOT" vs "Estimated VDOT" in all UI. Update stale `raceResults.calculatedVdot` on resync | Multiple files | 3 hr |

### P2 — Cleanup

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 1.12 | **Remove/gate 11 test/debug pages** — `/test-chat`, `/test-stream`, `/test-streaming`, `/test-strava`, `/strava-test-direct`, `/strava-setup-test`, `/debug-strava`, `/debug-strava-exchange`, `/debug/api-usage`, `/env-check`, `/debug-profile` | Gate behind `NODE_ENV === 'development'` | 1 hr |
| 1.13 | **Consolidate 10 Strava pages** → 2-3 (setup, sync, fix) | Strava pages | 2 hr |
| 1.14 | **Delete dead code** — `StravaManualConnect.tsx` (0 imports), `strava-manual.ts` (unused), `strava-debug.ts` (dev-only), `/welcome` redirect, `/race-predictor` redirect | Various | 30 min |
| 1.15 | **Fix hardcoded `profileId: 1`** in coach-tools.ts | `coach-tools.ts:2360` | 30 min |
| 1.16 | **Remove demo seed fallback secret** — `'demo-seed-2024'` hardcoded if env var missing | `/api/seed-demo` | 5 min |

---

## Phase 2: Core Experience Completion

*Goal: The main user loops work end-to-end.*

### P0 — Race Lifecycle (The Core Loop)

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 2.1 | **Link planned races to race results** — FK from `raceResults` → `races`. When logging a result, auto-match to planned race by distance + date proximity. Archive completed races | Schema + races page | 4 hr |
| 2.2 | **Race history timeline** — Visual timeline showing all past races with results, PRs highlighted, VDOT trend overlay. Currently results are buried in a collapsible | New component on races page | 4 hr |
| 2.3 | **PR tracking by distance** — Track personal records for standard distances (5K, 10K, HM, M). Celebrate new PRs. Show progression per distance | New component + schema | 3 hr |
| 2.4 | **Race calendar view** — Unified view: upcoming races (with countdown), past races (with results), training phases between them | Races page redesign | 4 hr |
| 2.5 | **Training plan ↔ race wiring** — Generate plan from race page, view plan linked to race, show plan adherence %. Schema exists, UI doesn't | Races + plan pages | 6 hr |

### P0 — Post-Run Intelligence

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 2.6 | **Post-run auto-detection flow** — After Strava sync: detect what happened → ask targeted questions → analyze with context → update plan. Should feel like a coach checking in, not user navigating to chat | Coach + sync integration | 8 hr |
| 2.7 | **"Why did today feel hard?" auto-analysis** — Cross-reference: sleep, weather, TSB form, previous day's load, weekly stress, time of day, pace vs usual. Visual breakdown card | New component + action | 6 hr |
| 2.8 | **Explain workout difficulty tool** — Coach tool that analyzes all factors contributing to perceived effort | `coach-tools.ts` | 3 hr |

### P1 — Training Plan Intelligence

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 2.9 | **Adaptive plan that actually adapts** — Weekly re-evaluation: Was key workout hit? More/less volume than planned? Fatigue building? Auto-adjust next week. Show what changed and why | Plan + workout processor | 8 hr |
| 2.10 | **Coach action approval workflow** — When coach suggests plan changes: show diff, confirm/reject. Table exists, workflow doesn't | New component + action | 4 hr |

### P2 — Data Quality

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 2.11 | **Import cadence data from Strava** — Available in streams but not requested. Useful for running form analysis | `strava.ts` + schema | 2 hr |
| 2.12 | **Import gear_id from Strava** — Link activities to shoes automatically | `strava.ts` + schema | 2 hr |
| 2.13 | **Import best_efforts from Strava** — PR data for standard distances comes free with activity detail | `strava.ts` + schema | 3 hr |
| 2.14 | **Import activity zones from Strava** — `GET /activities/{id}/zones` gives HR zone breakdown for free | `strava.ts` | 2 hr |
| 2.15 | **Implement Strava webhook** — Real-time activity sync instead of manual. `activity.create` handler. Critical for rate limits (100 reads/15min) | New API route | 4 hr |

---

## Phase 3: Strava Social & Deep Analytics

*Goal: Transform raw data into insights no other app provides.*

### P1 — Strava Social Intelligence

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 3.1 | **Kudos tracking** — `GET /activities/{id}/kudos` returns who liked each activity. Store kudos givers per activity. Build kudos leaderboard: who gives you the most love | New schema + sync + component | 6 hr |
| 3.2 | **Kudos trend analysis** — Track kudos_count per activity over time. Identify: activities that get most engagement, time-of-day effects, distance/type correlation with kudos | Analytics component | 4 hr |
| 3.3 | **"Ghost kudos" detector** — Who used to give you kudos regularly but stopped? Track per-person kudos frequency over time. Surface "friends who went quiet" | Analytics component | 3 hr |
| 3.4 | **Comments tracking** — `GET /activities/{id}/comments` returns who commented and what they said. Store and surface engagement trends | New schema + sync | 4 hr |
| 3.5 | **Social engagement dashboard** — Combined view: kudos trend, comment frequency, engagement rate (kudos/activity), most engaged friends, engagement by activity type | New page or analytics section | 6 hr |
| 3.6 | **Club activity feed** — `GET /clubs/{id}/activities` shows what club members are doing. Surface training partners, group trends | New component | 4 hr |

### P0 — Grade-Adjusted Pace & Best Efforts (VDOT Refinement)

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 3.7 | **Import `grade_smooth` streams** — Pull hill gradient data on every sync. Calculate Grade Adjusted Pace (GAP) per split and per workout. Store GAP alongside raw pace. This makes hilly and flat runs directly comparable | Stream sync + schema + engine | 6 hr |
| 3.8 | **Import Strava best efforts** — `best_efforts` in activity detail gives verified PRs (400m, 1K, 1mi, 5K, 10K, HM, M) with pauses excluded. These are gold for VDOT — feed directly into multi-signal engine as high-confidence data points | Sync + schema + VDOT integration | 4 hr |
| 3.9 | **Import segment efforts** — `GET /segments/{id}/all_efforts` tracks PRs on specific segments over time. Verified pause-free data. Use as additional VDOT signal and show segment PR progression | Sync + schema + analytics | 6 hr |
| 3.10 | **GAP-based training load** — Recalculate TRIMP/training stress using GAP instead of raw pace. A hilly 6-miler should count for more training stress than a flat one at the same pace | Training load engine | 4 hr |

### P1 — Deep Performance Analytics

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 3.11 | **Import `temp` streams** — Device-recorded temperature per second. Cross-reference with weather API data. Build personal heat/cold performance curves. Also feeds into conditions-adjusted pace (you already have weather — this gives ground truth from the watch) | Stream sync + analytics | 4 hr |
| 3.12 | **Weather-adjusted training load** — A 6mi easy run at 90F/80% humidity = physiologically harder than at 60F. Weight TRIMP/TSS by heat stress. Your weather data already exists — wire it into load calculations | Training load engine | 4 hr |
| 3.13 | **Import cadence streams** — Step rate per second. Derive stride length (pace / cadence). Track cadence drift on long runs (fatigue indicator), optimal cadence by pace zone, stride length trends over months | Stream sync + analytics | 4 hr |
| 3.14 | **Running economy tracking** — Pace at a given HR over time. "You ran 7:30/mi at 155bpm today vs 160bpm three months ago." More useful than VDOT for tracking day-to-day fitness. Chart this on analytics | New analytics component | 4 hr |
| 3.15 | **Fatigue resistance metric** — How well you maintain pace in last 25% vs first 75% of runs. Track over time. Improving fatigue resistance = huge race performance predictor | New metric + analytics | 3 hr |
| 3.16 | **Negative split tendency** — Track positive/negative/even split patterns by workout type. Coach uses this: "You tend to go out too fast on tempos — try starting 10s/mi slower" | Analytics + coach integration | 2 hr |
| 3.17 | **Time of day analysis** — Using `start_date_local`, build personal circadian performance profile. Do you run better morning vs evening? What time do you typically run each workout type? | Analytics component | 3 hr |
| 3.18 | **Training partner effect** — `athlete_count` from Strava shows group vs solo runs. Correlate with pace, RPE, enjoyment. "Your average pace is 15s/mi faster on group runs" | Analytics component | 2 hr |
| 3.19 | **Route familiarity effect** — Using GPS data, detect repeated routes. Performance on familiar vs new routes. Most runners perform better on known routes (reduced mental load) | GPS analysis engine | 4 hr |
| 3.20 | **GPS route visualization** — Import `latlng` streams. Show actual route on map with pace/HR as color gradient overlay. Interactive playback | New component (Mapbox/Leaflet) | 8 hr |
| 3.21 | **Segment discovery** — `GET /segments/explore` finds popular segments near user. Show nearby segments, best efforts, improvement over time | New page | 6 hr |
| 3.22 | **Workout comparison tool** — "Compare this tempo to your last 5 tempos" — overlay pace charts, HR drift differences, highlight improvement | New component | 6 hr |
| 3.23 | **Device/watch tracking** — Import `device_name` from activity detail. Track which watch recorded what, identify device-specific data quirks | Schema + display | 1 hr |

### P1 — Social Intelligence

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 3.24 | **Kudos tracking** — `GET /activities/{id}/kudos` returns who liked each activity. Store kudos givers per activity. Build kudos leaderboard: who gives you the most love | New schema + sync + component | 6 hr |
| 3.25 | **Kudos trend analysis** — Track kudos_count per activity over time. Activities that get most engagement, time-of-day effects, distance/type correlation | Analytics component | 4 hr |
| 3.26 | **"Ghost kudos" detector** — Who used to give you kudos regularly but stopped? Track per-person kudos frequency over rolling windows. Surface "friends who went quiet" | Analytics component | 3 hr |
| 3.27 | **Comments tracking** — `GET /activities/{id}/comments` returns who commented and what they said. Log all comments with timestamps | New schema + sync | 4 hr |
| 3.28 | **Social engagement dashboard** — Combined view: kudos trend, comment frequency, engagement rate, most engaged friends, engagement by activity type | New page or analytics section | 6 hr |
| 3.29 | **Club activity feed** — `GET /clubs/{id}/activities` shows what club members are doing. Surface training partners, group trends | New component | 4 hr |

### P0 — Shoe Intelligence

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 3.30 | **Strava gear sync** — `GET /gear/{id}` returns shoe details (name, brand, model, total distance). Sync `gear_id` from every activity. Auto-link shoes to workouts | Schema + sync | 4 hr |
| 3.31 | **Shoe mileage dashboard** — Per-shoe mileage, breakdown by workout type (easy/tempo/long/race), retirement alerts at configurable threshold (300-500 mi) | New component | 4 hr |
| 3.32 | **Shoe efficiency model** — After adjusting for pace, HR, temperature, elevation, fatigue: which shoes produce the best running economy? Compare pace-at-HR across shoes. "You're 3% more efficient in the Vaporfly vs the Pegasus" | New engine + analytics | 8 hr |
| 3.33 | **Shoe rotation analysis** — Which shoes for which workout types? Auto-detect patterns. "You use Nike Pegasus for 80% of easy runs and Vaporfly for all races" | Analytics component | 3 hr |
| 3.34 | **Shoe recommendation engine** — For tomorrow's workout: suggest which shoe based on workout type, historical preference, current mileage, efficiency data. "Wear the Pegasus — your Vaporfly is at 450mi and due for retirement" | Coach tool integration | 4 hr |
| 3.35 | **Shoe break-in curve** — Track performance changes as shoes accumulate mileage. Is there a sweet spot? Do shoes degrade after X miles? | Analytics component | 3 hr |
| 3.36 | **Injury correlation by shoe** — Cross-reference soreness/injury reports with shoe used. "You report more knee soreness after runs in Shoe X" | Analytics + soreness integration | 3 hr |
| 3.37 | **Surface type inference** — From GPS + elevation + pace variability, infer trail vs road. Combined with shoe data: performance by shoe × surface | GPS analysis engine | 4 hr |

---

## Phase 4: Intelligence & Differentiation

*Goal: Things only Dreamy can do. The "wow" features.*

### P0 — Pattern Recognition Engine

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 4.1 | **Historical pattern recognition** — "You always struggle on day 3 of high mileage weeks", "Your tempo pace improves 2% when you sleep 8+ hours", "You PR when CTL is 50-55 and TSB is +5 to +8" | New engine + analytics | 12 hr |
| 4.2 | **Predictive insights** — "Based on your last 6 weeks, you'll PR if you race in the next 10 days", "Your current trajectory suggests 1:25 HM by April", "Warning: similar patterns preceded your last injury" | Engine + Today page integration | 10 hr |
| 4.3 | **Auto-generated weekly insights** — 3-5 personalized insights per week. Trend alerts when patterns change. "What's different this month" analysis | New component + scheduling | 6 hr |
| 4.4 | **Coach memory timeline** — Show what the coach "knows" over time: "Learned you struggle in heat (June 2025)", "Noticed you PR after down weeks" | New component | 4 hr |

### P1 — Smart Features

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 4.5 | **Race day countdown & prep** — Starting 2 weeks before A race: daily tips, taper guidance, race day checklist, weather forecast for race location, pace bands, nutrition reminders | New flow + components | 8 hr |
| 4.6 | **Running streak & consistency tracking** — Current streak, longest streak, consistency % by week/month. Gentle gamification | New component + schema | 3 hr |
| 4.7 | **Soreness body map** — Full body-region tracking UI, pattern detection, shoe correlation, coach proactive warnings. Schema exists, UI doesn't | New component | 6 hr |
| 4.8 | **Wellness trends dashboard** — HRV, resting HR, sleep, weight visualization over time. Intervals.icu import exists as starting point | New page/components | 6 hr |

### P2 — Advanced Training

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 4.9 | **Periodization view** — Visual training blocks: base → build → peak → taper. Show where user is, what's coming, how current block is progressing | New component | 6 hr |
| 4.10 | **Cross-training support** — Log bike/swim/strength. Strava already sends non-run activities. Calculate equivalent training stress | Schema + components | 6 hr |
| 4.11 | **Running power estimates** — Calculate estimated power from pace/grade/weight (Stryd-like). Realistic ranges (220-270W easy). Useful for hilly terrain analysis | New engine | 6 hr |
| 4.12 | **Ultra marathon support** — 50K+, time-based training, elevation as primary metric, aid station planning, nutrition scheduling | Training engine extension | 8 hr |

---

## Phase 5: Growth & Sharing

*Goal: Features that help the app grow and users share.*

### P1 — Shareability

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 5.1 | **Shareable race cards** — Beautiful cards for IG stories (1080x1920) and posts (1080x1080): finish time, VDOT, course map, split chart, weather, Dreamy branding. Viral growth loop | New API + components | 8 hr |
| 5.2 | **Weekly recap card** — Shareable card: weekly miles, runs, key workout highlight, fitness trend arrow. "Share your week" button | New component + share API | 4 hr |
| 5.3 | **PR celebration cards** — When a PR is hit: confetti animation + shareable card with old vs new time, improvement %, VDOT change | New component | 4 hr |

### P2 — Public Presence

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 5.4 | **Public profile / race resume** — Optional public page: race history, PRs, training volume, VDOT progression. Useful for running clubs, coaching | New public route | 6 hr |
| 5.5 | **Route export** — Export routes as GPX/TCX using Strava's route export endpoints. Let users download their courses | New API + component | 3 hr |
| 5.6 | **Weekly email digest** — "This week: 28 miles, VDOT trending up, key workout hit target pace. Next week: building to 32 miles." Even without email, a digest card on Today page | Email service or Today card | 6 hr |

### P3 — Platform

| # | Item | Description | Effort |
|---|------|-------------|--------|
| 5.7 | **Apple Health integration** — Import sleep, HRV, resting HR for wellness trends | New integration | 8 hr |
| 5.8 | **Garmin Connect integration** — Alternative to Strava for users who don't use Strava | New integration | 12 hr |
| 5.9 | **Push notifications** — Workout reminders, post-run check-in, race countdown, PR alerts | Service worker + API | 8 hr |
| 5.10 | **Full data export** — CSV/JSON export of all workouts, race results, training data | New API route | 3 hr |

---

## Summary

| Phase | Items | Theme | Time Estimate |
|-------|-------|-------|---------------|
| **Phase 1** | 16 items | Fix bugs, consistency, cleanup | ~25 hrs |
| **Phase 2** | 15 items | Core loops work end-to-end | ~60 hrs |
| **Phase 3** | 37 items | Strava data, social, shoes, deep analytics | ~150 hrs |
| **Phase 4** | 12 items | Intelligence & differentiation | ~80 hrs |
| **Phase 5** | 10 items | Growth & sharing | ~60 hrs |
| **Total** | **90 items** | | **~375 hrs** |

---

## Currently Importing from Strava vs Available

| Data | Currently | Available | Value |
|------|-----------|-----------|-------|
| Activities (basic) | Yes | Yes | - |
| Laps/splits | Yes | Yes | - |
| HR/pace/altitude streams | Yes | Yes | - |
| **Cadence streams** | **No** | Yes | Running form analysis |
| **GPS (latlng) streams** | **No** | Yes | Route maps, segment matching |
| **Grade streams** | **No** | Yes | Hill performance analysis |
| **Temperature streams** | **No** | Yes | Weather impact correlation |
| **Kudos (who liked)** | **No** | Yes | Social intelligence |
| **Comments** | **No** | Yes | Engagement tracking |
| **Gear/shoes** | **No** | Yes | Shoe mileage + retirement |
| **Best efforts (PRs)** | **No** | Yes | Free PR tracking |
| **Activity zones** | **No** | Yes | HR zone breakdown per run |
| **Athlete stats** | **No** | Yes | YTD/all-time totals |
| **Athlete HR zones** | **No** | Yes | Respect user's configured zones |
| **Segments explore** | **No** | Yes | Discover nearby segments |
| **Segment efforts** | **No** | Yes | Segment PR tracking |
| **Clubs** | **No** | Yes | Social features |
| **Webhook events** | **No** | Yes | Real-time sync (critical) |
| **Device name** | **No** | Yes | Watch tracking |

---

*This roadmap is a living document. Update as items are completed.*
