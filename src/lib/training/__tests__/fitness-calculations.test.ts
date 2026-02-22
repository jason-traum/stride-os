import { describe, it, expect } from 'vitest'
import {
  calculateWorkoutLoad,
  calculateFitnessMetrics,
  fillDailyLoadGaps,
  getFitnessStatus,
  calculateRampRate,
  getRampRateRisk,
  calculateOptimalLoadRange,
  calculateRollingLoad,
  INTENSITY_FACTORS,
  type DailyLoad,
  type FitnessMetrics,
} from '../fitness-calculations'

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

/** Build an array of daily loads for N consecutive days starting at base */
function buildDailyLoads(base: string, loads: number[]): DailyLoad[] {
  return loads.map((load, i) => ({ date: dateOffset(base, i), load }))
}

// ---------------------------------------------------------------------------
// calculateWorkoutLoad
// ---------------------------------------------------------------------------

describe('calculateWorkoutLoad', () => {
  it('returns a positive integer for a basic easy run', () => {
    const load = calculateWorkoutLoad(45, 'easy')
    expect(load).toBeGreaterThan(0)
    expect(Number.isInteger(load)).toBe(true)
  })

  it('higher duration produces higher load (same type)', () => {
    const short = calculateWorkoutLoad(30, 'easy')
    const long = calculateWorkoutLoad(60, 'easy')
    expect(long).toBeGreaterThan(short)
  })

  it('interval type produces higher load than easy (same duration)', () => {
    const easy = calculateWorkoutLoad(45, 'easy')
    const interval = calculateWorkoutLoad(45, 'interval')
    expect(interval).toBeGreaterThan(easy)
  })

  it('race type produces higher load than interval (same duration)', () => {
    const interval = calculateWorkoutLoad(45, 'interval')
    const race = calculateWorkoutLoad(45, 'race')
    expect(race).toBeGreaterThan(interval)
  })

  it('applies duration bonus for runs over 60 minutes', () => {
    // A 90-minute easy run should have a duration bonus vs. simple linear scaling
    const at60 = calculateWorkoutLoad(60, 'easy')
    const at90 = calculateWorkoutLoad(90, 'easy')
    // Without bonus, ratio would be exactly 90/60 = 1.5
    // With bonus the ratio should be > 1.5
    expect(at90 / at60).toBeGreaterThan(1.5)
  })

  it('does not apply duration bonus at exactly 60 minutes', () => {
    // Base load = 60 * 0.6 = 36, no bonus
    const load = calculateWorkoutLoad(60, 'easy')
    expect(load).toBe(36)
  })

  it('faster pace increases load', () => {
    // 8:00/mile pace (480s) vs. 10:00/mile pace (600s)
    const slowPace = calculateWorkoutLoad(45, 'easy', 5, 600)
    const fastPace = calculateWorkoutLoad(45, 'easy', 5, 480)
    expect(fastPace).toBeGreaterThan(slowPace)
  })

  it('ignores pace outside meaningful range (> 15:00/mile)', () => {
    const noPace = calculateWorkoutLoad(45, 'easy')
    const verySlowPace = calculateWorkoutLoad(45, 'easy', 3, 950)
    expect(verySlowPace).toBe(noPace)
  })

  it('ignores pace outside meaningful range (< 4:00/mile)', () => {
    const noPace = calculateWorkoutLoad(45, 'easy')
    const impossiblyFast = calculateWorkoutLoad(45, 'easy', 10, 200)
    expect(impossiblyFast).toBe(noPace)
  })

  it('uses "other" intensity factor for unknown workout types', () => {
    const other = calculateWorkoutLoad(45, 'unknown_type')
    const easy = calculateWorkoutLoad(45, 'easy')
    // other factor = 0.6, same as easy
    expect(other).toBe(easy)
  })

  it('returns 0 for zero duration', () => {
    expect(calculateWorkoutLoad(0, 'easy')).toBe(0)
  })

  it('ignores intervalAdjustedTrimp parameter', () => {
    const withTrimp = calculateWorkoutLoad(45, 'interval', undefined, undefined, 120)
    const withoutTrimp = calculateWorkoutLoad(45, 'interval')
    expect(withTrimp).toBe(withoutTrimp)
  })
})

// ---------------------------------------------------------------------------
// INTENSITY_FACTORS
// ---------------------------------------------------------------------------

describe('INTENSITY_FACTORS', () => {
  it('has recovery as lowest intensity', () => {
    const factors = Object.entries(INTENSITY_FACTORS).filter(([k]) => k !== 'cross_train')
    for (const [type, value] of factors) {
      if (type !== 'recovery') {
        expect(value).toBeGreaterThanOrEqual(INTENSITY_FACTORS.recovery)
      }
    }
  })

  it('has race as highest intensity', () => {
    for (const [, value] of Object.entries(INTENSITY_FACTORS)) {
      expect(value).toBeLessThanOrEqual(INTENSITY_FACTORS.race)
    }
  })

  it('ordering: cross_train < recovery < easy <= long < steady < tempo < interval < race', () => {
    const { cross_train, recovery, easy, long: longRun, steady, tempo, interval, race } = INTENSITY_FACTORS
    expect(cross_train).toBeLessThan(recovery)
    expect(recovery).toBeLessThan(easy)
    expect(easy).toBeLessThanOrEqual(longRun)
    expect(longRun).toBeLessThan(steady)
    expect(steady).toBeLessThan(tempo)
    expect(tempo).toBeLessThan(interval)
    expect(interval).toBeLessThan(race)
  })
})

// ---------------------------------------------------------------------------
// calculateFitnessMetrics (Banister impulse-response model)
// ---------------------------------------------------------------------------

describe('calculateFitnessMetrics', () => {
  it('returns empty array for empty input', () => {
    expect(calculateFitnessMetrics([])).toEqual([])
  })

  it('returns one entry for a single workout', () => {
    const loads: DailyLoad[] = [{ date: '2025-01-01', load: 50 }]
    const metrics = calculateFitnessMetrics(loads)
    expect(metrics).toHaveLength(1)
    expect(metrics[0].ctl).toBeGreaterThan(0)
    expect(metrics[0].atl).toBeGreaterThan(0)
  })

  it('TSB always equals CTL - ATL (mathematical identity)', () => {
    const loads = buildDailyLoads('2025-01-01', [50, 0, 30, 60, 0, 40, 20])
    const metrics = calculateFitnessMetrics(loads)
    for (const m of metrics) {
      // Each value is rounded to 1 decimal place independently, so the
      // difference between stored tsb and (ctl - atl) can be up to 0.1.
      // toBeCloseTo(x, 0) checks |diff| < 0.5, which is more than enough.
      expect(m.tsb).toBeCloseTo(m.ctl - m.atl, 0)
    }
  })

  it('ATL responds faster than CTL after a load spike', () => {
    // 7 rest days then one big workout
    const loads = buildDailyLoads('2025-01-01', [0, 0, 0, 0, 0, 0, 0, 100])
    const metrics = calculateFitnessMetrics(loads)
    const afterSpike = metrics[metrics.length - 1]
    // ATL should be higher than CTL after a spike because ATL has faster decay (shorter time constant)
    expect(afterSpike.atl).toBeGreaterThan(afterSpike.ctl)
  })

  it('rest days decrease ATL faster than CTL (TSB rises during taper)', () => {
    // Two weeks of training, then a week of rest
    const trainingLoads = Array(14).fill(50) // 14 days at load 50
    const restLoads = Array(7).fill(0)       // 7 days of rest
    const allLoads = [...trainingLoads, ...restLoads]
    const loads = buildDailyLoads('2025-01-01', allLoads)
    const metrics = calculateFitnessMetrics(loads)

    // During rest, TSB should increase day over day
    const restMetrics = metrics.slice(14) // the rest week
    for (let i = 1; i < restMetrics.length; i++) {
      expect(restMetrics[i].tsb).toBeGreaterThan(restMetrics[i - 1].tsb)
    }
  })

  it('steady training produces gradually increasing CTL', () => {
    const loads = buildDailyLoads('2025-01-01', Array(28).fill(40))
    const metrics = calculateFitnessMetrics(loads)
    // CTL should be monotonically increasing toward steady-state
    for (let i = 1; i < metrics.length; i++) {
      expect(metrics[i].ctl).toBeGreaterThanOrEqual(metrics[i - 1].ctl)
    }
  })

  it('CTL approaches daily load as steady state over many days', () => {
    // After ~5 time constants (42 * 5 = 210 days), CTL should be very close to daily load
    const dailyLoad = 40
    const loads = buildDailyLoads('2024-01-01', Array(210).fill(dailyLoad))
    const metrics = calculateFitnessMetrics(loads)
    const lastCtl = metrics[metrics.length - 1].ctl
    expect(lastCtl).toBeCloseTo(dailyLoad, 0) // within 1 unit
  })

  it('ATL converges to daily load faster than CTL', () => {
    // After 35 days (~5 ATL time constants), ATL should be very close to daily load
    const dailyLoad = 40
    const loads = buildDailyLoads('2025-01-01', Array(35).fill(dailyLoad))
    const metrics = calculateFitnessMetrics(loads)
    const lastAtl = metrics[metrics.length - 1].atl
    const lastCtl = metrics[metrics.length - 1].ctl
    // ATL should be closer to 40 than CTL
    expect(Math.abs(lastAtl - dailyLoad)).toBeLessThan(Math.abs(lastCtl - dailyLoad))
  })

  it('sorts input by date regardless of input order', () => {
    const loads: DailyLoad[] = [
      { date: '2025-01-03', load: 30 },
      { date: '2025-01-01', load: 50 },
      { date: '2025-01-02', load: 0 },
    ]
    const metrics = calculateFitnessMetrics(loads)
    expect(metrics[0].date).toBe('2025-01-01')
    expect(metrics[1].date).toBe('2025-01-02')
    expect(metrics[2].date).toBe('2025-01-03')
  })

  it('all zeros produce all-zero metrics', () => {
    const loads = buildDailyLoads('2025-01-01', [0, 0, 0, 0, 0])
    const metrics = calculateFitnessMetrics(loads)
    for (const m of metrics) {
      expect(m.ctl).toBe(0)
      expect(m.atl).toBe(0)
      expect(m.tsb).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// fillDailyLoadGaps
// ---------------------------------------------------------------------------

describe('fillDailyLoadGaps', () => {
  it('fills a week-long range with zeros for empty input', () => {
    const result = fillDailyLoadGaps([], '2025-01-01', '2025-01-07')
    expect(result).toHaveLength(7)
    for (const day of result) {
      expect(day.load).toBe(0)
    }
  })

  it('preserves existing non-zero loads', () => {
    const workouts: DailyLoad[] = [
      { date: '2025-01-02', load: 50 },
      { date: '2025-01-05', load: 30 },
    ]
    const result = fillDailyLoadGaps(workouts, '2025-01-01', '2025-01-07')
    expect(result).toHaveLength(7)
    expect(result.find(d => d.date === '2025-01-02')!.load).toBe(50)
    expect(result.find(d => d.date === '2025-01-05')!.load).toBe(30)
  })

  it('fills gap days with zero load', () => {
    const workouts: DailyLoad[] = [{ date: '2025-01-03', load: 40 }]
    const result = fillDailyLoadGaps(workouts, '2025-01-01', '2025-01-05')
    const zeroDays = result.filter(d => d.load === 0)
    expect(zeroDays).toHaveLength(4) // days 1, 2, 4, 5
  })

  it('handles single-day input', () => {
    const result = fillDailyLoadGaps([], '2025-06-15', '2025-06-15')
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2025-06-15')
    expect(result[0].load).toBe(0)
  })

  it('sums multiple workouts on the same date', () => {
    const workouts: DailyLoad[] = [
      { date: '2025-01-03', load: 20 },
      { date: '2025-01-03', load: 30 },
    ]
    const result = fillDailyLoadGaps(workouts, '2025-01-03', '2025-01-03')
    expect(result).toHaveLength(1)
    expect(result[0].load).toBe(50)
  })

  it('generates correct sequential dates', () => {
    const result = fillDailyLoadGaps([], '2025-01-29', '2025-02-02')
    const dates = result.map(d => d.date)
    expect(dates).toEqual([
      '2025-01-29',
      '2025-01-30',
      '2025-01-31',
      '2025-02-01',
      '2025-02-02',
    ])
  })
})

// ---------------------------------------------------------------------------
// getFitnessStatus
// ---------------------------------------------------------------------------

describe('getFitnessStatus', () => {
  it('TSB > 20 returns "fresh" / "Well Rested"', () => {
    const result = getFitnessStatus(25)
    expect(result.status).toBe('fresh')
    expect(result.label).toBe('Well Rested')
  })

  it('TSB 5-20 returns "optimal" / "Race Ready"', () => {
    const result = getFitnessStatus(10)
    expect(result.status).toBe('optimal')
    expect(result.label).toBe('Race Ready')
  })

  it('TSB -10 to 5 returns "optimal" / "Training"', () => {
    const result = getFitnessStatus(0)
    expect(result.status).toBe('optimal')
    expect(result.label).toBe('Training')
  })

  it('TSB -25 to -10 returns "tired" / "Fatigued"', () => {
    const result = getFitnessStatus(-15)
    expect(result.status).toBe('tired')
    expect(result.label).toBe('Fatigued')
  })

  it('TSB < -25 returns "overreached"', () => {
    const result = getFitnessStatus(-30)
    expect(result.status).toBe('overreached')
    expect(result.label).toBe('Overreached')
  })

  // Boundary values
  it('TSB exactly 20 returns "Race Ready" (not fresh)', () => {
    expect(getFitnessStatus(20).label).toBe('Race Ready')
  })

  it('TSB exactly 5 returns "Training" (not race ready)', () => {
    expect(getFitnessStatus(5).label).toBe('Training')
  })

  it('TSB exactly -10 returns "Fatigued" (not training)', () => {
    expect(getFitnessStatus(-10).label).toBe('Fatigued')
  })

  it('TSB exactly -25 returns "Overreached" (not fatigued)', () => {
    expect(getFitnessStatus(-25).label).toBe('Overreached')
  })
})

// ---------------------------------------------------------------------------
// calculateRampRate
// ---------------------------------------------------------------------------

describe('calculateRampRate', () => {
  it('returns null for fewer than 7 days of data', () => {
    const loads = buildDailyLoads('2025-01-01', [40, 40, 40, 40, 40, 40])
    const metrics = calculateFitnessMetrics(loads)
    expect(calculateRampRate(metrics)).toBeNull()
  })

  it('returns a number for sufficient data', () => {
    const loads = buildDailyLoads('2025-01-01', Array(28).fill(40))
    const metrics = calculateFitnessMetrics(loads)
    const rate = calculateRampRate(metrics)
    expect(rate).not.toBeNull()
    expect(typeof rate).toBe('number')
  })

  it('positive ramp rate when building fitness', () => {
    // Start from zero, train consistently
    const loads = buildDailyLoads('2025-01-01', Array(28).fill(50))
    const metrics = calculateFitnessMetrics(loads)
    const rate = calculateRampRate(metrics)
    expect(rate).not.toBeNull()
    expect(rate!).toBeGreaterThan(0)
  })

  it('negative ramp rate when detraining', () => {
    // Train hard for 42 days, then rest for 28 days
    const train = Array(42).fill(60)
    const rest = Array(28).fill(0)
    const loads = buildDailyLoads('2025-01-01', [...train, ...rest])
    const metrics = calculateFitnessMetrics(loads)
    const rate = calculateRampRate(metrics)
    expect(rate).not.toBeNull()
    expect(rate!).toBeLessThan(0)
  })

  it('respects the weeks parameter', () => {
    // 8 weeks of data; 4-week vs 2-week window can differ
    const loads = buildDailyLoads('2025-01-01', Array(56).fill(50))
    const metrics = calculateFitnessMetrics(loads)
    const rate4 = calculateRampRate(metrics, 4)
    const rate2 = calculateRampRate(metrics, 2)
    // Both should be positive (building fitness), but 4-week window should have higher
    // ramp rate because it captures more CTL growth from a lower starting point
    expect(rate4).not.toBeNull()
    expect(rate2).not.toBeNull()
    expect(rate4!).toBeGreaterThan(rate2!)
  })
})

// ---------------------------------------------------------------------------
// getRampRateRisk
// ---------------------------------------------------------------------------

describe('getRampRateRisk', () => {
  it('null ramp rate returns "Insufficient Data"', () => {
    const risk = getRampRateRisk(null)
    expect(risk.level).toBe('safe')
    expect(risk.label).toBe('Insufficient Data')
  })

  it('negative ramp rate returns "Decreasing"', () => {
    const risk = getRampRateRisk(-3)
    expect(risk.level).toBe('safe')
    expect(risk.label).toBe('Decreasing')
  })

  it('large negative ramp rate recommends increasing volume', () => {
    const risk = getRampRateRisk(-7)
    expect(risk.recommendation).not.toBeNull()
  })

  it('small negative ramp rate has no recommendation', () => {
    const risk = getRampRateRisk(-2)
    expect(risk.recommendation).toBeNull()
  })

  it('0-5 pts/week returns safe/Conservative', () => {
    const risk = getRampRateRisk(3)
    expect(risk.level).toBe('safe')
    expect(risk.label).toBe('Conservative')
  })

  it('5-8 pts/week returns moderate', () => {
    const risk = getRampRateRisk(6)
    expect(risk.level).toBe('moderate')
    expect(risk.label).toBe('Moderate')
  })

  it('8-10 pts/week returns elevated/Aggressive', () => {
    const risk = getRampRateRisk(9)
    expect(risk.level).toBe('elevated')
    expect(risk.label).toBe('Aggressive')
    expect(risk.recommendation).not.toBeNull()
  })

  it('>= 10 pts/week returns high risk', () => {
    const risk = getRampRateRisk(12)
    expect(risk.level).toBe('high')
    expect(risk.label).toBe('High Risk')
    expect(risk.recommendation).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// calculateOptimalLoadRange
// ---------------------------------------------------------------------------

describe('calculateOptimalLoadRange', () => {
  it('returns a range around 7x daily CTL', () => {
    const range = calculateOptimalLoadRange(30)
    // Weekly target = 30 * 7 = 210, min = 168, max = 252
    expect(range.min).toBe(168)
    expect(range.max).toBe(252)
  })

  it('zero CTL returns zero range', () => {
    const range = calculateOptimalLoadRange(0)
    expect(range.min).toBe(0)
    expect(range.max).toBe(0)
  })

  it('min is 80% and max is 120% of weekly target', () => {
    const ctl = 50
    const range = calculateOptimalLoadRange(ctl)
    expect(range.min).toBe(Math.round(ctl * 7 * 0.8))
    expect(range.max).toBe(Math.round(ctl * 7 * 1.2))
  })
})

// ---------------------------------------------------------------------------
// calculateRollingLoad
// ---------------------------------------------------------------------------

describe('calculateRollingLoad', () => {
  it('sums the most recent N days of load', () => {
    const loads = buildDailyLoads('2025-01-01', [10, 20, 30, 40, 50, 60, 70])
    const rolling7 = calculateRollingLoad(loads, 7)
    expect(rolling7).toBe(10 + 20 + 30 + 40 + 50 + 60 + 70)
  })

  it('defaults to 7 days', () => {
    const loads = buildDailyLoads('2025-01-01', [10, 20, 30, 40, 50, 60, 70, 80, 90])
    const rolling = calculateRollingLoad(loads)
    // Should take the 7 most recent dates (sorted desc): 90,80,70,60,50,40,30
    expect(rolling).toBe(90 + 80 + 70 + 60 + 50 + 40 + 30)
  })

  it('handles fewer days than requested window', () => {
    const loads = buildDailyLoads('2025-01-01', [25, 35])
    const rolling = calculateRollingLoad(loads, 7)
    expect(rolling).toBe(60)
  })
})

// ---------------------------------------------------------------------------
// Integration: realistic training scenario
// ---------------------------------------------------------------------------

describe('integration: 3-week build + 1-week taper', () => {
  // Simulate a realistic training cycle:
  // Week 1: moderate (40/day on run days, 3 rest days)
  // Week 2: higher load (50/day on run days)
  // Week 3: peak (60/day on run days)
  // Week 4: taper (20/day, more rest)
  const BASE = '2025-01-01'

  function buildTrainingBlock(): DailyLoad[] {
    const week1 = [40, 0, 40, 40, 0, 40, 0] // 4 runs
    const week2 = [50, 0, 50, 50, 0, 50, 50] // 5 runs
    const week3 = [60, 0, 60, 60, 0, 60, 60] // 5 runs
    const week4 = [20, 0, 0, 20, 0, 0, 20]   // 3 easy runs (taper)
    const allDays = [...week1, ...week2, ...week3, ...week4]
    return buildDailyLoads(BASE, allDays)
  }

  it('CTL increases through the build phase', () => {
    const loads = buildTrainingBlock()
    const metrics = calculateFitnessMetrics(loads)
    // End of week 1 vs end of week 3
    const endWeek1Ctl = metrics[6].ctl
    const endWeek3Ctl = metrics[20].ctl
    expect(endWeek3Ctl).toBeGreaterThan(endWeek1Ctl)
  })

  it('TSB becomes more positive during taper', () => {
    const loads = buildTrainingBlock()
    const metrics = calculateFitnessMetrics(loads)
    // TSB at end of peak week 3 vs end of taper week 4
    const endWeek3Tsb = metrics[20].tsb
    const endWeek4Tsb = metrics[27].tsb
    expect(endWeek4Tsb).toBeGreaterThan(endWeek3Tsb)
  })

  it('daily load is preserved in metrics output', () => {
    const loads = buildTrainingBlock()
    const metrics = calculateFitnessMetrics(loads)
    // Check day 0 has load 40, day 1 has load 0
    expect(metrics[0].dailyLoad).toBe(40)
    expect(metrics[1].dailyLoad).toBe(0)
  })
})
