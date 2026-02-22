'use server';

import { db, workouts, workoutSegments, plannedWorkouts, userSettings, Workout } from '@/lib/db';
import { desc, gte, eq, inArray, and, or, isNull } from 'drizzle-orm';
import { parseLocalDate, toLocalDateString } from '@/lib/utils';
import { classifySplitEfforts } from '@/lib/training/effort-classifier';
import { computeConditionAdjustment } from '@/lib/training/run-classifier';
import { getActiveProfileId } from '@/lib/profile-server';

// Condition: exclude workouts flagged for exclusion
function notExcluded() {
  return and(
    or(eq(workouts.excludeFromEstimates, false), isNull(workouts.excludeFromEstimates)),
    or(eq(workouts.autoExcluded, false), isNull(workouts.autoExcluded))
  );
}

// Base weekly stats for analytics charts
export interface WeeklyStatsBase {
  weekStart: string;
  totalMiles: number;
  totalMinutes: number;
  workoutCount: number;
}

// Extended weekly stats for Today page card
export interface WeeklyStats {
  weekStart: string;
  totalMiles: number;
  totalMinutes: number;
  workoutCount: number;
  runCount: number;
  avgPace: number | null;
  avgRpe: number | null;
  longestRun: number;
  weekOverWeekMileageChange: number | null;
}

export interface WorkoutTypeDistribution {
  type: string;
  count: number;
  miles: number;
  minutes: number;
}

export interface AnalyticsData {
  // Summary stats
  totalWorkouts: number;
  totalMiles: number;
  totalMinutes: number;
  avgPaceSeconds: number | null;

  // Weekly breakdown (last 12 weeks)
  weeklyStats: WeeklyStatsBase[];

  // Workout type distribution
  workoutTypeDistribution: WorkoutTypeDistribution[];

  // Recent workouts for pace trend
  recentPaces: Array<{
    date: string;
    paceSeconds: number;
    workoutType: string;
    fastestSplitSeconds?: number; // Fastest segment pace (any distance)
    goalPaceSeconds?: number; // Target pace from planned workout or zones
    goalSource?: string; // Where goal came from: 'planned', 'easy_zone', 'tempo_zone', etc.
  }>;
}

export async function getAnalyticsData(profileId?: number): Promise<AnalyticsData> {
  const resolvedProfileId = profileId ?? await getActiveProfileId();

  // Use 90 days for summary stats (fast), 365 days only for pace trend
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const cutoffDate = toLocalDateString(ninetyDaysAgo);

  const yearAgo = new Date();
  yearAgo.setDate(yearAgo.getDate() - 365);
  const paceCutoffDate = toLocalDateString(yearAgo);

  const whereConditions = resolvedProfileId
    ? and(gte(workouts.date, cutoffDate), eq(workouts.profileId, resolvedProfileId), notExcluded())
    : and(gte(workouts.date, cutoffDate), notExcluded());

  const recentWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(whereConditions)
    .orderBy(desc(workouts.date));

  // Calculate summary stats
  const totalWorkouts = recentWorkouts.length;
  const totalMiles = recentWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const totalMinutes = recentWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);

  // Calculate average pace from workouts with pace data
  const workoutsWithPace = recentWorkouts.filter(w => w.avgPaceSeconds);
  const avgPaceSeconds = workoutsWithPace.length > 0
    ? Math.round(workoutsWithPace.reduce((sum, w) => sum + w.avgPaceSeconds!, 0) / workoutsWithPace.length)
    : null;

  // Calculate weekly stats
  const weeklyMap = new Map<string, WeeklyStatsBase>();

  for (const workout of recentWorkouts) {
    const date = parseLocalDate(workout.date);
    // Get Monday of the week
    const dayOfWeek = date.getDay();
    const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);
    const weekStart = toLocalDateString(monday);

    const existing = weeklyMap.get(weekStart) || {
      weekStart,
      totalMiles: 0,
      totalMinutes: 0,
      workoutCount: 0,
    };

    existing.totalMiles += workout.distanceMiles || 0;
    existing.totalMinutes += workout.durationMinutes || 0;
    existing.workoutCount += 1;

    weeklyMap.set(weekStart, existing);
  }

  // Sort by week and take last 12 weeks
  const weeklyStats = Array.from(weeklyMap.values())
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .slice(-12);

  // Calculate effort distribution by segment (not by run-level type)
  // Fetch all segments for recent workouts to classify actual effort per mile
  const workoutIds = recentWorkouts.map(w => w.id);
  const allSegments = workoutIds.length > 0
    ? await db.query.workoutSegments.findMany({
        where: inArray(workoutSegments.workoutId, workoutIds),
      })
    : [];

  // Group segments by workout
  const segmentsByWorkout = new Map<number, typeof allSegments>();
  for (const seg of allSegments) {
    if (!segmentsByWorkout.has(seg.workoutId)) {
      segmentsByWorkout.set(seg.workoutId, []);
    }
    segmentsByWorkout.get(seg.workoutId)!.push(seg);
  }

  // Fetch user's pace settings for accurate zone classification
  const settingsWhere = profileId
    ? eq(userSettings.profileId, profileId)
    : undefined;
  const [settings] = settingsWhere
    ? await db.select().from(userSettings).where(settingsWhere).limit(1)
    : await db.select().from(userSettings).limit(1);

  const classifyOptions = {
    vdot: settings?.vdot ?? undefined,
    easyPace: settings?.easyPaceSeconds ?? undefined,
    marathonPace: settings?.marathonPaceSeconds ?? undefined,
    tempoPace: settings?.tempoPaceSeconds ?? undefined,
    thresholdPace: settings?.thresholdPaceSeconds ?? undefined,
  };

  // Classify each segment's effort and aggregate
  // Always reclassify from segments to use current zone boundaries
  const typeMap = new Map<string, { count: number; miles: number; minutes: number }>();

  for (const workout of recentWorkouts) {
    const segs = segmentsByWorkout.get(workout.id);

    if (segs && segs.length >= 2) {
      // Has segments — classify each one by actual effort using user's pace zones
      const sorted = [...segs].sort((a, b) => a.segmentNumber - b.segmentNumber);
      const laps = sorted.map(seg => ({
        lapNumber: seg.segmentNumber,
        distanceMiles: seg.distanceMiles || 1,
        durationSeconds: seg.durationSeconds || ((seg.paceSecondsPerMile || 480) * (seg.distanceMiles || 1)),
        avgPaceSeconds: seg.paceSecondsPerMile || 480,
        avgHeartRate: seg.avgHr,
        maxHeartRate: seg.maxHr,
        elevationGainFeet: seg.elevationGainFt,
        lapType: seg.segmentType || 'steady',
      }));

      const classified = classifySplitEfforts(laps, {
        workoutType: workout.workoutType || 'easy',
        avgPaceSeconds: workout.avgPaceSeconds,
        conditionAdjustment: computeConditionAdjustment(workout),
        ...classifyOptions,
      });

      for (let i = 0; i < classified.length; i++) {
        const cat = classified[i].category;
        // Normalize warmup/cooldown → easy, anomaly → other
        const type = (cat === 'warmup' || cat === 'cooldown') ? 'easy'
          : cat === 'anomaly' ? 'other'
          : cat;
        const segMiles = sorted[i].distanceMiles || 1;
        const segMinutes = (sorted[i].durationSeconds || 0) / 60;
        const existing = typeMap.get(type) || { count: 0, miles: 0, minutes: 0 };
        existing.count += 1; // count = number of segments
        existing.miles += segMiles;
        existing.minutes += segMinutes;
        typeMap.set(type, existing);
      }
    } else {
      // No segments — fall back to run-level type
      const type = workout.workoutType || 'other';
      const existing = typeMap.get(type) || { count: 0, miles: 0, minutes: 0 };
      existing.count += 1;
      existing.miles += workout.distanceMiles || 0;
      existing.minutes += workout.durationMinutes || 0;
      typeMap.set(type, existing);
    }
  }

  const workoutTypeDistribution = Array.from(typeMap.entries())
    .map(([type, data]) => ({
      type,
      count: data.count,
      miles: Math.round(data.miles * 10) / 10,
      minutes: Math.round(data.minutes),
    }))
    .sort((a, b) => {
      const order: Record<string, number> = {
        recovery: 0, easy: 1, long: 2, steady: 3, marathon: 4,
        tempo: 5, threshold: 6, interval: 7, repetition: 8,
        race: 9, cross_train: 10, other: 11,
      };
      return (order[a.type] ?? 99) - (order[b.type] ?? 99);
    });

  // Get recent paces for trend chart (use full year of data for longer trend view)
  const paceWhereConditions = profileId
    ? and(gte(workouts.date, paceCutoffDate), eq(workouts.profileId, profileId), notExcluded())
    : and(gte(workouts.date, paceCutoffDate), notExcluded());

  const paceWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(paceWhereConditions)
    .orderBy(desc(workouts.date));

  const workoutsForPaces = paceWorkouts
    .filter(w => w.avgPaceSeconds);

  const paceWorkoutIds = workoutsForPaces.map(w => w.id);

  // Fetch ALL segments for these workouts (any distance - pace is already normalized)
  const fastestSplitMap = new Map<number, number>();

  if (paceWorkoutIds.length > 0) {
    const paceSegments = await db.query.workoutSegments.findMany({
      where: inArray(workoutSegments.workoutId, paceWorkoutIds),
    });

    // Group segments by workout for analysis
    const paceSegmentsByWorkout = new Map<number, typeof paceSegments>();
    for (const seg of paceSegments) {
      if (!paceSegmentsByWorkout.has(seg.workoutId)) {
        paceSegmentsByWorkout.set(seg.workoutId, []);
      }
      paceSegmentsByWorkout.get(seg.workoutId)!.push(seg);
    }

    // For each workout, find the fastest work segment using smart classification
    for (const [workoutId, segs] of paceSegmentsByWorkout) {
      const validPaces = segs
        .map(s => s.paceSecondsPerMile)
        .filter((p): p is number => !!p && p > 180 && p < 600);

      if (validPaces.length === 0) continue;

      // Check if segments are already classified
      const hasWorkSegments = segs.some(s => s.segmentType === 'work');

      if (hasWorkSegments) {
        // Use existing classification
        const workPaces = segs
          .filter(s => s.segmentType === 'work')
          .map(s => s.paceSecondsPerMile)
          .filter((p): p is number => !!p && p > 180 && p < 600);

        if (workPaces.length > 0) {
          fastestSplitMap.set(workoutId, Math.min(...workPaces));
        }
      } else {
        // Smart classification: use Winsorized approach to find work intervals
        // Exclude recovery segments (much slower than median)
        const sortedPaces = [...validPaces].sort((a, b) => a - b);
        const medianPace = sortedPaces[Math.floor(sortedPaces.length / 2)];

        // Recovery threshold: > 45 seconds slower than median is likely rest
        const recoveryThreshold = medianPace + 45;

        // Filter out likely recovery/rest intervals
        const workPaces = validPaces.filter(p => p < recoveryThreshold);

        if (workPaces.length > 0) {
          // For interval workouts, look for the fast repeats
          // Use 25th percentile to get representative "work" pace (not just one fluke)
          const fastPaces = [...workPaces].sort((a, b) => a - b);
          const fastIdx = Math.min(Math.floor(fastPaces.length * 0.25), fastPaces.length - 1);
          fastestSplitMap.set(workoutId, fastPaces[fastIdx]);
        } else {
          // Fall back to fastest overall
          fastestSplitMap.set(workoutId, Math.min(...validPaces));
        }
      }
    }
  }

  // Fetch goal paces from linked planned workouts
  const goalPaceMap = new Map<number, { pace: number; source: string }>();
  const plannedWorkoutIds = workoutsForPaces
    .filter(w => w.plannedWorkoutId)
    .map(w => w.plannedWorkoutId as number);

  if (plannedWorkoutIds.length > 0) {
    const planned = await db.query.plannedWorkouts.findMany({
      where: inArray(plannedWorkouts.id, plannedWorkoutIds),
    });

    // Map planned workout ID to workout ID
    const plannedToWorkout = new Map<number, number>();
    for (const w of workoutsForPaces) {
      if (w.plannedWorkoutId) {
        plannedToWorkout.set(w.plannedWorkoutId, w.id);
      }
    }

    for (const p of planned) {
      const workoutId = plannedToWorkout.get(p.id);
      if (workoutId && p.targetPaceSecondsPerMile) {
        goalPaceMap.set(workoutId, {
          pace: p.targetPaceSecondsPerMile,
          source: 'planned'
        });
      }
    }
  }

  const recentPaces = workoutsForPaces
    .map(w => {
      const goalData = goalPaceMap.get(w.id);
      return {
        date: w.date,
        paceSeconds: w.avgPaceSeconds!,
        workoutType: w.workoutType || 'other',
        fastestSplitSeconds: fastestSplitMap.get(w.id),
        goalPaceSeconds: goalData?.pace,
        goalSource: goalData?.source,
      };
    })
    .reverse();

  return {
    totalWorkouts,
    totalMiles: Math.round(totalMiles),
    totalMinutes: Math.round(totalMinutes),
    avgPaceSeconds,
    weeklyStats,
    workoutTypeDistribution,
    recentPaces,
  };
}
