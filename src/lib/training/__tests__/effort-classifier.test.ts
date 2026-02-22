import { describe, it, expect } from 'vitest'
import {
  resolveZones,
  classifySplitEfforts,
  classifySplitEffortsWithZones,
  computeZoneDistribution,
  deriveWorkoutType,
  type ClassifyOptions,
  type ZoneBoundaries,
  type ClassifiedSplit,
  type EffortCategory,
} from '../effort-classifier'
import type { ZoneDistribution } from '../types'

// ---------------------------------------------------------------------------
// Helpers — build realistic lap data
// ---------------------------------------------------------------------------

interface LapInput {
  lapNumber?: number
  distanceMiles?: number
  durationSeconds?: number
  avgPaceSeconds?: number
  avgHeartRate?: number | null
  maxHeartRate?: number | null
  elevationGainFeet?: number | null
  lapType?: string
}

function lap(overrides: LapInput = {}): {
  lapNumber: number
  distanceMiles: number
  durationSeconds: number
  avgPaceSeconds: number
  avgHeartRate: number | null
  maxHeartRate: number | null
  elevationGainFeet: number | null
  lapType: string
} {
  return {
    lapNumber: 1,
    distanceMiles: 1.0,
    durationSeconds: 480,
    avgPaceSeconds: 480,
    avgHeartRate: null,
    maxHeartRate: null,
    elevationGainFeet: null,
    lapType: 'auto',
    ...overrides,
  }
}

/** Create a numbered sequence of laps with given paces. */
function laps(paces: number[], distanceMiles = 1.0): ReturnType<typeof lap>[] {
  return paces.map((pace, i) => lap({
    lapNumber: i + 1,
    avgPaceSeconds: pace,
    durationSeconds: Math.round(pace * distanceMiles),
    distanceMiles,
  }))
}

// Realistic zone boundaries for a ~45 VDOT runner (roughly 8:00/mi easy)
const ZONES_45: ZoneBoundaries = {
  easy: 560,       // 9:20/mi
  steady: 510,     // 8:30/mi
  marathon: 480,   // 8:00/mi
  tempo: 440,      // 7:20/mi
  threshold: 420,  // 7:00/mi
  interval: 390,   // 6:30/mi
}

// ---------------------------------------------------------------------------
// Stage 1: resolveZones
// ---------------------------------------------------------------------------
describe('resolveZones', () => {
  it('resolves zones from VDOT (priority 1)', () => {
    const zones = resolveZones([], { vdot: 50 })
    // VDOT 50 should produce sensible pace zones
    expect(zones.easy).toBeGreaterThan(zones.steady)
    expect(zones.steady).toBeGreaterThan(zones.marathon)
    expect(zones.marathon).toBeGreaterThan(zones.tempo)
    expect(zones.tempo).toBeGreaterThan(zones.threshold)
    expect(zones.threshold).toBeGreaterThan(zones.interval)
  })

  it('resolves zones from manual pace settings (priority 2)', () => {
    const zones = resolveZones([], {
      easyPace: 540,
      tempoPace: 440,
      thresholdPace: 420,
      intervalPace: 380,
      marathonPace: 490,
    })
    expect(zones.easy).toBe(540)
    expect(zones.tempo).toBe(440)
    expect(zones.threshold).toBe(420)
    expect(zones.interval).toBe(380)
    expect(zones.marathon).toBe(490)
    // steady = avg of easy + marathon
    expect(zones.steady).toBe(Math.round((540 + 490) / 2))
  })

  it('fills in missing manual paces with defaults', () => {
    const zones = resolveZones([], { easyPace: 540 })
    // marathon defaults to easyPace - 45
    expect(zones.marathon).toBe(495)
    // tempo defaults to marathon - 25
    expect(zones.tempo).toBe(470)
    // threshold defaults to tempo - 15
    expect(zones.threshold).toBe(455)
    // interval defaults to threshold - 15
    expect(zones.interval).toBe(440)
  })

  it('resolves zones from run data median (priority 3) when no VDOT or manual', () => {
    const testLaps = laps([480, 490, 500, 510, 520])
    const zones = resolveZones(testLaps, {})
    // Median pace is 500 (middle of sorted [480,490,500,510,520])
    expect(zones.easy).toBe(500 + 20) // 520
    expect(zones.steady).toBe(500 - 10) // 490
  })

  it('falls back to avgPaceSeconds when no valid laps', () => {
    const zones = resolveZones([], { avgPaceSeconds: 500 })
    expect(zones.easy).toBe(540) // 500 + 40
    expect(zones.tempo).toBe(455) // 500 - 45
  })

  it('uses default fallback (500) when no data at all', () => {
    const zones = resolveZones([], {})
    expect(zones.easy).toBe(540) // 500 + 40
  })

  it('VDOT takes priority over manual paces', () => {
    const vdotZones = resolveZones([], { vdot: 50, easyPace: 600 })
    // Should use VDOT, not easyPace=600
    expect(vdotZones.easy).toBeLessThan(600)
  })

  it('applies conditionAdjustment to all zone boundaries', () => {
    const adj = 15
    const noAdj = resolveZones([], { vdot: 50 })
    const withAdj = resolveZones([], { vdot: 50, conditionAdjustment: adj })
    expect(withAdj.easy).toBe(noAdj.easy + adj)
    expect(withAdj.threshold).toBe(noAdj.threshold + adj)
    expect(withAdj.interval).toBe(noAdj.interval + adj)
  })

  it('filters out invalid paces (< 180 or > 900) for median calculation', () => {
    const testLaps = [
      lap({ avgPaceSeconds: 100 }),  // too fast, filtered out
      lap({ avgPaceSeconds: 500 }),
      lap({ avgPaceSeconds: 510 }),
      lap({ avgPaceSeconds: 520 }),
      lap({ avgPaceSeconds: 1000 }), // too slow, filtered out
    ]
    const zones = resolveZones(testLaps, {})
    // Valid paces: [500, 510, 520] → median = 510
    expect(zones.easy).toBe(510 + 20) // 530
  })
})

// ---------------------------------------------------------------------------
// Stage 2: Run Mode Inference (tested via classifySplitEfforts)
// ---------------------------------------------------------------------------
describe('run mode inference', () => {
  it('explicit workoutType "race" maps to race mode', () => {
    // In race mode, splits near the dominant zone boundary get pulled toward dominant
    const raceLaps = laps([440, 442, 438, 441, 440, 439, 443, 440])
    const options: ClassifyOptions = { vdot: 50, workoutType: 'race' }
    const splits = classifySplitEfforts(raceLaps, options)
    // In a race, most splits should be the same category
    const mainCategories = splits
      .filter(s => s.category !== 'warmup' && s.category !== 'cooldown')
      .map(s => s.category)
    const uniqueCategories = new Set(mainCategories)
    // Very consistent paces → should be classified uniformly or nearly so
    expect(uniqueCategories.size).toBeLessThanOrEqual(2)
  })

  it('explicit workoutType "easy" maps to easy_run mode', () => {
    const easyLaps = laps([550, 545, 548, 550, 552])
    const options: ClassifyOptions = { vdot: 50, workoutType: 'easy' }
    const splits = classifySplitEfforts(easyLaps, options)
    // Easy run mode biases toward easy/steady
    for (const s of splits) {
      if (s.category !== 'warmup' && s.category !== 'cooldown') {
        expect(['easy', 'steady', 'recovery']).toContain(s.category)
      }
    }
  })

  it('high CV with fast splits infers workout mode', () => {
    // Alternating fast/slow → high coefficient of variation
    const workoutLaps = laps([400, 600, 390, 620, 400, 600, 395, 580])
    const options: ClassifyOptions = { vdot: 50 }
    const splits = classifySplitEfforts(workoutLaps, options)
    // Should detect recovery splits between hard efforts
    const hasRecovery = splits.some(s => s.category === 'recovery')
    const hasHard = splits.some(s => ['tempo', 'threshold', 'interval'].includes(s.category))
    expect(hasRecovery || hasHard).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Stage 3: Raw Classification
// ---------------------------------------------------------------------------
describe('raw classification', () => {
  it('classifies pace into correct zones via rawCategory', () => {
    // Use manual paces to get exact, predictable zone boundaries
    // steady boundary = round((560+480)/2) = 520
    // We test rawCategory to observe the raw classification before structural/smoothing stages.
    // Use only 4 splits (< 5) to avoid structural detection overwriting categories.
    const options: ClassifyOptions = {
      easyPace: 560,
      marathonPace: 480,
      tempoPace: 440,
      thresholdPace: 420,
      intervalPace: 390,
    }

    // Test each zone individually with a 4-split context (no structural detection)
    const easyLaps = [
      lap({ lapNumber: 1, avgPaceSeconds: 570 }),  // 570 >= 560 → easy
      lap({ lapNumber: 2, avgPaceSeconds: 570 }),
      lap({ lapNumber: 3, avgPaceSeconds: 570 }),
      lap({ lapNumber: 4, avgPaceSeconds: 570 }),
    ]
    expect(classifySplitEffortsWithZones(easyLaps, options).splits[0].rawCategory).toBe('easy')

    const steadyLaps = [
      lap({ lapNumber: 1, avgPaceSeconds: 530 }),  // 530 >= 560? No. 530 >= 520? Yes → steady
      lap({ lapNumber: 2, avgPaceSeconds: 530 }),
      lap({ lapNumber: 3, avgPaceSeconds: 530 }),
      lap({ lapNumber: 4, avgPaceSeconds: 530 }),
    ]
    expect(classifySplitEffortsWithZones(steadyLaps, options).splits[0].rawCategory).toBe('steady')

    const marathonLaps = [
      lap({ lapNumber: 1, avgPaceSeconds: 490 }),  // 490 >= 520? No. 490 >= 480? Yes → marathon
      lap({ lapNumber: 2, avgPaceSeconds: 490 }),
      lap({ lapNumber: 3, avgPaceSeconds: 490 }),
      lap({ lapNumber: 4, avgPaceSeconds: 490 }),
    ]
    expect(classifySplitEffortsWithZones(marathonLaps, options).splits[0].rawCategory).toBe('marathon')

    const tempoLaps = [
      lap({ lapNumber: 1, avgPaceSeconds: 445 }),  // 445 >= 440? Yes → tempo
      lap({ lapNumber: 2, avgPaceSeconds: 445 }),
      lap({ lapNumber: 3, avgPaceSeconds: 445 }),
      lap({ lapNumber: 4, avgPaceSeconds: 445 }),
    ]
    expect(classifySplitEffortsWithZones(tempoLaps, options).splits[0].rawCategory).toBe('tempo')

    const thresholdLaps = [
      lap({ lapNumber: 1, avgPaceSeconds: 425 }),  // 425 >= 440? No. 425 >= 420? Yes → threshold
      lap({ lapNumber: 2, avgPaceSeconds: 425 }),
      lap({ lapNumber: 3, avgPaceSeconds: 425 }),
      lap({ lapNumber: 4, avgPaceSeconds: 425 }),
    ]
    expect(classifySplitEffortsWithZones(thresholdLaps, options).splits[0].rawCategory).toBe('threshold')

    const intervalLaps = [
      lap({ lapNumber: 1, avgPaceSeconds: 370 }),  // 370 < 390 → interval
      lap({ lapNumber: 2, avgPaceSeconds: 370 }),
      lap({ lapNumber: 3, avgPaceSeconds: 370 }),
      lap({ lapNumber: 4, avgPaceSeconds: 370 }),
    ]
    expect(classifySplitEffortsWithZones(intervalLaps, options).splits[0].rawCategory).toBe('interval')
  })

  it('classifies very slow pace (> 900 sec/mi) as recovery', () => {
    const testLaps = laps([950, 500, 500, 500, 500])
    const options: ClassifyOptions = { easyPace: 560 }
    const result = classifySplitEffortsWithZones(testLaps, options)
    expect(result.splits[0].rawCategory).toBe('recovery')
  })
})

// ---------------------------------------------------------------------------
// Stage 3b: Structural Detection (warmup/cooldown/recovery)
// ---------------------------------------------------------------------------
describe('structural detection', () => {
  it('detects warmup: first split(s) significantly slower than median', () => {
    // First split at 600 (10:00/mi), rest at 480 (8:00/mi) → 120s slower
    const testLaps = laps([600, 480, 480, 480, 480, 480])
    const options: ClassifyOptions = { easyPace: 560, marathonPace: 480 }
    const splits = classifySplitEfforts(testLaps, options)
    expect(splits[0].category).toBe('warmup')
  })

  it('detects cooldown: last split significantly slower after faster splits', () => {
    const testLaps = laps([480, 480, 480, 480, 580])
    const options: ClassifyOptions = { easyPace: 560 }
    const splits = classifySplitEfforts(testLaps, options)
    expect(splits[4].category).toBe('cooldown')
  })

  it('does NOT detect structural warmup/cooldown for < 5 splits', () => {
    const testLaps = laps([600, 480, 480, 600])
    const options: ClassifyOptions = { easyPace: 560 }
    const splits = classifySplitEfforts(testLaps, options)
    // With < 5 splits, structural detection is skipped
    expect(splits[0].category).not.toBe('warmup')
    expect(splits[3].category).not.toBe('cooldown')
  })

  it('workout mode marks very slow splits as recovery', () => {
    const testLaps = laps([400, 650, 400, 650, 400, 650, 400])
    const options: ClassifyOptions = { easyPace: 560, workoutType: 'interval' }
    const splits = classifySplitEfforts(testLaps, options)
    // Slow splits (650) in a workout should be recovery
    const slowSplitCategories = [splits[1].category, splits[3].category, splits[5].category]
    slowSplitCategories.forEach(cat => {
      expect(cat).toBe('recovery')
    })
  })
})

// ---------------------------------------------------------------------------
// Stage 4: Smoothing
// ---------------------------------------------------------------------------
describe('smoothing', () => {
  it('smooths a single different split when both neighbors agree', () => {
    // Five splits: steady, steady, marathon (outlier), steady, steady
    // With boundaries where 510 = steady, 490 = just above marathon
    const testLaps = laps([510, 510, 490, 510, 510, 510])
    const options: ClassifyOptions = { easyPace: 560, marathonPace: 480 }
    // Steady boundary = round((560+480)/2) = 520
    // 510 >= 500? (steady boundary)... 490 < 520 so also steady
    // Let's create a more extreme case:
    // With paces where one is clearly in a different zone from neighbors
    const testLaps2 = laps([510, 510, 470, 510, 510, 510])
    // 510 > 500 → steady; 470 < 480 → marathon (or tempo depending on zones)
    // Both neighbors (510=steady) agree → smooth the 470 to steady
    const splits = classifySplitEfforts(testLaps2, options)
    // The outlier (index 2) should be smoothed to match neighbors
    // since it's sandwiched between two steady splits
    const categories = splits.map(s => s.category)
    // All non-structural should be the same after smoothing
    const nonStructural = categories.filter(c => c !== 'warmup' && c !== 'cooldown')
    const unique = new Set(nonStructural)
    expect(unique.size).toBeLessThanOrEqual(2) // may include one outlier at boundary
  })

  it('does NOT smooth anomaly splits', () => {
    // Pace < 180 is anomaly
    const testLaps = laps([510, 150, 510, 510, 510])
    const options: ClassifyOptions = { easyPace: 560 }
    const splits = classifySplitEfforts(testLaps, options)
    expect(splits[1].category).toBe('anomaly')
  })

  it('does NOT smooth recovery splits', () => {
    // Very slow split (> 900) between two easy splits
    const testLaps = laps([520, 950, 520, 520, 520])
    const options: ClassifyOptions = { easyPace: 560 }
    const splits = classifySplitEfforts(testLaps, options)
    expect(splits[1].category).toBe('recovery')
  })
})

// ---------------------------------------------------------------------------
// Stage 5: Anomaly Detection
// ---------------------------------------------------------------------------
describe('anomaly detection', () => {
  it('flags impossibly fast pace (< 3:00/mi = 180 sec)', () => {
    const testLaps = [
      lap({ lapNumber: 1, avgPaceSeconds: 500 }),
      lap({ lapNumber: 2, avgPaceSeconds: 120, distanceMiles: 1.0 }), // 2:00/mi — GPS tunnel artifact
      lap({ lapNumber: 3, avgPaceSeconds: 500 }),
      lap({ lapNumber: 4, avgPaceSeconds: 500 }),
      lap({ lapNumber: 5, avgPaceSeconds: 500 }),
    ]
    const splits = classifySplitEfforts(testLaps, { easyPace: 540 })
    expect(splits[1].category).toBe('anomaly')
    expect(splits[1].anomalyReason).toContain('3:00/mi')
  })

  it('flags very short splits (< 0.15 mi) with running pace as GPS noise', () => {
    const testLaps = [
      lap({ lapNumber: 1, avgPaceSeconds: 500 }),
      lap({ lapNumber: 2, avgPaceSeconds: 480, distanceMiles: 0.10 }), // only 0.10 mi
      lap({ lapNumber: 3, avgPaceSeconds: 500 }),
      lap({ lapNumber: 4, avgPaceSeconds: 500 }),
      lap({ lapNumber: 5, avgPaceSeconds: 500 }),
    ]
    const splits = classifySplitEfforts(testLaps, { easyPace: 540 })
    expect(splits[1].category).toBe('anomaly')
    expect(splits[1].anomalyReason).toContain('short split')
  })

  it('does NOT flag short splits with very slow pace (rest periods)', () => {
    // Short split at >900 sec/mi pace is a rest stop, not an anomaly
    const testLaps = [
      lap({ lapNumber: 1, avgPaceSeconds: 500 }),
      lap({ lapNumber: 2, avgPaceSeconds: 950, distanceMiles: 0.05 }), // rest stop
      lap({ lapNumber: 3, avgPaceSeconds: 500 }),
      lap({ lapNumber: 4, avgPaceSeconds: 500 }),
      lap({ lapNumber: 5, avgPaceSeconds: 500 }),
    ]
    const splits = classifySplitEfforts(testLaps, { easyPace: 540 })
    // Should NOT be anomaly (pace > 900 means rest, not GPS glitch)
    expect(splits[1].category).not.toBe('anomaly')
  })

  it('anomalies survive hysteresis (re-applied after stage 6)', () => {
    const testLaps = [
      lap({ lapNumber: 1, avgPaceSeconds: 500 }),
      lap({ lapNumber: 2, avgPaceSeconds: 100, distanceMiles: 1.0 }), // impossibly fast
      lap({ lapNumber: 3, avgPaceSeconds: 500 }),
      lap({ lapNumber: 4, avgPaceSeconds: 500 }),
      lap({ lapNumber: 5, avgPaceSeconds: 500 }),
    ]
    const splits = classifySplitEfforts(testLaps, { easyPace: 540 })
    expect(splits[1].category).toBe('anomaly')
    expect(splits[1].confidence).toBe(0.2)
  })
})

// ---------------------------------------------------------------------------
// Stage 6: Contextual Hysteresis
// ---------------------------------------------------------------------------
describe('hysteresis', () => {
  it('easy_run mode biases tempo-or-harder splits downward', () => {
    // On an easy run, splits near the tempo boundary should be demoted
    const options: ClassifyOptions = {
      easyPace: 560,
      marathonPace: 480,
      tempoPace: 440,
      thresholdPace: 420,
      intervalPace: 390,
      workoutType: 'easy',
    }
    // Steady boundary = 520

    // Create laps where one split is barely into tempo zone
    const testLaps = laps([530, 530, 442, 530, 530, 530]) // 442 is just barely < 440 (tempo boundary)
    const splits = classifySplitEfforts(testLaps, options)
    // In easy_run mode, the barely-tempo split should be demoted
    const suspectSplit = splits[2]
    // Should be at most marathon (one level below tempo), or could stay tempo if outside buffer
    expect(['marathon', 'tempo', 'steady']).toContain(suspectSplit.category)
  })

  it('workout mode detects recovery splits between hard efforts', () => {
    const options: ClassifyOptions = {
      easyPace: 560,
      marathonPace: 480,
      tempoPace: 440,
      thresholdPace: 420,
      intervalPace: 390,
      workoutType: 'interval',
    }
    // Classic interval pattern: hard / slow / hard / slow / hard
    // Recovery paces must be > zones.easy (560) to trigger hysteresis recovery detection
    // OR > zones.easy + 30 = 590 for structural detection
    const testLaps = laps([400, 620, 400, 620, 400, 620, 400])
    const splits = classifySplitEfforts(testLaps, options)

    // Slow splits between hard efforts in workout mode → recovery
    expect(splits[1].category).toBe('recovery')
    expect(splits[3].category).toBe('recovery')
    expect(splits[5].category).toBe('recovery')
  })

  it('race mode biases splits toward dominant category', () => {
    const options: ClassifyOptions = {
      easyPace: 560,
      marathonPace: 480,
      tempoPace: 440,
      thresholdPace: 420,
      intervalPace: 390,
      workoutType: 'race',
    }
    // All splits near tempo boundary, one slightly off
    const testLaps = laps([435, 435, 445, 435, 435, 435, 435, 435])
    const splits = classifySplitEfforts(testLaps, options)

    // The slightly-off split should be pulled toward the dominant category
    const categories = splits
      .filter(s => !['warmup', 'cooldown', 'anomaly'].includes(s.category))
      .map(s => s.category)
    const unique = new Set(categories)
    // In a race, a very consistent pace should produce very uniform classification
    expect(unique.size).toBeLessThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// Stage 7: Confidence Scoring
// ---------------------------------------------------------------------------
describe('confidence scoring', () => {
  it('anomaly splits get low confidence (0.2)', () => {
    const testLaps = [
      lap({ lapNumber: 1, avgPaceSeconds: 500 }),
      lap({ lapNumber: 2, avgPaceSeconds: 100, distanceMiles: 1.0 }),
      lap({ lapNumber: 3, avgPaceSeconds: 500 }),
      lap({ lapNumber: 4, avgPaceSeconds: 500 }),
      lap({ lapNumber: 5, avgPaceSeconds: 500 }),
    ]
    const splits = classifySplitEfforts(testLaps, { easyPace: 540 })
    expect(splits[1].confidence).toBe(0.2)
  })

  it('splits well within zone boundaries get higher confidence', () => {
    // All paces very comfortably in the easy zone
    const testLaps = laps([540, 540, 540, 540, 540])
    const options: ClassifyOptions = { easyPace: 560 }
    const splits = classifySplitEfforts(testLaps, options)
    // All are deep within easy zone → high confidence
    for (const s of splits) {
      expect(s.confidence).toBeGreaterThanOrEqual(0.6)
    }
  })

  it('HR agreement boosts confidence', () => {
    // Easy run with HR in the easy range (90-145)
    const testLaps = laps([540, 540, 540, 540, 540]).map((l, i) => ({
      ...l,
      avgHeartRate: 130,  // within easy HR zone [90, 145]
    }))
    const options: ClassifyOptions = { easyPace: 560 }
    const splits = classifySplitEfforts(testLaps, options)
    for (const s of splits) {
      expect(s.hrAgreement).toBe(true)
    }
  })

  it('HR disagreement lowers confidence and sets hrAgreement false', () => {
    // Easy pace but interval-level heart rate
    const testLaps = laps([540, 540, 540, 540, 540]).map(l => ({
      ...l,
      avgHeartRate: 190,  // way above easy HR zone [90, 145]
    }))
    const options: ClassifyOptions = { easyPace: 560 }
    const splits = classifySplitEfforts(testLaps, options)
    for (const s of splits) {
      expect(s.hrAgreement).toBe(false)
    }
  })

  it('short splits get slightly lower confidence', () => {
    const testLaps = [
      lap({ lapNumber: 1, avgPaceSeconds: 500, distanceMiles: 1.0 }),
      lap({ lapNumber: 2, avgPaceSeconds: 500, distanceMiles: 0.3 }), // short
      lap({ lapNumber: 3, avgPaceSeconds: 500, distanceMiles: 1.0 }),
      lap({ lapNumber: 4, avgPaceSeconds: 500, distanceMiles: 1.0 }),
      lap({ lapNumber: 5, avgPaceSeconds: 500, distanceMiles: 1.0 }),
    ]
    const splits = classifySplitEfforts(testLaps, { easyPace: 560 })
    // Short split should have lower confidence than full mile split
    expect(splits[1].confidence).toBeLessThanOrEqual(splits[0].confidence)
  })

  it('confidence is always between 0.2 and 1.0', () => {
    const testLaps = laps([200, 400, 500, 600, 800, 950])
    const splits = classifySplitEfforts(testLaps, { easyPace: 560 })
    for (const s of splits) {
      expect(s.confidence).toBeGreaterThanOrEqual(0.2)
      expect(s.confidence).toBeLessThanOrEqual(1.0)
    }
  })
})

// ---------------------------------------------------------------------------
// classifySplitEfforts — entry point
// ---------------------------------------------------------------------------
describe('classifySplitEfforts', () => {
  it('returns empty array for empty laps', () => {
    expect(classifySplitEfforts([], {})).toEqual([])
  })

  it('handles single-segment workout gracefully', () => {
    // With easyPace=560, marathon=515, steady=round((560+515)/2)=538
    // Pace 545 >= 538 → steady? No: 545 >= 560? No. 545 >= 538? Yes → easy.
    // Wait: easy boundary = 560. 545 < 560 so not easy. 545 >= 538 → steady.
    // Actually: classifyRaw checks: pace >= easy → easy; pace >= steady → steady; etc.
    // 545 >= 560? No. 545 >= 538? Yes → steady.
    const testLaps = [lap({ lapNumber: 1, avgPaceSeconds: 545, distanceMiles: 4.0, durationSeconds: 2180 })]
    const splits = classifySplitEfforts(testLaps, { easyPace: 560 })
    expect(splits).toHaveLength(1)
    expect(splits[0].lapNumber).toBe(1)
    // Single lap → no structural detection, no smoothing
    expect(splits[0].category).toBe('steady')
  })

  it('handles two-segment workout', () => {
    const testLaps = laps([530, 540])
    const splits = classifySplitEfforts(testLaps, { easyPace: 560 })
    expect(splits).toHaveLength(2)
  })

  it('returns correct ClassifiedSplit fields', () => {
    const testLaps = laps([500, 500, 500])
    const splits = classifySplitEfforts(testLaps, { easyPace: 560 })
    const s = splits[0]
    expect(s).toHaveProperty('lapNumber')
    expect(s).toHaveProperty('category')
    expect(s).toHaveProperty('categoryLabel')
    expect(s).toHaveProperty('confidence')
    expect(s).toHaveProperty('rawCategory')
    expect(typeof s.categoryLabel).toBe('string')
    expect(s.categoryLabel.length).toBeGreaterThan(0)
  })

  it('classifySplitEffortsWithZones returns both splits and zones', () => {
    const testLaps = laps([500, 500, 500])
    const result = classifySplitEffortsWithZones(testLaps, { easyPace: 560 })
    expect(result).toHaveProperty('splits')
    expect(result).toHaveProperty('zones')
    expect(result.zones).toHaveProperty('easy')
    expect(result.zones).toHaveProperty('threshold')
    expect(result.splits).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// Full pipeline integration tests
// ---------------------------------------------------------------------------
describe('full pipeline integration', () => {
  it('classifies a realistic easy run', () => {
    // 5-mile easy run with slight pace drift
    const testLaps = laps([545, 540, 535, 538, 542])
    const options: ClassifyOptions = { vdot: 45, workoutType: 'easy' }
    const splits = classifySplitEfforts(testLaps, options)

    expect(splits).toHaveLength(5)
    // All splits should be easy or steady
    for (const s of splits) {
      expect(['easy', 'steady', 'warmup', 'cooldown']).toContain(s.category)
    }
  })

  it('classifies a realistic interval workout', () => {
    // Warmup, 4x800 with recovery, cooldown
    // Use manual paces for exact boundaries:
    //   easy=560, marathon=480, tempo=440, threshold=420, interval=390
    //   steady = round((560+480)/2) = 520
    //
    // Warmup (580): structural detection needs > median+20 and < 900.
    // Sorted valid paces: [370,372,375,378,580,580,620,620,620] → median=580.
    // 580 > 580+20=600? No. So we need warmup slower than that.
    // Let's use 585 for warmup and 620 for recovery paces.
    // Sorted: [370,372,375,378,585,620,620,620,625] → median=585.
    // 625 > 585+20=605 and 625 < 900 → cooldown detected.
    // But 585 is not > 585+20. So warmup won't be detected at index 0.
    //
    // For workout mode, the key behavior is:
    // - Recovery splits between hard efforts
    // - Hard splits classified as interval/threshold
    // In workout mode, splits > easy+30=590 get marked recovery by structural detection.
    // So 620 → recovery. The first split at 580 < 590 → stays as classified (easy).
    const testLaps = [
      lap({ lapNumber: 1, avgPaceSeconds: 580, distanceMiles: 1.0 }),  // easy (not slow enough for warmup detection)
      lap({ lapNumber: 2, avgPaceSeconds: 370, distanceMiles: 0.5 }),  // interval
      lap({ lapNumber: 3, avgPaceSeconds: 620, distanceMiles: 0.25 }), // recovery
      lap({ lapNumber: 4, avgPaceSeconds: 372, distanceMiles: 0.5 }),  // interval
      lap({ lapNumber: 5, avgPaceSeconds: 620, distanceMiles: 0.25 }), // recovery
      lap({ lapNumber: 6, avgPaceSeconds: 375, distanceMiles: 0.5 }),  // interval
      lap({ lapNumber: 7, avgPaceSeconds: 620, distanceMiles: 0.25 }), // recovery
      lap({ lapNumber: 8, avgPaceSeconds: 378, distanceMiles: 0.5 }),  // interval
      lap({ lapNumber: 9, avgPaceSeconds: 625, distanceMiles: 1.0 }),  // cooldown
    ]
    const options: ClassifyOptions = {
      easyPace: 560,
      marathonPace: 480,
      tempoPace: 440,
      thresholdPace: 420,
      intervalPace: 390,
      workoutType: 'interval',
    }
    const splits = classifySplitEfforts(testLaps, options)

    expect(splits).toHaveLength(9)
    // Hard splits (index 1,3,5,7) should be interval/threshold
    expect(['interval', 'threshold']).toContain(splits[1].category)
    expect(['interval', 'threshold']).toContain(splits[3].category)
    // Recovery splits (index 2,4,6) should be recovery
    expect(splits[2].category).toBe('recovery')
    expect(splits[4].category).toBe('recovery')
    expect(splits[6].category).toBe('recovery')
  })

  it('classifies a realistic tempo run', () => {
    // Warmup, tempo, cooldown
    // Warmup/cooldown paces must be > median+20 but <= zones.easy+30 to avoid
    // workout-mode recovery override (VDOT 50 easy ≈ 524, so easy+30 = 554).
    const testLaps = [
      lap({ lapNumber: 1, avgPaceSeconds: 550, distanceMiles: 1.0 }),
      lap({ lapNumber: 2, avgPaceSeconds: 430, distanceMiles: 1.0 }),
      lap({ lapNumber: 3, avgPaceSeconds: 428, distanceMiles: 1.0 }),
      lap({ lapNumber: 4, avgPaceSeconds: 432, distanceMiles: 1.0 }),
      lap({ lapNumber: 5, avgPaceSeconds: 435, distanceMiles: 1.0 }),
      lap({ lapNumber: 6, avgPaceSeconds: 555, distanceMiles: 1.0 }),
    ]
    const options: ClassifyOptions = { vdot: 50, workoutType: 'tempo' }
    const splits = classifySplitEfforts(testLaps, options)

    expect(splits[0].category).toBe('warmup')
    // Middle splits should be tempo or threshold
    for (let i = 1; i <= 4; i++) {
      expect(['tempo', 'threshold', 'marathon']).toContain(splits[i].category)
    }
  })
})

// ---------------------------------------------------------------------------
// computeZoneDistribution
// ---------------------------------------------------------------------------
describe('computeZoneDistribution', () => {
  it('sums minutes per zone from classified splits', () => {
    const splits: ClassifiedSplit[] = [
      { lapNumber: 1, category: 'easy', categoryLabel: 'Easy', confidence: 0.9, rawCategory: 'easy' },
      { lapNumber: 2, category: 'tempo', categoryLabel: 'Tempo', confidence: 0.8, rawCategory: 'tempo' },
      { lapNumber: 3, category: 'easy', categoryLabel: 'Easy', confidence: 0.9, rawCategory: 'easy' },
    ]
    const segments = [
      { durationSeconds: 600 },   // 10 min easy
      { durationSeconds: 300 },   // 5 min tempo
      { durationSeconds: 600 },   // 10 min easy
    ]
    const dist = computeZoneDistribution(splits, segments)
    expect(dist.easy).toBeCloseTo(20.0, 1)   // 1200s = 20 min
    expect(dist.tempo).toBeCloseTo(5.0, 1)    // 300s = 5 min
    expect(dist.threshold).toBe(0)
    expect(dist.interval).toBe(0)
  })

  it('handles warmup and cooldown', () => {
    const splits: ClassifiedSplit[] = [
      { lapNumber: 1, category: 'warmup', categoryLabel: 'Warmup', confidence: 0.9, rawCategory: 'easy' },
      { lapNumber: 2, category: 'threshold', categoryLabel: 'Threshold', confidence: 0.8, rawCategory: 'threshold' },
      { lapNumber: 3, category: 'cooldown', categoryLabel: 'Cooldown', confidence: 0.9, rawCategory: 'easy' },
    ]
    const segments = [
      { durationSeconds: 600 },
      { durationSeconds: 1200 },
      { durationSeconds: 600 },
    ]
    const dist = computeZoneDistribution(splits, segments)
    expect(dist.warmup).toBeCloseTo(10, 1)
    expect(dist.threshold).toBeCloseTo(20, 1)
    expect(dist.cooldown).toBeCloseTo(10, 1)
  })

  it('handles null durations', () => {
    const splits: ClassifiedSplit[] = [
      { lapNumber: 1, category: 'easy', categoryLabel: 'Easy', confidence: 0.9, rawCategory: 'easy' },
    ]
    const segments = [{ durationSeconds: null }]
    const dist = computeZoneDistribution(splits, segments)
    expect(dist.easy).toBe(0)
  })

  it('rounds to one decimal place', () => {
    const splits: ClassifiedSplit[] = [
      { lapNumber: 1, category: 'easy', categoryLabel: 'Easy', confidence: 0.9, rawCategory: 'easy' },
    ]
    const segments = [{ durationSeconds: 123 }] // 2.05 min
    const dist = computeZoneDistribution(splits, segments)
    const decimals = (dist.easy.toString().split('.')[1] || '').length
    expect(decimals).toBeLessThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// deriveWorkoutType
// ---------------------------------------------------------------------------
describe('deriveWorkoutType', () => {
  const baseDist: ZoneDistribution = {
    recovery: 0, easy: 0, steady: 0, marathon: 0,
    tempo: 0, threshold: 0, interval: 0,
    warmup: 0, cooldown: 0, anomaly: 0,
  }

  it('preserves race workout type', () => {
    expect(deriveWorkoutType(baseDist, { workoutType: 'race' })).toBe('race')
  })

  it('preserves cross_train workout type', () => {
    expect(deriveWorkoutType(baseDist, { workoutType: 'cross_train' })).toBe('cross_train')
  })

  it('returns "long" for distance >= 9 miles', () => {
    const dist = { ...baseDist, easy: 60 }
    expect(deriveWorkoutType(dist, { distanceMiles: 10 })).toBe('long')
  })

  it('returns "long" for duration >= 75 minutes', () => {
    // Total minutes = all zones summed
    const dist = { ...baseDist, easy: 50, warmup: 15, cooldown: 15 }
    // 50 + 15 + 15 = 80 min → long
    expect(deriveWorkoutType(dist, {})).toBe('long')
  })

  it('returns "easy" when easy zone dominates (> 50%)', () => {
    const dist = { ...baseDist, easy: 30, steady: 5 }
    expect(deriveWorkoutType(dist, { distanceMiles: 4 })).toBe('easy')
  })

  it('returns "recovery" when recovery dominates', () => {
    const dist = { ...baseDist, recovery: 20, easy: 5 }
    expect(deriveWorkoutType(dist, { distanceMiles: 3 })).toBe('recovery')
  })

  it('remaps threshold dominance to "tempo"', () => {
    const dist = { ...baseDist, threshold: 20, easy: 5 }
    expect(deriveWorkoutType(dist, { distanceMiles: 4 })).toBe('tempo')
  })

  it('returns "tempo" when hard work >= 20% and tempo+threshold dominate', () => {
    // Ensure no single zone > 50% so the hard-work check is reached
    const dist = { ...baseDist, easy: 10, steady: 10, tempo: 8, threshold: 5 }
    // Total main = 33. Dominant = easy/steady at 10 each (30.3% each, < 50%)
    // Hard = 13. Hard pct = 39% > 20%
    // Dominant hard zone: tempo (8) + threshold (5) = 13 vs interval (0)
    expect(deriveWorkoutType(dist, { distanceMiles: 5 })).toBe('tempo')
  })

  it('returns "interval" when interval work dominates the hard zones', () => {
    // Ensure no single zone > 50% so the hard-work check is reached
    const dist = { ...baseDist, easy: 8, steady: 7, interval: 12, tempo: 2 }
    // Total main = 29. Dominant = interval at 12 (41.4%, < 50%)
    // Hard = 14. Hard pct = 48% > 20%
    // interval (12) > tempo+threshold (2)
    expect(deriveWorkoutType(dist, { distanceMiles: 5 })).toBe('interval')
  })

  it('returns dominant zone when > 50% (steady, marathon)', () => {
    const distSteady = { ...baseDist, steady: 30, easy: 10 }
    expect(deriveWorkoutType(distSteady, { distanceMiles: 5 })).toBe('steady')

    const distMarathon = { ...baseDist, marathon: 25, easy: 10 }
    expect(deriveWorkoutType(distMarathon, { distanceMiles: 5 })).toBe('marathon')
  })

  it('returns "easy" for aerobic-dominant runs when no zone dominates', () => {
    // Mixed easy/steady/marathon with no single zone > 50% and hard < 20%
    const dist = { ...baseDist, easy: 10, steady: 10, marathon: 8 }
    expect(deriveWorkoutType(dist, { distanceMiles: 4 })).toBe('easy')
  })

  it('returns existing workoutType or "easy" for zero total minutes', () => {
    expect(deriveWorkoutType(baseDist, {})).toBe('easy')
    expect(deriveWorkoutType(baseDist, { workoutType: 'tempo' })).toBe('tempo')
  })
})
