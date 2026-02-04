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
| GAP-000v | Demo mode (localStorage) | implemented | `demo-mode.ts` |
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
- **Status:** partial
- **Batch:** TBD
- **Files:** `canonicalRoutes` table, `route-matcher.ts`
- **Missing:** Auto-trigger on workout save
- **Tests:** TBD

### GAP-004: Workout Segments / Lap Display
- **Source:** Intervals.icu catalog B2, B6; Addendum 2 Issue 15
- **Status:** partial (sync fixed, UI still needed)
- **Batch:** 1
- **Files:** `workoutSegments` table, `src/actions/laps.ts`, `src/actions/strava.ts`
- **Fixed:** Lap sync pipeline, safety fix for empty arrays, single workout resync
- **Missing:** Manual lap entry UI, rich interval data table (WORK/ALL/RECOVERY tabs), interval summary bar, CSV export
- **Tests:** TBD

### GAP-005: Share Cards (Sizing/Polish)
- **Source:** Feature Expansion v2, Feature 6
- **Status:** partial
- **Batch:** TBD
- **Files:** `/api/share/[type]/[id]`
- **Missing:** IG-story size (1080x1920), square post (1080x1080), PR confetti, streak badges, Dreamy branding
- **Tests:** TBD

### GAP-006: Busy Week + Travel Mode (Flags Only)
- **Source:** Feature Expansion v2, Feature 11
- **Status:** partial
- **Batch:** TBD
- **Files:** `coachSettings` has flags
- **Missing:** Actual logic for volume reduction, key session identification, treadmill conversion, "Life Happens" toggles, return-from-absence ramp
- **Tests:** TBD

---

## NOT BUILT - Feature Expansion v2

### GAP-007: "I Have X Minutes" Quick Workout Rewrite
- **Source:** Feature Expansion v2, Feature 1
- **Status:** not started
- **Batch:** TBD
- **Files:** TBD
- **Missing:** `rewrite_workout_for_time` chatbot tool, "Short on time?" button, time picker modal
- **Tests:** TBD
- **Priority:** HIGH

### GAP-008: "Why Did This Feel Hard?" Auto-Explainer
- **Source:** Feature Expansion v2, Feature 3
- **Status:** not started
- **Batch:** TBD
- **Files:** TBD
- **Missing:** `ai_explanation TEXT` field, post-assessment auto-generation, `explain_workout` tool, "Ask Coach: Why?" button
- **Tests:** TBD
- **Priority:** HIGH

### GAP-009: Intelligent Run Auto-Categorization (Full Engine)
- **Source:** Feature Expansion v2, Feature 4
- **Status:** partial
- **Batch:** TBD
- **Files:** Basic classification exists, `run-classifier.ts`
- **Missing:** Full pattern analysis (even splits, progressive, fartlek, negative split), AI-generated summaries, user override, bulk backfill tool, training distribution
- **Tests:** TBD
- **Priority:** HIGH

### GAP-010: Enhanced Activity Heatmap (Multi-Mode)
- **Source:** Feature Expansion v2, Feature 5
- **Status:** partial
- **Batch:** 2
- **Files:** `ActivityHeatmap.tsx` - basic heatmap exists
- **Missing:** Toggle modes (Run Type/Mileage/TRIMP/RPE), depth/opacity dimension, dynamic legend, click interactions, summary stats
- **Tests:** TBD
- **Priority:** MEDIUM

### GAP-011: Treadmill Conversion
- **Source:** Feature Expansion v2, Feature 7
- **Status:** not started
- **Batch:** TBD
- **Files:** TBD
- **Missing:** `treadmill-converter.ts`, pace adjustment, hill→incline, "Convert to Treadmill" button, chatbot tool
- **Tests:** TBD
- **Priority:** MEDIUM

### GAP-012: Race Week Checklist
- **Source:** Feature Expansion v2, Feature 8
- **Status:** not started
- **Batch:** TBD
- **Files:** TBD
- **Missing:** Auto-generate when race <7 days, gear prep, nutrition, race day logistics, fueling splits
- **Tests:** TBD
- **Priority:** MEDIUM

### GAP-013: Weekly Recap Card
- **Source:** Feature Expansion v2, Feature 9
- **Status:** not started
- **Batch:** TBD
- **Files:** TBD
- **Missing:** Sunday summary → Monday card, total stats, adherence %, streak tracking, shareable
- **Tests:** TBD
- **Priority:** MEDIUM

### GAP-014: Coach Dry-Run / Preview Mode
- **Source:** Feature Expansion v2, Feature 10
- **Status:** not started
- **Batch:** TBD
- **Files:** `coachActions` table exists but workflow not implemented
- **Missing:** `dryRun: boolean` on mutation tools, preview object, `PlanDiffCard.tsx`, safe vs significant change detection
- **Tests:** TBD
- **Priority:** HIGH

### GAP-015: Gear Prep Reminder (Night Before)
- **Source:** Feature Expansion v2, Feature 13
- **Status:** not started
- **Batch:** TBD
- **Files:** TBD
- **Missing:** After 6pm card, tomorrow's workout preview, outfit, shoe recommendation, chatbot tool
- **Tests:** TBD
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
- **Status:** not started
- **Batch:** TBD
- **Files:** TBD
- **Missing:** Bayesian pace model, weighted inputs from race results/workouts, evolving pace zones, VDOT fallback
- **Tests:** TBD
- **Priority:** HIGH

### GAP-018: Standard Plan Import (Pfitz, Hansons, Higdon, Daniels)
- **Source:** Addendum 1, Issue 2
- **Status:** not started
- **Batch:** TBD
- **Files:** CSV/ICS import exists
- **Missing:** Pre-built templates for popular programs, Dreamy coaching layer on top
- **Tests:** TBD
- **Priority:** MEDIUM

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
- **Status:** partial
- **Batch:** TBD
- **Files:** Tailwind config
- **Missing:** Verify/shift to warm stone/amber palette per spec
- **Tests:** Visual review
- **Priority:** MEDIUM

### GAP-021: Agenda-First Home Screen (LeCoach Pattern)
- **Source:** Addendum 1, Issue 7
- **Status:** partial
- **Batch:** 3
- **Files:** `src/app/today/page.tsx` - dashboard exists
- **Missing:** Verify single timeline view pattern, quick actions consistency
- **Tests:** TBD
- **Priority:** MEDIUM

### GAP-022: Fix Charts/Heatmap/Data Population
- **Source:** Addendum 1, Issue 8
- **Status:** in progress
- **Batch:** 2
- **Files:** `/analytics`, `ActivityHeatmap.tsx`
- **Missing:** Full pipeline trace per chart, date filtering fixes (UTC vs local), computed fields verification, heatmap cell size, purple color fix
- **Tests:** TBD
- **Priority:** BLOCKER

---

## NOT BUILT - Addendum 2 (Issues 9-16)

### GAP-023: 16 Weeks Realistic Demo Data
- **Source:** Addendum 2, Issue 9
- **Status:** not started
- **Batch:** 5+
- **Files:** TBD
- **Missing:** "Jason" profile with ~42 VDOT, 16 weeks history, full lap data, messy realism, races, shoe rotation
- **Tests:** TBD
- **Priority:** HIGH (but after real-data fixes)

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
- **Status:** partial
- **Batch:** 3
- **Files:** `today/page.tsx` (greeting looks correct), `/races`, plan actions
- **Missing:** Verify end-to-end race adding, plan persistence
- **Tests:** TBD
- **Priority:** HIGH

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
- **Status:** partial
- **Batch:** TBD
- **Files:** `RacePredictions.tsx` (some work done prior session)
- **Missing:** `pace_model_history` table, full timeline chart, explanation engine
- **Tests:** TBD
- **Priority:** MEDIUM

---

## NOT BUILT - Intervals.icu Catalog

### GAP-031: HR Zone Breakdown Per Activity
- **Source:** Intervals.icu B5 (Tier 1)
- **Status:** partial
- **Batch:** TBD
- **Files:** `getWorkoutHRZones` in `strava.ts`
- **Missing:** Full UI with 7 zones, colored bars, HR histogram, curve comparison
- **Tests:** TBD
- **Priority:** MEDIUM

### GAP-032: Training Distribution Classification
- **Source:** Intervals.icu D3 (Tier 1)
- **Status:** not started
- **Batch:** TBD
- **Files:** TBD
- **Missing:** Polarized/Pyramidal/Threshold/HIIT classification, mini chart, score display
- **Tests:** TBD
- **Priority:** MEDIUM

### GAP-033: Period Totals Dashboard
- **Source:** Intervals.icu D1 (Tier 1)
- **Status:** partial
- **Batch:** TBD
- **Files:** Analytics page exists
- **Missing:** Verify top bar with activities count, weeks, distance, duration, load
- **Tests:** TBD
- **Priority:** MEDIUM

### GAP-034: Weekly Summary Sidebar
- **Source:** Intervals.icu C1 (Tier 2)
- **Status:** not started
- **Batch:** TBD
- **Files:** TBD
- **Missing:** Per-week panel with totals, fitness/fatigue/form, zone distribution
- **Tests:** TBD
- **Priority:** MEDIUM

### GAP-035: Activity Cards with Mini Zone Bars
- **Source:** Intervals.icu C2 (Tier 2)
- **Status:** not started
- **Batch:** TBD
- **Files:** TBD
- **Missing:** Calendar/list cards with mini zone distribution bar
- **Tests:** TBD
- **Priority:** LOW

### GAP-036: Pace Curve / Critical Speed Model
- **Source:** Intervals.icu E1 (Tier 2)
- **Status:** partial
- **Batch:** TBD
- **Files:** `best-efforts.ts` has pace curve data
- **Missing:** Full visualization, 42-day vs all-time lines, Critical Speed model
- **Tests:** TBD
- **Priority:** MEDIUM

### GAP-037: Ramp Rate Warning
- **Source:** Intervals.icu A3 (Tier 3)
- **Status:** not started
- **Batch:** TBD
- **Files:** CTL data exists
- **Missing:** Rate of CTL change calculation, injury risk warning
- **Tests:** TBD
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
- **Status:** not started
- **Batch:** 3
- **Files:** TBD
- **Missing:** Add race to DB, associate with user profile
- **Tests:** Verify race appears in system

### GAP-040: Jersey City Marathon Race (April 19, 2026)
- **Status:** not started
- **Batch:** 3
- **Files:** TBD
- **Missing:** Add race to DB, associate with user profile
- **Tests:** Verify race appears in system

### GAP-041: Integrated Training Plan for Both Races
- **Status:** not started
- **Batch:** 4
- **Files:** Plan generator
- **Missing:** Plan that tapers for March 15, recovers, continues to April 19 marathon
- **Tests:** Verify plan structure and calendar display

---

## Summary Statistics

| Status | Count |
|--------|-------|
| implemented | 27 |
| partial | 18 |
| not started | 20 |
| in progress | 1 |
| **Total** | **66** |

---

## Batch Assignment Summary

| Batch | Items |
|-------|-------|
| 1 | GAP-004, GAP-029 (Laps/Segments) |
| 2 | GAP-010, GAP-022 (Analytics/Heatmap) |
| 3 | GAP-021, GAP-028, GAP-039, GAP-040 (UX, Races) |
| 4 | GAP-041 (Integrated Plan) |
| 5+ | All remaining items |

---

*Last updated: Batch 0 - 2026-02-03*
