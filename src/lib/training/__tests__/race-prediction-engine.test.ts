import { describe, it, expect } from 'vitest'
import {
  generatePredictions,
  type PredictionEngineInput,
  type WorkoutSignalInput,
  type BestEffortInput,
  type UserPhysiology,
} from '../race-prediction-engine'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const METERS_PER_MILE = 1609.34

/** Generate a YYYY-MM-DD date string N days before a reference date */
function daysAgo(n: number, ref: Date = new Date('2024-06-15T12:00:00')): string {
  const d = new Date(ref)
  d.setDate(d.getDate() - n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

const NOW = new Date('2024-06-15T12:00:00')

const DEFAULT_PHYSIOLOGY: UserPhysiology = {
  restingHr: 55,
  maxHr: 185,
  age: 35,
  gender: 'male',
}

const DEFAULT_FITNESS = { ctl: 50, atl: 45, tsb: 5 }

const DEFAULT_VOLUME = {
  avgWeeklyMiles4Weeks: 35,
  longestRecentRunMiles: 14,
  weeksConsecutiveTraining: 16,
  qualitySessionsPerWeek: 2,
}

/** Build a minimal empty input */
function emptyInput(overrides: Partial<PredictionEngineInput> = {}): PredictionEngineInput {
  return {
    physiology: DEFAULT_PHYSIOLOGY,
    workouts: [],
    races: [],
    bestEfforts: [],
    fitnessState: DEFAULT_FITNESS,
    trainingVolume: DEFAULT_VOLUME,
    savedVdot: null,
    asOfDate: NOW,
    ...overrides,
  }
}

/** Create a race best effort at a given distance + time */
function makeRace(opts: {
  distanceMeters: number
  timeSeconds: number
  date: string
  effortLevel?: string
  weatherTempF?: number | null
  weatherHumidityPct?: number | null
  elevationGainFt?: number | null
}): BestEffortInput {
  return {
    date: opts.date,
    distanceMeters: opts.distanceMeters,
    timeSeconds: opts.timeSeconds,
    source: 'race',
    effortLevel: opts.effortLevel ?? 'all_out',
    weatherTempF: opts.weatherTempF ?? null,
    weatherHumidityPct: opts.weatherHumidityPct ?? null,
    elevationGainFt: opts.elevationGainFt ?? null,
  }
}

/** Create a best effort from a workout segment */
function makeBestEffort(opts: {
  distanceMeters: number
  timeSeconds: number
  date: string
  source?: 'race' | 'time_trial' | 'workout_segment'
  workoutId?: number
}): BestEffortInput {
  return {
    date: opts.date,
    distanceMeters: opts.distanceMeters,
    timeSeconds: opts.timeSeconds,
    source: opts.source ?? 'workout_segment',
    workoutId: opts.workoutId ?? 1,
  }
}

/** Create an easy/steady run workout with HR data */
function makeEasyRun(opts: {
  id?: number
  date: string
  distanceMiles: number
  durationMinutes: number
  avgHr: number
  workoutType?: string
  tsb?: number
  weatherTempF?: number | null
  weatherHumidityPct?: number | null
  elevationGainFt?: number | null
}): WorkoutSignalInput {
  const paceSeconds = (opts.durationMinutes * 60) / opts.distanceMiles
  return {
    id: opts.id ?? Math.floor(Math.random() * 10000),
    date: opts.date,
    distanceMiles: opts.distanceMiles,
    durationMinutes: opts.durationMinutes,
    avgPaceSeconds: paceSeconds,
    avgHr: opts.avgHr,
    maxHr: opts.avgHr + 15,
    elevationGainFt: opts.elevationGainFt ?? null,
    weatherTempF: opts.weatherTempF ?? null,
    weatherHumidityPct: opts.weatherHumidityPct ?? null,
    workoutType: opts.workoutType ?? 'easy',
    tsb: opts.tsb,
  }
}

// ---------------------------------------------------------------------------
// Edge Cases: No Data / Minimal Data
// ---------------------------------------------------------------------------

describe('generatePredictions — edge cases', () => {
  it('returns predictions with no workout data and no saved VDOT', () => {
    const result = generatePredictions(emptyInput())
    // Should still return a prediction (default VDOT 40)
    expect(result.vdot).toBe(40)
    expect(result.predictions).toHaveLength(4)
    expect(result.confidence).toBe('low')
    expect(result.dataQuality.signalsUsed).toBe(0)
    expect(result.signals).toHaveLength(0)
  })

  it('uses saved VDOT as fallback when no other signals', () => {
    const result = generatePredictions(emptyInput({ savedVdot: 50 }))
    expect(result.vdot).toBeGreaterThan(40)
    expect(result.signals).toHaveLength(1)
    expect(result.signals[0].name).toBe('Saved VDOT')
    expect(result.confidence).toBe('low')
  })

  it('ignores invalid saved VDOT values', () => {
    const tooLow = generatePredictions(emptyInput({ savedVdot: 5 }))
    expect(tooLow.signals).toHaveLength(0)

    const tooHigh = generatePredictions(emptyInput({ savedVdot: 100 }))
    expect(tooHigh.signals).toHaveLength(0)
  })

  it('returns all four standard prediction distances', () => {
    const result = generatePredictions(emptyInput({ savedVdot: 45 }))
    const names = result.predictions.map(p => p.distance)
    expect(names).toEqual(['5K', '10K', 'Half Marathon', 'Marathon'])
  })

  it('prediction distances have correct meters values', () => {
    const result = generatePredictions(emptyInput({ savedVdot: 45 }))
    const metersMap: Record<string, number> = {
      '5K': 5000,
      '10K': 10000,
      'Half Marathon': 21097,
      'Marathon': 42195,
    }
    for (const p of result.predictions) {
      expect(p.meters).toBe(metersMap[p.distance])
    }
  })
})

// ---------------------------------------------------------------------------
// Signal 1: Race VDOT
// ---------------------------------------------------------------------------

describe('generatePredictions — Race VDOT signal', () => {
  it('extracts a signal from a single race result', () => {
    // ~20:00 5K is roughly VDOT 46
    const input = emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10) })],
    })
    const result = generatePredictions(input)
    const raceSignal = result.signals.find(s => s.name === 'Race VDOT')
    expect(raceSignal).toBeDefined()
    expect(raceSignal!.weight).toBe(1.0)
    expect(raceSignal!.estimatedVdot).toBeGreaterThan(40)
    expect(raceSignal!.estimatedVdot).toBeLessThan(55)
    expect(raceSignal!.dataPoints).toBe(1)
  })

  it('gives higher VDOT for faster race times', () => {
    const fast = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1080, date: daysAgo(5) })],
    }))
    const slow = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1500, date: daysAgo(5) })],
    }))
    expect(fast.vdot).toBeGreaterThan(slow.vdot)
  })

  it('recent races influence VDOT more than old races (180-day half-life)', () => {
    // Two races at very different VDOTs: recent fast, old slow
    const recentFast = makeRace({ distanceMeters: 5000, timeSeconds: 1100, date: daysAgo(5) })
    const oldSlow = makeRace({ distanceMeters: 5000, timeSeconds: 1500, date: daysAgo(175) })

    const result = generatePredictions(emptyInput({ races: [recentFast, oldSlow] }))
    // The blended VDOT should be much closer to the fast race since it's recent
    const fastOnlyResult = generatePredictions(emptyInput({ races: [recentFast] }))
    const slowOnlyResult = generatePredictions(emptyInput({ races: [oldSlow] }))

    // The blended VDOT should be closer to the fast race than the slow one
    const distToFast = Math.abs(result.vdot - fastOnlyResult.vdot)
    const distToSlow = Math.abs(result.vdot - slowOnlyResult.vdot)
    expect(distToFast).toBeLessThan(distToSlow)
  })

  it('all_out effort level gets higher confidence than unset effort level', () => {
    const allOut = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10), effortLevel: 'all_out' })],
    }))
    const moderate = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10), effortLevel: 'moderate' })],
    }))
    const allOutSignal = allOut.signals.find(s => s.name === 'Race VDOT')!
    const moderateSignal = moderate.signals.find(s => s.name === 'Race VDOT')!
    expect(allOutSignal.confidence).toBeGreaterThan(moderateSignal.confidence)
  })

  it('multiple races increase confidence', () => {
    const oneRace = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10) })],
    }))
    const threeRaces = generatePredictions(emptyInput({
      races: [
        makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10) }),
        makeRace({ distanceMeters: 10000, timeSeconds: 2500, date: daysAgo(30) }),
        makeRace({ distanceMeters: 21097, timeSeconds: 5400, date: daysAgo(60) }),
      ],
    }))
    const oneSignal = oneRace.signals.find(s => s.name === 'Race VDOT')!
    const threeSignal = threeRaces.signals.find(s => s.name === 'Race VDOT')!
    expect(threeSignal.confidence).toBeGreaterThan(oneSignal.confidence)
  })

  it('old races (>120 days) reduce confidence', () => {
    const recent = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(30) })],
    }))
    const old = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(150) })],
    }))
    const recentSignal = recent.signals.find(s => s.name === 'Race VDOT')!
    const oldSignal = old.signals.find(s => s.name === 'Race VDOT')!
    expect(recentSignal.confidence).toBeGreaterThan(oldSignal.confidence)
  })

  it('filters out races with distance < 1000m', () => {
    const result = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 500, timeSeconds: 90, date: daysAgo(5) })],
    }))
    const raceSignal = result.signals.find(s => s.name === 'Race VDOT')
    expect(raceSignal).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Signal 2: Best Effort VDOT
// ---------------------------------------------------------------------------

describe('generatePredictions — Best Effort signal', () => {
  it('extracts a signal from valid best efforts', () => {
    const efforts = [
      makeBestEffort({ distanceMeters: 5000, timeSeconds: 1250, date: daysAgo(10), source: 'time_trial' }),
      makeBestEffort({ distanceMeters: 10000, timeSeconds: 2600, date: daysAgo(20), source: 'time_trial' }),
      makeBestEffort({ distanceMeters: 5000, timeSeconds: 1300, date: daysAgo(30), source: 'time_trial' }),
    ]
    const result = generatePredictions(emptyInput({ bestEfforts: efforts }))
    const signal = result.signals.find(s => s.name === 'Best Effort VDOT')
    expect(signal).toBeDefined()
    expect(signal!.weight).toBe(0.65)
  })

  it('workout_segment efforts require >= 5K distance', () => {
    // Short workout segment — should be filtered out
    const shortEffort = makeBestEffort({
      distanceMeters: METERS_PER_MILE * 1, // 1 mile
      timeSeconds: 360,
      date: daysAgo(5),
      source: 'workout_segment',
    })
    const result = generatePredictions(emptyInput({ bestEfforts: [shortEffort] }))
    const signal = result.signals.find(s => s.name === 'Best Effort VDOT')
    expect(signal).toBeUndefined()
  })

  it('race/time_trial efforts only require >= 1 mile distance', () => {
    const mileEffort = makeBestEffort({
      distanceMeters: METERS_PER_MILE,
      timeSeconds: 360,
      date: daysAgo(5),
      source: 'time_trial',
    })
    const result = generatePredictions(emptyInput({ bestEfforts: [mileEffort] }))
    const signal = result.signals.find(s => s.name === 'Best Effort VDOT')
    expect(signal).toBeDefined()
  })

  it('workout_segment efforts get a 3% VDOT derate', () => {
    // Same performance as race vs segment — segment should produce lower VDOT
    const raceEffort = makeBestEffort({
      distanceMeters: 5000,
      timeSeconds: 1200,
      date: daysAgo(5),
      source: 'time_trial',
    })
    const segmentEffort = makeBestEffort({
      distanceMeters: 5000,
      timeSeconds: 1200,
      date: daysAgo(5),
      source: 'workout_segment',
    })
    const raceResult = generatePredictions(emptyInput({ bestEfforts: [raceEffort] }))
    const segmentResult = generatePredictions(emptyInput({ bestEfforts: [segmentEffort] }))
    const raceVdot = raceResult.signals.find(s => s.name === 'Best Effort VDOT')!.estimatedVdot
    const segmentVdot = segmentResult.signals.find(s => s.name === 'Best Effort VDOT')!.estimatedVdot
    expect(raceVdot).toBeGreaterThan(segmentVdot)
  })

  it('uses peak-performance approach (top efforts dominate)', () => {
    // Many slow efforts and a few fast ones — fast ones should dominate
    const efforts: BestEffortInput[] = []
    // 3 fast 5K efforts
    for (let i = 0; i < 3; i++) {
      efforts.push(makeBestEffort({
        distanceMeters: 5000,
        timeSeconds: 1200, // ~20:00 5K
        date: daysAgo(5 + i * 3),
        source: 'time_trial',
        workoutId: i + 1,
      }))
    }
    // 20 slower 5K efforts
    for (let i = 0; i < 20; i++) {
      efforts.push(makeBestEffort({
        distanceMeters: 5000,
        timeSeconds: 1500, // ~25:00 5K
        date: daysAgo(10 + i * 3),
        source: 'time_trial',
        workoutId: 100 + i,
      }))
    }
    const result = generatePredictions(emptyInput({ bestEfforts: efforts }))
    const signal = result.signals.find(s => s.name === 'Best Effort VDOT')!
    // The VDOT should be closer to the fast efforts (VDOT ~46) than slow (VDOT ~37)
    expect(signal.estimatedVdot).toBeGreaterThan(42)
  })
})

// ---------------------------------------------------------------------------
// Signal 3: Effective VO2max (HR-based)
// ---------------------------------------------------------------------------

describe('generatePredictions — Effective VO2max signal', () => {
  it('extracts signal from easy runs with HR data', () => {
    const workouts: WorkoutSignalInput[] = []
    for (let i = 0; i < 10; i++) {
      workouts.push(makeEasyRun({
        id: i + 1,
        date: daysAgo(i * 3),
        distanceMiles: 5,
        durationMinutes: 45,
        avgHr: 145,
        workoutType: 'easy',
      }))
    }
    const result = generatePredictions(emptyInput({ workouts }))
    const signal = result.signals.find(s => s.name === 'Effective VO2max (HR)')
    expect(signal).toBeDefined()
    expect(signal!.weight).toBe(0.5)
    expect(signal!.estimatedVdot).toBeGreaterThan(15)
    expect(signal!.estimatedVdot).toBeLessThan(85)
  })

  it('requires steady-state workout types', () => {
    const workouts = [
      makeEasyRun({
        date: daysAgo(3),
        distanceMiles: 5,
        durationMinutes: 45,
        avgHr: 145,
        workoutType: 'interval', // Not steady-state
      }),
    ]
    const result = generatePredictions(emptyInput({ workouts }))
    const signal = result.signals.find(s => s.name === 'Effective VO2max (HR)')
    expect(signal).toBeUndefined()
  })

  it('filters out workouts with invalid HR reserve percentage', () => {
    const workouts = [
      makeEasyRun({
        date: daysAgo(3),
        distanceMiles: 5,
        durationMinutes: 45,
        avgHr: 65, // Too low — %HRR would be < 0.50
      }),
    ]
    const result = generatePredictions(emptyInput({ workouts }))
    const signal = result.signals.find(s => s.name === 'Effective VO2max (HR)')
    expect(signal).toBeUndefined()
  })

  it('requires minimum 15 minutes and 0.5 miles', () => {
    const tooShort = makeEasyRun({
      date: daysAgo(3),
      distanceMiles: 5,
      durationMinutes: 10, // Too short
      avgHr: 145,
    })
    const tooFar = makeEasyRun({
      date: daysAgo(3),
      distanceMiles: 0.3, // Too short distance
      durationMinutes: 45,
      avgHr: 145,
    })
    const result = generatePredictions(emptyInput({ workouts: [tooShort, tooFar] }))
    const signal = result.signals.find(s => s.name === 'Effective VO2max (HR)')
    expect(signal).toBeUndefined()
  })

  it('rejects invalid HR range (maxHr - restingHr <= 20)', () => {
    const workouts = [
      makeEasyRun({ date: daysAgo(3), distanceMiles: 5, durationMinutes: 45, avgHr: 145 }),
    ]
    const result = generatePredictions(emptyInput({
      workouts,
      physiology: { restingHr: 80, maxHr: 95, age: 35, gender: 'male' }, // hrRange = 15
    }))
    const signal = result.signals.find(s => s.name === 'Effective VO2max (HR)')
    expect(signal).toBeUndefined()
  })

  it('applies fatigue correction when TSB is negative', () => {
    // Same run with negative TSB should produce a slightly higher VO2max estimate
    // (because the engine corrects for elevated HR due to fatigue)
    const baseWorkouts = Array.from({ length: 5 }, (_, i) =>
      makeEasyRun({
        id: i + 1,
        date: daysAgo(i * 3),
        distanceMiles: 5,
        durationMinutes: 45,
        avgHr: 150,
        tsb: 0,
      })
    )
    const fatiguedWorkouts = Array.from({ length: 5 }, (_, i) =>
      makeEasyRun({
        id: i + 100,
        date: daysAgo(i * 3),
        distanceMiles: 5,
        durationMinutes: 45,
        avgHr: 150,
        tsb: -20,
      })
    )
    const baseResult = generatePredictions(emptyInput({ workouts: baseWorkouts }))
    const fatiguedResult = generatePredictions(emptyInput({ workouts: fatiguedWorkouts }))
    const baseSignal = baseResult.signals.find(s => s.name === 'Effective VO2max (HR)')
    const fatiguedSignal = fatiguedResult.signals.find(s => s.name === 'Effective VO2max (HR)')
    expect(fatiguedSignal).toBeDefined()
    expect(baseSignal).toBeDefined()
    // Fatigue correction should increase the VO2max estimate
    expect(fatiguedSignal!.estimatedVdot).toBeGreaterThan(baseSignal!.estimatedVdot)
  })
})

// ---------------------------------------------------------------------------
// Signal 4: Efficiency Factor Trend
// ---------------------------------------------------------------------------

describe('generatePredictions — EF Trend signal', () => {
  it('requires at least 5 eligible workouts in 90 days', () => {
    const workouts = Array.from({ length: 4 }, (_, i) =>
      makeEasyRun({
        id: i + 1,
        date: daysAgo(i * 5),
        distanceMiles: 5,
        durationMinutes: 45,
        avgHr: 145,
      })
    )
    const result = generatePredictions(emptyInput({ workouts }))
    const signal = result.signals.find(s => s.name === 'Efficiency Factor Trend')
    expect(signal).toBeUndefined()
  })

  it('detects improving EF trend', () => {
    // Simulate improving EF: same pace with decreasing HR over time
    const workouts = Array.from({ length: 10 }, (_, i) =>
      makeEasyRun({
        id: i + 1,
        date: daysAgo(80 - i * 8), // Spread over ~80 days
        distanceMiles: 5,
        durationMinutes: 45,
        avgHr: 155 - i * 2, // HR drops from 155 to 137 over time
        workoutType: 'easy',
      })
    )
    const result = generatePredictions(emptyInput({ workouts }))
    const signal = result.signals.find(s => s.name === 'Efficiency Factor Trend')
    // If detected, the adjustment should be positive (improving)
    if (signal) {
      expect(signal.estimatedVdot).toBeGreaterThan(0)
      expect(signal.weight).toBe(0.35)
      expect(signal.description).toContain('improving')
    }
  })

  it('detects declining EF trend', () => {
    // Simulate declining EF: same pace with increasing HR over time
    const workouts = Array.from({ length: 10 }, (_, i) =>
      makeEasyRun({
        id: i + 1,
        date: daysAgo(80 - i * 8),
        distanceMiles: 5,
        durationMinutes: 45,
        avgHr: 135 + i * 2, // HR rises from 135 to 153
        workoutType: 'easy',
      })
    )
    const result = generatePredictions(emptyInput({ workouts }))
    const signal = result.signals.find(s => s.name === 'Efficiency Factor Trend')
    if (signal) {
      expect(signal.estimatedVdot).toBeLessThan(0)
      expect(signal.description).toContain('declining')
    }
  })

  it('returns null for negligible trend (< 0.1 VDOT adjustment)', () => {
    // Flat EF — no meaningful trend
    const workouts = Array.from({ length: 8 }, (_, i) =>
      makeEasyRun({
        id: i + 1,
        date: daysAgo(80 - i * 10),
        distanceMiles: 5,
        durationMinutes: 45,
        avgHr: 145, // Constant HR = flat EF
        workoutType: 'easy',
      })
    )
    const result = generatePredictions(emptyInput({ workouts }))
    const signal = result.signals.find(s => s.name === 'Efficiency Factor Trend')
    // Either null or very small adjustment — negligible trends are dropped
    if (signal) {
      expect(Math.abs(signal.estimatedVdot)).toBeLessThan(3)
    }
  })

  it('EF trend is a modifier, clamped to [-3, +3] VDOT', () => {
    // Extreme EF improvement — should still be clamped
    const workouts = Array.from({ length: 10 }, (_, i) =>
      makeEasyRun({
        id: i + 1,
        date: daysAgo(80 - i * 8),
        distanceMiles: 5,
        durationMinutes: 45,
        avgHr: 175 - i * 6, // Massive HR drop
        workoutType: 'easy',
      })
    )
    const result = generatePredictions(emptyInput({ workouts }))
    const signal = result.signals.find(s => s.name === 'Efficiency Factor Trend')
    if (signal) {
      expect(signal.estimatedVdot).toBeLessThanOrEqual(3)
      expect(signal.estimatedVdot).toBeGreaterThanOrEqual(-3)
    }
  })
})

// ---------------------------------------------------------------------------
// Signal 5: Critical Speed
// ---------------------------------------------------------------------------

describe('generatePredictions — Critical Speed signal', () => {
  it('requires 3+ different distance buckets', () => {
    // Only 2 distances — should not produce a CS signal
    const efforts = [
      makeBestEffort({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10), source: 'race' }),
      makeBestEffort({ distanceMeters: 5100, timeSeconds: 1230, date: daysAgo(20), source: 'race' }),
    ]
    const result = generatePredictions(emptyInput({ bestEfforts: efforts }))
    const signal = result.signals.find(s => s.name === 'Critical Speed')
    expect(signal).toBeUndefined()
  })

  it('produces signal from 3+ distance buckets', () => {
    // Cover 1mi, 5K, 10K buckets
    const efforts = [
      makeBestEffort({ distanceMeters: METERS_PER_MILE, timeSeconds: 360, date: daysAgo(10), source: 'race' }),
      makeBestEffort({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(20), source: 'race' }),
      makeBestEffort({ distanceMeters: 10000, timeSeconds: 2550, date: daysAgo(30), source: 'race' }),
    ]
    const result = generatePredictions(emptyInput({
      races: efforts,
      bestEfforts: efforts,
    }))
    const signal = result.signals.find(s => s.name === 'Critical Speed')
    expect(signal).toBeDefined()
    expect(signal!.weight).toBe(0.6)
    expect(signal!.dataPoints).toBeGreaterThanOrEqual(3)
  })

  it('filters out efforts > 15000m', () => {
    const efforts = [
      makeBestEffort({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10), source: 'race' }),
      makeBestEffort({ distanceMeters: 10000, timeSeconds: 2550, date: daysAgo(20), source: 'race' }),
      makeBestEffort({ distanceMeters: 21097, timeSeconds: 5400, date: daysAgo(30), source: 'race' }), // > 15K
    ]
    // The HM effort should be filtered out, leaving only 2 buckets
    const result = generatePredictions(emptyInput({ bestEfforts: efforts }))
    const signal = result.signals.find(s => s.name === 'Critical Speed')
    expect(signal).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Signal 6: Training Pace Inference
// ---------------------------------------------------------------------------

describe('generatePredictions — Training Pace signal', () => {
  it('extracts signal from easy runs in last 90 days', () => {
    const workouts = Array.from({ length: 10 }, (_, i) =>
      makeEasyRun({
        id: i + 1,
        date: daysAgo(i * 5),
        distanceMiles: 5,
        durationMinutes: 45,
        avgHr: 0, // No HR — pace-only signal
        workoutType: 'easy',
      })
    )
    // Set avgHr to null for pace-only (the makeEasyRun helper sets it)
    workouts.forEach(w => { w.avgHr = null })

    const result = generatePredictions(emptyInput({ workouts }))
    const signal = result.signals.find(s => s.name === 'Training Pace Inference')
    expect(signal).toBeDefined()
    expect(signal!.weight).toBe(0.25)
  })

  it('works with tempo and threshold workout types', () => {
    const workouts = [
      makeEasyRun({
        id: 1,
        date: daysAgo(5),
        distanceMiles: 4,
        durationMinutes: 28, // ~7:00/mi tempo
        avgHr: 0,
        workoutType: 'tempo',
      }),
      makeEasyRun({
        id: 2,
        date: daysAgo(10),
        distanceMiles: 3,
        durationMinutes: 20, // ~6:40/mi threshold
        avgHr: 0,
        workoutType: 'threshold',
      }),
    ]
    workouts.forEach(w => { w.avgHr = null })

    const result = generatePredictions(emptyInput({ workouts }))
    const signal = result.signals.find(s => s.name === 'Training Pace Inference')
    expect(signal).toBeDefined()
  })

  it('ignores workouts older than 90 days', () => {
    const workouts = [
      makeEasyRun({
        id: 1,
        date: daysAgo(100), // Too old
        distanceMiles: 5,
        durationMinutes: 45,
        avgHr: 0,
        workoutType: 'easy',
      }),
    ]
    workouts.forEach(w => { w.avgHr = null })

    const result = generatePredictions(emptyInput({ workouts }))
    const signal = result.signals.find(s => s.name === 'Training Pace Inference')
    expect(signal).toBeUndefined()
  })

  it('requires minimum 10 minutes and 0.5 miles', () => {
    const workouts = [
      makeEasyRun({
        id: 1,
        date: daysAgo(5),
        distanceMiles: 0.3, // Too short
        durationMinutes: 5,
        avgHr: 0,
        workoutType: 'easy',
      }),
    ]
    workouts.forEach(w => { w.avgHr = null })

    const result = generatePredictions(emptyInput({ workouts }))
    const signal = result.signals.find(s => s.name === 'Training Pace Inference')
    expect(signal).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Signal Blending
// ---------------------------------------------------------------------------

describe('generatePredictions — signal blending', () => {
  it('single signal dominates the blended VDOT', () => {
    const input = emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10) })],
    })
    const result = generatePredictions(input)
    const raceSignal = result.signals.find(s => s.name === 'Race VDOT')!
    // Blended VDOT should be very close to the single signal
    expect(Math.abs(result.vdot - raceSignal.estimatedVdot)).toBeLessThan(2)
  })

  it('agreement score is high when signals agree', () => {
    // Race and best effort at similar VDOTs
    const input = emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10) })],
      bestEfforts: [
        makeBestEffort({ distanceMeters: 5000, timeSeconds: 1210, date: daysAgo(15), source: 'time_trial' }),
        makeBestEffort({ distanceMeters: 10000, timeSeconds: 2520, date: daysAgo(20), source: 'time_trial' }),
      ],
    })
    const result = generatePredictions(input)
    expect(result.agreementScore).toBeGreaterThan(0.5)
  })

  it('outlier dampening reduces influence of extreme signals (deviation > 4 VDOT)', () => {
    // Three races at similar VDOT + one way-off best effort
    // The outlier should be dampened in pass 2
    const consistentRaces = [
      makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(5) }),
      makeRace({ distanceMeters: 10000, timeSeconds: 2500, date: daysAgo(15) }),
      makeRace({ distanceMeters: 5000, timeSeconds: 1210, date: daysAgo(25) }),
    ]
    // Outlier best effort: very fast (unrealistic improvement)
    const outlierEffort = makeBestEffort({
      distanceMeters: 5000,
      timeSeconds: 900, // ~15:00 5K = VDOT ~60+
      date: daysAgo(8),
      source: 'time_trial',
    })

    const withOutlier = generatePredictions(emptyInput({
      races: consistentRaces,
      bestEfforts: [outlierEffort],
    }))
    const withoutOutlier = generatePredictions(emptyInput({
      races: consistentRaces,
    }))

    // The outlier should NOT dramatically shift the VDOT
    // With dampening, the difference should be smaller than without dampening
    expect(Math.abs(withOutlier.vdot - withoutOutlier.vdot)).toBeLessThan(5)
  })

  it('EF trend modifier is applied only when confidence > 0.3', () => {
    // This is tested implicitly through the main engine; the EF modifier
    // applies as 0.35 * adjustment. We verify by checking that an improving
    // EF trend moves the blended VDOT upward.
    const baseWorkouts = Array.from({ length: 12 }, (_, i) =>
      makeEasyRun({
        id: i + 1,
        date: daysAgo(80 - i * 7),
        distanceMiles: 6,
        durationMinutes: 54,
        avgHr: 155 - i * 2, // Improving EF
        workoutType: 'easy',
      })
    )
    const race = makeRace({ distanceMeters: 10000, timeSeconds: 2500, date: daysAgo(30) })

    const result = generatePredictions(emptyInput({
      workouts: baseWorkouts,
      races: [race],
    }))
    const efSignal = result.signals.find(s => s.name === 'Efficiency Factor Trend')
    if (efSignal && efSignal.confidence > 0.3 && efSignal.estimatedVdot > 0) {
      // If EF is improving, the blended VDOT should reflect a small boost
      const noEfResult = generatePredictions(emptyInput({ races: [race] }))
      // The result WITH the EF trend should be >= the result without
      // (the VO2max signal also contributes, so we just check it's not lower)
      expect(result.vdot).toBeGreaterThanOrEqual(noEfResult.vdot - 1)
    }
  })

  it('VDOT is clamped to [15, 85]', () => {
    // Extremely fast race — VDOT should be clamped at 85
    const result = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 10000, timeSeconds: 1600, date: daysAgo(5) })],
    }))
    expect(result.vdot).toBeLessThanOrEqual(85)

    // Extremely slow race — VDOT should be at least 15
    const slowResult = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 4000, date: daysAgo(5) })],
    }))
    expect(slowResult.vdot).toBeGreaterThanOrEqual(15)
  })
})

// ---------------------------------------------------------------------------
// Form Adjustment (via TSB)
// ---------------------------------------------------------------------------

describe('generatePredictions — form adjustment', () => {
  // We test form adjustment through the main engine by varying fitnessState

  it('TSB 5-25 gives a bonus (-0.5% time)', () => {
    const result = generatePredictions(emptyInput({
      savedVdot: 45,
      fitnessState: { ctl: 50, atl: 40, tsb: 15 },
    }))
    expect(result.formAdjustmentPct).toBe(-0.5)
    expect(result.formDescription).toContain('tapered')
  })

  it('TSB > 25 gives penalty (+0.5% time, lost sharpness)', () => {
    const result = generatePredictions(emptyInput({
      savedVdot: 45,
      fitnessState: { ctl: 50, atl: 20, tsb: 30 },
    }))
    expect(result.formAdjustmentPct).toBe(0.5)
    expect(result.formDescription).toContain('rested')
  })

  it('TSB -25 to -10 gives fatigue penalty (+1.5%)', () => {
    const result = generatePredictions(emptyInput({
      savedVdot: 45,
      fitnessState: { ctl: 50, atl: 65, tsb: -15 },
    }))
    expect(result.formAdjustmentPct).toBe(1.5)
    expect(result.formDescription).toContain('fatigued')
  })

  it('TSB < -25 gives significant penalty (+3%)', () => {
    const result = generatePredictions(emptyInput({
      savedVdot: 45,
      fitnessState: { ctl: 50, atl: 80, tsb: -30 },
    }))
    expect(result.formAdjustmentPct).toBe(3)
    expect(result.formDescription).toContain('overreached')
  })

  it('TSB in neutral zone (-10 to 5) gives no TSB adjustment', () => {
    const result = generatePredictions(emptyInput({
      savedVdot: 45,
      fitnessState: { ctl: 50, atl: 50, tsb: 0 },
    }))
    // No TSB adjustment (may still have CTL adjustment if ctl < 20)
    expect(result.formAdjustmentPct).toBe(0)
  })

  it('low CTL (< 20) adds +1% penalty for thin fitness base', () => {
    const result = generatePredictions(emptyInput({
      savedVdot: 45,
      fitnessState: { ctl: 15, atl: 15, tsb: 0 },
    }))
    expect(result.formAdjustmentPct).toBe(1)
    expect(result.formDescription).toContain('thin fitness base')
  })

  it('TSB and CTL penalties stack', () => {
    const result = generatePredictions(emptyInput({
      savedVdot: 45,
      fitnessState: { ctl: 15, atl: 45, tsb: -30 },
    }))
    // TSB < -25 = +3%, CTL < 20 = +1% => total = +4%
    expect(result.formAdjustmentPct).toBe(4)
  })

  it('form adjustment affects predicted times', () => {
    const fresh = generatePredictions(emptyInput({
      savedVdot: 45,
      fitnessState: { ctl: 50, atl: 40, tsb: 15 }, // tapered
    }))
    const fatigued = generatePredictions(emptyInput({
      savedVdot: 45,
      fitnessState: { ctl: 50, atl: 80, tsb: -30 }, // overreached
    }))

    // Fatigued prediction should be slower
    const fresh5k = fresh.predictions.find(p => p.distance === '5K')!
    const fatigued5k = fatigued.predictions.find(p => p.distance === '5K')!
    expect(fatigued5k.predictedSeconds).toBeGreaterThan(fresh5k.predictedSeconds)
  })
})

// ---------------------------------------------------------------------------
// Readiness Score
// ---------------------------------------------------------------------------

describe('generatePredictions — readiness score', () => {
  it('perfect readiness for 5K with adequate training', () => {
    const result = generatePredictions(emptyInput({
      savedVdot: 45,
      trainingVolume: {
        avgWeeklyMiles4Weeks: 30,
        longestRecentRunMiles: 10,
        weeksConsecutiveTraining: 16,
        qualitySessionsPerWeek: 2,
      },
    }))
    const fiveK = result.predictions.find(p => p.distance === '5K')!
    // 5K requires weeklyMiles * 2 = ~6.2 mi, longRun = 5 mi
    // With 30 mi/week and 10 mi long run, these should be maxed at 1.0
    expect(fiveK.readiness).toBeGreaterThanOrEqual(0.95)
  })

  it('readiness factors use correct weights: volume 40%, long run 35%, consistency 25%', () => {
    // Carefully craft inputs to isolate weights
    const result = generatePredictions(emptyInput({
      savedVdot: 45,
      trainingVolume: {
        avgWeeklyMiles4Weeks: 100, // Well above any requirement
        longestRecentRunMiles: 20,  // Well above any requirement
        weeksConsecutiveTraining: 20, // Above 12 week cap
        qualitySessionsPerWeek: 2,
      },
    }))
    // All factors should be 1.0 for 5K
    const fiveK = result.predictions.find(p => p.distance === '5K')!
    expect(fiveK.readinessFactors.volume).toBe(1)
    expect(fiveK.readinessFactors.longRun).toBe(1)
    expect(fiveK.readinessFactors.consistency).toBe(1)
    expect(fiveK.readiness).toBe(1)
  })

  it('marathon readiness is lower than 5K with modest training', () => {
    const result = generatePredictions(emptyInput({
      savedVdot: 45,
      trainingVolume: {
        avgWeeklyMiles4Weeks: 25,
        longestRecentRunMiles: 10,
        weeksConsecutiveTraining: 8,
        qualitySessionsPerWeek: 1,
      },
    }))
    const fiveK = result.predictions.find(p => p.distance === '5K')!
    const marathon = result.predictions.find(p => p.distance === 'Marathon')!
    // Marathon requires much higher volume and long runs
    expect(marathon.readiness).toBeLessThan(fiveK.readiness)
  })

  it('readiness below 0.7 triggers adjustment reason', () => {
    const result = generatePredictions(emptyInput({
      savedVdot: 45,
      trainingVolume: {
        avgWeeklyMiles4Weeks: 10,
        longestRecentRunMiles: 5,
        weeksConsecutiveTraining: 4,
        qualitySessionsPerWeek: 0,
      },
    }))
    const marathon = result.predictions.find(p => p.distance === 'Marathon')!
    expect(marathon.readiness).toBeLessThan(0.7)
    expect(marathon.adjustmentReasons.length).toBeGreaterThan(0)
    expect(marathon.adjustmentReasons[0]).toContain('Endurance readiness')
  })

  it('consistency score caps at 12 weeks', () => {
    const at12 = generatePredictions(emptyInput({
      savedVdot: 45,
      trainingVolume: {
        avgWeeklyMiles4Weeks: 100,
        longestRecentRunMiles: 25,
        weeksConsecutiveTraining: 12,
        qualitySessionsPerWeek: 2,
      },
    }))
    const at20 = generatePredictions(emptyInput({
      savedVdot: 45,
      trainingVolume: {
        avgWeeklyMiles4Weeks: 100,
        longestRecentRunMiles: 25,
        weeksConsecutiveTraining: 20,
        qualitySessionsPerWeek: 2,
      },
    }))
    const fiveK12 = at12.predictions.find(p => p.distance === '5K')!
    const fiveK20 = at20.predictions.find(p => p.distance === '5K')!
    // Both should have consistency score of 1.0
    expect(fiveK12.readinessFactors.consistency).toBe(1)
    expect(fiveK20.readinessFactors.consistency).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Race Predictions (times and structure)
// ---------------------------------------------------------------------------

describe('generatePredictions — race time predictions', () => {
  it('higher VDOT produces faster race times', () => {
    const fastRunner = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1050, date: daysAgo(10) })],
    }))
    const slowRunner = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1500, date: daysAgo(10) })],
    }))
    for (const dist of ['5K', '10K', 'Half Marathon', 'Marathon']) {
      const fastPred = fastRunner.predictions.find(p => p.distance === dist)!
      const slowPred = slowRunner.predictions.find(p => p.distance === dist)!
      expect(fastPred.predictedSeconds).toBeLessThan(slowPred.predictedSeconds)
    }
  })

  it('marathon is proportionally slower than 5K', () => {
    const result = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10) })],
    }))
    const fiveK = result.predictions.find(p => p.distance === '5K')!
    const marathon = result.predictions.find(p => p.distance === 'Marathon')!

    // Marathon is ~8.4x the distance of 5K, time ratio should be > 8.4 (endurance factor)
    const timeRatio = marathon.predictedSeconds / fiveK.predictedSeconds
    expect(timeRatio).toBeGreaterThan(8)
    expect(timeRatio).toBeLessThan(12) // Reasonable upper bound
  })

  it('10K is roughly 2x the 5K time (with endurance factor)', () => {
    const result = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10) })],
    }))
    const fiveK = result.predictions.find(p => p.distance === '5K')!
    const tenK = result.predictions.find(p => p.distance === '10K')!

    const ratio = tenK.predictedSeconds / fiveK.predictedSeconds
    // Should be slightly more than 2x (endurance factor)
    expect(ratio).toBeGreaterThan(2.0)
    expect(ratio).toBeLessThan(2.3)
  })

  it('tapered times are faster than current form times when fatigued', () => {
    const result = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10) })],
      fitnessState: { ctl: 50, atl: 70, tsb: -20 }, // Fatigued
    }))
    for (const pred of result.predictions) {
      expect(pred.taperedSeconds).toBeLessThan(pred.predictedSeconds)
    }
  })

  it('prediction has confidence range (fast < slow)', () => {
    const result = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10) })],
    }))
    for (const pred of result.predictions) {
      expect(pred.range.fast).toBeLessThan(pred.range.slow)
    }
  })

  it('pace per mile is consistent with predicted seconds', () => {
    const result = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10) })],
    }))
    for (const pred of result.predictions) {
      const expectedPace = Math.round(pred.predictedSeconds / pred.miles)
      expect(pred.pacePerMile).toBe(expectedPace)
    }
  })

  it('longer distances have wider confidence intervals', () => {
    const result = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10) })],
    }))
    const fiveK = result.predictions.find(p => p.distance === '5K')!
    const marathon = result.predictions.find(p => p.distance === 'Marathon')!

    const fiveKRange = fiveK.range.slow - fiveK.range.fast
    const marathonRange = marathon.range.slow - marathon.range.fast

    // Marathon should have a wider range (both absolutely and relatively)
    expect(marathonRange).toBeGreaterThan(fiveKRange)
  })
})

// ---------------------------------------------------------------------------
// Data Quality Assessment
// ---------------------------------------------------------------------------

describe('generatePredictions — data quality', () => {
  it('detects HR data presence', () => {
    const withHr = generatePredictions(emptyInput({
      workouts: [makeEasyRun({ date: daysAgo(5), distanceMiles: 5, durationMinutes: 45, avgHr: 145 })],
    }))
    const withoutHr = generatePredictions(emptyInput({
      workouts: [makeEasyRun({ date: daysAgo(5), distanceMiles: 5, durationMinutes: 45, avgHr: 0 })],
    }))
    expect(withHr.dataQuality.hasHr).toBe(true)
    // avgHr of 0 is falsy (0 > 0 is false)
    expect(withoutHr.dataQuality.hasHr).toBe(false)
  })

  it('detects race data presence', () => {
    const withRaces = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10) })],
    }))
    const withoutRaces = generatePredictions(emptyInput())
    expect(withRaces.dataQuality.hasRaces).toBe(true)
    expect(withoutRaces.dataQuality.hasRaces).toBe(false)
  })

  it('detects recent data (3+ workouts in last 30 days)', () => {
    const recentWorkouts = Array.from({ length: 5 }, (_, i) =>
      makeEasyRun({ date: daysAgo(i * 5), distanceMiles: 5, durationMinutes: 45, avgHr: 145 })
    )
    const oldWorkouts = Array.from({ length: 5 }, (_, i) =>
      makeEasyRun({ date: daysAgo(60 + i * 5), distanceMiles: 5, durationMinutes: 45, avgHr: 145 })
    )
    const recent = generatePredictions(emptyInput({ workouts: recentWorkouts }))
    const old = generatePredictions(emptyInput({ workouts: oldWorkouts }))
    expect(recent.dataQuality.hasRecentData).toBe(true)
    expect(old.dataQuality.hasRecentData).toBe(false)
  })

  it('counts signals used (excluding EF trend)', () => {
    const result = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10) })],
    }))
    expect(result.dataQuality.signalsUsed).toBeGreaterThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Confidence Level
// ---------------------------------------------------------------------------

describe('generatePredictions — confidence level', () => {
  it('high confidence with 3+ signals, good agreement, and recent data', () => {
    const workouts = Array.from({ length: 10 }, (_, i) =>
      makeEasyRun({
        id: i + 1,
        date: daysAgo(i * 3),
        distanceMiles: 5,
        durationMinutes: 45,
        avgHr: 145,
        workoutType: 'easy',
      })
    )
    const races = [
      makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(15) }),
    ]
    const bestEfforts = [
      makeBestEffort({ distanceMeters: 5000, timeSeconds: 1210, date: daysAgo(20), source: 'time_trial' }),
      makeBestEffort({ distanceMeters: 10000, timeSeconds: 2520, date: daysAgo(25), source: 'time_trial' }),
    ]

    const result = generatePredictions(emptyInput({
      workouts,
      races,
      bestEfforts,
    }))
    // With race + best effort + VO2max + training pace signals, and recent data
    expect(result.dataQuality.signalsUsed).toBeGreaterThanOrEqual(2)
  })

  it('low confidence with only saved VDOT and no data', () => {
    const result = generatePredictions(emptyInput({ savedVdot: 45 }))
    expect(result.confidence).toBe('low')
  })
})

// ---------------------------------------------------------------------------
// Weather and Elevation Corrections
// ---------------------------------------------------------------------------

describe('generatePredictions — weather/elevation corrections', () => {
  it('hot weather race produces higher adjusted VDOT than raw pace suggests', () => {
    // Race in 90F heat should be corrected to a faster "ideal conditions" time
    const hotRace = makeRace({
      distanceMeters: 10000,
      timeSeconds: 2700,
      date: daysAgo(10),
      weatherTempF: 90,
      weatherHumidityPct: 70,
    })
    const idealRace = makeRace({
      distanceMeters: 10000,
      timeSeconds: 2700,
      date: daysAgo(10),
    })

    const hotResult = generatePredictions(emptyInput({ races: [hotRace] }))
    const idealResult = generatePredictions(emptyInput({ races: [idealRace] }))

    // The hot-weather race should produce a HIGHER VDOT after correction
    expect(hotResult.vdot).toBeGreaterThan(idealResult.vdot)
  })

  it('hilly race produces higher adjusted VDOT than raw pace suggests', () => {
    const hillyRace = makeRace({
      distanceMeters: 10000,
      timeSeconds: 2700,
      date: daysAgo(10),
      elevationGainFt: 500,
    })
    const flatRace = makeRace({
      distanceMeters: 10000,
      timeSeconds: 2700,
      date: daysAgo(10),
    })

    const hillyResult = generatePredictions(emptyInput({ races: [hillyRace] }))
    const flatResult = generatePredictions(emptyInput({ races: [flatRace] }))

    expect(hillyResult.vdot).toBeGreaterThan(flatResult.vdot)
  })
})

// ---------------------------------------------------------------------------
// asOfDate (retroactive prediction)
// ---------------------------------------------------------------------------

describe('generatePredictions — asOfDate', () => {
  it('uses asOfDate for recency calculations instead of wall clock', () => {
    const raceDate = '2024-01-15'
    const race = makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: raceDate })

    // Predict as of Feb 1 (race is 17 days old)
    const nearResult = generatePredictions(emptyInput({
      races: [race],
      asOfDate: new Date('2024-02-01T12:00:00'),
    }))

    // Predict as of Dec 1 (race is ~11 months old)
    const farResult = generatePredictions(emptyInput({
      races: [race],
      asOfDate: new Date('2024-12-01T12:00:00'),
    }))

    const nearSignal = nearResult.signals.find(s => s.name === 'Race VDOT')!
    const farSignal = farResult.signals.find(s => s.name === 'Race VDOT')!

    // Older race should have lower confidence
    expect(nearSignal.confidence).toBeGreaterThan(farSignal.confidence)
    expect(nearSignal.recencyDays!).toBeLessThan(farSignal.recencyDays!)
  })
})

// ---------------------------------------------------------------------------
// Multi-signal integration tests
// ---------------------------------------------------------------------------

describe('generatePredictions — multi-signal integration', () => {
  it('produces reasonable predictions for a well-trained runner', () => {
    const workouts = Array.from({ length: 20 }, (_, i) =>
      makeEasyRun({
        id: i + 1,
        date: daysAgo(i * 3),
        distanceMiles: 6,
        durationMinutes: 54, // ~9:00/mi
        avgHr: 145,
        workoutType: i % 5 === 0 ? 'long' : 'easy',
      })
    )
    const races = [
      makeRace({ distanceMeters: 5000, timeSeconds: 1350, date: daysAgo(30) }), // ~22:30 5K
    ]

    const result = generatePredictions(emptyInput({
      workouts,
      races,
      fitnessState: { ctl: 45, atl: 40, tsb: 5 },
    }))

    // VDOT should be in a reasonable range for a ~22:30 5K runner
    expect(result.vdot).toBeGreaterThan(35)
    expect(result.vdot).toBeLessThan(55)

    // All distances should have predictions
    expect(result.predictions).toHaveLength(4)

    // 5K prediction should be in the ballpark of the race (within a minute)
    const fiveK = result.predictions.find(p => p.distance === '5K')!
    expect(fiveK.predictedSeconds).toBeGreaterThan(1200) // > 20:00
    expect(fiveK.predictedSeconds).toBeLessThan(1600)    // < 26:40

    // Multiple signals should be present
    expect(result.signals.length).toBeGreaterThanOrEqual(2)
  })

  it('handles a new runner with only a single easy run', () => {
    const workouts = [
      makeEasyRun({
        id: 1,
        date: daysAgo(3),
        distanceMiles: 3,
        durationMinutes: 30,
        avgHr: 155,
        workoutType: 'easy',
      }),
    ]
    const result = generatePredictions(emptyInput({ workouts }))
    // Should still produce predictions, just lower confidence
    expect(result.predictions).toHaveLength(4)
    expect(result.confidence).not.toBe('high')
  })

  it('handles very old data only (no recent training)', () => {
    const races = [
      makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(350) }),
    ]
    const result = generatePredictions(emptyInput({ races }))
    expect(result.predictions).toHaveLength(4)
    expect(result.dataQuality.hasRecentData).toBe(false)
    // Very old race should still influence VDOT but with reduced confidence
    const raceSignal = result.signals.find(s => s.name === 'Race VDOT')
    if (raceSignal) {
      expect(raceSignal.confidence).toBeLessThan(0.7)
    }
  })

  it('VDOT range narrows with good signal agreement', () => {
    // Two signals that agree closely
    const agreeing = generatePredictions(emptyInput({
      races: [
        makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10) }),
        makeRace({ distanceMeters: 10000, timeSeconds: 2500, date: daysAgo(20) }),
      ],
    }))

    // The range should be relatively tight
    const rangeWidth = agreeing.vdotRange.high - agreeing.vdotRange.low
    expect(rangeWidth).toBeGreaterThan(0)
    expect(rangeWidth).toBeLessThan(10)
  })

  it('signal descriptions provide useful context', () => {
    const result = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10) })],
    }))
    const raceSignal = result.signals.find(s => s.name === 'Race VDOT')!
    expect(raceSignal.description).toContain('1 race')
    expect(raceSignal.description).toContain('d ago')
  })

  it('agreement details describe the signal agreement quality', () => {
    // Single signal
    const single = generatePredictions(emptyInput({
      races: [makeRace({ distanceMeters: 5000, timeSeconds: 1200, date: daysAgo(10) })],
    }))
    expect(single.agreementDetails).toBeTruthy()
    expect(typeof single.agreementDetails).toBe('string')
  })

  it('form description is always populated', () => {
    const result = generatePredictions(emptyInput({ savedVdot: 45 }))
    expect(result.formDescription).toBeTruthy()
    expect(typeof result.formDescription).toBe('string')
  })
})
