import { describe, it, expect } from 'vitest'
import {
  computeSegmentTrimp,
  classifyRecoveryType,
  computeRestToWorkRatio,
  computeDiscountFactor,
  checkCruiseIntervalException,
  computeIntervalStress,
} from '../interval-stress'
import type { WorkoutSegment, Workout, UserSettings } from '../../schema'

// ---------------------------------------------------------------------------
// Helpers — build realistic segment / workout objects with minimal boilerplate
// ---------------------------------------------------------------------------

/** Create a minimal WorkoutSegment with sensible defaults. */
function seg(overrides: Partial<WorkoutSegment> = {}): WorkoutSegment {
  return {
    id: 1,
    workoutId: 1,
    segmentNumber: 1,
    segmentType: 'work',
    distanceMiles: 1.0,
    durationSeconds: 480,
    paceSecondsPerMile: 480,
    avgHr: null,
    maxHr: null,
    elevationGainFt: null,
    notes: null,
    paceZone: null,
    paceZoneConfidence: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as WorkoutSegment
}

/** Minimal Workout object for computeIntervalStress. */
function workout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: 1,
    profileId: 1,
    date: '2026-01-15',
    distanceMiles: 6.0,
    durationMinutes: 48,
    avgPaceSeconds: 480,
    avgHr: null,
    maxHr: null,
    elevationGainFt: null,
    routeName: null,
    shoeId: null,
    workoutType: 'interval',
    source: 'manual',
    notes: null,
    weatherTempF: null,
    weatherFeelsLikeF: null,
    weatherHumidityPct: null,
    weatherWindMph: null,
    weatherConditions: null,
    weatherSeverityScore: null,
    plannedWorkoutId: null,
    stravaActivityId: null,
    intervalsActivityId: null,
    avgHeartRate: null,
    elevationGainFeet: null,
    trainingLoad: null,
    autoCategory: null,
    category: null,
    structureOverride: null,
    stravaName: null,
    autoSummary: null,
    aiExplanation: null,
    qualityRatio: null,
    trimp: null,
    intervalAdjustedTrimp: null,
    intervalStressDetails: null,
    executionScore: null,
    executionDetails: null,
    dataQualityFlags: null,
    routeFingerprint: null,
    routeId: null,
    ...overrides,
  } as Workout
}

function settings(overrides: Partial<UserSettings> = {}): UserSettings {
  return {
    id: 1,
    profileId: 1,
    name: 'Test Runner',
    age: 30,
    gender: 'male',
    restingHr: 60,
    thresholdPaceSeconds: 400,
    ...overrides,
  } as UserSettings
}

// ---------------------------------------------------------------------------
// computeSegmentTrimp
// ---------------------------------------------------------------------------
describe('computeSegmentTrimp', () => {
  it('returns 0 for zero-duration segment', () => {
    const s = seg({ durationSeconds: 0 })
    expect(computeSegmentTrimp(s, null, 0)).toBe(0)
  })

  it('returns 0 for null duration', () => {
    const s = seg({ durationSeconds: null })
    expect(computeSegmentTrimp(s, null, 0)).toBe(0)
  })

  it('uses HR-based Banister formula when avgHr is present (male)', () => {
    // Male runner, age 30, resting HR 60, max HR = 190
    // avgHr = 160 → hrFraction = (160-60)/(190-60) = 100/130 ≈ 0.769
    // yFactor = 0.769 * 1.92 * exp(1.92 * 0.769) = 0.769 * 1.92 * exp(1.477)
    // exp(1.477) ≈ 4.381 → yFactor ≈ 0.769 * 1.92 * 4.381 ≈ 6.467
    // 10 min * 6.467 ≈ 64.67
    const s = seg({ durationSeconds: 600, avgHr: 160, paceSecondsPerMile: 420 })
    const trimp = computeSegmentTrimp(s, settings({ gender: 'male' }), 0)
    expect(trimp).toBeGreaterThan(50)
    expect(trimp).toBeLessThan(80)
  })

  it('uses female y-factor (1.67) for female runners', () => {
    // Same HR but female: yFactor = 0.769 * 1.67 * exp(1.92 * 0.769)
    // = 0.769 * 1.67 * 4.381 ≈ 5.625
    const s = seg({ durationSeconds: 600, avgHr: 160 })
    const male = computeSegmentTrimp(s, settings({ gender: 'male' }), 0)
    const female = computeSegmentTrimp(s, settings({ gender: 'female' }), 0)
    // Male y-factor (1.92) is higher than female (1.67) so male TRIMP > female
    expect(male).toBeGreaterThan(female)
  })

  it('clamps HR reserve fraction to [0, 1]', () => {
    // avgHr below resting → hrFraction clamped to 0 → yFactor = 0
    const s = seg({ durationSeconds: 600, avgHr: 50 })
    const trimp = computeSegmentTrimp(s, settings({ restingHr: 60 }), 0)
    expect(trimp).toBe(0)
  })

  it('falls back to pace-based intensity when no HR data', () => {
    // pace 350 sec/mi (< 360) → intensity 2.5
    // 5 min * 2.5 = 12.5
    const s = seg({ durationSeconds: 300, paceSecondsPerMile: 350, avgHr: null })
    const trimp = computeSegmentTrimp(s, null, 0)
    expect(trimp).toBe(5 * 2.5) // 12.5
  })

  it('applies condition adjustment to pace fallback', () => {
    // Raw pace 430, condition adj 20 → effective pace 410
    // 410 < 420 → intensity 2.0
    // Without adj: 430 < 480 → intensity 1.6
    const s = seg({ durationSeconds: 600, paceSecondsPerMile: 430, avgHr: null })
    const withAdj = computeSegmentTrimp(s, null, 20)
    const withoutAdj = computeSegmentTrimp(s, null, 0)
    expect(withAdj).toBeGreaterThan(withoutAdj)
  })

  it('uses correct pace intensity brackets', () => {
    const dur = 60 // 1 minute
    const make = (pace: number) => seg({ durationSeconds: dur, paceSecondsPerMile: pace, avgHr: null })

    // < 360 → 2.5
    expect(computeSegmentTrimp(make(340), null, 0)).toBeCloseTo(2.5, 1)
    // 360-419 → 2.0
    expect(computeSegmentTrimp(make(390), null, 0)).toBeCloseTo(2.0, 1)
    // 420-479 → 1.6
    expect(computeSegmentTrimp(make(450), null, 0)).toBeCloseTo(1.6, 1)
    // 480-539 → 1.3
    expect(computeSegmentTrimp(make(500), null, 0)).toBeCloseTo(1.3, 1)
    // 540-599 → 1.1
    expect(computeSegmentTrimp(make(570), null, 0)).toBeCloseTo(1.1, 1)
    // >= 600 → 1.0
    expect(computeSegmentTrimp(make(700), null, 0)).toBeCloseTo(1.0, 1)
  })

  it('returns durationMin * 1.0 when no HR and no pace', () => {
    const s = seg({ durationSeconds: 120, avgHr: null, paceSecondsPerMile: null })
    expect(computeSegmentTrimp(s, null, 0)).toBe(2.0) // 2 min * 1.0
  })

  it('defaults age to 30 and resting HR to 60 when no settings', () => {
    const s = seg({ durationSeconds: 600, avgHr: 160 })
    const withSettings = computeSegmentTrimp(s, settings({ age: 30, restingHr: 60 }), 0)
    const withoutSettings = computeSegmentTrimp(s, null, 0)
    expect(withoutSettings).toBeCloseTo(withSettings, 5)
  })
})

// ---------------------------------------------------------------------------
// classifyRecoveryType
// ---------------------------------------------------------------------------
describe('classifyRecoveryType', () => {
  it('returns passive for empty array', () => {
    expect(classifyRecoveryType([])).toBe('passive')
  })

  it('returns active for segments with real pace and >1 mph speed', () => {
    // distance 0.1mi in 120s = 0.1 / (120/3600) = 3.0 mph → active
    const s = seg({
      segmentType: 'recovery',
      paceSecondsPerMile: 720,
      distanceMiles: 0.1,
      durationSeconds: 120,
    })
    expect(classifyRecoveryType([s])).toBe('active')
  })

  it('returns passive for stopped/walking segments with no pace', () => {
    const s = seg({
      segmentType: 'recovery',
      paceSecondsPerMile: null,
      distanceMiles: 0,
      durationSeconds: 60,
    })
    expect(classifyRecoveryType([s])).toBe('passive')
  })

  it('returns passive when pace > 900 (>15:00/mi)', () => {
    const s = seg({
      segmentType: 'recovery',
      paceSecondsPerMile: 950,
      distanceMiles: 0.05,
      durationSeconds: 60,
    })
    expect(classifyRecoveryType([s])).toBe('passive')
  })

  it('returns passive when speed <= 1 mph despite having pace', () => {
    // distance 0.01mi in 60s = 0.01 / (60/3600) = 0.6 mph → passive
    const s = seg({
      segmentType: 'recovery',
      paceSecondsPerMile: 600,
      distanceMiles: 0.01,
      durationSeconds: 60,
    })
    expect(classifyRecoveryType([s])).toBe('passive')
  })

  it('returns mixed when both active and passive segments present', () => {
    const active = seg({
      segmentType: 'recovery',
      paceSecondsPerMile: 600,
      distanceMiles: 0.15,
      durationSeconds: 90,
    })
    const passive = seg({
      segmentType: 'recovery',
      paceSecondsPerMile: null,
      distanceMiles: 0,
      durationSeconds: 60,
    })
    expect(classifyRecoveryType([active, passive])).toBe('mixed')
  })
})

// ---------------------------------------------------------------------------
// computeRestToWorkRatio
// ---------------------------------------------------------------------------
describe('computeRestToWorkRatio', () => {
  it('identifies work by pace zone', () => {
    const segments = [
      seg({ paceZone: 'threshold', durationSeconds: 300, segmentType: 'steady' }),
      seg({ paceZone: 'recovery', durationSeconds: 90, segmentType: 'steady' }),
    ]
    const { ratio, workDurationSec, restDurationSec } = computeRestToWorkRatio(segments)
    expect(workDurationSec).toBe(300)
    expect(restDurationSec).toBe(90)
    expect(ratio).toBeCloseTo(0.3, 1)
  })

  it('identifies work by segment type', () => {
    const segments = [
      seg({ segmentType: 'work', durationSeconds: 300, paceZone: null }),
      seg({ segmentType: 'recovery', durationSeconds: 150, paceZone: null }),
    ]
    const { ratio } = computeRestToWorkRatio(segments)
    expect(ratio).toBeCloseTo(0.5, 1)
  })

  it('returns null ratio when no work segments', () => {
    const segments = [
      seg({ segmentType: 'warmup', paceZone: 'easy', durationSeconds: 600 }),
    ]
    const { ratio } = computeRestToWorkRatio(segments)
    expect(ratio).toBeNull()
  })

  it('excludes warmup/cooldown from ratio', () => {
    const segments = [
      seg({ segmentType: 'warmup', durationSeconds: 600, paceZone: 'easy' }),
      seg({ segmentType: 'work', durationSeconds: 300, paceZone: 'threshold' }),
      seg({ segmentType: 'recovery', durationSeconds: 60, paceZone: 'recovery' }),
      seg({ segmentType: 'cooldown', durationSeconds: 600, paceZone: 'easy' }),
    ]
    const { ratio, workDurationSec, restDurationSec } = computeRestToWorkRatio(segments)
    expect(workDurationSec).toBe(300)
    expect(restDurationSec).toBe(60)
    expect(ratio).toBeCloseTo(0.2, 1)
  })

  it('counts all WORK_ZONES: tempo, threshold, interval, marathon', () => {
    const segments = [
      seg({ paceZone: 'tempo', durationSeconds: 200, segmentType: 'steady' }),
      seg({ paceZone: 'interval', durationSeconds: 100, segmentType: 'steady' }),
      seg({ paceZone: 'marathon', durationSeconds: 100, segmentType: 'steady' }),
      seg({ paceZone: 'recovery', durationSeconds: 80, segmentType: 'steady' }),
    ]
    const { workDurationSec, restDurationSec } = computeRestToWorkRatio(segments)
    expect(workDurationSec).toBe(400)
    expect(restDurationSec).toBe(80)
  })

  it('counts WORK_SEGMENT_TYPES: work, intervals, strides', () => {
    const segments = [
      seg({ segmentType: 'work', durationSeconds: 100, paceZone: null }),
      seg({ segmentType: 'intervals' as any, durationSeconds: 100, paceZone: null }),
      seg({ segmentType: 'strides' as any, durationSeconds: 50, paceZone: null }),
    ]
    const { workDurationSec } = computeRestToWorkRatio(segments)
    expect(workDurationSec).toBe(250)
  })
})

// ---------------------------------------------------------------------------
// computeDiscountFactor (DISCOUNT_TABLE)
// ---------------------------------------------------------------------------
describe('computeDiscountFactor', () => {
  it('returns 1.0 for null ratio', () => {
    expect(computeDiscountFactor(null, 'active')).toBe(1.0)
  })

  it('returns 1.0 for continuous run (ratio <= 0.02)', () => {
    expect(computeDiscountFactor(0.01, 'active')).toBe(1.0)
    expect(computeDiscountFactor(0.02, 'active')).toBe(1.0)
  })

  it('passive gets more discount (lower factor) than active', () => {
    const ratios = [0.10, 0.25, 0.45, 0.80]
    for (const r of ratios) {
      const active = computeDiscountFactor(r, 'active')
      const passive = computeDiscountFactor(r, 'passive')
      expect(passive).toBeLessThan(active)
    }
  })

  it('mixed recovery averages active and passive', () => {
    const ratio = 0.3
    const active = computeDiscountFactor(ratio, 'active')
    const passive = computeDiscountFactor(ratio, 'passive')
    const mixed = computeDiscountFactor(ratio, 'mixed')
    expect(mixed).toBeCloseTo((active + passive) / 2, 5)
  })

  it('maps discount table brackets correctly', () => {
    // ratio 0.10 → bracket [0.17]: active 0.965, passive 0.925
    expect(computeDiscountFactor(0.10, 'active')).toBe(0.965)
    expect(computeDiscountFactor(0.10, 'passive')).toBe(0.925)

    // ratio 0.25 → bracket [0.33]: active 0.925, passive 0.875
    expect(computeDiscountFactor(0.25, 'active')).toBe(0.925)
    expect(computeDiscountFactor(0.25, 'passive')).toBe(0.875)

    // ratio 0.45 → bracket [0.50]: active 0.875, passive 0.825
    expect(computeDiscountFactor(0.45, 'active')).toBe(0.875)
    expect(computeDiscountFactor(0.45, 'passive')).toBe(0.825)

    // ratio 0.80 → bracket [1.00]: active 0.825, passive 0.750
    expect(computeDiscountFactor(0.80, 'active')).toBe(0.825)
    expect(computeDiscountFactor(0.80, 'passive')).toBe(0.750)
  })

  it('uses worst-case for ratios exceeding 1.0', () => {
    expect(computeDiscountFactor(1.5, 'active')).toBe(0.825)
    expect(computeDiscountFactor(1.5, 'passive')).toBe(0.750)
  })

  it('discount factor is always between 0.70 and 1.00', () => {
    const ratios = [0, 0.01, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0]
    const types = ['active', 'passive', 'mixed'] as const
    for (const r of ratios) {
      for (const t of types) {
        const f = computeDiscountFactor(r, t)
        expect(f).toBeGreaterThanOrEqual(0.70)
        expect(f).toBeLessThanOrEqual(1.00)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// checkCruiseIntervalException
// ---------------------------------------------------------------------------
describe('checkCruiseIntervalException', () => {
  it('returns false when no threshold pace in settings', () => {
    expect(checkCruiseIntervalException([], null)).toBe(false)
    expect(checkCruiseIntervalException([], settings({ thresholdPaceSeconds: null } as any))).toBe(false)
  })

  it('returns true for Daniels cruise intervals: threshold pace, short rest', () => {
    // thresholdPace = 400 sec/mi
    // Work pace at 395 (within 95-110% of 400 → 380-440)
    // 3 work segments of 1 mile each = 3 miles
    // 2 rest segments of 45 sec each = 90 sec total → 90/3 = 30 sec/mi ≤ 60
    const segments = [
      seg({ segmentType: 'work', paceZone: 'threshold', paceSecondsPerMile: 395, distanceMiles: 1.0, durationSeconds: 395 }),
      seg({ segmentType: 'recovery', paceZone: 'recovery', paceSecondsPerMile: 900, distanceMiles: 0.05, durationSeconds: 45 }),
      seg({ segmentType: 'work', paceZone: 'threshold', paceSecondsPerMile: 405, distanceMiles: 1.0, durationSeconds: 405 }),
      seg({ segmentType: 'recovery', paceZone: 'recovery', paceSecondsPerMile: 900, distanceMiles: 0.05, durationSeconds: 45 }),
      seg({ segmentType: 'work', paceZone: 'threshold', paceSecondsPerMile: 400, distanceMiles: 1.0, durationSeconds: 400 }),
    ]
    expect(checkCruiseIntervalException(segments, settings({ thresholdPaceSeconds: 400 }))).toBe(true)
  })

  it('returns false when work pace is too fast (< 95% of threshold)', () => {
    // threshold = 400, 95% = 380. Pace of 370 is too fast.
    const segments = [
      seg({ segmentType: 'work', paceZone: 'threshold', paceSecondsPerMile: 370, distanceMiles: 1.0, durationSeconds: 370 }),
      seg({ segmentType: 'recovery', paceZone: 'recovery', paceSecondsPerMile: 900, distanceMiles: 0.05, durationSeconds: 30 }),
    ]
    expect(checkCruiseIntervalException(segments, settings({ thresholdPaceSeconds: 400 }))).toBe(false)
  })

  it('returns false when work pace is too slow (> 110% of threshold)', () => {
    // threshold = 400, 110% = 440. Pace of 450 is too slow.
    const segments = [
      seg({ segmentType: 'work', paceZone: 'tempo', paceSecondsPerMile: 450, distanceMiles: 1.0, durationSeconds: 450 }),
      seg({ segmentType: 'recovery', paceZone: 'recovery', paceSecondsPerMile: 900, distanceMiles: 0.05, durationSeconds: 30 }),
    ]
    expect(checkCruiseIntervalException(segments, settings({ thresholdPaceSeconds: 400 }))).toBe(false)
  })

  it('returns false when rest exceeds 60 sec per mile of work', () => {
    // 2 miles of work, 150 sec of rest → 75 sec/mi > 60
    const segments = [
      seg({ segmentType: 'work', paceZone: 'threshold', paceSecondsPerMile: 400, distanceMiles: 1.0, durationSeconds: 400 }),
      seg({ segmentType: 'recovery', paceZone: 'recovery', paceSecondsPerMile: 900, distanceMiles: 0.1, durationSeconds: 150 }),
      seg({ segmentType: 'work', paceZone: 'threshold', paceSecondsPerMile: 400, distanceMiles: 1.0, durationSeconds: 400 }),
    ]
    expect(checkCruiseIntervalException(segments, settings({ thresholdPaceSeconds: 400 }))).toBe(false)
  })

  it('returns false when there are no work segments', () => {
    const segments = [
      seg({ segmentType: 'warmup', paceZone: 'easy', paceSecondsPerMile: 550, distanceMiles: 1.0, durationSeconds: 550 }),
    ]
    expect(checkCruiseIntervalException(segments, settings({ thresholdPaceSeconds: 400 }))).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// computeIntervalStress — main orchestrator
// ---------------------------------------------------------------------------
describe('computeIntervalStress', () => {
  it('gracefully degrades for < 3 segments (returns aggregate TRIMP unchanged)', () => {
    const w = workout()
    const segs = [
      seg({ segmentType: 'work', paceSecondsPerMile: 420, durationSeconds: 300 }),
    ]
    const result = computeIntervalStress(w, segs, null, 50)
    expect(result.intervalAdjustedTrimp).toBe(50)
    expect(result.discountFactor).toBe(1.0)
    expect(result.segmentCount).toBe(1)
    expect(result.isCruiseInterval).toBe(false)
  })

  it('gracefully degrades for 2 segments', () => {
    const w = workout()
    const segs = [
      seg({ segmentType: 'work', paceSecondsPerMile: 400, durationSeconds: 300 }),
      seg({ segmentType: 'recovery', paceSecondsPerMile: 700, durationSeconds: 60 }),
    ]
    const result = computeIntervalStress(w, segs, null, 75)
    expect(result.intervalAdjustedTrimp).toBe(75)
    expect(result.segmentCount).toBe(2)
  })

  it('gracefully degrades for 0 segments', () => {
    const result = computeIntervalStress(workout(), [], null, 100)
    expect(result.intervalAdjustedTrimp).toBe(100)
    expect(result.segmentCount).toBe(0)
  })

  it('applies discount factor for interval workout with rest', () => {
    // Classic interval session: warmup, 3x work + 2x recovery, cooldown
    const w = workout()
    const segs = [
      seg({ segmentType: 'warmup', paceZone: 'easy', paceSecondsPerMile: 540, durationSeconds: 600, distanceMiles: 1.1 }),
      seg({ segmentType: 'work', paceZone: 'threshold', paceSecondsPerMile: 400, durationSeconds: 300, distanceMiles: 0.75 }),
      seg({ segmentType: 'recovery', paceZone: 'recovery', paceSecondsPerMile: 700, durationSeconds: 120, distanceMiles: 0.17 }),
      seg({ segmentType: 'work', paceZone: 'threshold', paceSecondsPerMile: 400, durationSeconds: 300, distanceMiles: 0.75 }),
      seg({ segmentType: 'recovery', paceZone: 'recovery', paceSecondsPerMile: 700, durationSeconds: 120, distanceMiles: 0.17 }),
      seg({ segmentType: 'work', paceZone: 'threshold', paceSecondsPerMile: 400, durationSeconds: 300, distanceMiles: 0.75 }),
      seg({ segmentType: 'cooldown', paceZone: 'easy', paceSecondsPerMile: 540, durationSeconds: 600, distanceMiles: 1.1 }),
    ]
    const result = computeIntervalStress(w, segs, null, 100)

    expect(result.segmentCount).toBe(7)
    expect(result.discountFactor).toBeLessThan(1.0) // rest gets discounted
    expect(result.restTrimp).toBeGreaterThan(0)
    expect(result.workTrimp).toBeGreaterThan(0)
    expect(result.warmupCooldownTrimp).toBeGreaterThan(0)
    // Adjusted is less than raw sum due to discount
    expect(result.intervalAdjustedTrimp).toBeLessThanOrEqual(result.rawSegmentTrimpSum)
  })

  it('continuous run gets no discount (factor ~1.0)', () => {
    // All easy segments, no recovery — typical continuous easy run
    const w = workout({ workoutType: 'easy' })
    const segs = [
      seg({ segmentType: 'steady', paceZone: 'easy', paceSecondsPerMile: 540, durationSeconds: 600 }),
      seg({ segmentType: 'steady', paceZone: 'easy', paceSecondsPerMile: 535, durationSeconds: 600 }),
      seg({ segmentType: 'steady', paceZone: 'easy', paceSecondsPerMile: 530, durationSeconds: 600 }),
    ]
    const result = computeIntervalStress(w, segs, null, 100)
    // No work or rest segments → ratio is null → discount = 1.0
    expect(result.discountFactor).toBe(1.0)
  })

  it('passive recovery gets more discount than active recovery', () => {
    const w = workout()
    const makeSegs = (recoveryPace: number | null, recoveryDist: number): WorkoutSegment[] => [
      seg({ segmentType: 'work', paceZone: 'threshold', paceSecondsPerMile: 400, durationSeconds: 300, distanceMiles: 0.75 }),
      seg({ segmentType: 'recovery', paceZone: 'recovery', paceSecondsPerMile: recoveryPace, durationSeconds: 120, distanceMiles: recoveryDist }),
      seg({ segmentType: 'work', paceZone: 'threshold', paceSecondsPerMile: 400, durationSeconds: 300, distanceMiles: 0.75 }),
      seg({ segmentType: 'recovery', paceZone: 'recovery', paceSecondsPerMile: recoveryPace, durationSeconds: 120, distanceMiles: recoveryDist }),
      seg({ segmentType: 'work', paceZone: 'threshold', paceSecondsPerMile: 400, durationSeconds: 300, distanceMiles: 0.75 }),
    ]

    // Active recovery: jogging at 10:00/mi pace
    const activeResult = computeIntervalStress(w, makeSegs(600, 0.2), null, 100)
    // Passive recovery: standing still
    const passiveResult = computeIntervalStress(w, makeSegs(null, 0), null, 100)

    expect(activeResult.recoveryType).toBe('active')
    expect(passiveResult.recoveryType).toBe('passive')
    // Active gets less discount (higher factor) than passive
    expect(activeResult.discountFactor).toBeGreaterThan(passiveResult.discountFactor)
  })

  it('cruise interval exception bypasses discount', () => {
    const w = workout()
    const segs = [
      seg({ segmentType: 'work', paceZone: 'threshold', paceSecondsPerMile: 400, durationSeconds: 400, distanceMiles: 1.0 }),
      seg({ segmentType: 'recovery', paceZone: 'recovery', paceSecondsPerMile: 800, durationSeconds: 50, distanceMiles: 0.06 }),
      seg({ segmentType: 'work', paceZone: 'threshold', paceSecondsPerMile: 400, durationSeconds: 400, distanceMiles: 1.0 }),
      seg({ segmentType: 'recovery', paceZone: 'recovery', paceSecondsPerMile: 800, durationSeconds: 50, distanceMiles: 0.06 }),
      seg({ segmentType: 'work', paceZone: 'threshold', paceSecondsPerMile: 400, durationSeconds: 400, distanceMiles: 1.0 }),
    ]
    // Rest = 100 sec total, work = 3 miles → 33.3 sec/mi ≤ 60 → cruise interval
    const result = computeIntervalStress(w, segs, settings({ thresholdPaceSeconds: 400 }), 100)
    expect(result.isCruiseInterval).toBe(true)
    expect(result.discountFactor).toBe(1.0)
  })

  it('handles single-segment workouts (most common case)', () => {
    // Most workouts have only 1 segment (user turned off auto-lapping)
    const w = workout({ workoutType: 'easy' })
    const segs = [
      seg({ segmentType: 'steady', paceZone: 'easy', paceSecondsPerMile: 540, durationSeconds: 2400, distanceMiles: 4.4 }),
    ]
    const result = computeIntervalStress(w, segs, null, 40)
    // Should gracefully degrade — return aggregate TRIMP unchanged
    expect(result.intervalAdjustedTrimp).toBe(40)
    expect(result.discountFactor).toBe(1.0)
    expect(result.segmentCount).toBe(1)
  })

  it('buckets easy/steady segments into warmupCooldown bucket', () => {
    const w = workout()
    const segs = [
      seg({ segmentType: 'steady', paceZone: 'easy', paceSecondsPerMile: 540, durationSeconds: 600 }),
      seg({ segmentType: 'steady', paceZone: 'steady', paceSecondsPerMile: 500, durationSeconds: 600 }),
      seg({ segmentType: 'steady', paceZone: 'easy', paceSecondsPerMile: 550, durationSeconds: 600 }),
    ]
    const result = computeIntervalStress(w, segs, null, 50)
    // All segments go to warmupCooldownTrimp (not work or rest buckets)
    expect(result.warmupCooldownTrimp).toBeGreaterThan(0)
    expect(result.workTrimp).toBe(0)
    expect(result.restTrimp).toBe(0)
  })

  it('returns rounded TRIMP values', () => {
    const w = workout()
    const segs = [
      seg({ segmentType: 'warmup', paceZone: 'easy', paceSecondsPerMile: 540, durationSeconds: 600, distanceMiles: 1.1 }),
      seg({ segmentType: 'work', paceZone: 'interval', paceSecondsPerMile: 360, durationSeconds: 240, distanceMiles: 0.67 }),
      seg({ segmentType: 'recovery', paceZone: 'recovery', paceSecondsPerMile: 720, durationSeconds: 120, distanceMiles: 0.17 }),
    ]
    const result = computeIntervalStress(w, segs, null, 80)
    expect(Number.isInteger(result.intervalAdjustedTrimp)).toBe(true)
    expect(Number.isInteger(result.rawSegmentTrimpSum)).toBe(true)
    expect(Number.isInteger(result.workTrimp)).toBe(true)
    expect(Number.isInteger(result.restTrimp)).toBe(true)
    expect(Number.isInteger(result.warmupCooldownTrimp)).toBe(true)
  })
})
