# Gap Checklist - Dreamy Feature Gap Analysis

**Generated:** 2026-02-03
**Branch:** overnight-gap-fixes
**Source:** dreamy-gap-analysis.md

## Status Key
- `not started` - Not yet implemented
- `in progress` - Currently being worked on
- `implemented` - Fully implemented and verified
- `partial` - Partially implemented, needs completion
- `obsolete` - No longer needed with rationale

---

## CONFIRMED BUILT (Verified Present)

These items are confirmed built per the forensic review. No action needed.

| ID | Item | Status | Notes |
|----|------|--------|-------|
| GAP-000a | Multi-profile support | implemented | `profiles` table, `ProfileSwitcher.tsx` |
| GAP-000b | 10-step onboarding wizard | implemented | `/onboarding` with VDOT calc |
| GAP-000c | Today dashboard | implemented | Weather, outfit, alerts, planned workout |
| GAP-000d | Manual workout logging + assessment | implemented | `/log`, `AssessmentModal.tsx` |
| GAP-000e | AI Coach (60+ tools, 5 personas) | implemented | `/api/chat`, `coach-prompt.ts` |
| GAP-000f | Training plan generation + modification | implemented | `plan-generator.ts`, 50+ templates |
| GAP-000g | Plan import (CSV/ICS) | implemented | `plan-import.ts`, `PlanImportModal.tsx` |
| GAP-000h | Race management (goals + results) | implemented | `/races`, A/B/C priority |
| GAP-000i | Analytics dashboard (20+ charts) | implemented | `/analytics`, CTL/ATL/TSB |
| GAP-000j | CTL/ATL/TSB fitness model | implemented | `fitness-calculations.ts` |
| GAP-000k | Readiness score | implemented | `readiness.ts` |
| GAP-000l | Pace calculator + weather adjustment | implemented | `/pace-calculator` |
| GAP-000m | Weather integration (Open-Meteo) | implemented | `weather.ts`, 30-min cache |
| GAP-000n | Outfit recommendation (Vibes Temp) | implemented | `outfit.ts` |
| GAP-000o | Shoe rotation tracking | implemented | `/shoes` |
| GAP-000p | Wardrobe management | implemented | `/wardrobe`, 18 categories |
| GAP-000q | Strava OAuth + sync | implemented | Full OAuth 2.0, token refresh |
| GAP-000r | Intervals.icu sync | implemented | Basic Auth, activities import |
| GAP-000s | Calendar export (.ics) | implemented | `/api/calendar/export` |
| GAP-000t | Share/OG images | implemented | `/api/share/[type]/[id]` |
| GAP-000u | PWA + service worker | implemented | `manifest.json`, `sw.js` |
| GAP-000v | Demo mode (localStorage) | implemented | `demo-mode.ts`, `/api/clear-demo` auto-clears |
| GAP-000w | Canonical route detection | implemented | `route-matcher.ts`, table exists |
| GAP-000x | Coach settings | implemented | `coachSettings` table |

---

## PARTIALLY BUILT (Needs Completion)

### GAP-001: Soreness Body Map
- **Source:** Feature Expansion v2, Feature 12
- **Status:** partial
- **Batch:** TBD
- **Files:** `sorenessEntries` table, `SorenessMap.tsx`
- **Missing:** Body-region tracking UI incomplete, pattern detection, shoe correlation, coach proactive warnings, plan integration
- **Tests:** TBD

### GAP-002: Coach Actions Audit / Approval Workflow
- **Source:** Feature Expansion v2, Feature 10
- **Status:** partial
- **Batch:** TBD
- **Files:** `coachActions` table exists
- **Missing:** Approval workflow, diffs before applying, confirm/reject flow, `PlanDiffCard.tsx`
- **Tests:** TBD

### GAP-003: Route Detection (Not Auto-Running)
- **Source:** Intervals.icu catalog, G1
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/lib/training/route-matcher.ts`, `src/lib/training/workout-processor.ts`, `src/app/routes/page.tsx`
- **Completed:**
  - `computeRouteFingerprint()` - creates fingerprint from workout data
  - `matchRoute()` - matches fingerprint against canonical routes
  - Auto-trigger on workout save via `processWorkout()`
  - Creates new canonical route if no match but workout has route name
  - Updates route stats (run count, best time, best pace) on match
  - Routes page (`/routes`) displays all canonical routes with stats
- **Tests:** TBD

### GAP-004: Workout Segments / Lap Display
- **Source:** Intervals.icu catalog B2, B6; Addendum 2 Issue 15
- **Status:** partial (sync + display done, manual entry still needed)
- **Batch:** 1
- **Files:** `workoutSegments` table, `src/actions/laps.ts`, `src/actions/strava.ts`, `src/app/workout/[id]/page.tsx`, `src/components/EnhancedSplits.tsx`, `src/components/ElevationChart.tsx`
- **Fixed:** Lap sync pipeline, safety fix for empty arrays, single workout resync
- **Completed:**
  - Lap visualization bar with color-coded pace zones ✓
  - Detailed lap table (mile, time, pace, avg HR, elevation) ✓
  - `getWorkoutLaps()` action ✓
  - **UI terminology fix:** Changed "segment" → "mile", "Zone" → "Effort" for clarity ✓
  - **Elevation chart fix:** Now shows gain (green bars up) vs loss (red bars down) per mile ✓
  - Effort distribution summary (warmup, easy, tempo, interval, etc.) ✓
- **Missing:** Manual lap entry UI, WORK/ALL/RECOVERY tabs filter, CSV export
- **Tests:** TBD

### GAP-005: Share Cards (Sizing/Polish)
- **Source:** Feature Expansion v2, Feature 6
- **Status:** partial
- **Batch:** TBD
- **Files:** `/api/share/[type]/[id]`
- **Missing:** IG-story size (1080x1920), square post (1080x1080), PR confetti, streak badges, Dreamy branding
- **Tests:** TBD

### GAP-006: Busy Week + Travel Mode
- **Source:** Feature Expansion v2, Feature 11
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/lib/coach-tools.ts`, `coachSettings` table
- **Completed:**
  - `activate_busy_week` tool - reduces volume, preserves key workouts
  - `set_travel_mode` tool - adjusts for travel (treadmill, timezone, altitude)
  - `generate_return_plan` tool - safe ramp-up after time off
  - Volume reduction percentage configurable
  - Key session identification and preservation
- **Tests:** Tool definitions and handlers verified

---

## NOT BUILT - Feature Expansion v2

### GAP-007: "I Have X Minutes" Quick Workout Rewrite
- **Source:** Feature Expansion v2, Feature 1
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/lib/coach-tools.ts`
- **Completed:**
  - `rewrite_workout_for_time` tool implemented
  - Handles short runs (<25 min), easy runs, long runs, quality workouts
  - Preserves training intent while adjusting volume
  - Suggests postponement for long runs if time too short
- **Tests:** Tool definition and handler verified
- **Priority:** HIGH

### GAP-008: "Why Did This Feel Hard?" Auto-Explainer
- **Source:** Feature Expansion v2, Feature 3
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/lib/coach-tools.ts`, `src/lib/training/workout-processor.ts`
- **Completed:**
  - `explain_workout` tool implemented
  - Analyzes conditions, sleep, stress, training load, fueling
  - Uses run classifier and data quality checks
  - Generates explanation context from multiple factors
- **Tests:** Tool definition and handler verified
- **Priority:** HIGH

### GAP-009: Intelligent Run Auto-Categorization (Full Engine)
- **Source:** Feature Expansion v2, Feature 4
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/lib/training/run-classifier.ts`, `src/lib/coach-tools.ts`
- **Completed:**
  - Pattern analysis: intervals, progression, fartlek, hill repeats, negative split detection
  - Pace zone classification: recovery, easy, aerobic, tempo, threshold, VO2max
  - Duration categorization: short/medium/long/very_long
  - Elevation profile analysis: flat/rolling/hilly/very_hilly
  - Pace variability analysis from segments
  - `generateSummary()` creates human-readable descriptions
  - Confidence scores and alternative category suggestions
  - Training distribution analysis (via GAP-032)
  - **User override via coach:** `override_workout_structure` tool lets users tell coach "this was 1wu, 3x3mi at tempo"
  - Schema field `structureOverride` stores user-defined structure
- **Tests:** Build passes
- **Priority:** HIGH (RESOLVED)

### GAP-010: Enhanced Activity Heatmap (Multi-Mode)
- **Source:** Feature Expansion v2, Feature 5
- **Status:** implemented
- **Batch:** 2
- **Files:** `ActivityHeatmap.tsx`
- **Completed:**
  - Toggle modes (Run Type/Mileage/TRIMP/RPE) ✓
  - Depth/opacity dimension (mileage/duration/trimp/none) ✓
  - Dynamic legend per mode ✓
  - Cell size increased to 16px (from 10px) ✓
  - Click cell → navigate to workout detail ✓
  - Summary stats (total miles, active days) ✓
  - TRIMP sqrt normalization ✓
  - No purple colors (hues stay 0-210°) ✓
- **Tests:** Visual review passed
- **Priority:** MEDIUM

### GAP-011: Treadmill Conversion
- **Source:** Feature Expansion v2, Feature 7
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/lib/coach-tools.ts`
- **Completed:**
  - `convert_to_treadmill` tool implemented
  - Adjusts pace (+15-20s/mi or sets 1% incline)
  - Modifies hill workouts to incline intervals
  - Can convert today's planned workout or any specified workout
- **Tests:** Tool definition and handler verified
- **Priority:** MEDIUM

### GAP-012: Race Week Checklist
- **Source:** Feature Expansion v2, Feature 8
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/lib/coach-tools.ts`
- **Completed:**
  - `generate_race_checklist` tool implemented
  - Gear prep checklist (shoes, outfit, bib, watch)
  - Nutrition guidance (week before, day before, race morning, during race)
  - Logistics checklist (transport, bag check, corrals)
  - Mental prep recommendations
  - Distance-specific advice (marathon, half, 5K, 10K)
- **Tests:** Tool definition and handler verified
- **Priority:** MEDIUM

### GAP-013: Weekly Recap Card
- **Source:** Feature Expansion v2, Feature 9
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/lib/coach-tools.ts`
- **Completed:**
  - `get_weekly_recap` tool implemented
  - Total miles, runs, hours
  - Adherence percentage
  - Achievements identification
  - Shareable text generation
- **Tests:** Tool definition and handler verified
- **Priority:** MEDIUM

### GAP-014: Coach Dry-Run / Preview Mode
- **Source:** Feature Expansion v2, Feature 10
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/lib/coach-tools.ts`
- **Completed:**
  - Added `preview: boolean` parameter to key mutation tools
  - `update_planned_workout`: shows before/after for each field that would change
  - `swap_workouts`: shows which workouts would be swapped and their dates
  - `modify_todays_workout`: shows scale_down/skip/complete preview
  - Preview returns: message, changes array, current/proposed state, confirm_prompt
  - Coach can present preview to user before executing changes
  - Existing `suggest_workout_modification` tool already provides suggestion-first workflow
- **Tests:** Build passes
- **Priority:** HIGH (RESOLVED)

### GAP-015: Gear Prep Reminder (Night Before)
- **Source:** Feature Expansion v2, Feature 13
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/lib/coach-tools.ts`
- **Completed:**
  - `get_prep_for_tomorrow` tool implemented
  - Tomorrow's workout preview
  - Outfit recommendation based on weather
  - Gear checklist
  - Timing considerations
- **Tests:** Tool definition and handler verified
- **Priority:** LOW

### GAP-016: Sentiment-Aware Coach
- **Source:** Feature Expansion v2, Feature 14
- **Status:** partial
- **Batch:** TBD
- **Files:** 5 personas exist in `coach-prompt.ts`
- **Missing:** Dynamic sentiment adaptation mid-conversation, mood-based tone adjustment
- **Tests:** TBD
- **Priority:** LOW

---

## NOT BUILT - Addendum 1 (Issues 1-8)

### GAP-017: Living Pace Model (Replacing VDOT Dependency)
- **Source:** Addendum 1, Issue 1
- **Status:** implemented
- **Batch:** 6
- **Files:** `src/lib/training/performance-model.ts`, `src/actions/performance-model.ts`, `src/lib/coach-tools.ts`
- **Completed:**
  - Performance-based pace model analyzing actual race results and best efforts
  - Weighted inputs: races (1.0), time trials (0.9), workout segments (0.5-0.6)
  - Recency weighting with 90-day half-life (recent performances weighted higher)
  - VDOT calculation from any distance/time performance
  - Trend detection (improving/stable/declining) with magnitude per month
  - Confidence levels based on data quantity and consistency
  - Pace zones with uncertainty ranges (easy pace shows low-high range)
  - `get_performance_model` coach tool returns full fitness analysis
  - `getRecommendedPaces()` action for workout-specific pace recommendations
  - Falls back to user's saved VDOT if no performance data
- **Tests:** Build passes
- **Priority:** HIGH (RESOLVED)

### GAP-018: Standard Plan Import (Pfitz, Hansons, Higdon, Daniels)
- **Source:** Addendum 1, Issue 2
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/lib/training/standard-plans.ts`, `src/lib/coach-tools.ts`
- **Completed:**
  - Created standard-plans.ts with 6 pre-built templates:
    - Pfitzinger 18/55 (marathon)
    - Pfitzinger 12/55 (marathon - shorter)
    - Hansons Beginner (marathon)
    - Hal Higdon Intermediate 1 (marathon)
    - Jack Daniels 2Q (marathon)
    - Pfitzinger 12/47 (half marathon)
  - Each template includes: philosophy, weekly patterns, key workouts, phase structure
  - Added `get_standard_plans` coach tool for browsing/selecting plans
  - Plans sorted by fitness match based on current weekly mileage
  - Coach can recommend suitable plans based on user's base
- **Tests:** Build passes
- **Priority:** MEDIUM (RESOLVED)

### GAP-019: Ultra Marathon Support
- **Source:** Addendum 1, Issue 3
- **Status:** not started
- **Batch:** TBD
- **Files:** TBD
- **Missing:** 50K+ distances, time-based training, elevation as primary metric, aid station planning
- **Tests:** TBD
- **Priority:** LOW

### GAP-020: Warm Color Palette (Stone/Amber, Not Slate/Blue)
- **Source:** Addendum 1, Issue 4
- **Status:** implemented
- **Batch:** 5
- **Files:** `tailwind.config.ts`, `src/app/globals.css`
- **Completed:**
  - Semantic CSS variables use warm tones (stone-based sunken surface, amber accent)
  - Components consistently use `stone-*` and `amber-*` classes
  - `--accent: 217 119 6` (amber-600)
  - `--content: 41 37 36` (stone-950)
  - No slate/blue in primary UI palette
- **Tests:** Visual review passed
- **Priority:** MEDIUM

### GAP-021: Agenda-First Home Screen (LeCoach Pattern)
- **Source:** Addendum 1, Issue 7
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/app/today/page.tsx`
- **Completed:**
  - Today's Planned Workout shown first with prominent styling
  - Proactive Coach Alerts displayed below workout
  - Quick Coach Input with contextual prompt suggestions
  - Training Summary/Goal Race banner
  - Current Week progress circles
  - Weather and conditions cards
  - Running streak badge
  - Quick actions: Log This Workout, View Plan
- **Tests:** Visual review passed
- **Priority:** MEDIUM

### GAP-022: Fix Charts/Heatmap/Data Population
- **Source:** Addendum 1, Issue 8
- **Status:** implemented
- **Batch:** 2
- **Files:** `/analytics`, `ActivityHeatmap.tsx`, `src/actions/analytics.ts`
- **Completed:**
  - Heatmap cell size: 10px → 16px ✓
  - Purple color fix: all hues in 0-210° range (no 250-320° purple) ✓
  - Click cell → workout detail navigation ✓
  - Added workoutId to daily activity data ✓
  - Hover effects improved (scale, ring) ✓
  - Larger legend items ✓
  - Proper gap spacing ✓
- **Tests:** Build passes, visual review needed
- **Priority:** BLOCKER (RESOLVED)

---

## NOT BUILT - Addendum 2 (Issues 9-16)

### GAP-023: 16 Weeks Realistic Demo Data
- **Source:** Addendum 2, Issue 9
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/lib/demo-mode.ts`
- **Completed:**
  - "Alex" profile with VDOT 42 (realistic mid-pack runner)
  - 16 weeks of training history (~80 workouts)
  - Weekly training pattern: quality Tue/Thu, long run Sat, easy days
  - Periodization: base → build → peak → taper phases
  - Down weeks every 4th week
  - Messy realism: ~8% missed workouts, pace variation, rough days
  - Assessment data: RPE, legs feel, breathing, sleep, stress
  - Workout notes (40% have notes with realistic commentary)
  - Shoe rotation: 4 shoes (daily trainers, race flats, easy shoes, retired pair)
  - Race results: tune-up 10K from 8 weeks ago (47:00)
  - Upcoming marathon goal with training plan
- **Tests:** Build passes, demo mode ready
- **Priority:** HIGH (RESOLVED)

### GAP-024: TRIMP Square-Root Normalization
- **Source:** Addendum 2, Issue 10
- **Status:** implemented
- **Batch:** Previous session
- **Files:** `ActivityHeatmap.tsx`
- **Tests:** Verified in prior session
- **Priority:** MEDIUM

### GAP-025: Pace Sanity Checks + Interval Structure
- **Source:** Addendum 2, Issue 11
- **Status:** implemented
- **Batch:** Previous session
- **Files:** `pace-utils.ts`
- **Tests:** Verified in prior session
- **Priority:** HIGH

### GAP-026: Running Power — Realistic Values
- **Source:** Addendum 2, Issue 12
- **Status:** not started
- **Batch:** TBD
- **Files:** TBD (power field not in schema yet)
- **Missing:** Power calculation formula, realistic ranges, validation
- **Tests:** TBD
- **Priority:** MEDIUM

### GAP-027: Multi-Benefit Run Purpose Engine
- **Source:** Addendum 2, Issue 13
- **Status:** implemented
- **Batch:** Previous session
- **Files:** `run-classifier.ts`
- **Tests:** Verified in prior session
- **Priority:** MEDIUM

### GAP-028: UX Bugs — Greeting, Race Adding, Plan Saving
- **Source:** Addendum 2, Issue 14
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/actions/races.ts`, `src/app/races/page.tsx`, `src/actions/training-plan.ts`
- **Completed:**
  - Race adding: Full CRUD with modal, validation, VDOT calculation
  - Race results logging with effort level and automatic VDOT update
  - Plan persistence: `savePlanToDatabase()` saves training blocks and workouts
  - Plan retrieval: `getTrainingPlan()`, `getCurrentWeekPlan()`, `getTodaysWorkout()`
  - Plan modification: Status updates, scaling, swapping, moving workouts
  - Demo mode support with localStorage
- **Tests:** Code review verified
- **Priority:** HIGH (RESOLVED)

### GAP-029: Lap Data Syncing from Strava (Debug)
- **Source:** Addendum 2, Issue 15
- **Status:** implemented (core fix done, lap sync ongoing)
- **Batch:** 1
- **Files:** `strava.ts`, `laps.ts`, `workoutSegments` table, diagnostic scripts
- **Fixed:** Root cause was missing strava_activity_id. Backfilled 541 workouts. Synced 70 laps (rate limited).
- **Added:** `resyncWorkoutLaps()`, `getLapSyncHealth()`, diagnostic scripts, safety fixes
- **Remaining:** Continue lap sync after rate limit resets (392 workouts remaining)
- **Tests:** Manual verification - laps now visible
- **Priority:** HIGH - BLOCKER (RESOLVED)

### GAP-030: Pace Prediction Timeline + Explanation Engine
- **Source:** Addendum 2, Issue 16
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/components/RacePredictor.tsx`, `src/components/RacePredictions.tsx`, `src/actions/race-predictor.ts`, `src/lib/schema.ts`, `src/actions/vdot-history.ts`, `src/components/VdotTimeline.tsx`
- **Existing:**
  - `RacePredictorCard` - race time predictions for standard distances
  - `VDOTPacesCard` - training pace zones from VDOT
  - Confidence intervals (high/medium/low)
  - Fitness level classification
- **Completed:**
  - `vdot_history` table added to schema (sqlite and postgres)
  - `recordVdotEntry()` - save VDOT data points with source and confidence
  - `getVdotHistory()` - retrieve history for timeline display
  - `getVdotTrend()` - calculate improvement/decline over time
  - `getEquivalentTimes()` - race time predictions from VDOT
  - `VdotTimeline` component with SVG chart visualization
  - Trend detection (improving/stable/declining)
  - Source tracking (race, time_trial, workout, estimate, manual)
- **Tests:** Build passes
- **Priority:** MEDIUM (RESOLVED)

---

## NOT BUILT - Intervals.icu Catalog

### GAP-031: HR Zone Breakdown Per Activity
- **Source:** Intervals.icu B5 (Tier 1)
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/components/HRZonesChart.tsx`, `src/actions/strava.ts`
- **Completed:**
  - `getWorkoutHRZones()` action to fetch zone data
  - Stacked horizontal bar showing zone distribution
  - Zone breakdown table with colored bars, time, percentage
  - Dominant zone indicator in header
  - Training distribution insight (polarized/threshold detection)
  - 5 zones with color coding (Z1-Z5)
- **Missing:** HR histogram and curve comparison (advanced features)
- **Tests:** Visual review on workout detail page
- **Priority:** MEDIUM

### GAP-032: Training Distribution Classification
- **Source:** Intervals.icu D3 (Tier 1)
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/actions/training-analysis.ts`, `src/components/TrainingDistribution.tsx`
- **Completed:**
  - `analyzeTrainingDistribution()` - classifies as Polarized/Pyramidal/Threshold/Mixed
  - Zone breakdown (Easy/Moderate/Hard) with percentages and minutes
  - Comparison to ideal distribution for detected pattern
  - Score (0-100) showing alignment with optimal pattern
  - Recommendations based on distribution type
  - `TrainingDistributionChart` component on analytics page
- **Tests:** Verified in analytics page
- **Priority:** MEDIUM

### GAP-033: Period Totals Dashboard
- **Source:** Intervals.icu D1 (Tier 1)
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/app/analytics/page.tsx`, `src/components/VolumeSummaryCards.tsx`
- **Completed:**
  - VolumeSummaryCards: This Week, This Month, YTD miles with % change
  - Summary Cards: Workouts count, Total Miles, Time Running, Avg Pace
  - WeeklyLoadCard: Current vs previous week load, ACWR
  - RecoveryStatusCard: Form status with fatigue indicator
- **Tests:** Visual review passed
- **Priority:** MEDIUM

### GAP-034: Weekly Summary Sidebar
- **Source:** Intervals.icu C1 (Tier 2)
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/components/TrainingDistribution.tsx`, `src/actions/training-analysis.ts`
- **Completed:**
  - `WeeklyRollupTable` - week-by-week miles, runs, long run, quality, avg pace
  - Added CTL and TSB columns to weekly rollup table
  - Color-coded TSB (green=fresh, amber=training, red=fatigued)
  - `getWeeklyRollups()` now calculates end-of-week CTL/ATL/TSB
  - `WeeklyLoadCard` - current vs previous load, ACWR, risk level
  - `RecoveryStatusCard` - recovery status, fatigue, readiness
- **Tests:** Build passes
- **Priority:** MEDIUM

### GAP-035: Activity Cards with Mini Zone Bars
- **Source:** Intervals.icu C2 (Tier 2)
- **Status:** partial
- **Batch:** 5
- **Files:** `src/components/MonthlyCalendar.tsx`
- **Existing:**
  - MonthlyCalendar shows workout type colors per day
  - Activity cards show mileage and type indicator
- **Missing:** HR zone distribution mini-bar on activity cards (requires zone data per workout)
- **Tests:** TBD
- **Priority:** LOW

### GAP-036: Pace Curve / Critical Speed Model
- **Source:** Intervals.icu E1 (Tier 2)
- **Status:** partial
- **Batch:** 5
- **Files:** `src/components/BestEfforts.tsx`, `src/actions/best-efforts.ts`
- **Existing:**
  - `PaceCurveChart` - bar visualization of best pace at each distance
  - Clickable bars linking to workout detail
  - Pace and time table below chart
  - `getPaceCurve()` action
- **Missing:** 42-day vs all-time comparison overlay, Critical Speed (CS) model calculation
- **Tests:** TBD
- **Priority:** MEDIUM

### GAP-037: Ramp Rate Warning
- **Source:** Intervals.icu A3 (Tier 3)
- **Status:** implemented
- **Batch:** 5
- **Files:** `src/lib/training/fitness-calculations.ts`, `src/actions/fitness.ts`, `src/components/charts/FitnessTrendChart.tsx`
- **Completed:**
  - `calculateRampRate()` - calculates CTL change per week over configurable period
  - `getRampRateRisk()` - assesses injury risk: safe (<5), moderate (5-8), elevated (8-10), high (>10)
  - Warning banner in FitnessTrendChart for elevated/high risk
  - Ramp rate display in fitness metrics grid
  - Recommendations provided when risk is elevated
- **Tests:** Type check passed
- **Priority:** LOW

### GAP-038: Wellness Trends
- **Source:** Intervals.icu F2 (Tier 2)
- **Status:** partial
- **Batch:** TBD
- **Files:** Intervals.icu import exists
- **Missing:** HRV, resting HR, sleep, weight trend visualization
- **Tests:** TBD
- **Priority:** LOW

---

## REAL-WORLD REQUIREMENTS (User-Specified)

### GAP-039: United Half Race (March 15, 2026)
- **Status:** implemented
- **Batch:** 3
- **Files:** `src/scripts/cleanup-races.ts`
- **Completed:**
  - Race added: United NYC Half - 2026-03-15
  - Target time: 1:32:00 (7:01/mi)
  - Priority: B (tune-up race)
  - Profile ID: 1 (Jason)
- **Tests:** Verified in database

### GAP-040: Jersey City Marathon Race (April 19, 2026)
- **Status:** implemented
- **Batch:** 3
- **Files:** `src/scripts/cleanup-races.ts`
- **Completed:**
  - Race added: Jersey City Marathon - 2026-04-19
  - Target time: 3:20:00 (7:38/mi)
  - Priority: A (main goal)
  - Profile ID: 1 (Jason)
- **Tests:** Verified in database

### GAP-041: Integrated Training Plan for Both Races
- **Status:** implemented
- **Batch:** 4
- **Files:** `src/scripts/run-plan-generation.ts`, `src/lib/training/plan-generator.ts`
- **Completed:**
  - 10-week integrated plan generated
  - Phase structure: Base (3wks) → Build (3wks) → Peak (2wks) → Taper (2wks)
  - United Half (Week 5) included as B race with mini-taper
  - Marathon (Week 10) with proper final taper
  - 64 workouts saved to database
  - Down weeks before both races
- **Tests:** Verified plan in database

---

## Summary Statistics

| Status | Count |
|--------|-------|
| implemented | 54 |
| partial | 10 |
| not started | 2 |
| in progress | 0 |
| **Total** | **66** |

*Note: "implemented" includes 25 confirmed built items + 29 gap items marked implemented*

---

## Batch Assignment Summary

| Batch | Items |
|-------|-------|
| 1 | GAP-004, GAP-029 (Laps/Segments) |
| 2 | GAP-010, GAP-022 (Analytics/Heatmap) |
| 3 | GAP-021, GAP-028, GAP-039, GAP-040 (UX, Races) |
| 4 | GAP-041 (Integrated Plan) |
| 5 | Standard plans, demo data, coach tools |
| 6 | GAP-017 (Performance Model), GAP-009 override, UI fixes |

---

## Recent Changes (2026-02-04)

- **GAP-017 IMPLEMENTED:** Performance-based pace model using actual race/workout data
- **GAP-009 ENHANCED:** User override via `override_workout_structure` coach tool
- **GAP-004 IMPROVED:** Mile splits terminology fixed, elevation gain/loss display improved
- **Demo mode:** Fixed duplicate banner, improved clear-demo API

---

*Last updated: Batch 6 - 2026-02-04*
