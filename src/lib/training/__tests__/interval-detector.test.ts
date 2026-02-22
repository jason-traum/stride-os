import { describe, it, expect, beforeAll } from 'vitest';
import { detectIntervalPattern, type IntervalPattern } from '../interval-detector';
import type { WorkoutSegment } from '../../schema';

// ---------------------------------------------------------------------------
// Helpers — build realistic segment objects with minimal boilerplate
// ---------------------------------------------------------------------------

const METERS_PER_MILE = 1609.344;

/** Create a minimal WorkoutSegment with sensible defaults. */
function seg(overrides: Partial<WorkoutSegment> = {}): WorkoutSegment {
  const distMiles = overrides.distanceMiles ?? 0.5;
  const paceSPM = overrides.paceSecondsPerMile ?? 480;
  const durSec = overrides.durationSeconds ?? Math.round(distMiles * paceSPM);
  return {
    id: overrides.id ?? 1,
    workoutId: 1,
    segmentNumber: overrides.segmentNumber ?? 1,
    segmentType: overrides.segmentType ?? 'work',
    distanceMiles: distMiles,
    durationSeconds: durSec,
    paceSecondsPerMile: paceSPM,
    avgHr: overrides.avgHr ?? null,
    maxHr: overrides.maxHr ?? null,
    elevationGainFt: overrides.elevationGainFt ?? null,
    notes: overrides.notes ?? null,
    paceZone: overrides.paceZone ?? null,
    paceZoneConfidence: overrides.paceZoneConfidence ?? null,
    createdAt: '2026-01-01T00:00:00Z',
  } as WorkoutSegment;
}

/** Create a work segment at a given distance (meters) and pace (sec/mi). */
function workSeg(distMeters: number, paceSPM: number, segNum: number = 1): WorkoutSegment {
  const distMiles = distMeters / METERS_PER_MILE;
  return seg({
    id: segNum,
    segmentNumber: segNum,
    segmentType: 'work',
    distanceMiles: distMiles,
    paceSecondsPerMile: paceSPM,
    durationSeconds: Math.round(distMiles * paceSPM),
  });
}

/** Create a rest/recovery segment. */
function restSeg(distMeters: number, paceSPM: number, segNum: number = 1): WorkoutSegment {
  const distMiles = distMeters / METERS_PER_MILE;
  return seg({
    id: segNum,
    segmentNumber: segNum,
    segmentType: 'recovery',
    distanceMiles: distMiles,
    paceSecondsPerMile: paceSPM,
    durationSeconds: Math.round(distMiles * paceSPM),
    paceZone: 'recovery',
  });
}

/** Create a warmup segment. */
function warmupSeg(distMeters: number, paceSPM: number, segNum: number = 1): WorkoutSegment {
  const distMiles = distMeters / METERS_PER_MILE;
  return seg({
    id: segNum,
    segmentNumber: segNum,
    segmentType: 'warmup',
    distanceMiles: distMiles,
    paceSecondsPerMile: paceSPM,
    durationSeconds: Math.round(distMiles * paceSPM),
    paceZone: 'warmup',
  });
}

/** Create a cooldown segment. */
function cooldownSeg(distMeters: number, paceSPM: number, segNum: number = 1): WorkoutSegment {
  const distMiles = distMeters / METERS_PER_MILE;
  return seg({
    id: segNum,
    segmentNumber: segNum,
    segmentType: 'cooldown',
    distanceMiles: distMiles,
    paceSecondsPerMile: paceSPM,
    durationSeconds: Math.round(distMiles * paceSPM),
    paceZone: 'cooldown',
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('detectIntervalPattern', () => {
  // ===== Edge cases =====

  describe('edge cases', () => {
    it('returns unknown for no segments', () => {
      const result = detectIntervalPattern([]);
      expect(result.type).toBe('unknown');
      expect(result.workSegments).toBe(0);
    });

    it('returns unknown for single segment', () => {
      const result = detectIntervalPattern([
        workSeg(5000, 480, 1),
      ]);
      expect(result.type).toBe('unknown');
      expect(result.description).toContain('Single segment');
    });

    it('returns unknown for 2-3 segments when work/rest cannot be determined', () => {
      // Two segments at similar paces — can't tell work from rest
      const result = detectIntervalPattern([
        workSeg(800, 480, 1),
        workSeg(800, 475, 2),
      ]);
      // With only 2 segments and no explicit rest, pattern should be either
      // detected as repeat (if both are "work") or unknown
      expect(['repeat', 'unknown']).toContain(result.type);
    });

    it('filters out GPS artifacts (segments < 100m)', () => {
      const segments = [
        workSeg(800, 345, 1),
        restSeg(200, 600, 2),
        workSeg(50, 200, 3),  // GPS artifact — too short and impossibly fast
        workSeg(800, 340, 4),
        restSeg(200, 600, 5),
        workSeg(800, 350, 6),
        restSeg(200, 600, 7),
        workSeg(800, 345, 8),
      ];
      // The 50m artifact should be filtered
      const result = detectIntervalPattern(segments);
      // Should still detect pattern from the valid segments
      expect(result.type).not.toBe('unknown');
    });

    it('handles segments with zero distance gracefully', () => {
      const result = detectIntervalPattern([
        seg({ distanceMiles: 0, paceSecondsPerMile: 0, segmentNumber: 1 }),
        seg({ distanceMiles: 0, paceSecondsPerMile: 0, segmentNumber: 2 }),
      ]);
      expect(result.type).toBe('unknown');
    });
  });

  // ===== 8 x 800m =====

  describe('8x800m with 200m jog recovery', () => {
    let result: IntervalPattern;

    beforeAll(() => {
      const segments: WorkoutSegment[] = [];
      let segNum = 1;

      // Warmup: 1.5mi at 8:30/mi
      segments.push(warmupSeg(2414, 510, segNum++));

      // 8 x 800m @ ~5:45/mi with 200m jog recovery
      for (let i = 0; i < 8; i++) {
        segments.push(workSeg(800, 345, segNum++));  // 5:45/mi
        if (i < 7) {
          segments.push(restSeg(200, 600, segNum++));  // 10:00/mi jog
        }
      }

      // Cooldown: 1mi at 9:00/mi
      segments.push(cooldownSeg(1609, 540, segNum++));

      result = detectIntervalPattern(segments);
    });

    it('detects as repeat', () => {
      expect(result.type).toBe('repeat');
    });

    it('identifies 8 work segments', () => {
      expect(result.workSegments).toBe(8);
    });

    it('identifies 7 rest segments', () => {
      expect(result.restSegments).toBe(7);
    });

    it('reports ~800m average work distance', () => {
      expect(result.workDistance.avg).toBeGreaterThan(750);
      expect(result.workDistance.avg).toBeLessThan(850);
    });

    it('reports ~200m average rest distance', () => {
      expect(result.restDistance.avg).toBeGreaterThan(150);
      expect(result.restDistance.avg).toBeLessThan(250);
    });

    it('has high consistency', () => {
      expect(result.consistency).toBeGreaterThan(0.85);
    });

    it('description mentions 800m', () => {
      expect(result.description).toContain('800m');
    });

    it('description includes pace', () => {
      // Should mention something like "5:45/mi"
      expect(result.description).toMatch(/\d+:\d+\/mi/);
    });

    it('work pace is around 345 sec/mi', () => {
      expect(result.workPace.avg).toBeGreaterThan(330);
      expect(result.workPace.avg).toBeLessThan(360);
    });
  });

  // ===== 4 x 1600m =====

  describe('4x1600m with 400m recovery', () => {
    let result: IntervalPattern;

    beforeAll(() => {
      const segments: WorkoutSegment[] = [];
      let segNum = 1;

      // Warmup
      segments.push(warmupSeg(2414, 510, segNum++));

      // 4 x 1600m @ 6:00/mi with 400m jog
      for (let i = 0; i < 4; i++) {
        segments.push(workSeg(1600, 360, segNum++));
        if (i < 3) {
          segments.push(restSeg(400, 600, segNum++));
        }
      }

      // Cooldown
      segments.push(cooldownSeg(1609, 540, segNum++));

      result = detectIntervalPattern(segments);
    });

    it('detects as repeat', () => {
      expect(result.type).toBe('repeat');
    });

    it('identifies 4 work segments', () => {
      expect(result.workSegments).toBe(4);
    });

    it('description mentions "1 mile" or "1600m"', () => {
      // snapToStandardDistance should match 1600m to "1 mile"
      expect(
        result.description.includes('mile') || result.description.includes('1600')
      ).toBe(true);
    });

    it('reports ~1600m average work distance', () => {
      expect(result.workDistance.avg).toBeGreaterThan(1500);
      expect(result.workDistance.avg).toBeLessThan(1700);
    });
  });

  // ===== 6 x 400m =====

  describe('6x400m repeats', () => {
    it('detects as repeat with correct count', () => {
      const segments: WorkoutSegment[] = [];
      let segNum = 1;

      segments.push(warmupSeg(1609, 510, segNum++));

      for (let i = 0; i < 6; i++) {
        segments.push(workSeg(400, 330, segNum++)); // 5:30/mi
        if (i < 5) {
          segments.push(restSeg(400, 660, segNum++)); // 11:00/mi jog
        }
      }

      segments.push(cooldownSeg(1609, 540, segNum++));

      const result = detectIntervalPattern(segments);
      expect(result.type).toBe('repeat');
      expect(result.workSegments).toBe(6);
      expect(result.description).toContain('400m');
    });
  });

  // ===== Ladder =====

  describe('ladder 400-800-1200-800-400', () => {
    let result: IntervalPattern;

    beforeAll(() => {
      const segments: WorkoutSegment[] = [];
      let segNum = 1;

      segments.push(warmupSeg(1609, 510, segNum++));

      const ladderDists = [400, 800, 1200, 800, 400];
      for (let i = 0; i < ladderDists.length; i++) {
        segments.push(workSeg(ladderDists[i], 345, segNum++));
        if (i < ladderDists.length - 1) {
          segments.push(restSeg(200, 600, segNum++));
        }
      }

      segments.push(cooldownSeg(1609, 540, segNum++));

      result = detectIntervalPattern(segments);
    });

    it('detects as ladder or pyramid', () => {
      expect(['ladder', 'pyramid']).toContain(result.type);
    });

    it('has 5 work segments', () => {
      expect(result.workSegments).toBe(5);
    });

    it('description mentions ladder or pyramid', () => {
      expect(
        result.description.toLowerCase().includes('ladder') ||
        result.description.toLowerCase().includes('pyramid')
      ).toBe(true);
    });
  });

  // ===== Pyramid =====

  describe('pyramid 400-800-1200-1600-1200-800-400', () => {
    it('detects as pyramid', () => {
      const segments: WorkoutSegment[] = [];
      let segNum = 1;

      segments.push(warmupSeg(1609, 510, segNum++));

      const pyramidDists = [400, 800, 1200, 1600, 1200, 800, 400];
      for (let i = 0; i < pyramidDists.length; i++) {
        segments.push(workSeg(pyramidDists[i], 345, segNum++));
        if (i < pyramidDists.length - 1) {
          segments.push(restSeg(200, 600, segNum++));
        }
      }

      segments.push(cooldownSeg(1609, 540, segNum++));

      const result = detectIntervalPattern(segments);
      expect(result.type).toBe('pyramid');
      expect(result.workSegments).toBe(7);
    });
  });

  // ===== Tempo intervals =====

  describe('tempo intervals: 3 x 2 miles', () => {
    it('detects as tempo_intervals', () => {
      const segments: WorkoutSegment[] = [];
      let segNum = 1;

      segments.push(warmupSeg(1609, 510, segNum++));

      for (let i = 0; i < 3; i++) {
        segments.push(workSeg(3219, 390, segNum++)); // 2mi @ 6:30/mi
        if (i < 2) {
          segments.push(restSeg(400, 600, segNum++));
        }
      }

      segments.push(cooldownSeg(1609, 540, segNum++));

      const result = detectIntervalPattern(segments);
      expect(result.type).toBe('tempo_intervals');
      expect(result.workSegments).toBe(3);
      expect(result.description).toContain('mile');
    });
  });

  // ===== Mixed intervals =====

  describe('mixed: 3x800 + 2x400', () => {
    it('detects as mixed with two distance groups', () => {
      const segments: WorkoutSegment[] = [];
      let segNum = 1;

      segments.push(warmupSeg(1609, 510, segNum++));

      // 3 x 800m
      for (let i = 0; i < 3; i++) {
        segments.push(workSeg(800, 345, segNum++));
        segments.push(restSeg(200, 600, segNum++));
      }

      // 2 x 400m
      for (let i = 0; i < 2; i++) {
        segments.push(workSeg(400, 330, segNum++));
        if (i < 1) segments.push(restSeg(200, 600, segNum++));
      }

      segments.push(cooldownSeg(1609, 540, segNum++));

      const result = detectIntervalPattern(segments);
      expect(result.type).toBe('mixed');
      expect(result.workSegments).toBe(5);
      expect(result.description).toContain('800m');
      expect(result.description).toContain('400m');
    });
  });

  // ===== Fartlek =====

  describe('fartlek: varied distances with no consistent rest', () => {
    it('detects varied unstructured intervals as fartlek', () => {
      const segments: WorkoutSegment[] = [];
      let segNum = 1;

      // No warmup/cooldown labels — just varied segments
      segments.push(workSeg(300, 360, segNum++));
      segments.push(workSeg(600, 345, segNum++));
      segments.push(workSeg(200, 330, segNum++));
      segments.push(workSeg(900, 350, segNum++));
      segments.push(workSeg(450, 340, segNum++));
      segments.push(workSeg(700, 355, segNum++));
      segments.push(workSeg(350, 345, segNum++));

      const result = detectIntervalPattern(segments);
      expect(result.type).toBe('fartlek');
      expect(result.description.toLowerCase()).toContain('fartlek');
    });
  });

  // ===== Inconsistent distances =====

  describe('inconsistent work distances with some rest', () => {
    it('handles slightly varying distances within tolerance', () => {
      // 800m repeats where distances vary: 790, 810, 805, 795, 800
      const segments: WorkoutSegment[] = [];
      let segNum = 1;

      segments.push(warmupSeg(1609, 510, segNum++));

      const dists = [790, 810, 805, 795, 800];
      for (let i = 0; i < dists.length; i++) {
        segments.push(workSeg(dists[i], 345, segNum++));
        if (i < dists.length - 1) {
          segments.push(restSeg(200, 600, segNum++));
        }
      }

      segments.push(cooldownSeg(1609, 540, segNum++));

      const result = detectIntervalPattern(segments);
      // Should cluster these as ~800m repeats despite slight variation
      expect(result.type).toBe('repeat');
      expect(result.workSegments).toBe(5);
      expect(result.description).toContain('800m');
      expect(result.consistency).toBeGreaterThan(0.95);
    });
  });

  // ===== Work pace reporting =====

  describe('pace reporting', () => {
    it('correctly reports fastest and slowest work pace', () => {
      const segments: WorkoutSegment[] = [];
      let segNum = 1;

      segments.push(warmupSeg(1609, 510, segNum++));

      // 4 x 800m with varying paces
      const paces = [340, 345, 350, 338];
      for (let i = 0; i < paces.length; i++) {
        segments.push(workSeg(800, paces[i], segNum++));
        if (i < paces.length - 1) {
          segments.push(restSeg(200, 600, segNum++));
        }
      }

      segments.push(cooldownSeg(1609, 540, segNum++));

      const result = detectIntervalPattern(segments);
      expect(result.workPace.fastest).toBe(338);
      expect(result.workPace.slowest).toBe(350);
      expect(result.workPace.avg).toBeGreaterThan(339);
      expect(result.workPace.avg).toBeLessThan(349);
    });
  });

  // ===== Rest-to-work ratio =====

  describe('rest to work ratio', () => {
    it('computes ratio based on segment durations', () => {
      const segments: WorkoutSegment[] = [];
      let segNum = 1;

      // 4 x 800m @ 5:45/mi (~170s per 800m) with 200m recovery jog (~74s per 200m)
      for (let i = 0; i < 4; i++) {
        segments.push(workSeg(800, 345, segNum++));
        if (i < 3) {
          segments.push(restSeg(200, 600, segNum++));
        }
      }

      const result = detectIntervalPattern(segments);
      // Rest:work ratio should be roughly 3 * 74 / (4 * 170) ~ 0.33
      expect(result.restToWorkRatio).toBeGreaterThan(0.2);
      expect(result.restToWorkRatio).toBeLessThan(0.5);
    });
  });

  // ===== Segments without explicit types =====

  describe('segments without segmentType/paceZone labels', () => {
    it('infers work/rest from pace differences', () => {
      const segments: WorkoutSegment[] = [];
      let segNum = 1;

      // Simulate watch laps without labels: alternating fast and slow
      for (let i = 0; i < 8; i++) {
        const isFast = i % 2 === 0;
        segments.push(seg({
          id: segNum,
          segmentNumber: segNum++,
          segmentType: 'steady', // generic type
          distanceMiles: isFast ? 800 / METERS_PER_MILE : 200 / METERS_PER_MILE,
          paceSecondsPerMile: isFast ? 345 : 660,
          paceZone: null,
        }));
      }

      const result = detectIntervalPattern(segments);
      // Should detect the alternating fast/slow pattern
      expect(result.workSegments).toBeGreaterThanOrEqual(3);
      expect(result.restSegments).toBeGreaterThanOrEqual(1);
    });
  });

  // ===== Realistic workout with warmup + cooldown =====

  describe('full workout with warmup + intervals + cooldown', () => {
    it('correctly excludes warmup/cooldown from work segment count', () => {
      const segments: WorkoutSegment[] = [];
      let segNum = 1;

      // 2mi warmup
      segments.push(warmupSeg(3219, 510, segNum++));

      // 5 x 1000m @ 5:45/mi with 400m jog
      for (let i = 0; i < 5; i++) {
        segments.push(workSeg(1000, 345, segNum++));
        if (i < 4) {
          segments.push(restSeg(400, 600, segNum++));
        }
      }

      // 1.5mi cooldown
      segments.push(cooldownSeg(2414, 540, segNum++));

      const result = detectIntervalPattern(segments);
      expect(result.type).toBe('repeat');
      expect(result.workSegments).toBe(5);
      expect(result.description).toContain('1K');
    });
  });

  // ===== Ascending ladder (not pyramid) =====

  describe('ascending-only ladder', () => {
    it('detects ascending distances as ladder', () => {
      const segments: WorkoutSegment[] = [];
      let segNum = 1;

      segments.push(warmupSeg(1609, 510, segNum++));

      const dists = [400, 800, 1200, 1600];
      for (let i = 0; i < dists.length; i++) {
        segments.push(workSeg(dists[i], 345, segNum++));
        if (i < dists.length - 1) {
          segments.push(restSeg(200, 600, segNum++));
        }
      }

      segments.push(cooldownSeg(1609, 540, segNum++));

      const result = detectIntervalPattern(segments);
      expect(result.type).toBe('ladder');
      expect(result.workSegments).toBe(4);
    });
  });

  // ===== Output format validation =====

  describe('output format', () => {
    it('all numeric fields are populated for a detected pattern', () => {
      const segments: WorkoutSegment[] = [];
      let segNum = 1;

      for (let i = 0; i < 4; i++) {
        segments.push(workSeg(800, 345, segNum++));
        if (i < 3) segments.push(restSeg(200, 600, segNum++));
      }

      const result = detectIntervalPattern(segments);

      expect(result.type).toBeDefined();
      expect(typeof result.description).toBe('string');
      expect(result.description.length).toBeGreaterThan(0);
      expect(typeof result.workSegments).toBe('number');
      expect(typeof result.restSegments).toBe('number');
      expect(typeof result.workDistance.avg).toBe('number');
      expect(typeof result.workDistance.total).toBe('number');
      expect(typeof result.restDistance.avg).toBe('number');
      expect(typeof result.restDistance.total).toBe('number');
      expect(typeof result.workPace.avg).toBe('number');
      expect(typeof result.workPace.fastest).toBe('number');
      expect(typeof result.workPace.slowest).toBe('number');
      expect(typeof result.restPace.avg).toBe('number');
      expect(typeof result.consistency).toBe('number');
      expect(result.consistency).toBeGreaterThanOrEqual(0);
      expect(result.consistency).toBeLessThanOrEqual(1);
      expect(typeof result.restToWorkRatio).toBe('number');
    });
  });
});
