import { describe, it, expect } from 'vitest';
import {
  scanActivities,
  type FlaggedActivity,
  type FlagReason,
  type FlagSeverity,
  type ScanResult,
} from '../activity-scanner';
import type { Workout } from '../../schema';

// ── Helpers ──────────────────────────────────────────────────────────────

let _nextId = 1;

/** Build a minimal Workout with sensible defaults. Override any field via `overrides`. */
function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: _nextId++,
    profileId: 1,
    date: '2025-06-15',
    distanceMiles: 5.0,
    durationMinutes: 45,
    avgPaceSeconds: 540, // 9:00/mi
    avgHr: null,
    maxHr: null,
    elevationGainFt: null,
    routeName: null,
    shoeId: null,
    workoutType: 'easy',
    source: 'strava',
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
    polyline: null,
    zoneDistribution: null,
    zoneDominant: null,
    zoneClassifiedAt: null,
    zoneBoundariesUsed: null,
    elapsedTimeMinutes: null,
    excludeFromEstimates: false,
    autoExcluded: false,
    excludeReason: null,
    stravaDescription: null,
    stravaKudosCount: null,
    stravaCommentCount: null,
    stravaAchievementCount: null,
    stravaPhotoCount: null,
    stravaAthleteCount: null,
    stravaMaxSpeed: null,
    stravaAverageCadence: null,
    stravaSufferScore: null,
    stravaPerceivedExertion: null,
    stravaGearId: null,
    stravaDeviceName: null,
    startLatitude: null,
    startLongitude: null,
    endLatitude: null,
    endLongitude: null,
    stravaIsTrainer: null,
    stravaIsCommute: null,
    stravaKudosLastChecked: null,
    startTimeLocal: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Workout;
}

/** Convenience: scan a single workout and return the result. */
function scanOne(overrides: Partial<Workout> = {}): ScanResult {
  return scanActivities([makeWorkout(overrides)]);
}

/** Convenience: scan a single workout and return the first flag (or undefined). */
function flagOne(overrides: Partial<Workout> = {}): FlaggedActivity | undefined {
  return scanOne(overrides).flagged[0];
}

// Reset auto-incrementing ID between describe blocks
beforeEach(() => {
  _nextId = 1;
});

// ── Tests ────────────────────────────────────────────────────────────────

describe('scanActivities', () => {
  // ── Empty input ──────────────────────────────────────────────────────
  describe('empty input', () => {
    it('returns empty results for an empty array', () => {
      const result = scanActivities([]);
      expect(result).toEqual({
        totalWorkouts: 0,
        flaggedCount: 0,
        autoExcludeCount: 0,
        reviewCount: 0,
        infoCount: 0,
        flagged: [],
      });
    });
  });

  // ── Normal activities ────────────────────────────────────────────────
  describe('normal activities are not flagged', () => {
    it('does not flag a typical easy run', () => {
      const result = scanOne({
        distanceMiles: 5.0,
        durationMinutes: 45,
        avgPaceSeconds: 540, // 9:00/mi
      });
      expect(result.flaggedCount).toBe(0);
      expect(result.flagged).toEqual([]);
    });

    it('does not flag a long run', () => {
      const result = scanOne({
        distanceMiles: 16.0,
        durationMinutes: 140,
        avgPaceSeconds: 525, // 8:45/mi
      });
      expect(result.flaggedCount).toBe(0);
    });

    it('does not flag a fast tempo run', () => {
      const result = scanOne({
        distanceMiles: 6.0,
        durationMinutes: 36,
        avgPaceSeconds: 360, // 6:00/mi
      });
      expect(result.flaggedCount).toBe(0);
    });

    it('does not flag a legitimate 3:30/mi pace (exactly at threshold)', () => {
      const result = scanOne({
        distanceMiles: 3.0,
        durationMinutes: 10,
        avgPaceSeconds: 210, // exactly 3:30/mi
      });
      expect(result.flaggedCount).toBe(0);
    });

    it('does not flag a treadmill run marked as trainer', () => {
      const result = scanOne({
        distanceMiles: 0.3,
        durationMinutes: 30,
        avgPaceSeconds: 600,
        stravaIsTrainer: true,
      });
      expect(result.flaggedCount).toBe(0);
    });
  });

  // ── 1. micro ─────────────────────────────────────────────────────────
  describe('micro detection', () => {
    it('flags an activity under 0.3 mi as micro (auto_exclude)', () => {
      const flag = flagOne({ distanceMiles: 0.1, durationMinutes: 5, avgPaceSeconds: null });
      expect(flag).toBeDefined();
      expect(flag!.reason).toBe('micro');
      expect(flag!.severity).toBe('auto_exclude');
    });

    it('flags a very short duration (<2 min) with distance under 1 mi as micro', () => {
      const flag = flagOne({ distanceMiles: 0.5, durationMinutes: 1, avgPaceSeconds: null });
      expect(flag).toBeDefined();
      expect(flag!.reason).toBe('micro');
      expect(flag!.severity).toBe('auto_exclude');
    });

    it('does not flag 0.3 mi exactly (at threshold, not under)', () => {
      const result = scanOne({
        distanceMiles: 0.3,
        durationMinutes: 5,
        avgPaceSeconds: 1000,
      });
      // 0.3 mi is not < 0.3, so micro should not trigger
      const microFlags = result.flagged.filter(f => f.reason === 'micro');
      expect(microFlags).toHaveLength(0);
    });

    it('does not flag 2 min exactly (at threshold, not under)', () => {
      const result = scanOne({
        distanceMiles: 0.5,
        durationMinutes: 2,
        avgPaceSeconds: null,
      });
      const microFlags = result.flagged.filter(f => f.reason === 'micro');
      expect(microFlags).toHaveLength(0);
    });

    it('does not double-flag zero distance + zero duration as micro', () => {
      // isMicro explicitly returns false when both are 0
      const result = scanOne({ distanceMiles: 0, durationMinutes: 0, avgPaceSeconds: null });
      const microFlags = result.flagged.filter(f => f.reason === 'micro');
      expect(microFlags).toHaveLength(0);
    });
  });

  // ── 2. gps_glitch ───────────────────────────────────────────────────
  describe('gps_glitch detection', () => {
    it('flags unrealistically fast pace (<3:30/mi) as gps_glitch (review)', () => {
      const flag = flagOne({
        distanceMiles: 5.0,
        durationMinutes: 15,
        avgPaceSeconds: 180, // 3:00/mi
      });
      expect(flag).toBeDefined();
      expect(flag!.reason).toBe('gps_glitch');
      expect(flag!.severity).toBe('review');
      expect(flag!.recommendation).toContain('unrealistically fast');
    });

    it('flags unrealistically slow pace (>20:00/mi) when distance > 0.3 mi as gps_glitch', () => {
      const flag = flagOne({
        distanceMiles: 1.0,
        durationMinutes: 350,
        avgPaceSeconds: 1260, // 21:00/mi
      });
      expect(flag).toBeDefined();
      expect(flag!.reason).toBe('gps_glitch');
      expect(flag!.severity).toBe('review');
      expect(flag!.recommendation).toContain('unrealistically slow');
    });

    it('does not flag slow pace when distance <= 0.3 mi', () => {
      // Slow pace + short distance should be caught by micro, not gps_glitch
      const result = scanOne({
        distanceMiles: 0.2,
        durationMinutes: 60,
        avgPaceSeconds: 1500,
      });
      const gpsFlags = result.flagged.filter(f => f.reason === 'gps_glitch');
      expect(gpsFlags).toHaveLength(0);
    });

    it('flags max speed exceeding 25 mph as gps_glitch', () => {
      const flag = flagOne({
        distanceMiles: 5.0,
        durationMinutes: 45,
        avgPaceSeconds: 540,
        stravaMaxSpeed: 30.0, // 30 mph
      });
      expect(flag).toBeDefined();
      expect(flag!.reason).toBe('gps_glitch');
      expect(flag!.recommendation).toContain('Max speed');
    });

    it('does not flag max speed at exactly 25 mph', () => {
      const result = scanOne({
        distanceMiles: 5.0,
        durationMinutes: 45,
        avgPaceSeconds: 540,
        stravaMaxSpeed: 25.0,
      });
      const gpsFlags = result.flagged.filter(f => f.reason === 'gps_glitch');
      expect(gpsFlags).toHaveLength(0);
    });

    it('does not flag pace at exactly 3:30/mi (210 sec)', () => {
      const result = scanOne({
        distanceMiles: 3.0,
        durationMinutes: 10,
        avgPaceSeconds: 210, // exactly 3:30/mi
      });
      const gpsFlags = result.flagged.filter(f => f.reason === 'gps_glitch');
      expect(gpsFlags).toHaveLength(0);
    });

    it('does not flag pace at exactly 20:00/mi (1200 sec)', () => {
      const result = scanOne({
        distanceMiles: 1.0,
        durationMinutes: 20,
        avgPaceSeconds: 1200, // exactly 20:00/mi
      });
      const gpsFlags = result.flagged.filter(f => f.reason === 'gps_glitch');
      expect(gpsFlags).toHaveLength(0);
    });
  });

  // ── 3. walk_tagged_run ──────────────────────────────────────────────
  describe('walk_tagged_run detection', () => {
    it('flags slow pace (>=16:00/mi) with walklike workout type as walk_tagged_run (review)', () => {
      const flag = flagOne({
        distanceMiles: 2.0,
        durationMinutes: 34,
        avgPaceSeconds: 1020, // 17:00/mi
        workoutType: 'easy',
      });
      expect(flag).toBeDefined();
      expect(flag!.reason).toBe('walk_tagged_run');
      expect(flag!.severity).toBe('review');
    });

    it('flags walk pace with recovery workout type', () => {
      const flag = flagOne({
        distanceMiles: 2.0,
        durationMinutes: 34,
        avgPaceSeconds: 1020,
        workoutType: 'recovery',
      });
      expect(flag).toBeDefined();
      expect(flag!.reason).toBe('walk_tagged_run');
    });

    it('flags walk pace with "other" workout type', () => {
      const flag = flagOne({
        distanceMiles: 2.0,
        durationMinutes: 34,
        avgPaceSeconds: 1020,
        workoutType: 'other',
      });
      expect(flag).toBeDefined();
      expect(flag!.reason).toBe('walk_tagged_run');
    });

    it('flags walk pace with "cross_train" workout type', () => {
      const flag = flagOne({
        distanceMiles: 2.0,
        durationMinutes: 34,
        avgPaceSeconds: 1020,
        workoutType: 'cross_train',
      });
      expect(flag).toBeDefined();
      expect(flag!.reason).toBe('walk_tagged_run');
    });

    it('does not flag walk pace if workout type is non-walklike (e.g. tempo)', () => {
      const result = scanOne({
        distanceMiles: 2.0,
        durationMinutes: 34,
        avgPaceSeconds: 1020,
        workoutType: 'tempo',
      });
      const walkFlags = result.flagged.filter(f => f.reason === 'walk_tagged_run');
      expect(walkFlags).toHaveLength(0);
    });

    it('does not flag walk pace if distance <= 0.3 mi', () => {
      const result = scanOne({
        distanceMiles: 0.2,
        durationMinutes: 34,
        avgPaceSeconds: 1020,
        workoutType: 'easy',
      });
      const walkFlags = result.flagged.filter(f => f.reason === 'walk_tagged_run');
      expect(walkFlags).toHaveLength(0);
    });

    it('does not flag pace just under 16:00/mi (959 sec)', () => {
      const result = scanOne({
        distanceMiles: 2.0,
        durationMinutes: 32,
        avgPaceSeconds: 959, // just under 16:00
        workoutType: 'easy',
      });
      const walkFlags = result.flagged.filter(f => f.reason === 'walk_tagged_run');
      expect(walkFlags).toHaveLength(0);
    });

    it('flags pace at exactly 16:00/mi (960 sec)', () => {
      const result = scanOne({
        distanceMiles: 2.0,
        durationMinutes: 32,
        avgPaceSeconds: 960,
        workoutType: 'easy',
      });
      const walkFlags = result.flagged.filter(f => f.reason === 'walk_tagged_run');
      expect(walkFlags).toHaveLength(1);
    });
  });

  // ── 4. suspicious_distance ──────────────────────────────────────────
  // Note: Any pace < 120 (suspicious_distance threshold) is also < 210
  // (gps_glitch threshold). Since gps_glitch is checked first and both
  // are "review" severity, gps_glitch wins deduplication. We test that
  // the workout IS flagged and verify the suspicious_distance logic
  // indirectly via boundary and exclusion tests.
  describe('suspicious_distance detection', () => {
    it('flags impossible pace (<2:00/mi) — dedup yields gps_glitch since both are review', () => {
      const result = scanOne({
        distanceMiles: 10.0,
        durationMinutes: 15,
        avgPaceSeconds: 90, // 1:30/mi — triggers both gps_glitch and suspicious_distance
      });
      // The workout is flagged (both detectors fire, gps_glitch wins dedup)
      expect(result.flaggedCount).toBe(1);
      expect(result.flagged[0].severity).toBe('review');
      // gps_glitch is checked before suspicious_distance and both are review severity,
      // so gps_glitch wins deduplication
      expect(result.flagged[0].reason).toBe('gps_glitch');
    });

    it('does not trigger for distance < 0.3 mi (caught by micro instead)', () => {
      const result = scanOne({
        distanceMiles: 0.1,
        durationMinutes: 1,
        avgPaceSeconds: 60, // impossible but under micro threshold
      });
      const suspFlags = result.flagged.filter(f => f.reason === 'suspicious_distance');
      expect(suspFlags).toHaveLength(0);
    });

    it('does not flag pace at exactly 2:00/mi (120 sec) — boundary not crossed', () => {
      const result = scanOne({
        distanceMiles: 5.0,
        durationMinutes: 10,
        avgPaceSeconds: 120, // exactly 2:00/mi — not < 120
      });
      const suspFlags = result.flagged.filter(f => f.reason === 'suspicious_distance');
      expect(suspFlags).toHaveLength(0);
    });

    it('flags at 119 sec (just under 2:00/mi) — dedup yields gps_glitch', () => {
      const result = scanOne({
        distanceMiles: 5.0,
        durationMinutes: 9,
        avgPaceSeconds: 119,
      });
      expect(result.flaggedCount).toBe(1);
      // Both suspicious_distance and gps_glitch fire; gps_glitch wins dedup
      expect(result.flagged[0].reason).toBe('gps_glitch');
    });

    it('does not trigger if distance is null', () => {
      const result = scanOne({
        distanceMiles: null,
        durationMinutes: 30,
        avgPaceSeconds: null,
      });
      const suspFlags = result.flagged.filter(f => f.reason === 'suspicious_distance');
      expect(suspFlags).toHaveLength(0);
    });

    it('does not trigger if duration is null', () => {
      const result = scanOne({
        distanceMiles: 5.0,
        durationMinutes: null,
        avgPaceSeconds: null,
      });
      const suspFlags = result.flagged.filter(f => f.reason === 'suspicious_distance');
      expect(suspFlags).toHaveLength(0);
    });
  });

  // ── 5. duplicate ────────────────────────────────────────────────────
  describe('duplicate detection', () => {
    it('flags the higher-ID workout as duplicate when same date, similar distance and duration', () => {
      const w1 = makeWorkout({
        id: 10,
        profileId: 1,
        date: '2025-06-15',
        distanceMiles: 5.0,
        durationMinutes: 45,
      });
      const w2 = makeWorkout({
        id: 20,
        profileId: 1,
        date: '2025-06-15',
        distanceMiles: 5.05, // within 0.1 mi tolerance
        durationMinutes: 45,  // within 1 min tolerance
      });

      const result = scanActivities([w1, w2]);
      const dupFlags = result.flagged.filter(f => f.reason === 'duplicate');
      expect(dupFlags).toHaveLength(1);
      expect(dupFlags[0].workoutId).toBe(20); // higher ID is the duplicate
      expect(dupFlags[0].severity).toBe('review');
    });

    it('does not flag the lower-ID workout as duplicate', () => {
      const w1 = makeWorkout({
        id: 10,
        profileId: 1,
        date: '2025-06-15',
        distanceMiles: 5.0,
        durationMinutes: 45,
      });
      const w2 = makeWorkout({
        id: 20,
        profileId: 1,
        date: '2025-06-15',
        distanceMiles: 5.0,
        durationMinutes: 45,
      });

      const result = scanActivities([w1, w2]);
      const dupFlags = result.flagged.filter(f => f.reason === 'duplicate');
      const flaggedIds = dupFlags.map(f => f.workoutId);
      expect(flaggedIds).not.toContain(10);
    });

    it('does not flag workouts on different dates', () => {
      const w1 = makeWorkout({
        id: 10,
        profileId: 1,
        date: '2025-06-15',
        distanceMiles: 5.0,
        durationMinutes: 45,
      });
      const w2 = makeWorkout({
        id: 20,
        profileId: 1,
        date: '2025-06-16',
        distanceMiles: 5.0,
        durationMinutes: 45,
      });

      const result = scanActivities([w1, w2]);
      const dupFlags = result.flagged.filter(f => f.reason === 'duplicate');
      expect(dupFlags).toHaveLength(0);
    });

    it('does not flag workouts from different profiles on the same date', () => {
      const w1 = makeWorkout({
        id: 10,
        profileId: 1,
        date: '2025-06-15',
        distanceMiles: 5.0,
        durationMinutes: 45,
      });
      const w2 = makeWorkout({
        id: 20,
        profileId: 2,
        date: '2025-06-15',
        distanceMiles: 5.0,
        durationMinutes: 45,
      });

      const result = scanActivities([w1, w2]);
      const dupFlags = result.flagged.filter(f => f.reason === 'duplicate');
      expect(dupFlags).toHaveLength(0);
    });

    it('does not flag when distance difference exceeds tolerance (>0.1 mi)', () => {
      const w1 = makeWorkout({
        id: 10,
        profileId: 1,
        date: '2025-06-15',
        distanceMiles: 5.0,
        durationMinutes: 45,
      });
      const w2 = makeWorkout({
        id: 20,
        profileId: 1,
        date: '2025-06-15',
        distanceMiles: 5.2, // 0.2 mi difference, exceeds 0.1 tolerance
        durationMinutes: 45,
      });

      const result = scanActivities([w1, w2]);
      const dupFlags = result.flagged.filter(f => f.reason === 'duplicate');
      expect(dupFlags).toHaveLength(0);
    });

    it('does not flag when duration difference exceeds tolerance (>1 min)', () => {
      const w1 = makeWorkout({
        id: 10,
        profileId: 1,
        date: '2025-06-15',
        distanceMiles: 5.0,
        durationMinutes: 45,
      });
      const w2 = makeWorkout({
        id: 20,
        profileId: 1,
        date: '2025-06-15',
        distanceMiles: 5.0,
        durationMinutes: 47, // 2 min difference, exceeds 1 min tolerance
      });

      const result = scanActivities([w1, w2]);
      const dupFlags = result.flagged.filter(f => f.reason === 'duplicate');
      expect(dupFlags).toHaveLength(0);
    });

    it('flags at exactly the distance tolerance boundary (0.1 mi difference)', () => {
      const w1 = makeWorkout({
        id: 10,
        profileId: 1,
        date: '2025-06-15',
        distanceMiles: 5.0,
        durationMinutes: 45,
      });
      const w2 = makeWorkout({
        id: 20,
        profileId: 1,
        date: '2025-06-15',
        distanceMiles: 5.1, // exactly at tolerance
        durationMinutes: 45,
      });

      const result = scanActivities([w1, w2]);
      const dupFlags = result.flagged.filter(f => f.reason === 'duplicate');
      expect(dupFlags).toHaveLength(1);
    });

    it('flags at exactly the duration tolerance boundary (1 min difference)', () => {
      const w1 = makeWorkout({
        id: 10,
        profileId: 1,
        date: '2025-06-15',
        distanceMiles: 5.0,
        durationMinutes: 45,
      });
      const w2 = makeWorkout({
        id: 20,
        profileId: 1,
        date: '2025-06-15',
        distanceMiles: 5.0,
        durationMinutes: 46, // exactly at tolerance
      });

      const result = scanActivities([w1, w2]);
      const dupFlags = result.flagged.filter(f => f.reason === 'duplicate');
      expect(dupFlags).toHaveLength(1);
    });
  });

  // ── 6. zero_distance ────────────────────────────────────────────────
  describe('zero_distance detection', () => {
    it('flags activity with duration but null distance as zero_distance (auto_exclude)', () => {
      const flag = flagOne({
        distanceMiles: null,
        durationMinutes: 30,
        avgPaceSeconds: null,
      });
      expect(flag).toBeDefined();
      expect(flag!.reason).toBe('zero_distance');
      expect(flag!.severity).toBe('auto_exclude');
    });

    it('flags activity with duration but 0 distance as zero_distance', () => {
      const flag = flagOne({
        distanceMiles: 0,
        durationMinutes: 30,
        avgPaceSeconds: null,
      });
      expect(flag).toBeDefined();
      expect(flag!.reason).toBe('zero_distance');
      expect(flag!.severity).toBe('auto_exclude');
    });

    it('flags activity with duration but undefined distance as zero_distance', () => {
      const overrides: Partial<Workout> = {
        durationMinutes: 30,
        avgPaceSeconds: null,
      };
      // Explicitly set distanceMiles to undefined to test
      const w = makeWorkout(overrides);
      (w as any).distanceMiles = undefined;

      const result = scanActivities([w]);
      const zeroFlags = result.flagged.filter(f => f.reason === 'zero_distance');
      expect(zeroFlags).toHaveLength(1);
    });

    it('does not flag if duration is 0 (no duration = nothing happened)', () => {
      const result = scanOne({
        distanceMiles: null,
        durationMinutes: 0,
        avgPaceSeconds: null,
      });
      const zeroFlags = result.flagged.filter(f => f.reason === 'zero_distance');
      expect(zeroFlags).toHaveLength(0);
    });

    it('does not flag if duration is null', () => {
      const result = scanOne({
        distanceMiles: null,
        durationMinutes: null,
        avgPaceSeconds: null,
      });
      const zeroFlags = result.flagged.filter(f => f.reason === 'zero_distance');
      expect(zeroFlags).toHaveLength(0);
    });
  });

  // ── 7. indoor_anomaly ───────────────────────────────────────────────
  describe('indoor_anomaly detection', () => {
    it('flags short distance (<0.5 mi) with long duration (>=15 min) as indoor_anomaly (info)', () => {
      // Use avgPaceSeconds within normal range to avoid triggering gps_glitch
      const flag = flagOne({
        distanceMiles: 0.4,
        durationMinutes: 30,
        avgPaceSeconds: 540, // 9:00/mi — normal, won't trigger gps_glitch
        stravaIsTrainer: null,
      });
      expect(flag).toBeDefined();
      expect(flag!.reason).toBe('indoor_anomaly');
      expect(flag!.severity).toBe('info');
    });

    it('does not flag if stravaIsTrainer is true', () => {
      const result = scanOne({
        distanceMiles: 0.4,
        durationMinutes: 30,
        avgPaceSeconds: 540,
        stravaIsTrainer: true,
      });
      const indoorFlags = result.flagged.filter(f => f.reason === 'indoor_anomaly');
      expect(indoorFlags).toHaveLength(0);
    });

    it('does not flag if distance is 0 (caught by zero_distance)', () => {
      const result = scanOne({
        distanceMiles: 0,
        durationMinutes: 30,
        avgPaceSeconds: null,
      });
      const indoorFlags = result.flagged.filter(f => f.reason === 'indoor_anomaly');
      expect(indoorFlags).toHaveLength(0);
    });

    it('does not flag if distance >= 0.5 mi', () => {
      const result = scanOne({
        distanceMiles: 0.5,
        durationMinutes: 30,
        avgPaceSeconds: 3600,
        stravaIsTrainer: null,
      });
      const indoorFlags = result.flagged.filter(f => f.reason === 'indoor_anomaly');
      expect(indoorFlags).toHaveLength(0);
    });

    it('does not flag if duration < 15 min', () => {
      const result = scanOne({
        distanceMiles: 0.3,
        durationMinutes: 14,
        avgPaceSeconds: null,
        stravaIsTrainer: null,
      });
      const indoorFlags = result.flagged.filter(f => f.reason === 'indoor_anomaly');
      expect(indoorFlags).toHaveLength(0);
    });

    it('flags at exactly the threshold (0.49 mi, 15 min)', () => {
      const result = scanOne({
        distanceMiles: 0.49,
        durationMinutes: 15,
        avgPaceSeconds: 540, // normal pace to avoid gps_glitch
        stravaIsTrainer: null,
      });
      const indoorFlags = result.flagged.filter(f => f.reason === 'indoor_anomaly');
      expect(indoorFlags).toHaveLength(1);
    });
  });

  // ── Severity levels ─────────────────────────────────────────────────
  describe('severity levels', () => {
    it('zero_distance has auto_exclude severity', () => {
      const flag = flagOne({ distanceMiles: null, durationMinutes: 30, avgPaceSeconds: null });
      expect(flag!.severity).toBe('auto_exclude');
    });

    it('micro has auto_exclude severity', () => {
      const flag = flagOne({ distanceMiles: 0.1, durationMinutes: 5, avgPaceSeconds: null });
      expect(flag!.severity).toBe('auto_exclude');
    });

    it('gps_glitch has review severity', () => {
      const flag = flagOne({ distanceMiles: 5.0, durationMinutes: 15, avgPaceSeconds: 180 });
      expect(flag!.severity).toBe('review');
    });

    it('suspicious_distance has review severity (dedup yields gps_glitch, also review)', () => {
      // pace 100 < 120 triggers suspicious_distance (review) AND pace < 210 triggers gps_glitch (review)
      // gps_glitch wins dedup but severity is the same: review
      const flag = flagOne({ distanceMiles: 5.0, durationMinutes: 9, avgPaceSeconds: 100 });
      expect(flag!.severity).toBe('review');
    });

    it('walk_tagged_run has review severity', () => {
      const flag = flagOne({
        distanceMiles: 2.0,
        durationMinutes: 34,
        avgPaceSeconds: 1020,
        workoutType: 'easy',
      });
      expect(flag!.severity).toBe('review');
    });

    it('duplicate has review severity', () => {
      const w1 = makeWorkout({ id: 10, profileId: 1, date: '2025-06-15', distanceMiles: 5.0, durationMinutes: 45 });
      const w2 = makeWorkout({ id: 20, profileId: 1, date: '2025-06-15', distanceMiles: 5.0, durationMinutes: 45 });
      const result = scanActivities([w1, w2]);
      const dupFlag = result.flagged.find(f => f.reason === 'duplicate');
      expect(dupFlag!.severity).toBe('review');
    });

    it('indoor_anomaly has info severity', () => {
      const flag = flagOne({
        distanceMiles: 0.4,
        durationMinutes: 30,
        avgPaceSeconds: 540, // normal pace to avoid gps_glitch outranking indoor_anomaly
        stravaIsTrainer: null,
      });
      expect(flag!.severity).toBe('info');
    });
  });

  // ── Deduplication ───────────────────────────────────────────────────
  describe('deduplication: multiple flags on the same workout', () => {
    it('keeps only the highest-severity flag per workout', () => {
      // An activity that triggers both zero_distance (auto_exclude) and indoor_anomaly (info)
      // zero_distance: duration > 0, distance = 0
      // indoor_anomaly: distance = 0, but isIndoorAnomaly returns false for distance == 0
      // Instead, use an activity that triggers micro (auto_exclude) and walk_tagged_run (review)
      // micro: distance < 0.3 mi
      // walk_tagged_run: pace >= 960 with walklike type and distance >= 0.3 mi
      // Those are mutually exclusive too. Let's try micro + gps_glitch:
      // micro: distance 0.2 mi, duration 1 min
      // gps_glitch slow: pace > 1200 and distance > 0.3 - won't trigger because distance < 0.3
      // gps_glitch fast: avgPaceSeconds < 210
      // But: micro requires distance < 0.3, and gps_glitch fast uses the pace.
      // Let's use: 0.2 mi in 1 min with avgPaceSeconds = 100 (super fast)
      // micro triggers (distance < 0.3), gps_glitch triggers (pace < 210), suspicious_distance (pace < 120) won't trigger because distance < 0.3
      const result = scanOne({
        distanceMiles: 0.2,
        durationMinutes: 1,
        avgPaceSeconds: 100, // triggers gps_glitch (< 210)
      });

      // Should only have 1 flag after deduplication
      expect(result.flaggedCount).toBe(1);
      // micro is auto_exclude (rank 3), gps_glitch is review (rank 2)
      // auto_exclude wins
      expect(result.flagged[0].severity).toBe('auto_exclude');
      expect(result.flagged[0].reason).toBe('micro');
    });

    it('counts severity buckets correctly after deduplication', () => {
      // Build a mix: one clean, one with multiple flags, one with single flag
      const clean = makeWorkout({ id: 100, distanceMiles: 5.0, durationMinutes: 45, avgPaceSeconds: 540 });
      const multiFlagged = makeWorkout({
        id: 101,
        distanceMiles: 0.2,
        durationMinutes: 1,
        avgPaceSeconds: 100,
      });
      const singleFlagged = makeWorkout({
        id: 102,
        distanceMiles: 0.4,
        durationMinutes: 30,
        avgPaceSeconds: 540, // normal pace; only triggers indoor_anomaly (info)
        stravaIsTrainer: null,
      });

      const result = scanActivities([clean, multiFlagged, singleFlagged]);
      expect(result.totalWorkouts).toBe(3);
      expect(result.flaggedCount).toBe(2);
      expect(result.autoExcludeCount).toBe(1); // multiFlagged -> micro (auto_exclude)
      expect(result.infoCount).toBe(1); // singleFlagged -> indoor_anomaly (info)
    });
  });

  // ── ScanResult summary counts ───────────────────────────────────────
  describe('ScanResult summary counts', () => {
    it('totalWorkouts counts all input workouts', () => {
      const workouts = [
        makeWorkout({ id: 1 }),
        makeWorkout({ id: 2 }),
        makeWorkout({ id: 3 }),
      ];
      const result = scanActivities(workouts);
      expect(result.totalWorkouts).toBe(3);
    });

    it('flaggedCount matches flagged array length', () => {
      const w1 = makeWorkout({ id: 10, distanceMiles: null, durationMinutes: 30, avgPaceSeconds: null });
      const w2 = makeWorkout({ id: 20, distanceMiles: 5.0, durationMinutes: 45, avgPaceSeconds: 540 });
      const result = scanActivities([w1, w2]);
      expect(result.flaggedCount).toBe(result.flagged.length);
    });

    it('severity counts add up to flaggedCount', () => {
      const w1 = makeWorkout({ id: 10, distanceMiles: null, durationMinutes: 30, avgPaceSeconds: null }); // auto_exclude (zero_distance)
      const w2 = makeWorkout({ id: 20, distanceMiles: 5.0, durationMinutes: 15, avgPaceSeconds: 180 }); // review (gps_glitch)
      const w3 = makeWorkout({ id: 30, distanceMiles: 0.4, durationMinutes: 30, avgPaceSeconds: 540, stravaIsTrainer: null }); // info (indoor_anomaly)

      const result = scanActivities([w1, w2, w3]);
      expect(result.autoExcludeCount + result.reviewCount + result.infoCount).toBe(result.flaggedCount);
    });
  });

  // ── Pace calculation ────────────────────────────────────────────────
  describe('pace calculation', () => {
    it('prefers stored avgPaceSeconds over calculated pace', () => {
      // Stored pace is fast enough to trigger gps_glitch, but calculated would be normal
      const flag = flagOne({
        distanceMiles: 5.0,
        durationMinutes: 45,
        avgPaceSeconds: 180, // stored 3:00/mi -> gps_glitch
      });
      expect(flag).toBeDefined();
      expect(flag!.reason).toBe('gps_glitch');
    });

    it('calculates pace from distance and duration when avgPaceSeconds is null', () => {
      // 5 miles in 5 minutes -> calculated pace = (5 * 60) / 5 = 60 sec/mi
      // This triggers both gps_glitch (< 210) and suspicious_distance (< 120).
      // gps_glitch wins dedup since both are review severity and it's checked first.
      const flag = flagOne({
        distanceMiles: 5.0,
        durationMinutes: 5,
        avgPaceSeconds: null,
      });
      expect(flag).toBeDefined();
      expect(flag!.reason).toBe('gps_glitch');
    });

    it('returns null pace when both avgPaceSeconds and distance/duration are missing', () => {
      const result = scanOne({
        distanceMiles: null,
        durationMinutes: null,
        avgPaceSeconds: null,
      });
      // No pace-dependent flags should fire (gps_glitch, walk_tagged_run, suspicious_distance)
      const paceFlags = result.flagged.filter(
        f => f.reason === 'gps_glitch' || f.reason === 'walk_tagged_run' || f.reason === 'suspicious_distance'
      );
      expect(paceFlags).toHaveLength(0);
    });
  });

  // ── FlaggedActivity shape ───────────────────────────────────────────
  describe('FlaggedActivity shape', () => {
    it('includes all required fields', () => {
      const flag = flagOne({
        id: 42,
        distanceMiles: null,
        durationMinutes: 30,
        avgPaceSeconds: null,
        stravaName: 'Morning Run',
        date: '2025-06-15',
      });
      expect(flag).toBeDefined();
      expect(flag!.workoutId).toBe(42);
      expect(flag!.date).toBe('2025-06-15');
      expect(flag!.name).toBe('Morning Run');
      expect(flag!.distanceMiles).toBeNull();
      expect(flag!.durationMinutes).toBe(30);
      expect(flag!.paceSeconds).toBeNull();
      expect(flag!.reason).toBe('zero_distance');
      expect(flag!.severity).toBe('auto_exclude');
      expect(typeof flag!.recommendation).toBe('string');
      expect(flag!.recommendation.length).toBeGreaterThan(0);
    });

    it('uses routeName as name when stravaName is not set', () => {
      const flag = flagOne({
        distanceMiles: null,
        durationMinutes: 30,
        avgPaceSeconds: null,
        stravaName: null,
        routeName: 'Park Loop',
      });
      expect(flag!.name).toBe('Park Loop');
    });

    it('name is null when neither stravaName nor routeName is set', () => {
      const flag = flagOne({
        distanceMiles: null,
        durationMinutes: 30,
        avgPaceSeconds: null,
        stravaName: null,
        routeName: null,
      });
      expect(flag!.name).toBeNull();
    });

    it('prefers stravaName over routeName', () => {
      const flag = flagOne({
        distanceMiles: null,
        durationMinutes: 30,
        avgPaceSeconds: null,
        stravaName: 'Strava Title',
        routeName: 'Route Title',
      });
      expect(flag!.name).toBe('Strava Title');
    });
  });

  // ── Multiple workouts integration ───────────────────────────────────
  describe('scanning multiple workouts together', () => {
    it('correctly identifies a mix of clean and problematic workouts', () => {
      const workouts = [
        makeWorkout({ id: 1, distanceMiles: 6.0, durationMinutes: 50, avgPaceSeconds: 500 }),    // clean
        makeWorkout({ id: 2, distanceMiles: null, durationMinutes: 30, avgPaceSeconds: null }),    // zero_distance
        makeWorkout({ id: 3, distanceMiles: 0.1, durationMinutes: 3, avgPaceSeconds: null }),      // micro
        makeWorkout({ id: 4, distanceMiles: 10.0, durationMinutes: 10, avgPaceSeconds: 60 }),      // suspicious_distance
        makeWorkout({ id: 5, distanceMiles: 3.0, durationMinutes: 45, avgPaceSeconds: 540 }),      // clean
      ];

      const result = scanActivities(workouts);
      expect(result.totalWorkouts).toBe(5);
      expect(result.flaggedCount).toBe(3); // ids 2, 3, 4
      expect(result.flagged.map(f => f.workoutId).sort()).toEqual([2, 3, 4]);
    });

    it('handles a large batch without issues', () => {
      // Each workout gets a unique date to avoid duplicate detection.
      // Spread across 500 unique days (2024-06-19 through 2025-11-01).
      const startDate = new Date('2024-06-19');
      const workouts = Array.from({ length: 500 }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().slice(0, 10);
        return makeWorkout({
          id: i + 1,
          date: dateStr,
          distanceMiles: 5.0 + (i % 3),
          durationMinutes: 40 + (i % 10),
          avgPaceSeconds: 480 + (i % 60),
        });
      });

      const result = scanActivities(workouts);
      expect(result.totalWorkouts).toBe(500);
      // All are normal runs with unique dates, none should be flagged
      expect(result.flaggedCount).toBe(0);
    });
  });
});
