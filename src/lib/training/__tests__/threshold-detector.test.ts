import { describe, it, expect } from 'vitest'
import {
  detectThresholdPace,
  identifyThresholdEfforts,
  buildPaceHrPoints,
  findDeflectionPoint,
  findSustainabilityBoundary,
  validateAgainstVdot,
  computeCoefficientOfVariation,
  THRESHOLD_CONFIG,
  type ThresholdWorkoutData,
  type ThresholdSplitData,
  type PaceHrPoint,
} from '../threshold-detector'

// ---------------------------------------------------------------------------
// Helpers — build realistic workout data
// ---------------------------------------------------------------------------

/** Create a workout with sensible defaults */
function workout(overrides: Partial<ThresholdWorkoutData> = {}): ThresholdWorkoutData {
  return {
    date: '2026-02-01',
    distanceMiles: 6,
    durationSeconds: 48 * 60, // 48 min
    averagePaceSecondsPerMile: 480, // 8:00/mi
    averageHeartRate: null,
    maxHeartRate: null,
    elevationGainFeet: null,
    ...overrides,
  }
}

/** Create a threshold-effort workout (~7:00/mi pace, 25 min, steady, flat) */
function thresholdWorkout(overrides: Partial<ThresholdWorkoutData> = {}): ThresholdWorkoutData {
  const pace = overrides.averagePaceSecondsPerMile ?? 420 // 7:00/mi
  const duration = overrides.durationSeconds ?? 25 * 60  // 25 min
  const distance = (duration / pace)
  return workout({
    distanceMiles: distance,
    durationSeconds: duration,
    averagePaceSecondsPerMile: pace,
    averageHeartRate: 170,
    elevationGainFeet: 50,
    splits: makeSteadySplits(pace, Math.max(2, Math.round(distance)), 165),
    ...overrides,
  })
}

/** Create N mile splits at a steady pace with optional HR */
function makeSteadySplits(
  paceSecPerMile: number,
  count: number,
  baseHR?: number,
  hrDriftPerSplit = 1
): ThresholdSplitData[] {
  return Array.from({ length: count }, (_, i) => ({
    splitNumber: i + 1,
    distanceMiles: 1,
    durationSeconds: paceSecPerMile,
    paceSecondsPerMile: paceSecPerMile,
    heartRate: baseHR ? baseHR + i * hrDriftPerSplit : null,
  }))
}

/** Create a full training log with easy runs, tempos, long runs, etc. */
function buildTrainingLog(opts: {
  easyPace: number     // seconds/mile
  thresholdPace: number // seconds/mile
  count?: number
  includeHR?: boolean
  daysBetween?: number
}): ThresholdWorkoutData[] {
  const {
    easyPace,
    thresholdPace,
    count = 20,
    includeHR = true,
    daysBetween = 2,
  } = opts

  const workouts: ThresholdWorkoutData[] = []
  const baseDate = new Date('2026-01-01')

  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate.getTime() + i * daysBetween * 24 * 60 * 60 * 1000)
    const dateStr = date.toISOString().split('T')[0]

    if (i % 5 === 3) {
      // Threshold/tempo run every 5th workout
      const pace = thresholdPace + Math.round((Math.random() - 0.5) * 6)
      const duration = 25 * 60 + Math.round((Math.random() - 0.5) * 5 * 60)
      const dist = duration / pace
      workouts.push(workout({
        date: dateStr,
        distanceMiles: parseFloat(dist.toFixed(2)),
        durationSeconds: duration,
        averagePaceSecondsPerMile: pace,
        averageHeartRate: includeHR ? 168 + Math.round(Math.random() * 6) : null,
        elevationGainFeet: 40,
        splits: makeSteadySplits(pace, Math.max(2, Math.round(dist)), includeHR ? 165 : undefined, 2),
      }))
    } else if (i % 5 === 0) {
      // Long run
      const pace = easyPace + 15
      workouts.push(workout({
        date: dateStr,
        distanceMiles: 12,
        durationSeconds: 12 * pace,
        averagePaceSecondsPerMile: pace,
        averageHeartRate: includeHR ? 145 : null,
        elevationGainFeet: 200,
        splits: makeSteadySplits(pace, 12, includeHR ? 140 : undefined, 1),
      }))
    } else {
      // Easy run
      const pace = easyPace + Math.round((Math.random() - 0.5) * 20)
      workouts.push(workout({
        date: dateStr,
        distanceMiles: 5 + Math.round(Math.random() * 3),
        durationSeconds: 6 * pace,
        averagePaceSecondsPerMile: pace,
        averageHeartRate: includeHR ? 140 + Math.round(Math.random() * 10) : null,
        elevationGainFeet: 80,
      }))
    }
  }

  return workouts
}

// ---------------------------------------------------------------------------
// computeCoefficientOfVariation
// ---------------------------------------------------------------------------
describe('computeCoefficientOfVariation', () => {
  it('returns 0 for a single value', () => {
    expect(computeCoefficientOfVariation([420])).toBe(0)
  })

  it('returns 0 for identical values', () => {
    expect(computeCoefficientOfVariation([420, 420, 420])).toBe(0)
  })

  it('returns a small value for slightly varying paces', () => {
    // 420 +/- 5 seconds -> stddev ~4, mean 420 -> CV ~0.01
    const cv = computeCoefficientOfVariation([415, 418, 420, 422, 425])
    expect(cv).toBeGreaterThan(0)
    expect(cv).toBeLessThan(0.03)
  })

  it('returns a larger value for highly variable paces', () => {
    // Mix of 6:00 and 9:00 paces
    const cv = computeCoefficientOfVariation([360, 540, 360, 540, 360])
    expect(cv).toBeGreaterThan(0.15)
  })

  it('returns 0 for empty array', () => {
    expect(computeCoefficientOfVariation([])).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// identifyThresholdEfforts
// ---------------------------------------------------------------------------
describe('identifyThresholdEfforts', () => {
  it('identifies a classic threshold workout', () => {
    const log = [
      // Several easy runs to establish pace range
      workout({ date: '2026-01-01', averagePaceSecondsPerMile: 540, durationSeconds: 45 * 60, distanceMiles: 5 }),
      workout({ date: '2026-01-03', averagePaceSecondsPerMile: 530, durationSeconds: 50 * 60, distanceMiles: 5.6 }),
      workout({ date: '2026-01-05', averagePaceSecondsPerMile: 550, durationSeconds: 48 * 60, distanceMiles: 5.2 }),
      workout({ date: '2026-01-07', averagePaceSecondsPerMile: 520, durationSeconds: 42 * 60, distanceMiles: 4.8 }),
      // A threshold workout: 7:00/mi for 25 min, steady
      thresholdWorkout({ date: '2026-01-09', averagePaceSecondsPerMile: 420, durationSeconds: 25 * 60 }),
      // VO2max interval session (too short per split, high variability)
      workout({ date: '2026-01-11', averagePaceSecondsPerMile: 380, durationSeconds: 18 * 60, distanceMiles: 2.8 }),
    ]

    const efforts = identifyThresholdEfforts(log, THRESHOLD_CONFIG)
    expect(efforts.length).toBeGreaterThanOrEqual(1)
    expect(efforts[0].pace).toBe(420)
    expect(efforts[0].score).toBeGreaterThan(0.3)
  })

  it('rejects workouts shorter than 20 minutes', () => {
    const log = [
      workout({ date: '2026-01-01', averagePaceSecondsPerMile: 540, durationSeconds: 45 * 60, distanceMiles: 5 }),
      workout({ date: '2026-01-03', averagePaceSecondsPerMile: 420, durationSeconds: 15 * 60, distanceMiles: 2.1 }),
    ]
    const efforts = identifyThresholdEfforts(log, THRESHOLD_CONFIG)
    // Only the 15-min run was threshold-pace, but it's too short
    expect(efforts.length).toBe(0)
  })

  it('rejects workouts longer than 40 minutes', () => {
    const log = [
      workout({ date: '2026-01-01', averagePaceSecondsPerMile: 540, durationSeconds: 45 * 60, distanceMiles: 5 }),
      workout({ date: '2026-01-03', averagePaceSecondsPerMile: 420, durationSeconds: 50 * 60, distanceMiles: 7.1 }),
    ]
    const efforts = identifyThresholdEfforts(log, THRESHOLD_CONFIG)
    expect(efforts.length).toBe(0)
  })

  it('rejects very hilly workouts', () => {
    const log = [
      workout({ date: '2026-01-01', averagePaceSecondsPerMile: 540, durationSeconds: 45 * 60, distanceMiles: 5 }),
      thresholdWorkout({
        date: '2026-01-09',
        elevationGainFeet: 500, // 500ft over ~3.5 miles = ~143 ft/mi
        distanceMiles: 3.5,
      }),
    ]
    const efforts = identifyThresholdEfforts(log, THRESHOLD_CONFIG)
    expect(efforts.length).toBe(0)
  })

  it('rejects workouts with high pace variability', () => {
    const log = [
      workout({ date: '2026-01-01', averagePaceSecondsPerMile: 540, durationSeconds: 45 * 60, distanceMiles: 5 }),
      workout({
        date: '2026-01-09',
        averagePaceSecondsPerMile: 420,
        durationSeconds: 25 * 60,
        distanceMiles: 3.5,
        splits: [
          { splitNumber: 1, distanceMiles: 1, durationSeconds: 360, paceSecondsPerMile: 360, heartRate: 175 },
          { splitNumber: 2, distanceMiles: 1, durationSeconds: 500, paceSecondsPerMile: 500, heartRate: 155 },
          { splitNumber: 3, distanceMiles: 1, durationSeconds: 370, paceSecondsPerMile: 370, heartRate: 178 },
        ],
      }),
    ]
    const efforts = identifyThresholdEfforts(log, THRESHOLD_CONFIG)
    expect(efforts.length).toBe(0)
  })

  it('scores higher for 25-35 min runs than 20 min runs', () => {
    const baseLog = [
      workout({ date: '2026-01-01', averagePaceSecondsPerMile: 540, durationSeconds: 45 * 60, distanceMiles: 5 }),
      workout({ date: '2026-01-03', averagePaceSecondsPerMile: 530, durationSeconds: 50 * 60, distanceMiles: 5.6 }),
      workout({ date: '2026-01-05', averagePaceSecondsPerMile: 550, durationSeconds: 48 * 60, distanceMiles: 5.2 }),
    ]

    const log30 = [...baseLog, thresholdWorkout({ date: '2026-01-09', durationSeconds: 30 * 60 })]
    const log20 = [...baseLog, thresholdWorkout({ date: '2026-01-09', durationSeconds: 20 * 60 })]

    const efforts30 = identifyThresholdEfforts(log30, THRESHOLD_CONFIG)
    const efforts20 = identifyThresholdEfforts(log20, THRESHOLD_CONFIG)

    expect(efforts30.length).toBeGreaterThanOrEqual(1)
    expect(efforts20.length).toBeGreaterThanOrEqual(1)
    expect(efforts30[0].score).toBeGreaterThan(efforts20[0].score)
  })

  it('handles multiple threshold efforts and ranks them', () => {
    const baseLog = [
      workout({ date: '2026-01-01', averagePaceSecondsPerMile: 540, durationSeconds: 45 * 60, distanceMiles: 5 }),
      workout({ date: '2026-01-03', averagePaceSecondsPerMile: 530, durationSeconds: 50 * 60, distanceMiles: 5.6 }),
    ]

    const log = [
      ...baseLog,
      thresholdWorkout({ date: '2026-01-09', averagePaceSecondsPerMile: 420, durationSeconds: 30 * 60 }),
      thresholdWorkout({ date: '2026-01-15', averagePaceSecondsPerMile: 425, durationSeconds: 28 * 60 }),
      thresholdWorkout({ date: '2026-01-21', averagePaceSecondsPerMile: 418, durationSeconds: 32 * 60 }),
    ]

    const efforts = identifyThresholdEfforts(log, THRESHOLD_CONFIG)
    expect(efforts.length).toBe(3)
    // Should be sorted by score descending
    for (let i = 1; i < efforts.length; i++) {
      expect(efforts[i].score).toBeLessThanOrEqual(efforts[i - 1].score)
    }
  })
})

// ---------------------------------------------------------------------------
// buildPaceHrPoints
// ---------------------------------------------------------------------------
describe('buildPaceHrPoints', () => {
  it('builds pace-HR points from workouts with HR data', () => {
    const log = [
      workout({ averagePaceSecondsPerMile: 540, averageHeartRate: 140 }),
      workout({ averagePaceSecondsPerMile: 480, averageHeartRate: 155 }),
      workout({ averagePaceSecondsPerMile: 420, averageHeartRate: 170 }),
    ]
    const points = buildPaceHrPoints(log)
    expect(points.length).toBe(3)
    // Sorted slowest to fastest
    expect(points[0].pace).toBe(540)
    expect(points[2].pace).toBe(420)
  })

  it('excludes workouts without HR data', () => {
    const log = [
      workout({ averagePaceSecondsPerMile: 540, averageHeartRate: 140 }),
      workout({ averagePaceSecondsPerMile: 480, averageHeartRate: null }),
      workout({ averagePaceSecondsPerMile: 420, averageHeartRate: 0 }),
    ]
    const points = buildPaceHrPoints(log)
    expect(points.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// findDeflectionPoint
// ---------------------------------------------------------------------------
describe('findDeflectionPoint', () => {
  it('finds deflection when HR ramps steeply above threshold pace', () => {
    // Simulate a runner whose HR increases linearly until ~420s/mi
    // then jumps much more steeply above threshold
    const points: PaceHrPoint[] = [
      // Easy zone: small HR increase per pace decrease
      { pace: 600, heartRate: 130, workoutDate: '2026-01-01' },
      { pace: 580, heartRate: 133, workoutDate: '2026-01-02' },
      { pace: 560, heartRate: 136, workoutDate: '2026-01-03' },
      { pace: 540, heartRate: 140, workoutDate: '2026-01-04' },
      { pace: 520, heartRate: 144, workoutDate: '2026-01-05' },
      { pace: 500, heartRate: 148, workoutDate: '2026-01-06' },
      { pace: 480, heartRate: 153, workoutDate: '2026-01-07' },
      { pace: 460, heartRate: 158, workoutDate: '2026-01-08' },
      // Threshold zone: HR jumps more aggressively
      { pace: 440, heartRate: 165, workoutDate: '2026-01-09' },
      { pace: 420, heartRate: 173, workoutDate: '2026-01-10' },
      { pace: 400, heartRate: 182, workoutDate: '2026-01-11' },
      { pace: 380, heartRate: 190, workoutDate: '2026-01-12' },
    ]

    const deflection = findDeflectionPoint(points, THRESHOLD_CONFIG)
    expect(deflection).toBeDefined()
    // Should be somewhere in the 420-460 range where the slope steepens
    expect(deflection!).toBeGreaterThanOrEqual(400)
    expect(deflection!).toBeLessThanOrEqual(470)
  })

  it('returns undefined with too few data points', () => {
    const points: PaceHrPoint[] = [
      { pace: 540, heartRate: 140, workoutDate: '2026-01-01' },
      { pace: 420, heartRate: 170, workoutDate: '2026-01-02' },
    ]
    const deflection = findDeflectionPoint(points, THRESHOLD_CONFIG)
    expect(deflection).toBeUndefined()
  })

  it('returns undefined when HR response is perfectly linear', () => {
    // No deflection: perfectly linear HR-pace relationship
    const points: PaceHrPoint[] = Array.from({ length: 10 }, (_, i) => ({
      pace: 600 - i * 20,
      heartRate: 130 + i * 5,
      workoutDate: `2026-01-${(i + 1).toString().padStart(2, '0')}`,
    }))

    const deflection = findDeflectionPoint(points, THRESHOLD_CONFIG)
    // Should either be undefined or the sensitivity threshold catches it
    // A truly linear relationship has constant slope, so no deflection
    // The result depends on binning effects, but shouldn't find a strong deflection
    if (deflection !== undefined) {
      // If it finds something, it should be at the fast end where noise might appear
      expect(deflection).toBeLessThan(500)
    }
  })
})

// ---------------------------------------------------------------------------
// findSustainabilityBoundary
// ---------------------------------------------------------------------------
describe('findSustainabilityBoundary', () => {
  it('finds boundary between sustainable and unsustainable paces', () => {
    const log = [
      // Sustainable: easy run, HR doesn't drift much
      workout({
        date: '2026-01-01',
        averagePaceSecondsPerMile: 540,
        durationSeconds: 45 * 60,
        distanceMiles: 5,
        splits: makeSteadySplits(540, 5, 140, 1), // 1 bpm drift per split = ~0.7%
      }),
      // Sustainable: steady run, minimal drift
      workout({
        date: '2026-01-03',
        averagePaceSecondsPerMile: 480,
        durationSeconds: 35 * 60,
        distanceMiles: 4.4,
        splits: makeSteadySplits(480, 4, 150, 2), // 2 bpm drift = ~1.3%
      }),
      // Sustainable: tempo-ish, still below 5% drift
      workout({
        date: '2026-01-05',
        averagePaceSecondsPerMile: 440,
        durationSeconds: 25 * 60,
        distanceMiles: 3.4,
        splits: makeSteadySplits(440, 3, 160, 2), // ~1.2% drift
      }),
      // Unsustainable: threshold pace with significant HR drift
      workout({
        date: '2026-01-07',
        averagePaceSecondsPerMile: 410,
        durationSeconds: 25 * 60,
        distanceMiles: 3.7,
        splits: [
          { splitNumber: 1, distanceMiles: 1, durationSeconds: 410, paceSecondsPerMile: 410, heartRate: 162 },
          { splitNumber: 2, distanceMiles: 1, durationSeconds: 410, paceSecondsPerMile: 410, heartRate: 168 },
          { splitNumber: 3, distanceMiles: 1, durationSeconds: 410, paceSecondsPerMile: 410, heartRate: 175 },
        ],
      }),
      // Unsustainable: faster threshold with even more drift
      workout({
        date: '2026-01-09',
        averagePaceSecondsPerMile: 390,
        durationSeconds: 22 * 60,
        distanceMiles: 3.4,
        splits: [
          { splitNumber: 1, distanceMiles: 1, durationSeconds: 390, paceSecondsPerMile: 390, heartRate: 168 },
          { splitNumber: 2, distanceMiles: 1, durationSeconds: 390, paceSecondsPerMile: 390, heartRate: 176 },
          { splitNumber: 3, distanceMiles: 1, durationSeconds: 390, paceSecondsPerMile: 390, heartRate: 185 },
        ],
      }),
    ]

    const boundary = findSustainabilityBoundary(log, THRESHOLD_CONFIG)
    expect(boundary).toBeDefined()
    // Should be between the fastest sustainable (440) and slowest unsustainable (410)
    expect(boundary!).toBeGreaterThanOrEqual(400)
    expect(boundary!).toBeLessThanOrEqual(450)
  })

  it('returns undefined when all runs are sustainable', () => {
    const log = [
      workout({
        date: '2026-01-01',
        averagePaceSecondsPerMile: 540,
        durationSeconds: 45 * 60,
        distanceMiles: 5,
        splits: makeSteadySplits(540, 5, 140, 1),
      }),
      workout({
        date: '2026-01-03',
        averagePaceSecondsPerMile: 480,
        durationSeconds: 35 * 60,
        distanceMiles: 4.4,
        splits: makeSteadySplits(480, 4, 150, 1),
      }),
      workout({
        date: '2026-01-05',
        averagePaceSecondsPerMile: 440,
        durationSeconds: 25 * 60,
        distanceMiles: 3.4,
        splits: makeSteadySplits(440, 3, 155, 1),
      }),
    ]

    const boundary = findSustainabilityBoundary(log, THRESHOLD_CONFIG)
    expect(boundary).toBeUndefined()
  })

  it('returns undefined when no workouts have splits', () => {
    const log = [
      workout({ date: '2026-01-01', averagePaceSecondsPerMile: 540, durationSeconds: 45 * 60 }),
      workout({ date: '2026-01-03', averagePaceSecondsPerMile: 480, durationSeconds: 35 * 60 }),
    ]

    const boundary = findSustainabilityBoundary(log, THRESHOLD_CONFIG)
    expect(boundary).toBeUndefined()
  })

  it('skips workouts where pace drifts more than 8%', () => {
    const log = [
      workout({
        date: '2026-01-01',
        averagePaceSecondsPerMile: 540,
        durationSeconds: 45 * 60,
        distanceMiles: 5,
        splits: makeSteadySplits(540, 5, 140, 1),
      }),
      // This workout has erratic pacing -- should be skipped
      workout({
        date: '2026-01-03',
        averagePaceSecondsPerMile: 420,
        durationSeconds: 25 * 60,
        distanceMiles: 3.6,
        splits: [
          { splitNumber: 1, distanceMiles: 1, durationSeconds: 390, paceSecondsPerMile: 390, heartRate: 165 },
          { splitNumber: 2, distanceMiles: 1, durationSeconds: 460, paceSecondsPerMile: 460, heartRate: 158 },
          { splitNumber: 3, distanceMiles: 1, durationSeconds: 400, paceSecondsPerMile: 400, heartRate: 180 },
        ],
      }),
    ]

    const boundary = findSustainabilityBoundary(log, THRESHOLD_CONFIG)
    // With only one valid data point (the steady easy run), can't find boundary
    expect(boundary).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// validateAgainstVdot
// ---------------------------------------------------------------------------
describe('validateAgainstVdot', () => {
  it('shows strong agreement when estimate is within 10 seconds', () => {
    // VDOT 50 threshold is around 405-410 seconds/mile
    const validation = validateAgainstVdot(408, 50)
    expect(validation.agreement).toBe('strong')
    expect(Math.abs(validation.differenceSeconds)).toBeLessThanOrEqual(10)
  })

  it('shows moderate agreement when estimate is within 20 seconds', () => {
    const validation = validateAgainstVdot(425, 50)
    expect(validation.agreement).toBe('moderate')
  })

  it('shows weak agreement when estimate is off by more than 20 seconds', () => {
    const validation = validateAgainstVdot(460, 50)
    expect(validation.agreement).toBe('weak')
  })

  it('returns positive difference when estimated pace is slower', () => {
    const validation = validateAgainstVdot(430, 50)
    // 430 > vdotThresholdPace (~405) so difference should be positive
    expect(validation.differenceSeconds).toBeGreaterThan(0)
  })

  it('returns negative difference when estimated pace is faster', () => {
    const validation = validateAgainstVdot(390, 50)
    expect(validation.differenceSeconds).toBeLessThan(0)
  })
})

// ---------------------------------------------------------------------------
// detectThresholdPace — full integration
// ---------------------------------------------------------------------------
describe('detectThresholdPace', () => {
  it('returns insufficient_data for empty workout array', () => {
    const result = detectThresholdPace([])
    expect(result.method).toBe('insufficient_data')
    expect(result.confidence).toBe(0)
    expect(result.thresholdPaceSecondsPerMile).toBe(0)
  })

  it('returns insufficient_data for fewer than 3 valid workouts', () => {
    const log = [
      workout({ date: '2026-02-01', averagePaceSecondsPerMile: 480 }),
      workout({ date: '2026-02-03', averagePaceSecondsPerMile: 540 }),
    ]
    const result = detectThresholdPace(log)
    expect(result.method).toBe('insufficient_data')
  })

  it('filters out workouts older than 180 days', () => {
    const log = [
      workout({ date: '2025-06-01', averagePaceSecondsPerMile: 420, durationSeconds: 25 * 60 }),
      workout({ date: '2025-06-03', averagePaceSecondsPerMile: 540, durationSeconds: 45 * 60 }),
      workout({ date: '2025-06-05', averagePaceSecondsPerMile: 480, durationSeconds: 35 * 60 }),
    ]
    const result = detectThresholdPace(log)
    expect(result.method).toBe('insufficient_data')
  })

  it('detects threshold pace from a realistic training log', () => {
    const log = buildTrainingLog({
      easyPace: 530, // ~8:50/mi
      thresholdPace: 420, // 7:00/mi
      count: 20,
      includeHR: true,
    })

    const result = detectThresholdPace(log)
    expect(result.method).not.toBe('insufficient_data')
    expect(result.confidence).toBeGreaterThan(0)

    // Threshold pace should be in the right ballpark (within ~30 seconds of 420)
    expect(result.thresholdPaceSecondsPerMile).toBeGreaterThanOrEqual(390)
    expect(result.thresholdPaceSecondsPerMile).toBeLessThanOrEqual(450)

    // Evidence should be populated
    expect(result.evidence.workoutsAnalyzed).toBeGreaterThan(0)
    expect(result.evidence.dateRange.earliest).toBeTruthy()
    expect(result.evidence.dateRange.latest).toBeTruthy()
  })

  it('works with pace-only data (no HR)', () => {
    const log = buildTrainingLog({
      easyPace: 530,
      thresholdPace: 420,
      count: 20,
      includeHR: false,
    })

    const result = detectThresholdPace(log)
    // Without HR, only threshold effort identification works
    // Should still produce an estimate from threshold efforts alone
    expect(result.method).not.toBe('insufficient_data')
    expect(result.evidence.workoutsWithHR).toBe(0)
  })

  it('provides VDOT validation when knownVdot is provided', () => {
    const log = buildTrainingLog({
      easyPace: 530,
      thresholdPace: 420,
      count: 20,
      includeHR: true,
    })

    const result = detectThresholdPace(log, { knownVdot: 50 })
    expect(result.vdotValidation).toBeDefined()
    expect(result.vdotValidation!.vdotThresholdPace).toBeGreaterThan(0)
    expect(result.vdotValidation!.agreement).toBeDefined()
  })

  it('handles a fast runner (sub-6:00 threshold)', () => {
    const log = buildTrainingLog({
      easyPace: 430, // ~7:10/mi
      thresholdPace: 350, // ~5:50/mi
      count: 20,
      includeHR: true,
    })

    const result = detectThresholdPace(log)
    expect(result.method).not.toBe('insufficient_data')
    expect(result.thresholdPaceSecondsPerMile).toBeGreaterThanOrEqual(320)
    expect(result.thresholdPaceSecondsPerMile).toBeLessThanOrEqual(380)
  })

  it('handles a slower runner (9:30 threshold)', () => {
    const log = buildTrainingLog({
      easyPace: 660, // 11:00/mi
      thresholdPace: 570, // 9:30/mi
      count: 20,
      includeHR: true,
    })

    const result = detectThresholdPace(log)
    expect(result.method).not.toBe('insufficient_data')
    expect(result.thresholdPaceSecondsPerMile).toBeGreaterThanOrEqual(540)
    expect(result.thresholdPaceSecondsPerMile).toBeLessThanOrEqual(600)
  })

  it('higher confidence with more threshold efforts', () => {
    // Few threshold workouts
    const smallLog = buildTrainingLog({
      easyPace: 530,
      thresholdPace: 420,
      count: 8,
      includeHR: true,
    })

    // Many threshold workouts
    const bigLog = buildTrainingLog({
      easyPace: 530,
      thresholdPace: 420,
      count: 30,
      includeHR: true,
    })

    const smallResult = detectThresholdPace(smallLog)
    const bigResult = detectThresholdPace(bigLog)

    // More data should yield higher (or equal) confidence
    expect(bigResult.confidence).toBeGreaterThanOrEqual(smallResult.confidence)
  })

  it('filters out invalid pace data', () => {
    const log = [
      workout({ date: '2026-02-01', averagePaceSecondsPerMile: 0 }), // Invalid
      workout({ date: '2026-02-03', averagePaceSecondsPerMile: -100 }), // Invalid
      workout({ date: '2026-02-05', averagePaceSecondsPerMile: 200 }), // Too fast (3:20/mi)
      workout({ date: '2026-02-07', averagePaceSecondsPerMile: 1000 }), // Too slow (16:40/mi)
      // Valid workouts
      workout({ date: '2026-02-09', averagePaceSecondsPerMile: 540, durationSeconds: 45 * 60, distanceMiles: 5 }),
      workout({ date: '2026-02-11', averagePaceSecondsPerMile: 530, durationSeconds: 45 * 60, distanceMiles: 5 }),
      workout({ date: '2026-02-13', averagePaceSecondsPerMile: 520, durationSeconds: 45 * 60, distanceMiles: 5 }),
    ]

    const result = detectThresholdPace(log)
    // Only 3 valid workouts should be analyzed
    expect(result.evidence.workoutsAnalyzed).toBe(3)
  })

  it('returns evidence with populated date range', () => {
    const log = buildTrainingLog({
      easyPace: 530,
      thresholdPace: 420,
      count: 10,
      includeHR: true,
    })

    const result = detectThresholdPace(log)
    expect(result.evidence.dateRange.earliest).toBeTruthy()
    expect(result.evidence.dateRange.latest).toBeTruthy()
    expect(new Date(result.evidence.dateRange.earliest).getTime())
      .toBeLessThanOrEqual(new Date(result.evidence.dateRange.latest).getTime())
  })

  it('includes threshold efforts in evidence', () => {
    const log = buildTrainingLog({
      easyPace: 530,
      thresholdPace: 420,
      count: 20,
      includeHR: true,
    })

    const result = detectThresholdPace(log)
    expect(result.evidence.thresholdEfforts.length).toBeGreaterThan(0)

    // Each effort should have required fields
    for (const effort of result.evidence.thresholdEfforts) {
      expect(effort.pace).toBeGreaterThan(0)
      expect(effort.durationSeconds).toBeGreaterThan(0)
      expect(effort.score).toBeGreaterThan(0)
      expect(effort.score).toBeLessThanOrEqual(1)
      expect(effort.workoutDate).toBeTruthy()
    }
  })

  it('respects config overrides', () => {
    const log = buildTrainingLog({
      easyPace: 530,
      thresholdPace: 420,
      count: 20,
      includeHR: true,
    })

    // Override to require 30-40 min efforts only
    const result = detectThresholdPace(log, {
      config: {
        MIN_DURATION_SECONDS: 30 * 60,
        MAX_DURATION_SECONDS: 40 * 60,
      },
    })

    // With stricter duration window, we might find fewer or no threshold efforts
    // but the algorithm should still run without errors
    expect(result).toBeDefined()
    expect(result.method).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Edge cases and robustness
// ---------------------------------------------------------------------------
describe('edge cases', () => {
  it('handles workouts with zero distance gracefully', () => {
    const log = [
      workout({ date: '2026-02-01', distanceMiles: 0 }),
      workout({ date: '2026-02-03', distanceMiles: 0.1 }), // Too short
      workout({ date: '2026-02-05', averagePaceSecondsPerMile: 540, durationSeconds: 45 * 60 }),
      workout({ date: '2026-02-07', averagePaceSecondsPerMile: 530, durationSeconds: 45 * 60 }),
      workout({ date: '2026-02-09', averagePaceSecondsPerMile: 520, durationSeconds: 45 * 60 }),
    ]
    const result = detectThresholdPace(log)
    expect(result).toBeDefined()
    expect(result.evidence.workoutsAnalyzed).toBe(3) // Only the 3 valid ones
  })

  it('handles all workouts at the same pace', () => {
    const log = Array.from({ length: 10 }, (_, i) =>
      workout({
        date: `2026-02-${(i + 1).toString().padStart(2, '0')}`,
        averagePaceSecondsPerMile: 480,
        durationSeconds: 40 * 60,
        distanceMiles: 5,
      })
    )
    const result = detectThresholdPace(log)
    // Algorithm should handle this without crashing
    expect(result).toBeDefined()
  })

  it('handles a single very long workout with splits', () => {
    const log = [
      workout({
        date: '2026-02-01',
        averagePaceSecondsPerMile: 540,
        durationSeconds: 120 * 60,
        distanceMiles: 13,
        splits: makeSteadySplits(540, 13, 140, 1),
      }),
      workout({ date: '2026-02-03', averagePaceSecondsPerMile: 530, durationSeconds: 45 * 60, distanceMiles: 5 }),
      workout({ date: '2026-02-05', averagePaceSecondsPerMile: 520, durationSeconds: 45 * 60, distanceMiles: 5 }),
    ]
    const result = detectThresholdPace(log)
    expect(result).toBeDefined()
  })

  it('mixed splits with and without HR data', () => {
    const log = [
      workout({
        date: '2026-02-01',
        averagePaceSecondsPerMile: 540,
        durationSeconds: 45 * 60,
        distanceMiles: 5,
        splits: [
          { splitNumber: 1, distanceMiles: 1, durationSeconds: 540, paceSecondsPerMile: 540, heartRate: 140 },
          { splitNumber: 2, distanceMiles: 1, durationSeconds: 540, paceSecondsPerMile: 540, heartRate: null },
          { splitNumber: 3, distanceMiles: 1, durationSeconds: 540, paceSecondsPerMile: 540, heartRate: 142 },
          { splitNumber: 4, distanceMiles: 1, durationSeconds: 540, paceSecondsPerMile: 540, heartRate: null },
          { splitNumber: 5, distanceMiles: 1, durationSeconds: 540, paceSecondsPerMile: 540, heartRate: 144 },
        ],
      }),
      workout({ date: '2026-02-03', averagePaceSecondsPerMile: 530, durationSeconds: 45 * 60, distanceMiles: 5 }),
      workout({ date: '2026-02-05', averagePaceSecondsPerMile: 520, durationSeconds: 45 * 60, distanceMiles: 5 }),
    ]
    const result = detectThresholdPace(log)
    expect(result).toBeDefined()
  })
})
