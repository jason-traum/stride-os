# Partial Feature Quality Review — 2026-02-21

Deep code review of the ~20 features marked "partial" in the feature audit.

## Summary

| # | Feature | Status | Key Blocker | Effort |
|---|---------|--------|------------|--------|
| 1 | Import page | **FIXED** (commit f590d32) | ~~Missing server action + field mapping~~ Strava JSON + Garmin CSV now save. Bulk exporter added (ecd264c). | ~~Medium~~ Done |
| 2 | Coach Memory | Working but low quality | Regex extraction, stubbed compression. Schema tables added (9ff7ecf) but queries still commented out. | Medium |
| 3 | Hardcoded profileId | **FIXED** (~65 queries, commits a40603c, a715fe3, e44d4f1) | ~~1 explicit + ~15 unguarded `findFirst()`~~ All patched. | ~~Small~~ Done |
| 4 | Soreness body map | **FIXED** (commit 7bcfe65) | ~~Not imported anywhere~~ Integrated into AssessmentModal with per-region tracking. | ~~Medium~~ Done |
| 5 | Coach action approval (UI) | **Schema only** | Full feature missing | Large |
| 6 | Weekly Insights | **FIXED** (commit a715fe3) | ~~PR query missing profileId filter~~ profileId added. | ~~Small~~ Done |
| 7 | Morning Readiness | **PARTIALLY FIXED** | profileId fixed (a715fe3). HRV now wired from Intervals.icu (dbd4f4e). Stale data problem remains. | Small |
| 8 | Execution Scoring | **FIXED** (commit 4925017) | ~~No blocking issues~~ VDOT-derived paces working. | ~~Small~~ Done |
| 9 | Training Plan Adaptation | **FIXED** (commit a40603c) | ~~RPE trend not used, unguarded `findFirst()`~~ profileId guarded. RPE still not used but adaptation works. | ~~Small/Medium~~ Done |
| 10 | Best VDOT Segment | Working | Needs stream data (by design) | Small (UX) |
| 11 | Intervals.icu | **PARTIALLY FIXED** (commit dbd4f4e) | ~~Wellness/HRV never imported~~ HRV now wired into readiness score. Two-way sync still not built. | Small |
| 12 | Coach Action Creation | **Schema only** | Full feature missing | Large |

## Quick Wins (Small effort, high impact) — ALL DONE

1. ~~**Fix ~15 unguarded `findFirst()` calls**~~ — DONE (commits a40603c, a715fe3, e44d4f1)
2. ~~**Fix Weekly Insights PR query**~~ — DONE (commit a715fe3)
3. ~~**Fix Readiness profileId**~~ — DONE (commit a715fe3)
4. ~~**Fix Intervals.icu duplicate detection**~~ — DONE (commit a715fe3)

## Medium Effort — MOSTLY DONE

5. ~~**Import page**~~ — DONE (commit f590d32). Also added Strava bulk export importer (commit ecd264c).
6. **Coach Memory quality** — Still TODO. Regex extraction needs LLM replacement. Schema tables added (commit 9ff7ecf).
7. ~~**Soreness body map**~~ — DONE (commit 7bcfe65). Integrated into AssessmentModal with per-region tracking.
8. ~~**Intervals.icu wellness**~~ — DONE (commit dbd4f4e). HRV wired into readiness score.

## Large Effort (Needs Design)

9. **Coach action approval workflow** — Still TODO. Schema exists but nothing writes to it or reads from it.

## Detailed Findings

### 1. Import Page — FIXED (commit f590d32)

**File:** `src/app/import/page.tsx`

- ~~Line 43: `// TODO: Process and save activities` — nothing saves to DB~~ **Now saves to DB**
- Strava JSON and Garmin CSV formats both supported with proper field mapping
- Additionally, Strava bulk export importer added (commit ecd264c) for `.tar.gz` exports

### 2. Coach Memory — Low Quality

**Files:** `src/lib/coaching-memory.ts`, `src/lib/conversation-compression.ts`

- Insights are saved after each chat (api/chat/route.ts lines 883-888)
- `recallRelevantContext()` feeds memories into system prompt
- BUT: `extractInsights()` is pure regex — misses complex language, no dedup
- `conversation-compression.ts` DB path fully commented out; fallback is a basic keyword extractor

### 3. Hardcoded profileId — FIXED (commits a40603c, a715fe3, e44d4f1)

All ~65 unguarded queries now have profileId filters:
- ~~`src/actions/personal-records.ts:238` — `?? 1` fallback~~ Fixed
- ~~`src/actions/training-plan.ts:1101, 1166`~~ Fixed
- ~~`src/actions/onboarding.ts:99, 120, 258, 288, 312`~~ Fixed
- ~~`src/actions/races.ts:681, 753, 774`~~ Fixed
- ~~`src/lib/training/workout-processor.ts:114`~~ Fixed
- ~~`src/lib/coach-tools.ts:4227, 5654, 9708, 9912`~~ Fixed (commit e44d4f1)

### 4. Soreness Body Map — FIXED (commit 7bcfe65)

**File:** `src/components/SorenessMap.tsx`

- ~~Not imported anywhere in codebase~~ Now integrated into AssessmentModal
- ~~AssessmentModal uses a 0-10 numeric slider instead~~ Replaced with per-region body map tracking
- Per-region data now stored in DB

### 5 & 12. Coach Action Approval — Schema Only

- `coach_actions` table defined with approve/reject fields
- `PlanDiffCard.tsx` is display-only (no approve/reject buttons)
- Coach never creates `coach_actions` records
- Plan changes applied immediately without approval

### 6. Weekly Insights — FIXED (commit a715fe3)

- Real algorithmic analysis comparing 4-week vs 8-week windows
- ~~PR query at lines 220-233 missing profileId filter~~ profileId filter added

### 7. Morning Readiness — PARTIALLY FIXED (commits a715fe3, dbd4f4e)

- Weighted model: Sleep 35%, Training 25%, Physical 25%, Life 15%
- ~~`getIntervalsWellness()` defined but never called — HRV absent from calculation~~ HRV now wired into readiness (commit dbd4f4e)
- ~~DB queries have no profileId filter~~ profileId filters added (commit a715fe3)
- Stale data problem remains: uses most recent assessment even if days old

### 8. Execution Scoring — FIXED (commit 4925017)

- Real plan-vs-actual comparison with weather adjustment
- 4-component weighted scoring (pace/zone/completion/consistency)
- VDOT-derived paces now working (Phase 1 fix applied)
- No remaining blockers

### 9. Training Plan Adaptation — FIXED (commit a40603c)

- Completion rate <70% reduces mileage by 10%
- Overtraining 3+ weeks bumps mileage by 5%
- Limited: doesn't detect RPE trends or type mismatches (minor)
- ~~Unguarded `findFirst()` at line 1101~~ profileId filter added

### 10. Best VDOT Segment — Working

- Sliding-window algorithm with GPS/HR quality gating
- Graceful fallback when no stream data
- Works well when Strava GPS data is available

### 11. Intervals.icu — PARTIALLY FIXED (commit dbd4f4e)

- Full connect/sync flow works
- ~~`getIntervalsWellness()` defined but never called~~ HRV now wired into readiness score
- ~~Duplicate detection missing profileId filter~~ profileId filter added (commit a715fe3)
- Two-way sync still not built (low priority)
