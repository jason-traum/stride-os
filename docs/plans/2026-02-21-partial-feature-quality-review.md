# Partial Feature Quality Review — 2026-02-21

Deep code review of the ~20 features marked "partial" in the feature audit.

## Summary

| # | Feature | Status | Key Blocker | Effort |
|---|---------|--------|------------|--------|
| 1 | Import page | **Broken** (no save) | Missing server action + field mapping | Medium |
| 2 | Coach Memory | Working but low quality | Regex extraction, stubbed compression | Medium |
| 3 | Hardcoded profileId | Mostly fixed | 1 explicit + ~15 unguarded `findFirst()` | Small |
| 4 | Soreness body map | **Orphaned** component | Not imported anywhere, no DB field for per-region data | Medium |
| 5 | Coach action approval (UI) | **Schema only** | Full feature missing | Large |
| 6 | Weekly Insights | Working (algorithmic) | PR query missing profileId filter | Small |
| 7 | Morning Readiness | Working but incomplete | HRV not wired in, no profileId on queries | Small/Medium |
| 8 | Execution Scoring | Working well | No blocking issues | Small (polish) |
| 9 | Training Plan Adaptation | Working | RPE trend not used, unguarded `findFirst()` | Small/Medium |
| 10 | Best VDOT Segment | Working | Needs stream data (by design) | Small (UX) |
| 11 | Intervals.icu | Mostly working | Wellness/HRV never imported | Medium |
| 12 | Coach Action Creation | **Schema only** | Full feature missing | Large |

## Quick Wins (Small effort, high impact)

1. **Fix ~15 unguarded `findFirst()` calls** — Mechanical. Add `where: eq(profileId)` to each.
2. **Fix Weekly Insights PR query** — Add profileId filter to `stravaBestEfforts` query.
3. **Fix Readiness profileId** — Add profile filter to workout queries.
4. **Fix Intervals.icu duplicate detection** — Add profileId to dedup query.

## Medium Effort

5. **Import page** — Write `importActivities()` server action with Strava/Garmin field mapping.
6. **Coach Memory quality** — Replace regex `extractInsights()` with structured LLM extraction.
7. **Soreness body map** — Add JSON DB column, integrate into AssessmentModal, update coach tool.
8. **Intervals.icu wellness** — Wire `getIntervalsWellness()` into readiness score.

## Large Effort (Needs Design)

9. **Coach action approval workflow** — Full create-propose-approve-apply cycle missing. Schema exists but nothing writes to it or reads from it.

## Detailed Findings

### 1. Import Page — BROKEN

**File:** `src/app/import/page.tsx`

- File picker works, JSON/CSV parsing works
- Line 43: `// TODO: Process and save activities` — nothing saves to DB
- No field mapping from Strava/Garmin formats to internal schema
- CSV parser uses naive `split(',')` with no quote handling

### 2. Coach Memory — Low Quality

**Files:** `src/lib/coaching-memory.ts`, `src/lib/conversation-compression.ts`

- Insights are saved after each chat (api/chat/route.ts lines 883-888)
- `recallRelevantContext()` feeds memories into system prompt
- BUT: `extractInsights()` is pure regex — misses complex language, no dedup
- `conversation-compression.ts` DB path fully commented out; fallback is a basic keyword extractor

### 3. Hardcoded profileId — 1 Explicit + ~15 Implicit

**Direct:** `src/actions/personal-records.ts:238` — `?? 1` fallback

**Unguarded `findFirst()` (no where clause):**
- `src/actions/training-plan.ts:1101, 1166`
- `src/actions/onboarding.ts:99, 120, 258, 288, 312`
- `src/actions/races.ts:681, 753, 774`
- `src/lib/training/workout-processor.ts:114`
- `src/lib/coach-tools.ts:4227, 5654, 9708, 9912`

### 4. Soreness Body Map — Orphaned

**File:** `src/components/SorenessMap.tsx`

- Working SVG body diagram with severity picker
- Not imported anywhere in codebase
- AssessmentModal uses a 0-10 numeric slider instead
- No DB field for per-region data (schema has scalar `soreness` integer)

### 5 & 12. Coach Action Approval — Schema Only

- `coach_actions` table defined with approve/reject fields
- `PlanDiffCard.tsx` is display-only (no approve/reject buttons)
- Coach never creates `coach_actions` records
- Plan changes applied immediately without approval

### 6. Weekly Insights — Working, Small Bug

- Real algorithmic analysis comparing 4-week vs 8-week windows
- PR query at lines 220-233 missing profileId filter

### 7. Morning Readiness — Working, Incomplete

- Weighted model: Sleep 35%, Training 25%, Physical 25%, Life 15%
- `getIntervalsWellness()` defined but never called — HRV absent from calculation
- DB queries have no profileId filter
- Stale data problem: uses most recent assessment even if days old

### 8. Execution Scoring — Working Well

- Real plan-vs-actual comparison with weather adjustment
- 4-component weighted scoring (pace/zone/completion/consistency)
- VDOT-derived paces now working (Phase 1 fix applied)

### 9. Training Plan Adaptation — Working

- Completion rate <70% reduces mileage by 10%
- Overtraining 3+ weeks bumps mileage by 5%
- Limited: doesn't detect RPE trends or type mismatches
- Unguarded `findFirst()` at line 1101

### 10. Best VDOT Segment — Working

- Sliding-window algorithm with GPS/HR quality gating
- Graceful fallback when no stream data
- Works well when Strava GPS data is available

### 11. Intervals.icu — Mostly Working

- Full connect/sync flow works
- `getIntervalsWellness()` defined but never called
- No wellness/HRV data storage or usage
- Duplicate detection missing profileId filter
