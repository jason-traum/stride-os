# Phase 1: "The Engine" — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the algorithmic core — fix every correctness bug, sweep timezone issues, fill stubs, add test coverage, and create missing DB tables. No API calls, no LLM usage. Pure local work.

**Architecture:** Fix correctness bugs first (timezone, dead code, stubs), then add tests that verify the fixes and lock in behavior. Test infrastructure goes in first since everything else depends on it.

**Tech Stack:** Vitest (test runner), better-sqlite3 (local DB), Drizzle ORM, TypeScript

---

## Algorithm Audit Summary

| File | Grade | Issues |
|------|-------|--------|
| `src/lib/training/vdot-calculator.ts` | A | None |
| `src/lib/training/race-prediction-engine.ts` | A | Pragmatic timezone workaround line ~149 |
| `src/lib/training/interval-stress.ts` | A | None |
| `src/lib/training/effort-classifier.ts` | A | None |
| `src/lib/training/workout-processor.ts` | A | None |
| `src/lib/training/fitness-calculations.ts` | B+ | Timezone bug in `fillDailyLoadGaps` lines 136-140 |
| `src/lib/training/performance-model.ts` | B+ | None significant |
| `src/lib/training/fitness-assessment.ts` | B+ | `getRecentInjuries()` stub always returns `[]` |
| `src/lib/training/run-classifier.ts` | B+ | `220-age` maxHR formula outdated |
| `src/lib/training/execution-scorer.ts` | B | Hardcoded default paces |
| `src/lib/injury-risk.ts` | C+ | 4 timezone bugs, dead code bug in age risk |
| `src/lib/performance-trends.ts` | D/C+ | `fitnessProgression` fully stubbed, 6+ timezone bugs |

---

## Task 1: Set Up Vitest Test Infrastructure

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/training/__tests__/.gitkeep`
- Modify: `package.json` (add devDependencies and test scripts)
- Modify: `tsconfig.json` (add test paths if needed)

**Step 1: Install vitest**

Run: `npm install -D vitest @vitest/coverage-v8`
Expected: packages added to devDependencies

**Step 2: Create vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/training/**', 'src/lib/injury-risk.ts', 'src/lib/performance-trends.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Step 3: Add test scripts to package.json**

Add to `scripts`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

**Step 4: Create test directory**

Run: `mkdir -p src/lib/training/__tests__`

**Step 5: Write a smoke test to verify setup**

Create `src/lib/training/__tests__/vdot-calculator.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { calculateVDOT } from '../vdot-calculator'

describe('vdot-calculator smoke test', () => {
  it('calculates VDOT for a known 5K time', () => {
    // 20:00 5K = ~42.2 VDOT (Daniels table)
    const vdot = calculateVDOT(5000, 20 * 60)
    expect(vdot).toBeGreaterThan(41)
    expect(vdot).toBeLessThan(44)
  })
})
```

**Step 6: Run test to verify setup works**

Run: `npm test`
Expected: 1 test passes

**Step 7: Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/lib/training/__tests__/
git commit -m "feat: add vitest test infrastructure with smoke test"
```

---

## Task 2: Timezone Bug Sweep

Fix all `new Date("YYYY-MM-DD")` → `parseLocalDate()` across the algorithm files. This is mechanical and can be parallelized.

**Files:**
- Modify: `src/lib/injury-risk.ts` (lines 171, 259-260, 314-315, 363-365)
- Modify: `src/lib/performance-trends.ts` (lines 71, 74, 82, 243-245, 255, 385)
- Modify: `src/lib/training/fitness-calculations.ts` (lines 136-140)
- Modify: `src/lib/training/race-prediction-engine.ts` (line ~149)
- Test: `src/lib/training/__tests__/timezone-safety.test.ts`

**Step 1: Write a test that catches timezone bugs**

Create `src/lib/training/__tests__/timezone-safety.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'

describe('timezone safety', () => {
  it('parseLocalDate returns correct day-of-week for US timezones', () => {
    // 2026-02-21 is a Saturday
    // new Date("2026-02-21") in UTC = Friday night in US Pacific = wrong day
    const { parseLocalDate } = require('@/lib/utils')
    const date = parseLocalDate('2026-02-21')
    expect(date.getDay()).toBe(6) // Saturday
  })
})
```

**Step 2: Run test to verify it fails with raw `new Date()`**

This test should PASS because it tests `parseLocalDate` which is already correct. The point is to establish the contract.

**Step 3: Fix `injury-risk.ts`**

Add import at top: `import { parseLocalDate } from '@/lib/utils'`

Replace all `new Date(w.date)` and `new Date(dates[i])` with `parseLocalDate(w.date)` and `parseLocalDate(dates[i])` at lines:
- 171: `const weekKey = getWeekKey(parseLocalDate(w.date))`
- 259-260: `parseLocalDate(w.date) >= sevenDaysAgo`
- 314-315: `parseLocalDate(hardWorkouts[i-1].date)` and `parseLocalDate(hardWorkouts[i].date)`
- 363-365: `parseLocalDate(dates[i-1])` and `parseLocalDate(dates[i])`

**Step 4: Fix `performance-trends.ts`**

Add import: `import { parseLocalDate } from '@/lib/utils'`

Replace all `new Date(w.date)` and `new Date(dates[i])` with `parseLocalDate()` equivalents at lines 71, 74, 82, 243-245, 255, 385.

**Step 5: Fix `fitness-calculations.ts` `fillDailyLoadGaps`**

Lines 136-140: Replace `new Date(startDate)` with `parseLocalDate(startDate)`. Replace date iteration to use local date arithmetic instead of `.toISOString().split('T')[0]`.

```typescript
// Before (buggy):
const current = new Date(startDate)
while (current <= new Date(endDate)) {
  const dateStr = current.toISOString().split('T')[0]
  // ...
  current.setDate(current.getDate() + 1)
}

// After (fixed):
const current = parseLocalDate(startDate)
while (current <= parseLocalDate(endDate)) {
  const y = current.getFullYear()
  const m = String(current.getMonth() + 1).padStart(2, '0')
  const d = String(current.getDate()).padStart(2, '0')
  const dateStr = `${y}-${m}-${d}`
  // ...
  current.setDate(current.getDate() + 1)
}
```

**Step 6: Fix `race-prediction-engine.ts`**

Line ~149: Replace `new Date(dateStr + 'T12:00:00Z')` with `parseLocalDate(dateStr)` for canonical consistency.

**Step 7: Run all tests**

Run: `npm test`
Expected: All pass

**Step 8: Commit**

```bash
git add src/lib/injury-risk.ts src/lib/performance-trends.ts src/lib/training/fitness-calculations.ts src/lib/training/race-prediction-engine.ts src/lib/training/__tests__/timezone-safety.test.ts
git commit -m "fix: sweep timezone bugs across algorithm files — use parseLocalDate everywhere"
```

---

## Task 3: Fix `injury-risk.ts` Dead Code Bug

**Files:**
- Modify: `src/lib/injury-risk.ts` (line ~460)
- Test: `src/lib/training/__tests__/injury-risk.test.ts`

**Step 1: Write failing test**

Create `src/lib/training/__tests__/injury-risk.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'

describe('injury-risk age factor', () => {
  it('returns description for under-20 athletes', () => {
    // The calculateAgeRisk function at line 460 uses JavaScript label syntax
    // instead of object property — description is undefined for under-20
    // Test verifies the fix returns a proper description
  })
})
```

Note: The exact test depends on whether `calculateAgeRisk` is exported. If not, test through the main `calculateInjuryRisk` entry point with an under-20 profile.

**Step 2: Fix the dead code bug**

Line ~460 in `calculateAgeRisk()`: The under-20 case uses JavaScript label syntax `description:` which is a no-op label, not a property assignment.

```typescript
// Before (buggy):
description: 'Young runner — focus on form and gradual buildup'

// After (fixed):
description = 'Young runner — focus on form and gradual buildup'
```

Or if it's constructing an object literal, ensure proper syntax.

**Step 3: Run test to verify fix**

Run: `npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/injury-risk.ts src/lib/training/__tests__/injury-risk.test.ts
git commit -m "fix: injury-risk age factor description for under-20 athletes"
```

---

## Task 4: Implement `fitnessProgression` in `performance-trends.ts`

**Files:**
- Modify: `src/lib/performance-trends.ts` (line ~278)
- Modify: `src/actions/fitness.ts` (verify integration)
- Test: `src/lib/training/__tests__/performance-trends.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest'

describe('performance-trends fitnessProgression', () => {
  it('returns non-empty fitness progression when workouts exist', () => {
    // Currently always returns [] — test should fail until implemented
  })

  it('returns CTL/ATL/TSB values in progression', () => {
    // Each entry should have { date, ctl, atl, tsb }
  })
})
```

**Step 2: Implement fitnessProgression**

Replace the stub at line ~278 with a call to the existing `calculateFitnessMetrics` from `fitness-calculations.ts`. The CTL/ATL/TSB pipeline already works — it just needs to be connected here.

```typescript
// Before (stubbed):
fitnessProgression: []

// After (connected):
const dailyLoads = workouts.map(w => ({
  date: w.date,
  load: w.trimp || estimateTrimp(w),
}))
const filledLoads = fillDailyLoadGaps(dailyLoads)
const fitnessMetrics = calculateFitnessMetrics(filledLoads)
// ... assign to fitnessProgression
```

Import `fillDailyLoadGaps` and `calculateFitnessMetrics` from `@/lib/training/fitness-calculations`.

**Step 3: Run test**

Run: `npm test`
Expected: PASS

**Step 4: Verify FitnessTrendChart renders data**

Run the dev server locally and navigate to `/analytics/training`. The Fitness Trend Chart should now show actual CTL/ATL/TSB curves instead of being empty.

**Step 5: Commit**

```bash
git add src/lib/performance-trends.ts src/lib/training/__tests__/performance-trends.test.ts
git commit -m "feat: implement fitnessProgression — connect CTL/ATL/TSB pipeline to performance trends"
```

---

## Task 5: Update MaxHR Formula in `run-classifier.ts`

**Files:**
- Modify: `src/lib/training/run-classifier.ts` (line ~651)
- Test: `src/lib/training/__tests__/run-classifier.test.ts`

**Step 1: Write failing test**

```typescript
import { describe, it, expect } from 'vitest'

describe('run-classifier TRIMP', () => {
  it('uses Tanaka maxHR formula (208 - 0.7 * age) instead of 220-age', () => {
    // For age 50: 220-50=170 (old), 208-35=173 (Tanaka, more accurate)
    // Verify the TRIMP calculation uses the more accurate formula
  })
})
```

**Step 2: Fix the formula**

Line ~651:
```typescript
// Before:
const maxHr = 220 - age

// After (Tanaka, Monahan & Seals, 2001):
const maxHr = 208 - 0.7 * age
```

Also fix the hardcoded defaults:
```typescript
// Before:
const age = 30
const restingHr = 60

// After — use profile data when available, better defaults:
const age = profile?.age ?? 30
const restingHr = profile?.restingHeartRate ?? 60
```

**Step 3: Run test**

Run: `npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/training/run-classifier.ts src/lib/training/__tests__/run-classifier.test.ts
git commit -m "fix: use Tanaka maxHR formula (208-0.7*age) for more accurate TRIMP"
```

---

## Task 6: Fix Hardcoded Default Paces in `execution-scorer.ts`

**Files:**
- Modify: `src/lib/training/execution-scorer.ts` (lines 229-231)
- Test: `src/lib/training/__tests__/execution-scorer.test.ts`

**Step 1: Write failing test**

```typescript
describe('execution-scorer default paces', () => {
  it('derives default paces from user VDOT when available', () => {
    // A user with VDOT 35 (beginner) should not be scored against 7:00/mi threshold
    // Their threshold is ~9:54/mi per Daniels tables
  })

  it('falls back to reasonable paces when no VDOT available', () => {
    // Without VDOT, use mid-range defaults (VDOT ~40 ≈ recreational runner)
  })
})
```

**Step 2: Fix the defaults**

Lines 229-231: Instead of hardcoded 9:00/7:30/7:00, derive from user's VDOT using `calculatePaceZones()`:

```typescript
// Before:
const easyPace = 540   // 9:00/mi
const tempoPace = 450   // 7:30/mi
const thresholdPace = 420 // 7:00/mi

// After:
const zones = userVdot ? calculatePaceZones(userVdot) : calculatePaceZones(40)
const easyPace = zones.easy?.pace ?? 540
const tempoPace = zones.tempo?.pace ?? 450
const thresholdPace = zones.threshold?.pace ?? 420
```

**Step 3: Run tests**

Run: `npm test`
Expected: PASS

**Step 4: Commit**

```bash
git add src/lib/training/execution-scorer.ts src/lib/training/__tests__/execution-scorer.test.ts
git commit -m "fix: derive execution scorer paces from user VDOT instead of hardcoded defaults"
```

---

## Task 7: Comprehensive Tests for `vdot-calculator.ts`

**Files:**
- Modify: `src/lib/training/__tests__/vdot-calculator.test.ts` (expand smoke test)

**Step 1: Write comprehensive tests**

```typescript
import { describe, it, expect } from 'vitest'
import { calculateVDOT, calculatePaceZones, predictRaceTime, getWeatherPaceAdjustment } from '../vdot-calculator'

describe('vdot-calculator', () => {
  describe('calculateVDOT', () => {
    it('returns ~30 VDOT for 30:00 5K', () => {
      const vdot = calculateVDOT(5000, 30 * 60)
      expect(vdot).toBeCloseTo(30, 0)
    })

    it('returns ~42 VDOT for 20:00 5K', () => {
      const vdot = calculateVDOT(5000, 20 * 60)
      expect(vdot).toBeCloseTo(42, 0)
    })

    it('returns ~50 VDOT for 17:00 5K', () => {
      const vdot = calculateVDOT(5000, 17 * 60)
      expect(vdot).toBeCloseTo(50, 0)
    })

    it('returns ~60 VDOT for 14:30 5K', () => {
      const vdot = calculateVDOT(5000, 14.5 * 60)
      expect(vdot).toBeCloseTo(60, 0)
    })

    it('clamps to range 15-85', () => {
      // Very slow: should not go below 15
      const slow = calculateVDOT(5000, 60 * 60)
      expect(slow).toBeGreaterThanOrEqual(15)

      // Very fast: should not go above 85
      const fast = calculateVDOT(5000, 10 * 60)
      expect(fast).toBeLessThanOrEqual(85)
    })
  })

  describe('predictRaceTime', () => {
    it('predicts ~20:00 5K for VDOT 42', () => {
      const time = predictRaceTime(42, 5000)
      expect(time).toBeGreaterThan(19 * 60)
      expect(time).toBeLessThan(21 * 60)
    })

    it('predicts marathon slower than 5K proportionally', () => {
      const fiveK = predictRaceTime(42, 5000)
      const marathon = predictRaceTime(42, 42195)
      // Marathon should be > 8.44x the 5K time (distance ratio)
      expect(marathon / fiveK).toBeGreaterThan(8.44)
    })
  })

  describe('calculatePaceZones', () => {
    it('returns zones for VDOT 42', () => {
      const zones = calculatePaceZones(42)
      expect(zones).toBeDefined()
      // Easy pace should be slower than tempo
      // Tempo should be slower than interval
    })
  })

  describe('getWeatherPaceAdjustment', () => {
    it('returns 0 adjustment at optimal temperature (45F)', () => {
      const adj = getWeatherPaceAdjustment(45, 50, 40)
      expect(adj).toBeCloseTo(0, 1)
    })

    it('returns positive adjustment (slower) in heat', () => {
      const adj = getWeatherPaceAdjustment(85, 80, 75)
      expect(adj).toBeGreaterThan(0)
    })

    it('caps total adjustment at 15%', () => {
      const adj = getWeatherPaceAdjustment(100, 100, 90)
      expect(adj).toBeLessThanOrEqual(0.15)
    })
  })
})
```

**Step 2: Run tests to verify they pass**

Run: `npm test -- src/lib/training/__tests__/vdot-calculator.test.ts`
Expected: All PASS (this file is grade A, tests should confirm)

**Step 3: Commit**

```bash
git add src/lib/training/__tests__/vdot-calculator.test.ts
git commit -m "test: comprehensive tests for vdot-calculator (Daniels formula, zones, weather)"
```

---

## Task 8: Comprehensive Tests for `fitness-calculations.ts`

**Files:**
- Create: `src/lib/training/__tests__/fitness-calculations.test.ts`

**Step 1: Write tests**

```typescript
import { describe, it, expect } from 'vitest'
import { calculateWorkoutLoad, calculateFitnessMetrics, fillDailyLoadGaps, calculateRampRate, getFitnessStatus } from '../fitness-calculations'

describe('fitness-calculations', () => {
  describe('calculateWorkoutLoad', () => {
    it('returns higher load for faster paces', () => {
      const fast = calculateWorkoutLoad({ durationMinutes: 60, avgPaceSeconds: 420, type: 'easy' })
      const slow = calculateWorkoutLoad({ durationMinutes: 60, avgPaceSeconds: 600, type: 'easy' })
      expect(fast).toBeGreaterThan(slow)
    })

    it('returns higher load for longer duration', () => {
      const long = calculateWorkoutLoad({ durationMinutes: 90, avgPaceSeconds: 540, type: 'easy' })
      const short = calculateWorkoutLoad({ durationMinutes: 30, avgPaceSeconds: 540, type: 'easy' })
      expect(long).toBeGreaterThan(short)
    })

    it('applies intensity factor by workout type', () => {
      const interval = calculateWorkoutLoad({ durationMinutes: 60, avgPaceSeconds: 420, type: 'interval' })
      const easy = calculateWorkoutLoad({ durationMinutes: 60, avgPaceSeconds: 420, type: 'easy' })
      expect(interval).toBeGreaterThan(easy)
    })
  })

  describe('calculateFitnessMetrics (Banister model)', () => {
    it('CTL responds slower than ATL (42-day vs 7-day time constant)', () => {
      // After a sudden load spike, ATL should rise faster than CTL
      const loads = Array.from({ length: 50 }, (_, i) => ({
        date: `2026-01-${String(i + 1).padStart(2, '0')}`,
        load: i < 40 ? 50 : 150, // spike at day 40
      }))
      const metrics = calculateFitnessMetrics(loads)
      const lastMetric = metrics[metrics.length - 1]
      // ATL should be closer to 150 than CTL is
      expect(lastMetric.atl).toBeGreaterThan(lastMetric.ctl)
    })

    it('TSB = CTL - ATL', () => {
      const loads = [
        { date: '2026-01-01', load: 100 },
        { date: '2026-01-02', load: 50 },
      ]
      const metrics = calculateFitnessMetrics(loads)
      metrics.forEach(m => {
        expect(m.tsb).toBeCloseTo(m.ctl - m.atl, 5)
      })
    })
  })

  describe('fillDailyLoadGaps', () => {
    it('fills missing dates with zero load', () => {
      const loads = [
        { date: '2026-01-01', load: 100 },
        { date: '2026-01-03', load: 50 }, // gap on Jan 2
      ]
      const filled = fillDailyLoadGaps(loads)
      const jan2 = filled.find(l => l.date === '2026-01-02')
      expect(jan2).toBeDefined()
      expect(jan2!.load).toBe(0)
    })
  })

  describe('getFitnessStatus', () => {
    it('returns race-ready for TSB 5-20', () => {
      expect(getFitnessStatus(10)).toContain('race')
    })

    it('returns overreached for TSB < -25', () => {
      expect(getFitnessStatus(-30)).toContain('overreach')
    })
  })

  describe('calculateRampRate', () => {
    it('flags high risk for >10 CTL/week increase', () => {
      const result = calculateRampRate(12)
      expect(result.risk).toBe('high')
    })
  })
})
```

**Step 2: Run tests**

Run: `npm test -- src/lib/training/__tests__/fitness-calculations.test.ts`
Expected: All PASS (after timezone fix in Task 2)

**Step 3: Commit**

```bash
git add src/lib/training/__tests__/fitness-calculations.test.ts
git commit -m "test: comprehensive tests for fitness-calculations (Banister CTL/ATL/TSB)"
```

---

## Task 9: Comprehensive Tests for `race-prediction-engine.ts`

**Files:**
- Create: `src/lib/training/__tests__/race-prediction-engine.test.ts`

**Step 1: Write tests**

This file is pure (no DB imports) and highly testable. Test the signal extraction, blending, and decay logic.

```typescript
import { describe, it, expect } from 'vitest'

describe('race-prediction-engine', () => {
  describe('signal blending', () => {
    it('weights race VDOT highest (1.0)', () => {
      // Race signal should dominate when available
    })

    it('applies exponential decay to older data points', () => {
      // A 6-month-old race should have ~50% weight of a recent race (180-day half-life)
    })

    it('dampens outliers more than 4 VDOT from blend', () => {
      // An outlier signal should be weight-reduced
    })
  })

  describe('form adjustment', () => {
    it('penalizes race time when fatigued (TSB < -10)', () => {
      // TSB -15 should add ~1.5% to predicted time
    })

    it('gives slight bonus when fresh (TSB 5-25)', () => {
      // TSB 15 should subtract ~0.5% from predicted time
    })
  })

  describe('readiness score', () => {
    it('weights volume 40%, long run 35%, consistency 25%', () => {
      // Test individual component weights
    })
  })
})
```

Note: Exact test implementations depend on what's exported. If internal functions aren't exported, test through the main `getComprehensiveRacePredictions()` entry point with mocked workout data.

**Step 2: Run tests**

Run: `npm test -- src/lib/training/__tests__/race-prediction-engine.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add src/lib/training/__tests__/race-prediction-engine.test.ts
git commit -m "test: comprehensive tests for race-prediction-engine (signals, blending, decay)"
```

---

## Task 10: Tests for `interval-stress.ts` and `effort-classifier.ts`

**Files:**
- Create: `src/lib/training/__tests__/interval-stress.test.ts`
- Create: `src/lib/training/__tests__/effort-classifier.test.ts`

**Step 1: Write interval-stress tests**

```typescript
describe('interval-stress', () => {
  it('applies no discount for continuous runs', () => {
    // Rest:work ratio near 0 → discount factor ~1.0
  })

  it('applies cruise interval exception for Daniels criteria', () => {
    // Threshold pace ±5-10%, ≤60s rest per mile → no discount
  })

  it('discounts more for passive recovery than active', () => {
    // At same rest:work ratio, passive discount > active discount
  })

  it('uses gender-specific y-factor for Banister TRIMP', () => {
    // Male y=1.92, Female y=1.67
  })
})
```

**Step 2: Write effort-classifier tests**

```typescript
describe('effort-classifier', () => {
  it('classifies easy pace splits as Zone 1-2', () => {})
  it('detects warmup in first 1-2 splits', () => {})
  it('detects cooldown in last 1-2 splits', () => {})
  it('smooths isolated outlier classifications', () => {})
  it('flags GPS artifacts (pace < 3:00/mi)', () => {})
  it('applies hysteresis to prevent zone flipping', () => {})
})
```

**Step 3: Run tests**

Run: `npm test`
Expected: All PASS

**Step 4: Commit**

```bash
git add src/lib/training/__tests__/interval-stress.test.ts src/lib/training/__tests__/effort-classifier.test.ts
git commit -m "test: add tests for interval-stress and effort-classifier"
```

---

## Task 11: Fix UI Error Isolation on Today Page

**Files:**
- Modify: `src/app/today/page.tsx` (line ~111)
- Modify: `src/app/analytics/page.tsx` (line ~36)

**Step 1: Fix Today page — replace `Promise.all` with `Promise.allSettled`**

Line ~111: The 14-call `Promise.all` crashes the entire page if any single call fails.

```typescript
// Before:
const [workouts, settings, todaysWorkout, ...] = await Promise.all([
  getWorkouts(10),
  getSettings(),
  getTodaysWorkout(),
  // ...
])

// After:
const results = await Promise.allSettled([
  getWorkouts(10),
  getSettings(),
  getTodaysWorkout(),
  // ...
])

const [workouts, settings, todaysWorkout, ...] = results.map((r, i) => {
  if (r.status === 'fulfilled') return r.value
  console.error(`Today page data fetch ${i} failed:`, r.reason)
  return null // or appropriate default
})
```

**Step 2: Fix Analytics overview — add `.catch()` to unprotected calls**

Line ~36: `getTrainingLoadData` and `getVolumeSummaryData` need `.catch()` isolation like `getAnalyticsData` already has.

**Step 3: Verify locally**

Run: `npm run dev`
Navigate to `/today` — page should render even if one data source fails.

**Step 4: Commit**

```bash
git add src/app/today/page.tsx src/app/analytics/page.tsx
git commit -m "fix: add error isolation to Today and Analytics pages — no single failure crashes the page"
```

---

## Task 12: Fix Visible UI Bugs

**Files:**
- Modify: `src/components/RunningStats.tsx` (line ~251)
- Modify: `src/components/EnhancedSplits.tsx` (line ~376 vs ~407)
- Modify: `src/components/BestEfforts.tsx` (line ~548, type definition)
- Modify: `src/app/analytics/history/page.tsx` (line ~112)

**Step 1: Fix Runs-by-Day invisible bars**

`src/components/RunningStats.tsx` line ~251:
```typescript
// Before (bg-textTertiary is not a valid Tailwind class — transparent bars):
className={`... ${isActive ? 'bg-dream-500' : 'bg-textTertiary'}`}

// After:
className={`... ${isActive ? 'bg-dream-500' : 'bg-stone-400 dark:bg-stone-500'}`}
```

**Step 2: Fix EnhancedSplits HR column mismatch**

Line ~376: The HR column header checks `laps.some(l => l.avgHeartRate)` but the body at line ~407 iterates `activeSplits`. Change both to use the same source:
```typescript
// Use activeSplits for both header and body
const showHR = activeSplits.some(l => l.avgHeartRate)
```

**Step 3: Fix BestEfforts WorkoutRankingBadge type mismatch**

Lines ~548-585: The render code references `ranking.isBest`, `ranking.totalEfforts`, `ranking.percentFromBest` but the `WorkoutRanking` type only has `distance`, `rank`, `total`, `percentile`. Either fix the type or fix the render to use the correct field names.

**Step 4: Fix Analytics History proportionality bug**

Line ~112: Replace `data.totalWorkouts` denominator with the sum of the distribution counts:
```typescript
const totalCounts = data.workoutTypeDistribution.reduce((sum, t) => sum + t.count, 0)
// Then use totalCounts as denominator for bar widths
```

**Step 5: Verify fixes visually**

Run: `npm run dev`
- `/analytics/history` — Runs by Day chart should show visible bars
- Workout detail page — EnhancedSplits HR column should be consistent
- Analytics History — Workout type bars should sum to 100%

**Step 6: Commit**

```bash
git add src/components/RunningStats.tsx src/components/EnhancedSplits.tsx src/components/BestEfforts.tsx src/app/analytics/history/page.tsx
git commit -m "fix: invisible chart bars, HR column mismatch, type distribution proportionality"
```

---

## Task 13: Create Missing DB Tables

**Files:**
- Create: migration file via `drizzle-kit generate`
- Modify: `src/lib/schema.ts` (add 3 tables)

**Step 1: Add table definitions to schema**

Add to `src/lib/schema.ts`:

```typescript
export const conversationSummaries = sqliteTable('conversation_summaries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profile_id').notNull().references(() => profiles.id),
  summary: text('summary').notNull(),
  messageCount: integer('message_count').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`),
})

export const responseCache = sqliteTable('response_cache', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cacheKey: text('cache_key').notNull().unique(),
  response: text('response').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
})

export const workoutTemplates = sqliteTable('workout_templates', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  profileId: integer('profile_id').notNull().references(() => profiles.id),
  name: text('name').notNull(),
  workoutType: text('workout_type').notNull(),
  structure: text('structure').notNull(), // JSON
  targetPaceZone: text('target_pace_zone'),
  notes: text('notes'),
  usageCount: integer('usage_count').default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
})
```

**Step 2: Generate migration**

Run: `npm run db:generate`
Expected: New migration file created in `migrations/`

**Step 3: Apply migration locally**

Run: `npm run db:push`
Expected: Tables created in local SQLite

**Step 4: Commit**

```bash
git add src/lib/schema.ts migrations/
git commit -m "feat: add conversationSummaries, responseCache, workoutTemplates tables"
```

---

## Task 14: Gate Debug Pages Behind Development Mode

**Files:**
- Modify: `src/app/debug/page.tsx`
- Modify: `src/app/debug/api-usage/page.tsx`
- Modify: `src/app/test-chat/page.tsx`
- Modify: `src/app/test-stream/page.tsx`
- Modify: `src/app/test-streaming/page.tsx`
- Modify: `src/app/env-check/page.tsx`
- Modify: `src/app/debug-profile/page.tsx`
- And any other debug/test pages

**Step 1: Create a dev-only gate component or redirect**

Add to each debug page's server component:
```typescript
import { redirect } from 'next/navigation'

export default function DebugPage() {
  if (process.env.NODE_ENV === 'production') {
    redirect('/')
  }
  // ... existing page content
}
```

**Step 2: Verify locally**

Run: `npm run dev` — debug pages accessible
Run: `npm run build && npm start` — debug pages redirect to home

**Step 3: Commit**

```bash
git add src/app/debug/ src/app/test-chat/ src/app/test-stream/ src/app/test-streaming/ src/app/env-check/ src/app/debug-profile/
git commit -m "fix: gate debug/test pages behind NODE_ENV=development"
```

---

## Execution Order

Tasks can be grouped for parallel execution:

**Sequential (foundation first):**
1. Task 1 (vitest setup) — everything else depends on this

**Parallel batch 1 (bug fixes):**
2. Task 2 (timezone sweep)
3. Task 3 (injury-risk dead code)
4. Task 11 (error isolation)
5. Task 12 (UI bugs)
6. Task 14 (gate debug pages)

**Parallel batch 2 (features + tests, after batch 1):**
7. Task 4 (implement fitnessProgression)
8. Task 5 (Tanaka maxHR)
9. Task 6 (execution scorer paces)
10. Task 7 (vdot-calculator tests)
11. Task 8 (fitness-calculations tests)

**Parallel batch 3 (remaining tests, after batch 2):**
12. Task 9 (race-prediction-engine tests)
13. Task 10 (interval-stress + effort-classifier tests)

**Final:**
14. Task 13 (missing DB tables)

---

## Success Criteria

- [ ] `npm test` runs and passes with 0 failures
- [ ] All timezone bugs in algorithm files use `parseLocalDate()`
- [ ] `injury-risk.ts` has no dead code bugs
- [ ] FitnessTrendChart shows real CTL/ATL/TSB data
- [ ] Tanaka maxHR formula used throughout
- [ ] Execution scorer uses VDOT-derived paces
- [ ] Today page survives individual data source failures
- [ ] Runs-by-Day chart shows visible bars
- [ ] Debug pages inaccessible in production
- [ ] 3 new DB tables exist and are migratable
- [ ] Test coverage on all core algorithm files
