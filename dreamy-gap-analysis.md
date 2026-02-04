# Dreamy: Feature Gap Analysis
## What Was Spec'd vs. What's Actually Built

**Source:** Forensic codebase review (2026-02-03) cross-referenced against:
- Feature Expansion v2 (14 features)
- Addendum 1 (Issues 1-8)
- Addendum 2 (Issues 9-16)
- Intervals.icu Feature Catalog (21 features, Tiers 1-3)

---

## ✅ CONFIRMED BUILT (No Action Needed)

These features are verified present in the codebase by the forensic review:

| Feature | Evidence |
|---------|----------|
| Multi-profile support | `profiles` table, `ProfileSwitcher.tsx` |
| 10-step onboarding wizard | `/onboarding` with VDOT calc, race goals |
| Today dashboard | Weather, outfit, alerts, planned workout card |
| Manual workout logging + assessment | `/log`, `AssessmentModal.tsx`, 15+ fields |
| AI Coach (60+ tools, 5 personas) | `/api/chat`, `coach-prompt.ts`, streaming SSE |
| Training plan generation + modification | `plan-generator.ts`, 50+ templates, modify modal |
| Plan import (CSV/ICS) | `plan-import.ts`, `PlanImportModal.tsx` |
| Race management (goals + results) | `/races`, A/B/C priority, auto VDOT from results |
| Analytics dashboard (20+ charts) | `/analytics`, CTL/ATL/TSB, best efforts, heatmap |
| CTL/ATL/TSB fitness model | `fitness-calculations.ts` |
| Readiness score | `readiness.ts` (Sleep 35%, Training 25%, Physical 25%, Life 15%) |
| Pace calculator + weather adjustment | `/pace-calculator`, `conditions.ts` |
| Weather integration (Open-Meteo) | `weather.ts`, 30-min cache, free API |
| Outfit recommendation (Vibes Temp) | `outfit.ts`, effort heat, personal preference |
| Shoe rotation tracking | `/shoes`, category, mileage auto-update |
| Wardrobe management | `/wardrobe`, 18 clothing categories |
| Strava OAuth + sync | Full OAuth 2.0, token refresh, laps + streams |
| Intervals.icu sync | Basic Auth, activities + wellness import |
| Calendar export (.ics) | `/api/calendar/export` ✅ |
| Share/OG images | `/api/share/[type]/[id]` (600x400 PNG) |
| PWA + service worker | `manifest.json`, `sw.js`, installable |
| Demo mode (localStorage) | `demo-mode.ts`, sample "Alex" runner |
| Canonical route detection | `route-matcher.ts`, `canonicalRoutes` table |
| Coach settings | `coachSettings` table (advisor/autopilot, travel, busy week) |

---

## ⚠️ PARTIALLY BUILT (Needs Completion)

These exist in code but the forensic review flagged them as incomplete:

### 1. Soreness Body Map
- **What exists:** `sorenessEntries` table, `SorenessMap.tsx` component
- **What's missing:** Body-region tracking UI is incomplete. Pattern detection ("your right calf has been sore 4 of 6 runs"), shoe correlation, coach proactive warnings, plan integration (auto-suggest mods based on soreness area)
- **Spec ref:** Feature Expansion v2, Feature 12

### 2. Coach Actions Audit / Approval Workflow
- **What exists:** `coachActions` table with `actionType`, `description`, `approved` fields
- **What's missing:** The actual approval workflow — showing diffs before applying, user confirm/reject flow, the `PlanDiffCard.tsx` component
- **Spec ref:** Feature Expansion v2, Feature 10 (Coach Dry-Run/Preview Mode)

### 3. Route Detection (Not Auto-Running)
- **What exists:** `canonicalRoutes` table, `route-matcher.ts` with distance/elevation/GPS matching
- **What's missing:** Route detection doesn't run automatically after workout save. Should trigger on every new workout.
- **Spec ref:** Intervals.icu catalog, G1

### 4. Workout Segments / Lap Display
- **What exists:** `workoutSegments` table, Strava lap import
- **What's missing:** Manual lap entry UI not visible. The rich interval data table (Intervals.icu B6) with WORK/ALL/RECOVERY tabs, averages, CSV export is not built. Interval summary bar (auto-detected "warmup 1h | 4x6:53 @ 177bpm | cooldown") not built.
- **Spec ref:** Intervals.icu catalog B2, B6; Addendum 2 Issue 15

### 5. Share Cards (Sizing/Polish)
- **What exists:** `/api/share/[type]/[id]` generating 600x400 OG images
- **What's missing:** IG-story size (1080x1920), square post (1080x1080), PR celebration confetti, streak badges, native share sheet integration, Dreamy branding on cards
- **Spec ref:** Feature Expansion v2, Feature 6

### 6. Busy Week + Travel Mode (Flags Only)
- **What exists:** `coachSettings` has `travelMode` and `busyWeek` boolean flags
- **What's missing:** The actual logic — busy week should identify key session, reduce others to 60% volume, drop one run. Travel mode should compress plan, adjust for destination weather/timezone, convert to treadmill if available. "Life Happens" quick toggles (sick, sore, hungover, stressed, rain). Return-from-absence ramp plan.
- **Spec ref:** Feature Expansion v2, Feature 11

---

## ❌ NOT BUILT (From Feature Expansion v2 — 14 Features)

### Feature 1: "I Have X Minutes" Quick Workout Rewrite
- **Status:** NOT BUILT
- **What's needed:** `rewrite_workout_for_time` chatbot tool. "Short on time?" button on Today card → time picker modal → modified workout with diff. Preserves training intent (short tempo not easy run). Rules: min 10min warmup, 5min cooldown; <25min = easy only; long run <60% planned = suggest postpone.
- **Priority:** HIGH — most common real-world scenario

### Feature 3: "Why Did This Feel Hard?" Auto-Explainer
- **Status:** NOT BUILT
- **What's needed:** `ai_explanation TEXT` field on workouts. After assessment, auto-generate 2-3 sentence explanation (conditions vs baseline, sleep, stress, training load, pace vs typical). `explain_workout` chatbot tool. "Ask Coach: Why?" button on any recommendation. `explain_recommendation` tool.
- **Priority:** HIGH — builds trust, makes every workout feel understood

### Feature 4: Intelligent Run Auto-Categorization
- **Status:** PARTIALLY BUILT (basic classification exists per forensic review: "automated workout classification") but NOT the full engine
- **What's missing:**
  - `run-classifier.ts` engine analyzing interval/lap data for patterns (even splits, progressive, fartlek, negative split)
  - `auto_category TEXT` and `auto_summary TEXT` fields on workouts
  - AI-generated one-line descriptions ("Easy 6-miler with steady 8:45 pace — textbook recovery")
  - User override (tap to change category)
  - **Bulk backfill tool:** `categorize_workouts` chatbot tool for date ranges
  - Training distribution from categories (polarized/pyramidal/threshold classification)
  - Auto-trigger on Strava/Intervals import
- **Priority:** HIGH — this is what makes Intervals.icu feel smart

### Feature 5: Enhanced Activity Heatmap (Multi-Mode)
- **Status:** Basic heatmap exists in analytics. Multi-mode NOT BUILT
- **What's missing:**
  - Toggle between: Color by Run Type | Color by Mileage | Color by TRIMP | Color by RPE
  - Depth/opacity as second dimension (e.g., color=type, opacity=mileage)
  - Dynamic legend per mode
  - Click cell → workout detail, click week → week summary
  - Summary stats: "1,847 mi · 247 runs · 38 weeks active"
- **Priority:** MEDIUM — visual wow factor

### Feature 7: Treadmill Conversion
- **Status:** NOT BUILT
- **What's needed:** `treadmill-converter.ts` with pace adjustment (+15-20 sec/mi or 1% incline note). Hill → incline intervals. Strip weather/outfit → "indoor: shorts + singlet + towel". "Convert to Treadmill" button on workout card. `convert_to_treadmill` chatbot tool.
- **Priority:** MEDIUM — common real-world need

### Feature 8: Race Week Checklist
- **Status:** NOT BUILT
- **What's needed:** Auto-generate when race <7 days away. Sections: gear prep (shoes, outfit from forecast, bib), nutrition (carb loading, race morning meal), race day logistics (arrival, warmup, pacing from prediction engine + forecast), fueling splits. Checklist with auto-checkable items. `generate_race_checklist` chatbot tool.
- **Priority:** MEDIUM — great for race prep UX

### Feature 9: Weekly Recap Card
- **Status:** NOT BUILT
- **What's needed:** Sunday evening summary → Monday "Last Week" card on Today page. Total miles/hours/workouts, change vs last week, adherence %, key highlight, fitness trend direction, next week preview. Streak tracking (consecutive days/weeks). Shareable via Feature 6. Dismissible card.
- **Priority:** MEDIUM — retention driver

### Feature 10: Coach Dry-Run / Preview Mode
- **Status:** NOT BUILT (despite `coachActions` table existing)
- **What's needed:** `dryRun: boolean` parameter on all mutation tools (`modify_plan_workout`, `swap_workouts`, `reschedule_workout`, etc.). Returns preview object with changes array. `PlanDiffCard.tsx` (before/after, green/red/amber). Safe changes apply directly; significant changes (volume >20%, moving days) show preview first.
- **Priority:** HIGH — trust builder

### Feature 13: Gear Prep Reminder (Night Before)
- **Status:** NOT BUILT
- **What's needed:** After 6pm, if tomorrow has a run → "Prep for Tomorrow" card. Shows: workout preview, outfit for tomorrow's weather, shoe recommendation, "lay out gear tonight" checklist. `get_prep_for_tomorrow` chatbot tool.
- **Priority:** LOW — nice polish

### Feature 14: Sentiment-Aware Coach
- **Status:** PARTIALLY (5 personas exist) but NOT the dynamic sentiment adaptation
- **What's missing:** Coach adapting tone mid-conversation based on user mood. Frustrated → empathy first, then data reframe. Excited → match energy + celebrate. Anxious → normalize + structure. Burned out → suggest deload. Return from absence → "Welcome back!" not "You missed X workouts."
- **Priority:** LOW — can add to system prompt

---

## ❌ NOT BUILT (From Addendum 1 — Issues 1-8)

### Issue 1: Living Pace Model (Replacing VDOT Dependency)
- **Status:** NOT BUILT — VDOT is still the primary system
- **What's needed:** Bayesian pace model that updates from every run. Weighted inputs: recent race results (highest weight), workout performances, training volume trends. Produces 6 pace zones that evolve over time. Falls back to VDOT for new users. Replaces static VDOT lookup with continuously updating estimates.
- **Priority:** HIGH — core intelligence differentiator

### Issue 2: Standard Plan Import (Pfitz, Hansons, Higdon, Daniels)
- **Status:** NOT BUILT — CSV/ICS import exists but not named plan templates
- **What's needed:** Pre-built plan templates for popular programs (Pfitzinger 18/55, 18/70, 12/55; Hansons Beginner/Advanced; Higdon Novice/Intermediate; Daniels 2Q). User selects plan → Dreamy imports the structure → adds coaching layer (pace targets, outfit, weather adjustments, "why this workout" explanations). Import preserves the plan author's intent while adding Dreamy's intelligence.
- **Priority:** MEDIUM — huge for onboarding experienced runners

### Issue 3: Ultra Marathon Support
- **Status:** NOT BUILT
- **What's needed:** Support for 50K, 50mi, 100K, 100mi distances. Time-based training (not pace-based for ultras). Elevation gain as primary metric. Aid station planning. Back-to-back long run support. Ultra-specific workout types (hiking intervals, power hiking). Night running prep. Crew/pacer planning.
- **Priority:** LOW — niche but growing market

### Issue 4: Warm Color Palette (Stone/Amber, Not Slate/Blue)
- **Status:** UNCLEAR — forensic review doesn't specify current palette
- **What's needed:** Shift from clinical slate/blue to warm stone/amber. Easy runs = muted blue-steel, quality work = warm ember/amber, rest = warm dark stone. "Warm coals not neon signs." No saturation >70% except celebrations. Tooltip backgrounds warm dark (stone-800 not slate-800).
- **Priority:** MEDIUM — design/feel issue

### Issue 7: Agenda-First Home Screen (LeCoach Pattern)
- **Status:** PARTIALLY — Today dashboard exists but may not follow the agenda pattern
- **What's needed:** Single timeline view: "Good morning, Jason" → today's workout card → weather + outfit → upcoming 3-day preview → weekly progress bar → recent activity feed. No fragmented widgets — one scrollable agenda. Quick actions: "Log Run", "Short on Time?", "Talk to Coach".
- **Priority:** MEDIUM — UX polish

### Issue 8: Fix Charts/Heatmap/Data Population
- **Status:** ONGOING — this was spec'd as a debugging protocol
- **What's needed:** For EACH chart: trace data pipeline (API → query → component → render). Check: date filtering (UTC vs local), user ID scoping, computed fields populated (quality_ratio, trimp, auto_category). Heatmap specific: increase cell size to 16px+, show all day labels, fix purple color leak (hue 250-320° range), CSS Grid not flexbox. Reduce saturation globally. **Must verify every chart works before building new features.**
- **Priority:** BLOCKER — nothing matters if data isn't showing

---

## ❌ NOT BUILT (From Addendum 2 — Issues 9-16)

### Issue 9: 16 Weeks Realistic Demo Data
- **Status:** NOT BUILT — demo has "Alex" with only 10 workouts
- **What's needed:** "Jason" profile: ~42 VDOT, spring marathon, 35-50 mpw. 16 weeks of history with realistic distribution (55% easy, 15% long, 10% tempo, 10% intervals, 5% progression, 5% recovery). Full lap data for quality workouts. Messy realism: missed weeks, GPS jitter, cut-short runs, treadmill sessions. 2-3 races (5K, 10K, HM). Shoe rotation, weather variation. Progressive fitness building.
- **Priority:** HIGH — all charts and features need data to test against

### Issue 10: TRIMP Square-Root Normalization
- **Status:** NOT BUILT
- **What's needed:** Replace linear TRIMP scaling with `Math.pow(linear, 0.5)` for heatmap. Spreads low-to-mid range (daily runs visually distinct), compresses extremes (race days don't dominate). Percentile anchors: p10 = userMin, p90 = userMax, recalculated every 90 days.
- **Priority:** MEDIUM — visual improvement

### Issue 11: Pace Sanity Checks + Interval Structure
- **Status:** NOT BUILT
- **What's needed:** Hard constraints: recovery > easy > marathon > threshold > interval > repetition pace. No zone wider than 45 sec/mi. 15+ sec/mi gap between zones. Validation on every pace computation — if fails, fall back to VDOT + log error. Interval prescriptions must include: warmup (distance + pace + description), main set (repeats, work intervals, recovery intervals), sets structure, cooldown, total distance, purpose statement.
- **Priority:** HIGH — paces must make sense

### Issue 12: Running Power — Realistic Values
- **Status:** NOT CONFIRMED
- **What's needed:** For 75kg runner: easy 8:00/mi = 220-260W, tempo 6:45/mi = 280-320W, intervals 6:15/mi = 310-360W. NP/AP ratio (Variability Index): easy 1.02-1.05, tempo 1.03-1.06, intervals 1.08-1.15. Formula: `flatPower = weightKg × speedMs × 3.5`. Validation: if 8:00/mi easy ≠ 220-270W, formula is wrong.
- **Priority:** MEDIUM — if power is shown, it must be realistic

### Issue 13: Multi-Benefit Run Purpose Engine
- **Status:** NOT BUILT
- **What's needed:** `assignRunBenefits()` assigning MULTIPLE weighted benefits per run. Systems: aerobic_base, fat_oxidation, lactate_threshold, vo2max, speed, marathon_specific, race_simulation, recovery, endurance. Blended signal: pace (60%) + HR (40%) + RPE (tiebreaker). Weather-aware: hot → trust pace over HR. `benefits JSONB` field. UI: colored benefit badges ("Aerobic Base 60% | Marathon 20% | Threshold 20%"). AI summary.
- **Priority:** MEDIUM — enriches every workout

### Issue 14: UX Bugs — Greeting, Race Adding, Plan Saving
- **Status:** NOT CONFIRMED FIXED
- **What's needed:**
  - A) Greeting: "Good evening, Jason" not "Good evening, Coach" (pull `user.firstName`, fallback "Good evening 👋")
  - B) Race adding: verify form appears, submits, API validates, race shows on calendar, plan auto-adjusts. Multiple entry points: calendar, chatbot, settings, plan generation.
  - C) Plan saving: verify persists to DB, survives page refresh, individual workouts have planId foreign keys, shows on calendar, edits persist.
- **Priority:** HIGH — user-facing bugs

### Issue 15: Lap Data Syncing from Strava (Debug)
- **Status:** PARTIALLY — Strava lap import exists but may have issues
- **What's needed:** Verify: `GET /activities/{id}/laps` AND `/streams` both fetched. Check `activity:read_all` scope. Handle both manual and auto laps. Rate limiting (100 req/15min). StoredLap interface with source tracking. Test with known interval workout: verify DB has correct laps, UI shows them, auto-categorization detects workout type from laps.
- **Priority:** HIGH — blocks auto-categorization and interval display

### Issue 16: Pace Prediction Timeline + Explanation Engine
- **Status:** NOT BUILT
- **What's needed:** Weekly snapshots of pace model state → `pace_model_history` table. Line chart: threshold/marathon/easy pace over 3-6 months (inverted Y axis, faster = higher). Race annotations. Explanation engine: "10K in 43:30 updated paces" / "Last 5 tempo runs averaged 6:44" / "Mileage up 15%". Dashboard card showing current threshold with trend arrow. `get_pace_history` chatbot tool.
- **Priority:** MEDIUM — transparency and trust

---

## ❌ NOT BUILT (From Intervals.icu Catalog — Key Missing Features)

### HR Zone Breakdown Per Activity
- **Status:** NOT CONFIRMED
- **What's needed:** For each workout: 7 zones with HR ranges, time in each zone + percentage, colored bars, HR distribution histogram, HR curve comparison (this run vs 42-day avg), cumulative time above HR chart.
- **Spec ref:** Intervals.icu B5 (Tier 1 priority)

### Training Distribution Classification
- **Status:** NOT BUILT
- **What's needed:** Classify overall training as Polarized / Pyramidal / Threshold / HIIT / Base / Unique. Based on time in zone distribution. Mini 3-bar chart (Z1+2, Z3+4, Z5+). "Your training is Pyramidal 0.73."
- **Spec ref:** Intervals.icu D3 (Tier 1 priority)

### Period Totals Dashboard
- **Status:** PARTIALLY — analytics page exists but may not have the specific summary bar
- **What's needed:** Top bar: activities count, weeks, active days, total distance, duration, climbing, total load, calories.
- **Spec ref:** Intervals.icu D1 (Tier 1 priority)

### Weekly Summary Sidebar
- **Status:** NOT CONFIRMED
- **What's needed:** Per-week panel: week number, total time/kcal/load, elevation, fitness/fatigue/form/ramp rate, zone distribution classification.
- **Spec ref:** Intervals.icu C1 (Tier 2 priority)

### Activity Cards with Mini Zone Bars
- **Status:** NOT CONFIRMED
- **What's needed:** Calendar/list view where each workout card shows: duration + distance, avg HR (colored by intensity), pace, load, GAP, mini zone distribution bar at bottom.
- **Spec ref:** Intervals.icu C2 (Tier 2 priority)

### Pace Curve / Critical Speed Model
- **Status:** NOT CONFIRMED
- **What's needed:** X = distance (400m → marathon), Y = pace. Two lines: 42-day vs all-time. Critical Speed model (CS + D'). Hover shows distance, best time, date achieved.
- **Spec ref:** Intervals.icu E1 (Tier 2 priority)

### Ramp Rate Warning
- **Status:** NOT BUILT
- **What's needed:** Rate of CTL change. Warning if ramping too fast (injury risk). Simple calculation off existing CTL data.
- **Spec ref:** Intervals.icu A3 (Tier 3 priority)

### Wellness Trends
- **Status:** PARTIALLY — Intervals.icu wellness data imports but trend visualization not confirmed
- **What's needed:** HRV, resting HR, sleep duration, weight trends over time. Correlation with performance.
- **Spec ref:** Intervals.icu F2 (Tier 2 priority)

---

## SUMMARY: WHAT TO PROMPT CLAUDE CODE TO BUILD

### 🔴 BLOCKERS (Do First)
1. **Issue 8: Chart/Heatmap debugging protocol** — verify every chart shows data correctly
2. **Issue 14: UX bugs** — greeting, race adding, plan saving
3. **Issue 15: Lap sync debugging** — verify Strava laps import correctly
4. **Issue 9: Rich demo data** — 16 weeks of realistic training data for "Jason"

### 🟠 HIGH PRIORITY (Core Intelligence)
5. **Feature 4: Auto-categorization engine** — classify every run + AI summaries + bulk backfill
6. **Issue 1: Living pace model** — replace static VDOT with evolving Bayesian model
7. **Issue 11: Pace sanity checks** — hard constraints on zone ordering + interval structure
8. **Feature 1: "I Have X Minutes"** — quick rewrite preserving training intent
9. **Feature 3: "Why Did This Feel Hard?"** — post-run explainer + "Ask Coach: Why?" button
10. **Feature 10: Coach Dry-Run** — preview diffs before plan changes

### 🟡 MEDIUM PRIORITY (Rich Features)
11. **Issue 13: Multi-benefit run purpose** — weighted benefits per run (aerobic/threshold/VO2max)
12. **Feature 5: Multi-mode heatmap** — toggle between type/mileage/TRIMP/RPE coloring
13. **Training distribution classification** — polarized/pyramidal/threshold/etc.
14. **HR zone breakdown per activity** — time in zones, distribution histogram, curve comparison
15. **Issue 10: TRIMP square-root normalization** — better visual spread on heatmap
16. **Issue 12: Running power validation** — realistic watt ranges
17. **Issue 16: Pace prediction timeline** — pace trend chart + explanation engine
18. **Interval data table** — structured display of workout segments with tabs
19. **Feature 8: Race week checklist** — auto-generated race prep
20. **Feature 9: Weekly recap** — Monday morning summary card + streak tracking
21. **Feature 7: Treadmill conversion** — one-tap workout conversion
22. **Soreness body map completion** — finish the incomplete UI + pattern detection
23. **Issue 4: Warm color palette** — shift from clinical to warm
24. **Issue 2: Standard plan import** — Pfitz, Hansons, Higdon templates

### 🟢 LOW PRIORITY (Polish)
25. **Feature 6: Shareable cards upgrade** — IG story sizing, PR confetti, streak badges
26. **Feature 13: Gear prep reminder** — night-before preparation card
27. **Feature 14: Sentiment-aware coach** — add to system prompt
28. **Issue 3: Ultra marathon support** — 50K+ distances
29. **Issue 7: Agenda-first home screen** — single timeline view
30. **Route auto-detection** — trigger route matching on every workout save
31. **Pace curve / critical speed** — best efforts visualization
32. **Ramp rate warning** — alert if CTL increasing too fast
33. **Wellness trend charts** — HRV, resting HR, sleep over time
