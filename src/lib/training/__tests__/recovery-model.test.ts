import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  analyzeRecovery,
  extractQualityPairs,
  buildStressTypeProfiles,
  type RecoveryWorkout,
  type RecoveryModelInput,
  type WorkoutCategory,
} from '../recovery-model'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a date string N days offset from a base date */
function dateOffset(base: string, days: number): string {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** Build a simple workout */
function workout(
  date: string,
  category: WorkoutCategory,
  trimp: number,
  durationMinutes: number = 45,
  overrides?: Partial<RecoveryWorkout>
): RecoveryWorkout {
  return { date, category, trimp, durationMinutes, ...overrides }
}

/** Build a realistic 4-week training block with quality and easy days */
function build4WeekBlock(baseDate: string): RecoveryWorkout[] {
  const workouts: RecoveryWorkout[] = []
  for (let week = 0; week < 4; week++) {
    const weekStart = week * 7
    // Monday: easy
    workouts.push(workout(dateOffset(baseDate, weekStart), 'easy', 40, 40))
    // Tuesday: quality (intervals)
    workouts.push(workout(dateOffset(baseDate, weekStart + 1), 'interval', 130, 55, { quality: 'good' }))
    // Wednesday: easy
    workouts.push(workout(dateOffset(baseDate, weekStart + 2), 'easy', 35, 35))
    // Thursday: quality (tempo)
    workouts.push(workout(dateOffset(baseDate, weekStart + 3), 'tempo', 110, 50, { quality: 'good' }))
    // Friday: easy
    workouts.push(workout(dateOffset(baseDate, weekStart + 4), 'easy', 30, 30))
    // Saturday: long run
    workouts.push(workout(dateOffset(baseDate, weekStart + 5), 'long', 140, 90, { quality: 'good' }))
    // Sunday: rest (no workout)
  }
  return workouts
}

/** Fix "now" to a specific date for deterministic tests */
function freezeTime(dateStr: string) {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(dateStr + 'T12:00:00'))
}

function unfreezeTime() {
  vi.useRealTimers()
}

afterEach(() => {
  unfreezeTime()
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('analyzeRecovery — edge cases', () => {
  it('returns defaults for empty workout list', () => {
    const result = analyzeRecovery({ workouts: [] })
    expect(result.recoveryScore).toBe(100)
    expect(result.readyForQuality).toBe(true)
    expect(result.personalRecoveryRate).toBe('average')
    expect(result.confidence).toBe(0)
    expect(result.recommendations).toHaveLength(1)
    expect(result.recommendations[0]).toContain('Not enough')
  })

  it('handles a single easy workout', () => {
    const result = analyzeRecovery({
      workouts: [workout('2025-06-10', 'easy', 30, 30)],
    })
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.recoveryScore).toBeGreaterThan(0)
    expect(result.estimatedRecoveryHours).toBe(0) // no hard session found
  })

  it('handles a single hard workout', () => {
    const result = analyzeRecovery({
      workouts: [workout('2025-06-10', 'interval', 140, 55)],
    })
    expect(result.estimatedRecoveryHours).toBeGreaterThan(0)
    // Only one quality session → no pairs → baseline recovery
    expect(result.confidence).toBeLessThan(0.3)
  })
})

// ---------------------------------------------------------------------------
// extractQualityPairs
// ---------------------------------------------------------------------------

describe('extractQualityPairs', () => {
  it('extracts pairs from alternating quality sessions', () => {
    const workouts = [
      workout('2025-06-01', 'interval', 130, 55),
      workout('2025-06-02', 'easy', 30, 30),
      workout('2025-06-03', 'tempo', 110, 50, { quality: 'good' }),
    ]
    const pairs = extractQualityPairs(workouts)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].first.category).toBe('interval')
    expect(pairs[0].second.category).toBe('tempo')
    expect(pairs[0].gapHours).toBe(48) // 2 days
    expect(pairs[0].easyDaysBetween).toBe(1)
  })

  it('counts multiple easy days between quality sessions', () => {
    const workouts = [
      workout('2025-06-01', 'threshold', 120, 50),
      workout('2025-06-02', 'easy', 30, 30),
      workout('2025-06-03', 'easy', 35, 35),
      workout('2025-06-04', 'recovery', 20, 25),
      workout('2025-06-05', 'interval', 140, 60),
    ]
    const pairs = extractQualityPairs(workouts)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].easyDaysBetween).toBe(3) // 3 easy/recovery days
    expect(pairs[0].gapHours).toBe(96) // 4 days
  })

  it('treats long runs (75+ min) as quality sessions', () => {
    const workouts = [
      workout('2025-06-01', 'long', 140, 90),
      workout('2025-06-02', 'easy', 30, 30),
      workout('2025-06-04', 'interval', 130, 55),
    ]
    const pairs = extractQualityPairs(workouts)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].first.category).toBe('long')
  })

  it('does NOT treat short long runs as quality sessions', () => {
    const workouts = [
      workout('2025-06-01', 'long', 50, 40), // short "long run" — not quality
      workout('2025-06-03', 'interval', 130, 55),
    ]
    const pairs = extractQualityPairs(workouts)
    // Only interval is quality, so no pairs possible
    expect(pairs).toHaveLength(0)
  })

  it('treats high-TRIMP easy runs as quality sessions', () => {
    const workouts = [
      workout('2025-06-01', 'easy', 130, 70), // high TRIMP
      workout('2025-06-04', 'tempo', 110, 50),
    ]
    const pairs = extractQualityPairs(workouts)
    expect(pairs).toHaveLength(1)
    expect(pairs[0].first.category).toBe('easy')
    expect(pairs[0].first.trimp).toBe(130)
  })

  it('uses explicit quality rating when available', () => {
    const workouts = [
      workout('2025-06-01', 'interval', 130, 55),
      workout('2025-06-03', 'tempo', 110, 50, { quality: 'bad' }),
    ]
    const pairs = extractQualityPairs(workouts)
    expect(pairs[0].secondWasGood).toBe(false)
  })

  it('infers quality from TRIMP ratio when no rating', () => {
    const workouts = [
      workout('2025-06-01', 'interval', 130, 55),
      workout('2025-06-03', 'tempo', 50, 50), // much lower TRIMP → inferred bad
    ]
    const pairs = extractQualityPairs(workouts)
    expect(pairs[0].secondWasGood).toBe(false) // 50/130 = 0.38 < 0.6
  })

  it('returns empty array when no quality sessions exist', () => {
    const workouts = [
      workout('2025-06-01', 'easy', 30, 30),
      workout('2025-06-02', 'easy', 35, 35),
      workout('2025-06-03', 'recovery', 20, 25),
    ]
    const pairs = extractQualityPairs(workouts)
    expect(pairs).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// buildStressTypeProfiles
// ---------------------------------------------------------------------------

describe('buildStressTypeProfiles', () => {
  it('groups pairs by stress type', () => {
    const workouts = [
      workout('2025-06-01', 'interval', 130, 55),
      workout('2025-06-03', 'tempo', 110, 50, { quality: 'good' }),
      workout('2025-06-05', 'long', 140, 90),
      workout('2025-06-08', 'interval', 135, 55, { quality: 'good' }),
    ]
    const pairs = extractQualityPairs(workouts)
    const profiles = buildStressTypeProfiles(pairs)

    // Should have buckets for intervals, threshold (tempo), long_runs
    const types = profiles.map(p => p.type)
    expect(types).toContain('intervals')
    expect(types).toContain('threshold')
    expect(types).toContain('long_runs')
  })

  it('calculates correct success rates', () => {
    const workouts = [
      workout('2025-06-01', 'interval', 130, 55),
      workout('2025-06-03', 'tempo', 110, 50, { quality: 'good' }),
      workout('2025-06-05', 'interval', 135, 55),
      workout('2025-06-07', 'interval', 40, 55, { quality: 'bad' }), // bad follow-up
    ]
    const pairs = extractQualityPairs(workouts)
    const profiles = buildStressTypeProfiles(pairs)

    // interval → tempo (good), interval → interval (bad)
    const intervalProfile = profiles.find(p => p.type === 'intervals')
    expect(intervalProfile).toBeDefined()
    expect(intervalProfile!.sampleCount).toBe(2)
    expect(intervalProfile!.successRate).toBe(0.5)
  })

  it('returns empty array when no pairs', () => {
    const profiles = buildStressTypeProfiles([])
    expect(profiles).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// analyzeRecovery — core behavior
// ---------------------------------------------------------------------------

describe('analyzeRecovery — core', () => {
  it('returns all required fields', () => {
    const input: RecoveryModelInput = {
      workouts: build4WeekBlock('2025-05-01'),
    }
    const result = analyzeRecovery(input)

    expect(typeof result.estimatedRecoveryHours).toBe('number')
    expect(typeof result.recoveryScore).toBe('number')
    expect(typeof result.readyForQuality).toBe('boolean')
    expect(['fast', 'average', 'slow']).toContain(result.personalRecoveryRate)
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(Array.isArray(result.recommendations)).toBe(true)
  })

  it('recovery score is 0-100', () => {
    const input: RecoveryModelInput = {
      workouts: build4WeekBlock('2025-05-01'),
    }
    const result = analyzeRecovery(input)
    expect(result.recoveryScore).toBeGreaterThanOrEqual(0)
    expect(result.recoveryScore).toBeLessThanOrEqual(100)
  })

  it('confidence increases with more data', () => {
    const oneWeek: RecoveryModelInput = {
      workouts: build4WeekBlock('2025-05-01').slice(0, 6),
    }
    const fourWeeks: RecoveryModelInput = {
      workouts: build4WeekBlock('2025-05-01'),
    }

    const r1 = analyzeRecovery(oneWeek)
    const r4 = analyzeRecovery(fourWeeks)

    expect(r4.confidence).toBeGreaterThan(r1.confidence)
  })

  it('confidence is higher with HR data', () => {
    const withoutHR: RecoveryModelInput = {
      workouts: build4WeekBlock('2025-05-01'),
    }
    const withHR: RecoveryModelInput = {
      workouts: build4WeekBlock('2025-05-01').map(w => ({ ...w, averageHR: 140 })),
    }

    const r1 = analyzeRecovery(withoutHR)
    const r2 = analyzeRecovery(withHR)

    expect(r2.confidence).toBeGreaterThan(r1.confidence)
  })

  it('confidence is higher with explicit quality ratings', () => {
    const withoutRatings: RecoveryModelInput = {
      workouts: build4WeekBlock('2025-05-01').map(w => {
        const { quality: _, ...rest } = w
        return rest
      }),
    }
    const withRatings: RecoveryModelInput = {
      workouts: build4WeekBlock('2025-05-01'), // already has quality ratings
    }

    const r1 = analyzeRecovery(withoutRatings)
    const r2 = analyzeRecovery(withRatings)

    expect(r2.confidence).toBeGreaterThan(r1.confidence)
  })
})

// ---------------------------------------------------------------------------
// Age factor
// ---------------------------------------------------------------------------

describe('analyzeRecovery — age factor', () => {
  it('older runners get longer recovery estimates', () => {
    const base = build4WeekBlock('2025-05-01')

    const young = analyzeRecovery({ workouts: base, userAge: 25 })
    const middle = analyzeRecovery({ workouts: base, userAge: 45 })
    const older = analyzeRecovery({ workouts: base, userAge: 55 })

    expect(middle.estimatedRecoveryHours).toBeGreaterThan(young.estimatedRecoveryHours)
    expect(older.estimatedRecoveryHours).toBeGreaterThan(middle.estimatedRecoveryHours)
  })

  it('age 30 or under has no age penalty', () => {
    const base = build4WeekBlock('2025-05-01')

    const age25 = analyzeRecovery({ workouts: base, userAge: 25 })
    const age30 = analyzeRecovery({ workouts: base, userAge: 30 })

    expect(age25.estimatedRecoveryHours).toBe(age30.estimatedRecoveryHours)
  })
})

// ---------------------------------------------------------------------------
// TRIMP intensity scaling
// ---------------------------------------------------------------------------

describe('analyzeRecovery — TRIMP scaling', () => {
  it('very high TRIMP session increases recovery estimate', () => {
    const normalWorkouts = [
      workout('2025-06-10', 'interval', 100, 55),
    ]
    const highTrimpWorkouts = [
      workout('2025-06-10', 'interval', 200, 55),
    ]

    const normal = analyzeRecovery({ workouts: normalWorkouts })
    const high = analyzeRecovery({ workouts: highTrimpWorkouts })

    expect(high.estimatedRecoveryHours).toBeGreaterThan(normal.estimatedRecoveryHours)
  })
})

// ---------------------------------------------------------------------------
// Quality readiness
// ---------------------------------------------------------------------------

describe('analyzeRecovery — readyForQuality', () => {
  it('not ready immediately after a hard session', () => {
    // Freeze time to day of the hard session
    freezeTime('2025-06-10')

    const result = analyzeRecovery({
      workouts: [workout('2025-06-10', 'interval', 140, 55)],
    })

    expect(result.readyForQuality).toBe(false)
    expect(result.recoveryScore).toBeLessThan(65)
  })

  it('ready after sufficient recovery time', () => {
    // Freeze time to 3 days after the hard session
    freezeTime('2025-06-13')

    const result = analyzeRecovery({
      workouts: [workout('2025-06-10', 'interval', 140, 55)],
    })

    // 72 hours after a ~48h recovery session → should be ready
    expect(result.readyForQuality).toBe(true)
    expect(result.recoveryScore).toBeGreaterThanOrEqual(65)
  })
})

// ---------------------------------------------------------------------------
// Recovery score curve
// ---------------------------------------------------------------------------

describe('recovery score curve', () => {
  it('score increases over time after a hard session', () => {
    const hardSession = workout('2025-06-01', 'interval', 140, 55)

    // Score at different time points
    freezeTime('2025-06-01')
    const day0 = analyzeRecovery({ workouts: [hardSession] })

    freezeTime('2025-06-02')
    const day1 = analyzeRecovery({ workouts: [hardSession] })

    freezeTime('2025-06-03')
    const day2 = analyzeRecovery({ workouts: [hardSession] })

    freezeTime('2025-06-05')
    const day4 = analyzeRecovery({ workouts: [hardSession] })

    expect(day1.recoveryScore).toBeGreaterThan(day0.recoveryScore)
    expect(day2.recoveryScore).toBeGreaterThan(day1.recoveryScore)
    expect(day4.recoveryScore).toBeGreaterThan(day2.recoveryScore)
  })

  it('score approaches 100 with enough time', () => {
    const hardSession = workout('2025-05-01', 'race', 200, 120)

    freezeTime('2025-06-01') // 31 days later
    const result = analyzeRecovery({ workouts: [hardSession] })

    expect(result.recoveryScore).toBeGreaterThanOrEqual(95)
  })
})

// ---------------------------------------------------------------------------
// Personal recovery rate classification
// ---------------------------------------------------------------------------

describe('personal recovery rate', () => {
  it('classifies fast recoverers who succeed with short gaps', () => {
    // Runner who successfully does quality every day
    const workouts: RecoveryWorkout[] = []
    for (let i = 0; i < 30; i++) {
      if (i % 2 === 0) {
        workouts.push(workout(dateOffset('2025-05-01', i), 'interval', 130, 55, { quality: 'good' }))
      } else {
        workouts.push(workout(dateOffset('2025-05-01', i), 'easy', 30, 30))
      }
    }

    const result = analyzeRecovery({ workouts, userAge: 25 })
    // ~48h gaps with good quality → fast or average
    expect(['fast', 'average']).toContain(result.personalRecoveryRate)
  })

  it('classifies slow recoverers who need longer gaps', () => {
    // Runner who needs 4 days between quality sessions
    const workouts: RecoveryWorkout[] = []
    for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) {
        workouts.push(workout(dateOffset('2025-04-01', i), 'interval', 130, 55, { quality: 'good' }))
      } else {
        workouts.push(workout(dateOffset('2025-04-01', i), 'easy', 30, 30))
      }
    }

    const result = analyzeRecovery({ workouts, userAge: 25 })
    // ~120h gaps → likely slow
    expect(['slow', 'average']).toContain(result.personalRecoveryRate)
  })
})

// ---------------------------------------------------------------------------
// Stacking detection
// ---------------------------------------------------------------------------

describe('stacking penalty detection', () => {
  it('detects performance degradation from back-to-back hard days', () => {
    // Runner who does hard sessions on consecutive days with bad results
    const workouts: RecoveryWorkout[] = []
    for (let week = 0; week < 4; week++) {
      const base = week * 7
      // Consecutive hard days
      workouts.push(workout(dateOffset('2025-05-01', base), 'interval', 130, 55, { quality: 'good' }))
      workouts.push(workout(dateOffset('2025-05-01', base + 1), 'tempo', 110, 50, { quality: 'bad' }))
      // Then easy
      workouts.push(workout(dateOffset('2025-05-01', base + 2), 'easy', 30, 30))
      workouts.push(workout(dateOffset('2025-05-01', base + 3), 'easy', 30, 30))
    }

    const result = analyzeRecovery({ workouts })
    // Should have a recommendation about not stacking
    const hasStackingRec = result.recommendations.some(
      r => r.toLowerCase().includes('back-to-back') || r.toLowerCase().includes('stacking')
    )
    expect(hasStackingRec).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// HR fatigue detection
// ---------------------------------------------------------------------------

describe('HR fatigue detection', () => {
  it('detects elevated easy-run HR as fatigue signal', () => {
    const workouts: RecoveryWorkout[] = []
    // First 20 easy runs at normal HR
    for (let i = 0; i < 20; i++) {
      workouts.push(workout(dateOffset('2025-04-01', i), 'easy', 35, 35, { averageHR: 130 }))
    }
    // Last 10 easy runs at elevated HR
    for (let i = 20; i < 30; i++) {
      workouts.push(workout(dateOffset('2025-04-01', i), 'easy', 35, 35, { averageHR: 142 }))
    }
    // Add a hard session to make recovery meaningful
    workouts.push(workout(dateOffset('2025-04-01', 30), 'interval', 130, 55))

    const result = analyzeRecovery({ workouts })
    const hasHRRec = result.recommendations.some(
      r => r.toLowerCase().includes('hr') || r.toLowerCase().includes('elevated')
    )
    expect(hasHRRec).toBe(true)
  })

  it('does not flag HR fatigue with insufficient data', () => {
    const workouts: RecoveryWorkout[] = [
      workout('2025-06-01', 'easy', 35, 35, { averageHR: 140 }),
      workout('2025-06-03', 'interval', 130, 55),
    ]

    const result = analyzeRecovery({ workouts })
    const hasHRRec = result.recommendations.some(
      r => r.toLowerCase().includes('hr') || r.toLowerCase().includes('elevated')
    )
    expect(hasHRRec).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Stress type specific recommendations
// ---------------------------------------------------------------------------

describe('stress type specific recommendations', () => {
  it('generates type-specific recovery insights with enough data', () => {
    // Build a training block with consistent interval recovery
    const workouts: RecoveryWorkout[] = []
    for (let week = 0; week < 6; week++) {
      const base = week * 7
      workouts.push(workout(dateOffset('2025-04-01', base), 'easy', 35, 35))
      workouts.push(workout(dateOffset('2025-04-01', base + 1), 'interval', 130, 55, { quality: 'good' }))
      workouts.push(workout(dateOffset('2025-04-01', base + 2), 'easy', 30, 30))
      workouts.push(workout(dateOffset('2025-04-01', base + 3), 'tempo', 110, 50, { quality: 'good' }))
      workouts.push(workout(dateOffset('2025-04-01', base + 4), 'easy', 30, 30))
      workouts.push(workout(dateOffset('2025-04-01', base + 5), 'long', 140, 90, { quality: 'good' }))
    }

    const result = analyzeRecovery({ workouts })
    // Should have at least some type-specific recommendation
    expect(result.recommendations.length).toBeGreaterThan(0)
    // Should have gap recommendation with enough pairs
    const hasGapRec = result.recommendations.some(
      r => r.includes('days between hard sessions')
    )
    expect(hasGapRec).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Race recovery
// ---------------------------------------------------------------------------

describe('race recovery', () => {
  it('gives longer recovery estimate after a race', () => {
    const raceWorkout = workout('2025-06-08', 'race', 200, 120)
    const intervalWorkout = workout('2025-06-08', 'interval', 130, 55)

    const afterRace = analyzeRecovery({ workouts: [raceWorkout] })
    const afterInterval = analyzeRecovery({ workouts: [intervalWorkout] })

    expect(afterRace.estimatedRecoveryHours).toBeGreaterThan(afterInterval.estimatedRecoveryHours)
  })

  it('includes race-specific recommendation', () => {
    const result = analyzeRecovery({
      workouts: [workout('2025-06-08', 'race', 200, 120)],
    })

    const hasRaceRec = result.recommendations.some(
      r => r.toLowerCase().includes('race') && r.toLowerCase().includes('recovery')
    )
    expect(hasRaceRec).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Overload detection
// ---------------------------------------------------------------------------

describe('overload detection', () => {
  it('lowers recovery score when recent load exceeds weekly average', () => {
    // Freeze time to 36h after the last hard session so base recovery is partial
    freezeTime('2025-06-10')

    // Both scenarios have the same last hard session (same date, same TRIMP)
    // so the only difference is the overload penalty from accumulated weekly load
    const sharedLastSession = workout('2025-06-09', 'interval', 130, 55)

    const lightLoad = analyzeRecovery({
      workouts: [
        workout('2025-06-05', 'easy', 30, 30),
        sharedLastSession,
      ],
      currentWeeklyTrimp: 400,
    })

    const heavyLoad = analyzeRecovery({
      workouts: [
        workout('2025-06-04', 'interval', 150, 55),
        workout('2025-06-05', 'tempo', 130, 50),
        workout('2025-06-06', 'threshold', 140, 50),
        workout('2025-06-07', 'long', 170, 90),
        workout('2025-06-08', 'tempo', 130, 50),
        sharedLastSession,
      ],
      currentWeeklyTrimp: 400, // recent 7-day load is ~850 vs avg 400 → heavy penalty
    })

    expect(heavyLoad.recoveryScore).toBeLessThan(lightLoad.recoveryScore)
  })
})

// ---------------------------------------------------------------------------
// Sorting robustness
// ---------------------------------------------------------------------------

describe('input robustness', () => {
  it('handles unsorted workout input', () => {
    const workouts = [
      workout('2025-06-05', 'interval', 130, 55),
      workout('2025-06-01', 'easy', 30, 30),
      workout('2025-06-03', 'tempo', 110, 50),
    ]

    // Should not throw
    const result = analyzeRecovery({ workouts })
    expect(result.estimatedRecoveryHours).toBeGreaterThan(0)
  })

  it('handles duplicate dates', () => {
    const workouts = [
      workout('2025-06-01', 'easy', 30, 30),
      workout('2025-06-01', 'interval', 130, 55), // same day, AM/PM
      workout('2025-06-03', 'tempo', 110, 50),
    ]

    const result = analyzeRecovery({ workouts })
    expect(result.estimatedRecoveryHours).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Comprehensive integration test
// ---------------------------------------------------------------------------

describe('integration: realistic 8-week training cycle', () => {
  function buildRealisticCycle(): RecoveryWorkout[] {
    const workouts: RecoveryWorkout[] = []
    const base = '2025-04-01'

    for (let week = 0; week < 8; week++) {
      const ws = week * 7
      const isRecoveryWeek = week % 4 === 3

      if (isRecoveryWeek) {
        // Recovery week: all easy
        for (let d = 0; d < 5; d++) {
          workouts.push(workout(dateOffset(base, ws + d), 'easy', 30, 35, { averageHR: 128 }))
        }
        workouts.push(workout(dateOffset(base, ws + 5), 'long', 70, 60, { averageHR: 135 }))
      } else {
        // Normal week
        workouts.push(workout(dateOffset(base, ws), 'easy', 35, 40, { averageHR: 130 }))
        workouts.push(workout(dateOffset(base, ws + 1), 'interval', 135, 55, {
          averageHR: 162,
          quality: week < 6 ? 'good' : 'ok',
        }))
        workouts.push(workout(dateOffset(base, ws + 2), 'easy', 30, 30, { averageHR: 128 }))
        workouts.push(workout(dateOffset(base, ws + 3), 'tempo', 115, 50, {
          averageHR: 155,
          quality: 'good',
        }))
        workouts.push(workout(dateOffset(base, ws + 4), 'easy', 30, 30, { averageHR: 130 }))
        workouts.push(workout(dateOffset(base, ws + 5), 'long', 145, 95, {
          averageHR: 140,
          quality: 'good',
        }))
      }
    }

    return workouts
  }

  it('produces reasonable output for a full training cycle', () => {
    const result = analyzeRecovery({
      workouts: buildRealisticCycle(),
      userAge: 35,
      currentWeeklyTrimp: 500,
    })

    // Recovery hours should be in a reasonable range
    expect(result.estimatedRecoveryHours).toBeGreaterThanOrEqual(24)
    expect(result.estimatedRecoveryHours).toBeLessThanOrEqual(120)

    // Confidence should be moderate-to-high with 8 weeks of data
    expect(result.confidence).toBeGreaterThanOrEqual(0.3)

    // Should have multiple recommendations
    expect(result.recommendations.length).toBeGreaterThanOrEqual(2)

    // Recovery rate should be deterministic
    const rate = result.personalRecoveryRate
    expect(['fast', 'average', 'slow']).toContain(rate)
  })

  it('produces consistent results for the same input', () => {
    const input: RecoveryModelInput = {
      workouts: buildRealisticCycle(),
      userAge: 35,
      currentWeeklyTrimp: 500,
    }

    const r1 = analyzeRecovery(input)
    const r2 = analyzeRecovery(input)

    expect(r1.estimatedRecoveryHours).toBe(r2.estimatedRecoveryHours)
    expect(r1.personalRecoveryRate).toBe(r2.personalRecoveryRate)
    expect(r1.confidence).toBe(r2.confidence)
    expect(r1.recommendations).toEqual(r2.recommendations)
  })
})

// ---------------------------------------------------------------------------
// Boundary values
// ---------------------------------------------------------------------------

describe('boundary values', () => {
  it('TRIMP exactly at HIGH_TRIMP_THRESHOLD (120) is treated as quality', () => {
    const w = workout('2025-06-01', 'easy', 120, 60)
    const pairs = extractQualityPairs([
      w,
      workout('2025-06-04', 'interval', 130, 55),
    ])
    // TRIMP 120 should be treated as quality
    expect(pairs).toHaveLength(1)
  })

  it('TRIMP just below HIGH_TRIMP_THRESHOLD (119) is NOT treated as quality for easy runs', () => {
    const w = workout('2025-06-01', 'easy', 119, 60)
    const pairs = extractQualityPairs([
      w,
      workout('2025-06-04', 'interval', 130, 55),
    ])
    // TRIMP 119 on easy run → not quality, so only 1 quality session → no pairs
    expect(pairs).toHaveLength(0)
  })

  it('long run at exactly 75 minutes IS quality', () => {
    const w = workout('2025-06-01', 'long', 90, 75)
    const pairs = extractQualityPairs([
      w,
      workout('2025-06-04', 'interval', 130, 55),
    ])
    expect(pairs).toHaveLength(1)
  })

  it('long run at 74 minutes with low TRIMP is NOT quality', () => {
    const w = workout('2025-06-01', 'long', 80, 74)
    const pairs = extractQualityPairs([
      w,
      workout('2025-06-04', 'interval', 130, 55),
    ])
    expect(pairs).toHaveLength(0)
  })

  it('recovery score clamps to 0 minimum', () => {
    // Force very low score: recent hard session + overloaded + HR fatigue
    freezeTime('2025-06-10')

    const workouts: RecoveryWorkout[] = []
    // Lots of easy runs with elevated HR
    for (let i = 0; i < 20; i++) {
      workouts.push(workout(dateOffset('2025-05-01', i), 'easy', 30, 30, { averageHR: 125 }))
    }
    for (let i = 20; i < 30; i++) {
      workouts.push(workout(dateOffset('2025-05-01', i), 'easy', 30, 30, { averageHR: 145 }))
    }
    // Very recent massive hard session
    workouts.push(workout('2025-06-10', 'race', 250, 180))

    const result = analyzeRecovery({
      workouts,
      currentWeeklyTrimp: 100, // way over
    })

    expect(result.recoveryScore).toBeGreaterThanOrEqual(0)
  })

  it('recovery score clamps to 100 maximum', () => {
    // Ancient hard session
    freezeTime('2025-06-10')

    const result = analyzeRecovery({
      workouts: [workout('2025-01-01', 'interval', 130, 55)],
    })

    expect(result.recoveryScore).toBeLessThanOrEqual(100)
  })
})
