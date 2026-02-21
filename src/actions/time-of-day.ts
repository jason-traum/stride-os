'use server';

import { db } from '@/lib/db';
import { workouts, workoutSegments } from '@/lib/schema';
import { eq, gte, and, isNotNull, inArray } from 'drizzle-orm';
import { createProfileAction } from '@/lib/action-utils';

// ============================================================
// Types
// ============================================================

export type TimeBucket =
  | 'Early Morning'
  | 'Morning'
  | 'Mid-Morning'
  | 'Midday'
  | 'Afternoon'
  | 'Evening'
  | 'Night';

export interface TimeBucketStats {
  bucket: TimeBucket;
  hourRange: string; // "5am-7am"
  count: number;
  avgPaceSeconds: number | null;
  avgHr: number | null;
  avgFatigueResistance: number | null; // from segments, if available
  mostCommonType: string;
  /** Breakdown of workout type counts within this bucket */
  typeCounts: Record<string, number>;
}

export interface TypeTimeDistribution {
  workoutType: string;
  totalCount: number;
  /** Percentage of this type in each bucket */
  bucketPcts: Record<TimeBucket, number>;
  /** The dominant bucket for this type */
  dominantBucket: TimeBucket;
  dominantPct: number;
}

export interface TimeOfDayResult {
  buckets: TimeBucketStats[];
  typeDistributions: TypeTimeDistribution[];
  peakBucket: TimeBucket | null; // best performance by avg pace
  peakAvgPace: number | null;
  totalAnalyzed: number;
}

// ============================================================
// Constants
// ============================================================

const BUCKET_DEFINITIONS: { bucket: TimeBucket; hourRange: string; minHour: number; maxHour: number }[] = [
  { bucket: 'Early Morning', hourRange: '5am-7am', minHour: 5, maxHour: 7 },
  { bucket: 'Morning', hourRange: '7am-9am', minHour: 7, maxHour: 9 },
  { bucket: 'Mid-Morning', hourRange: '9am-11am', minHour: 9, maxHour: 11 },
  { bucket: 'Midday', hourRange: '11am-1pm', minHour: 11, maxHour: 13 },
  { bucket: 'Afternoon', hourRange: '1pm-4pm', minHour: 13, maxHour: 16 },
  { bucket: 'Evening', hourRange: '4pm-7pm', minHour: 16, maxHour: 19 },
  { bucket: 'Night', hourRange: '7pm-10pm', minHour: 19, maxHour: 22 },
];

const NON_RUNNING_TYPES = ['cross_train', 'other'];

// ============================================================
// Helpers
// ============================================================

function getTimeBucket(timeStr: string): TimeBucket | null {
  // timeStr is "HH:MM"
  const hour = parseInt(timeStr.split(':')[0], 10);
  if (isNaN(hour)) return null;

  for (const def of BUCKET_DEFINITIONS) {
    if (hour >= def.minHour && hour < def.maxHour) return def.bucket;
  }
  // Outside 5am-10pm range — skip
  return null;
}

function mostCommon(counts: Record<string, number>): string {
  let maxType = '';
  let maxCount = 0;
  for (const [type, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxType = type;
    }
  }
  return maxType || 'easy';
}

// ============================================================
// Server action
// ============================================================

export const getTimeOfDayData = createProfileAction(
  async (profileId: number, days: number = 365): Promise<TimeOfDayResult> => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get workouts that have startTimeLocal populated
    type WorkoutRow = typeof workouts.$inferSelect;
    const allWorkouts: WorkoutRow[] = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          gte(workouts.date, startDateStr),
          isNotNull(workouts.startTimeLocal),
        )
      );

    // Filter to running workouts
    const runWorkouts = allWorkouts.filter(
      (w: WorkoutRow) => w.distanceMiles && w.distanceMiles > 0 && !NON_RUNNING_TYPES.includes(w.workoutType)
    );

    if (runWorkouts.length === 0) {
      return {
        buckets: [],
        typeDistributions: [],
        peakBucket: null,
        peakAvgPace: null,
        totalAnalyzed: 0,
      };
    }

    // Try to get fatigue resistance data from segments for these workouts
    const workoutIds = runWorkouts.map((w: WorkoutRow) => w.id);
    type SegmentRow = typeof workoutSegments.$inferSelect;
    const segmentsByWorkout = new Map<number, SegmentRow[]>();

    try {
      const allSegments = await db
        .select()
        .from(workoutSegments)
        .where(inArray(workoutSegments.workoutId, workoutIds));

      allSegments.forEach((seg: SegmentRow) => {
        const list = segmentsByWorkout.get(seg.workoutId) || [];
        list.push(seg);
        segmentsByWorkout.set(seg.workoutId, list);
      });
    } catch {
      // Non-critical — fatigue resistance will just be null
    }

    // Calculate fatigue resistance per workout (last 25% pace / first 75% pace)
    function calcFatigueResistance(workoutId: number): number | null {
      const segments = segmentsByWorkout.get(workoutId);
      if (!segments || segments.length < 4) return null;

      const sorted = [...segments].sort((a, b) => a.segmentNumber - b.segmentNumber);
      const withPace = sorted.filter(s =>
        s.distanceMiles && s.distanceMiles > 0 &&
        (s.paceSecondsPerMile && s.paceSecondsPerMile > 0 || s.durationSeconds && s.durationSeconds > 0)
      );
      if (withPace.length < 4) return null;

      const splitIdx = Math.floor(withPace.length * 0.75);
      const first75 = withPace.slice(0, splitIdx);
      const last25 = withPace.slice(splitIdx);

      const avgPace = (segs: typeof withPace) => {
        let totalDist = 0, totalTime = 0;
        for (const s of segs) {
          const d = s.distanceMiles || 0;
          const p = s.paceSecondsPerMile || (s.durationSeconds ? s.durationSeconds / (s.distanceMiles || 1) : 0);
          totalDist += d;
          totalTime += p * d;
        }
        return totalDist > 0 ? totalTime / totalDist : 0;
      };

      const firstPace = avgPace(first75);
      const lastPace = avgPace(last25);
      if (lastPace <= 0) return null;

      return (firstPace / lastPace) * 100;
    }

    // ---- Group workouts into time buckets ----
    type BucketAccum = {
      count: number;
      totalPace: number;
      paceCount: number;
      totalHr: number;
      hrCount: number;
      fatigueSum: number;
      fatigueCount: number;
      typeCounts: Record<string, number>;
    };

    const bucketMap = new Map<TimeBucket, BucketAccum>();
    for (const def of BUCKET_DEFINITIONS) {
      bucketMap.set(def.bucket, {
        count: 0,
        totalPace: 0,
        paceCount: 0,
        totalHr: 0,
        hrCount: 0,
        fatigueSum: 0,
        fatigueCount: 0,
        typeCounts: {},
      });
    }

    // Also track per-type bucket counts for distribution
    const typeGlobal = new Map<string, { total: number; bucketCounts: Record<TimeBucket, number> }>();

    let totalAnalyzed = 0;

    for (const w of runWorkouts) {
      const bucket = getTimeBucket(w.startTimeLocal!);
      if (!bucket) continue;

      totalAnalyzed++;
      const accum = bucketMap.get(bucket)!;
      accum.count++;

      if (w.avgPaceSeconds && w.avgPaceSeconds > 0 && w.avgPaceSeconds < 1800) {
        accum.totalPace += w.avgPaceSeconds;
        accum.paceCount++;
      }

      const hr = w.avgHr || w.avgHeartRate;
      if (hr && hr > 0) {
        accum.totalHr += hr;
        accum.hrCount++;
      }

      const fr = calcFatigueResistance(w.id);
      if (fr !== null) {
        accum.fatigueSum += fr;
        accum.fatigueCount++;
      }

      accum.typeCounts[w.workoutType] = (accum.typeCounts[w.workoutType] || 0) + 1;

      // Track type distributions
      if (!typeGlobal.has(w.workoutType)) {
        const emptyBuckets: Record<TimeBucket, number> = {} as Record<TimeBucket, number>;
        for (const def of BUCKET_DEFINITIONS) emptyBuckets[def.bucket] = 0;
        typeGlobal.set(w.workoutType, { total: 0, bucketCounts: emptyBuckets });
      }
      const tg = typeGlobal.get(w.workoutType)!;
      tg.total++;
      tg.bucketCounts[bucket]++;
    }

    // ---- Build bucket stats ----
    const buckets: TimeBucketStats[] = BUCKET_DEFINITIONS.map(def => {
      const accum = bucketMap.get(def.bucket)!;
      return {
        bucket: def.bucket,
        hourRange: def.hourRange,
        count: accum.count,
        avgPaceSeconds: accum.paceCount > 0 ? Math.round(accum.totalPace / accum.paceCount) : null,
        avgHr: accum.hrCount > 0 ? Math.round(accum.totalHr / accum.hrCount) : null,
        avgFatigueResistance: accum.fatigueCount > 0
          ? Math.round((accum.fatigueSum / accum.fatigueCount) * 10) / 10
          : null,
        mostCommonType: mostCommon(accum.typeCounts),
        typeCounts: accum.typeCounts,
      };
    });

    // ---- Peak performance bucket (lowest avg pace among buckets with 3+ runs) ----
    const qualifyingBuckets = buckets.filter(b => b.count >= 3 && b.avgPaceSeconds !== null);
    let peakBucket: TimeBucket | null = null;
    let peakAvgPace: number | null = null;

    if (qualifyingBuckets.length > 0) {
      const best = qualifyingBuckets.reduce((a, b) =>
        (a.avgPaceSeconds ?? Infinity) < (b.avgPaceSeconds ?? Infinity) ? a : b
      );
      peakBucket = best.bucket;
      peakAvgPace = best.avgPaceSeconds;
    }

    // ---- Per-type time distributions ----
    const typeDistributions: TypeTimeDistribution[] = Array.from(typeGlobal.entries())
      .filter(([, data]) => data.total >= 2)
      .map(([workoutType, data]) => {
        const bucketPcts: Record<TimeBucket, number> = {} as Record<TimeBucket, number>;
        let dominantBucket: TimeBucket = 'Morning';
        let dominantPct = 0;

        for (const def of BUCKET_DEFINITIONS) {
          const pct = data.total > 0 ? Math.round((data.bucketCounts[def.bucket] / data.total) * 100) : 0;
          bucketPcts[def.bucket] = pct;
          if (pct > dominantPct) {
            dominantPct = pct;
            dominantBucket = def.bucket;
          }
        }

        return {
          workoutType,
          totalCount: data.total,
          bucketPcts,
          dominantBucket,
          dominantPct,
        };
      })
      .sort((a, b) => b.totalCount - a.totalCount);

    return {
      buckets,
      typeDistributions,
      peakBucket,
      peakAvgPace,
      totalAnalyzed,
    };
  },
  'getTimeOfDayData'
);
