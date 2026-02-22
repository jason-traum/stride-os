import { describe, it, expect } from 'vitest'
import {
  calculateVDOT,
  predictRaceTime,
  calculatePaceZones,
  getWeatherPaceAdjustment,
  calculateAdjustedVDOT,
  elevationPaceCorrection,
  estimateVDOTFromEasyPace,
  adjustPaceZonesForWeather,
  getEquivalentRaceTimes,
  getPaceForZone,
  getPaceZoneDescriptions,
} from '../vdot-calculator'

// ---------------------------------------------------------------------------
// calculateVDOT
// ---------------------------------------------------------------------------
describe('calculateVDOT', () => {
  it('returns ~49.8 for a 20:00 5K', () => {
    const vdot = calculateVDOT(5000, 20 * 60)
    expect(vdot).toBeCloseTo(49.8, 0)
  })

  it('returns higher VDOT for faster 5K times', () => {
    const v15 = calculateVDOT(5000, 15 * 60)
    const v20 = calculateVDOT(5000, 20 * 60)
    const v25 = calculateVDOT(5000, 25 * 60)
    const v30 = calculateVDOT(5000, 30 * 60)
    expect(v15).toBeGreaterThan(v20)
    expect(v20).toBeGreaterThan(v25)
    expect(v25).toBeGreaterThan(v30)
  })

  it('works across standard race distances', () => {
    expect(calculateVDOT(10000, 40 * 60)).toBeCloseTo(51.9, 0)
    expect(calculateVDOT(21097, 90 * 60)).toBeCloseTo(51.0, 0)
    expect(calculateVDOT(42195, 180 * 60)).toBeCloseTo(53.5, 0)
    expect(calculateVDOT(42195, 240 * 60)).toBeCloseTo(37.9, 0)
  })

  it('clamps to 15 for very slow times', () => {
    // 5K in 60 min is extremely slow
    expect(calculateVDOT(5000, 60 * 60)).toBe(15)
  })

  it('clamps to 85 for unrealistically fast times', () => {
    expect(calculateVDOT(5000, 10 * 60)).toBe(85)
    expect(calculateVDOT(100, 10)).toBe(85) // 100m in 10s
  })

  it('is monotonically decreasing in time for a fixed distance', () => {
    const times = [12, 15, 18, 20, 22, 25, 28, 30].map(m => m * 60)
    const vdots = times.map(t => calculateVDOT(5000, t))
    for (let i = 1; i < vdots.length; i++) {
      expect(vdots[i]).toBeLessThanOrEqual(vdots[i - 1])
    }
  })

  it('returns a value rounded to one decimal place', () => {
    const vdot = calculateVDOT(10000, 50 * 60)
    const decimals = (vdot.toString().split('.')[1] || '').length
    expect(decimals).toBeLessThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// predictRaceTime
// ---------------------------------------------------------------------------
describe('predictRaceTime', () => {
  it('returns expected 5K times for known VDOT values', () => {
    expect(predictRaceTime(50, 5000)).toBeCloseTo(1196, -1) // ~19:56
    expect(predictRaceTime(30, 5000)).toBeCloseTo(1842, -1) // ~30:42
    expect(predictRaceTime(60, 5000)).toBeCloseTo(1023, -1) // ~17:03
  })

  it('higher VDOT produces faster race times', () => {
    const t30 = predictRaceTime(30, 5000)
    const t40 = predictRaceTime(40, 5000)
    const t50 = predictRaceTime(50, 5000)
    const t60 = predictRaceTime(60, 5000)
    const t70 = predictRaceTime(70, 5000)
    expect(t70).toBeLessThan(t60)
    expect(t60).toBeLessThan(t50)
    expect(t50).toBeLessThan(t40)
    expect(t40).toBeLessThan(t30)
  })

  it('marathon is disproportionately slower than 5K (not just 8.44x)', () => {
    const vdot = 50
    const t5k = predictRaceTime(vdot, 5000)
    const tMarathon = predictRaceTime(vdot, 42195)
    const distanceRatio = 42195 / 5000 // 8.44x
    const timeRatio = tMarathon / t5k
    // Time ratio should exceed distance ratio due to fatigue modeling
    expect(timeRatio).toBeGreaterThan(distanceRatio)
  })

  it('round-trips through calculateVDOT within 0.5 VDOT', () => {
    for (const vdotIn of [30, 40, 50, 60]) {
      // 5K round trip
      const time5k = predictRaceTime(vdotIn, 5000)
      const vdotBack5k = calculateVDOT(5000, time5k)
      expect(vdotBack5k).toBeCloseTo(vdotIn, 0)

      // Marathon round trip
      const timeM = predictRaceTime(vdotIn, 42195)
      const vdotBackM = calculateVDOT(42195, timeM)
      expect(vdotBackM).toBeCloseTo(vdotIn, 0)
    }
  })

  it('returns an integer (rounded seconds)', () => {
    const time = predictRaceTime(50, 10000)
    expect(Number.isInteger(time)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// calculatePaceZones
// ---------------------------------------------------------------------------
describe('calculatePaceZones', () => {
  it('returns all expected zone keys', () => {
    const zones = calculatePaceZones(50)
    const expectedKeys = [
      'recovery', 'easy', 'generalAerobic', 'marathon', 'halfMarathon',
      'tempo', 'threshold', 'vo2max', 'interval', 'repetition', 'vdot',
    ]
    for (const key of expectedKeys) {
      expect(zones).toHaveProperty(key)
    }
  })

  it('preserves the VDOT value in the returned object', () => {
    expect(calculatePaceZones(50).vdot).toBe(50)
    expect(calculatePaceZones(35).vdot).toBe(35)
  })

  it('zones are ordered from slow (recovery) to fast (repetition)', () => {
    const zones = calculatePaceZones(50)
    // Slower pace = higher seconds per mile
    expect(zones.recovery).toBeGreaterThan(zones.easy)
    expect(zones.easy).toBeGreaterThan(zones.generalAerobic)
    expect(zones.threshold).toBeGreaterThan(zones.vo2max)
    expect(zones.vo2max).toBeGreaterThan(zones.interval)
    expect(zones.interval).toBeGreaterThan(zones.repetition)
  })

  it('higher VDOT produces faster paces across all zones', () => {
    const z30 = calculatePaceZones(30)
    const z50 = calculatePaceZones(50)
    expect(z50.easy).toBeLessThan(z30.easy)
    expect(z50.threshold).toBeLessThan(z30.threshold)
    expect(z50.interval).toBeLessThan(z30.interval)
    expect(z50.repetition).toBeLessThan(z30.repetition)
  })

  it('produces sensible paces for VDOT 50 (~8:00 easy)', () => {
    const zones = calculatePaceZones(50)
    // Easy pace around 9:04 (544s)
    expect(zones.easy).toBeGreaterThan(500)
    expect(zones.easy).toBeLessThan(600)
    // Interval pace around 6:20 (380s)
    expect(zones.interval).toBeGreaterThan(350)
    expect(zones.interval).toBeLessThan(420)
  })
})

// ---------------------------------------------------------------------------
// getWeatherPaceAdjustment
// ---------------------------------------------------------------------------
describe('getWeatherPaceAdjustment', () => {
  it('returns 0 at optimal temperature (~45F, moderate humidity)', () => {
    expect(getWeatherPaceAdjustment(45, 50)).toBe(0)
  })

  it('returns positive adjustment (slower) in hot weather', () => {
    expect(getWeatherPaceAdjustment(75, 60)).toBeGreaterThan(0)
    expect(getWeatherPaceAdjustment(85, 70)).toBeGreaterThan(0)
    expect(getWeatherPaceAdjustment(95, 80)).toBeGreaterThan(0)
  })

  it('hotter temperatures produce larger adjustments', () => {
    const adj60 = getWeatherPaceAdjustment(60, 50)
    const adj75 = getWeatherPaceAdjustment(75, 50)
    const adj85 = getWeatherPaceAdjustment(85, 50)
    const adj95 = getWeatherPaceAdjustment(95, 50)
    expect(adj75).toBeGreaterThan(adj60)
    expect(adj85).toBeGreaterThan(adj75)
    expect(adj95).toBeGreaterThan(adj85)
  })

  it('returns a small adjustment for cold weather below 35F', () => {
    const adj30 = getWeatherPaceAdjustment(30, 50)
    const adj20 = getWeatherPaceAdjustment(20, 50)
    expect(adj30).toBeGreaterThan(0)
    expect(adj20).toBeGreaterThan(adj30)
  })

  it('returns 0 in the 35-45F "sweet spot"', () => {
    expect(getWeatherPaceAdjustment(40, 50)).toBe(0)
    expect(getWeatherPaceAdjustment(35, 50)).toBe(0)
  })

  it('high humidity at hot temps adds extra penalty', () => {
    const adjDryHot = getWeatherPaceAdjustment(80, 40)
    const adjHumidHot = getWeatherPaceAdjustment(80, 80)
    expect(adjHumidHot).toBeGreaterThan(adjDryHot)
  })

  it('dew point above 60F adds extra penalty', () => {
    const adjNoDew = getWeatherPaceAdjustment(80, 70)
    const adjHighDew = getWeatherPaceAdjustment(80, 70, 70)
    expect(adjHighDew).toBeGreaterThan(adjNoDew)
  })

  it('returns an integer (rounded)', () => {
    const adj = getWeatherPaceAdjustment(78, 65)
    expect(Number.isInteger(adj)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// elevationPaceCorrection
// ---------------------------------------------------------------------------
describe('elevationPaceCorrection', () => {
  it('returns ~12 sec/mi for 100 ft/mi gain', () => {
    // 500ft over 5 miles = 100ft/mi
    expect(elevationPaceCorrection(500, 5)).toBe(12)
  })

  it('returns 0 when no elevation gain', () => {
    expect(elevationPaceCorrection(0, 5)).toBe(0)
  })

  it('returns 0 when distance is 0 or negative', () => {
    expect(elevationPaceCorrection(500, 0)).toBe(0)
    expect(elevationPaceCorrection(500, -1)).toBe(0)
  })

  it('scales proportionally with gain per mile', () => {
    const adj100 = elevationPaceCorrection(500, 5)   // 100 ft/mi
    const adj200 = elevationPaceCorrection(1000, 5)  // 200 ft/mi
    expect(adj200).toBe(adj100 * 2)
  })
})

// ---------------------------------------------------------------------------
// calculateAdjustedVDOT
// ---------------------------------------------------------------------------
describe('calculateAdjustedVDOT', () => {
  it('returns raw VDOT when no options provided', () => {
    const raw = calculateVDOT(5000, 20 * 60)
    const adjusted = calculateAdjustedVDOT(5000, 20 * 60)
    expect(adjusted).toBe(raw)
  })

  it('returns raw VDOT when weather is at optimal conditions', () => {
    const raw = calculateVDOT(5000, 20 * 60)
    const adjusted = calculateAdjustedVDOT(5000, 20 * 60, {
      weatherTempF: 45,
      weatherHumidityPct: 50,
    })
    expect(adjusted).toBe(raw)
  })

  it('returns higher VDOT when hot weather penalized the raw time', () => {
    const raw = calculateVDOT(5000, 20 * 60)
    const adjusted = calculateAdjustedVDOT(5000, 20 * 60, {
      weatherTempF: 80,
      weatherHumidityPct: 70,
    })
    // Adjusted VDOT should be higher since we're crediting the runner
    // for running in bad conditions
    expect(adjusted).toBeGreaterThan(raw)
  })

  it('returns higher VDOT when elevation penalized the raw time', () => {
    const raw = calculateVDOT(42195, 4 * 3600)
    const adjusted = calculateAdjustedVDOT(42195, 4 * 3600, {
      elevationGainFt: 2000,
    })
    // Elevation alone (no weather) won't trigger adjustment because
    // weather fields are null, so totalPaceAdj only includes elevation
    expect(adjusted).toBeGreaterThan(raw)
  })

  it('combined weather + elevation never reduces time by more than 15%', () => {
    // Extreme conditions: very hot, humid, and hilly
    const raw = calculateVDOT(42195, 4 * 3600)
    const adjusted = calculateAdjustedVDOT(42195, 4 * 3600, {
      weatherTempF: 110,
      weatherHumidityPct: 95,
      elevationGainFt: 10000,
    })
    // The safety clamp ensures we can't get unrealistically high VDOT
    // The corrected time is at least 85% of actual time
    const maxPossibleVDOT = calculateVDOT(42195, 4 * 3600 * 0.85)
    expect(adjusted).toBeLessThanOrEqual(maxPossibleVDOT)
  })
})

// ---------------------------------------------------------------------------
// estimateVDOTFromEasyPace
// ---------------------------------------------------------------------------
describe('estimateVDOTFromEasyPace', () => {
  it('returns reasonable VDOT for typical easy paces', () => {
    // 10:00/mi easy -> ~42
    expect(estimateVDOTFromEasyPace(600)).toBeCloseTo(42.2, 0)
    // 8:00/mi easy -> ~56
    expect(estimateVDOTFromEasyPace(480)).toBeCloseTo(55.8, 0)
  })

  it('faster easy pace produces higher VDOT', () => {
    const slow = estimateVDOTFromEasyPace(660) // 11:00/mi
    const mid = estimateVDOTFromEasyPace(540)  // 9:00/mi
    const fast = estimateVDOTFromEasyPace(420) // 7:00/mi
    expect(fast).toBeGreaterThan(mid)
    expect(mid).toBeGreaterThan(slow)
  })
})

// ---------------------------------------------------------------------------
// adjustPaceZonesForWeather
// ---------------------------------------------------------------------------
describe('adjustPaceZonesForWeather', () => {
  it('returns unchanged zones at optimal temperature', () => {
    const zones = calculatePaceZones(50)
    const adjusted = adjustPaceZonesForWeather(zones, 45, 50)
    expect(adjusted).toEqual(zones)
  })

  it('adds adjustment to easy/marathon zones at full rate in heat', () => {
    const zones = calculatePaceZones(50)
    const adj = getWeatherPaceAdjustment(80, 70)
    const adjusted = adjustPaceZonesForWeather(zones, 80, 70)
    expect(adjusted.easy).toBe(zones.easy + adj)
    expect(adjusted.marathon).toBe(zones.marathon + adj)
  })

  it('scales down adjustment for harder zones', () => {
    const zones = calculatePaceZones(50)
    const adj = getWeatherPaceAdjustment(85, 70)
    const adjusted = adjustPaceZonesForWeather(zones, 85, 70)
    // Threshold gets 80% of adjustment
    expect(adjusted.threshold).toBe(zones.threshold + Math.round(adj * 0.8))
    // VO2max/interval get 50%
    expect(adjusted.vo2max).toBe(zones.vo2max + Math.round(adj * 0.5))
    // Repetition gets 30%
    expect(adjusted.repetition).toBe(zones.repetition + Math.round(adj * 0.3))
  })
})

// ---------------------------------------------------------------------------
// getEquivalentRaceTimes & getPaceForZone & getPaceZoneDescriptions
// ---------------------------------------------------------------------------
describe('utility functions', () => {
  it('getEquivalentRaceTimes returns entries for all RACE_DISTANCES', () => {
    const results = getEquivalentRaceTimes(50)
    expect(results).toHaveProperty('5K')
    expect(results).toHaveProperty('10K')
    expect(results).toHaveProperty('half_marathon')
    expect(results).toHaveProperty('marathon')
    expect(results['5K'].time).toBeGreaterThan(0)
    expect(results['5K'].pace).toBeGreaterThan(0)
    // Longer race = longer time
    expect(results['marathon'].time).toBeGreaterThan(results['half_marathon'].time)
    expect(results['half_marathon'].time).toBeGreaterThan(results['10K'].time)
  })

  it('getPaceForZone maps zone names correctly', () => {
    const zones = calculatePaceZones(50)
    expect(getPaceForZone(zones, 'easy')).toBe(zones.easy)
    expect(getPaceForZone(zones, 'threshold')).toBe(zones.threshold)
    expect(getPaceForZone(zones, 'general_aerobic')).toBe(zones.generalAerobic)
    expect(getPaceForZone(zones, 'steady')).toBe(zones.generalAerobic)
    expect(getPaceForZone(zones, 'easy_long')).toBe(zones.easy)
    expect(getPaceForZone(zones, 'nonexistent')).toBeUndefined()
  })

  it('getPaceZoneDescriptions returns 10 zone descriptions', () => {
    const zones = calculatePaceZones(50)
    const descriptions = getPaceZoneDescriptions(zones)
    expect(descriptions).toHaveLength(10)
    expect(descriptions[0].zone).toBe('Recovery')
    expect(descriptions[9].zone).toBe('Repetition')
    for (const d of descriptions) {
      expect(d.pace).toBeTruthy()
      expect(d.effortDescription).toBeTruthy()
      expect(d.purpose).toBeTruthy()
    }
  })
})
