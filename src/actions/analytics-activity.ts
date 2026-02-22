'use server';

import { db, workouts, workoutSegments, userSettings, Workout } from '@/lib/db';
import { desc, gte, eq, inArray, and, or, isNull } from 'drizzle-orm';
import { toLocalDateString } from '@/lib/utils';
import { classifySplitEfforts } from '@/lib/training/effort-classifier';
import { computeConditionAdjustment } from '@/lib/training/run-classifier';

function notExcluded() {
  return and(
    or(eq(workouts.excludeFromEstimates, false), isNull(workouts.excludeFromEstimates)),
    or(eq(workouts.autoExcluded, false), isNull(workouts.autoExcluded))
  );
}
import type { WorkoutTypeDistribution } from './analytics-core';

/**
 * Extended daily activity data for heatmap with color system
 */
export interface DailyActivityData {
  date: string;
  miles: number;
  workoutType?: string;
  avgPaceSeconds?: number;
  avgHr?: number;
  durationMinutes?: number;
  trimp?: number;
  rpe?: number;
  workoutId?: number;
  workoutCount?: number;
}

/**
 * Estimate TRIMP when no stored value exists.
 * Uses HR if available (Banister formula), otherwise pace-based intensity.
 */
function estimateTrimp(
  durationMinutes: number,
  avgPaceSeconds?: number | null,
  avgHr?: number | null,
  workoutType?: string | null,
): number {
  if (avgHr && avgHr > 0) {
    // Simplified Banister TRIMP with assumed resting HR 60, max HR 190
    const restingHr = 60;
    const maxHr = 190;
    const hrFraction = Math.max(0, Math.min(1, (avgHr - restingHr) / (maxHr - restingHr)));
    const yFactor = hrFraction * 1.92 * Math.exp(1.92 * hrFraction);
    return Math.round(durationMinutes * yFactor);
  }

  // Pace-based intensity factor
  const pace = avgPaceSeconds || 600;
  let intensityFactor = pace < 360 ? 2.5 :
                        pace < 420 ? 2.0 :
                        pace < 480 ? 1.6 :
                        pace < 540 ? 1.3 :
                        pace < 600 ? 1.1 :
                        1.0;

  // Boost for known hard workout types
  if (workoutType) {
    const type = workoutType.toLowerCase();
    if (type === 'race') intensityFactor *= 1.3;
    else if (type === 'interval' || type === 'speed') intensityFactor *= 1.15;
    else if (type === 'tempo' || type === 'threshold') intensityFactor *= 1.1;
  }

  return Math.round(durationMinutes * intensityFactor);
}

/**
 * Get daily activity data for heatmap
 */
export async function getDailyActivityData(months: number = 12, profileId?: number): Promise<DailyActivityData[]> {
  // Get workouts from the last N months
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  const cutoffDateStr = toLocalDateString(startDate);

  const whereConditions = profileId
    ? and(gte(workouts.date, cutoffDateStr), eq(workouts.profileId, profileId), notExcluded())
    : and(gte(workouts.date, cutoffDateStr), notExcluded());

  const recentWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(whereConditions)
    .orderBy(desc(workouts.date));

  // Group by date, aggregating workout data
  // For days with multiple workouts, we'll sum miles/duration and average pace/HR
  const dailyMap = new Map<string, {
    miles: number;
    durationMinutes: number;
    totalPaceWeighted: number;
    totalHrWeighted: number;
    trimp: number;
    rpe: number | null;
    workoutTypes: string[];
    workoutIds: number[];
    count: number;
  }>();

  for (const workout of recentWorkouts) {
    const miles = workout.distanceMiles || 0;
    const duration = workout.durationMinutes || 0;
    const existing = dailyMap.get(workout.date) || {
      miles: 0,
      durationMinutes: 0,
      totalPaceWeighted: 0,
      totalHrWeighted: 0,
      trimp: 0,
      rpe: null,
      workoutTypes: [],
      workoutIds: [],
      count: 0,
    };

    existing.miles += miles;
    existing.durationMinutes += duration;
    existing.workoutIds.push(workout.id);
    if (workout.avgPaceSeconds && miles > 0) {
      existing.totalPaceWeighted += workout.avgPaceSeconds * miles;
    }
    if (workout.avgHr && miles > 0) {
      existing.totalHrWeighted += workout.avgHr * miles;
    }
    // Use stored TRIMP, or estimate from available data
    if (workout.trimp) {
      existing.trimp += workout.trimp;
    } else if (duration > 0) {
      existing.trimp += estimateTrimp(duration, workout.avgPaceSeconds, workout.avgHr || workout.avgHeartRate, workout.workoutType);
    }
    // RPE lives on the assessments table, not workouts — skip here
    if (workout.workoutType) {
      existing.workoutTypes.push(workout.workoutType);
    }
    existing.count++;

    dailyMap.set(workout.date, existing);
  }

  // Convert to array with computed averages
  return Array.from(dailyMap.entries())
    .map(([date, data]) => {
      // Determine dominant workout type for the day
      // Priority: race > interval/tempo/threshold > long > easy
      const typeOrder = ['race', 'interval', 'tempo', 'threshold', 'long', 'steady', 'easy', 'recovery'];
      let dominantType = data.workoutTypes[0] || undefined;
      for (const type of typeOrder) {
        if (data.workoutTypes.some(t => t?.toLowerCase().includes(type))) {
          dominantType = type;
          break;
        }
      }

      return {
        date,
        miles: Math.round(data.miles * 10) / 10,
        workoutType: dominantType,
        avgPaceSeconds: data.totalPaceWeighted > 0 && data.miles > 0
          ? Math.round(data.totalPaceWeighted / data.miles)
          : undefined,
        avgHr: data.totalHrWeighted > 0 && data.miles > 0
          ? Math.round(data.totalHrWeighted / data.miles)
          : undefined,
        durationMinutes: Math.round(data.durationMinutes),
        trimp: data.trimp > 0 ? Math.round(data.trimp) : undefined,
        rpe: data.rpe ?? undefined,
        workoutId: data.workoutIds[0],
        workoutCount: data.count,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calendar data for monthly calendar view
 */
export interface CalendarWorkoutDay {
  date: string;
  miles: number;
  workoutType: string;
  workoutId?: number;
}

/**
 * Get workout data for calendar view (last 12 months)
 */
export async function getCalendarData(profileId?: number): Promise<CalendarWorkoutDay[]> {
  // Get workouts from the last 12 months
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 12);
  const cutoffDateStr = toLocalDateString(startDate);

  const whereConditions = profileId
    ? and(gte(workouts.date, cutoffDateStr), eq(workouts.profileId, profileId))
    : gte(workouts.date, cutoffDateStr);

  const recentWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(whereConditions)
    .orderBy(desc(workouts.date));

  return recentWorkouts.map(w => ({
    date: w.date,
    miles: Math.round((w.distanceMiles || 0) * 10) / 10,
    workoutType: w.workoutType || 'other',
    workoutId: w.id,
  }));
}

/**
 * Training focus (workout type distribution) for a configurable time range.
 * Uses segment-level classification for accurate effort distribution.
 */
export async function getTrainingFocusData(
  days: number,
  profileId?: number
): Promise<{ distribution: WorkoutTypeDistribution[]; totalMiles: number; totalMinutes: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoff = toLocalDateString(cutoffDate);

  const whereConditions = profileId
    ? and(gte(workouts.date, cutoff), eq(workouts.profileId, profileId), notExcluded())
    : and(gte(workouts.date, cutoff), notExcluded());

  const recentWorkouts: Workout[] = await db
    .select()
    .from(workouts)
    .where(whereConditions)
    .orderBy(desc(workouts.date));

  const totalMiles = recentWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const totalMinutes = recentWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0);

  // Fetch segments for classification
  const workoutIds = recentWorkouts.map(w => w.id);
  const allSegments = workoutIds.length > 0
    ? await db.query.workoutSegments.findMany({
        where: inArray(workoutSegments.workoutId, workoutIds),
      })
    : [];

  const segmentsByWorkout = new Map<number, typeof allSegments>();
  for (const seg of allSegments) {
    if (!segmentsByWorkout.has(seg.workoutId)) {
      segmentsByWorkout.set(seg.workoutId, []);
    }
    segmentsByWorkout.get(seg.workoutId)!.push(seg);
  }

  // Fetch user settings for zone classification
  const settingsWhere = profileId ? eq(userSettings.profileId, profileId) : undefined;
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

  const typeMap = new Map<string, { count: number; miles: number; minutes: number }>();

  for (const workout of recentWorkouts) {
    const segs = segmentsByWorkout.get(workout.id);

    if (segs && segs.length >= 2) {
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
        const type = (cat === 'warmup' || cat === 'cooldown') ? 'easy'
          : cat === 'anomaly' ? 'other'
          : cat;
        const segMiles = sorted[i].distanceMiles || 1;
        const segMinutes = (sorted[i].durationSeconds || 0) / 60;
        const existing = typeMap.get(type) || { count: 0, miles: 0, minutes: 0 };
        existing.count += 1;
        existing.miles += segMiles;
        existing.minutes += segMinutes;
        typeMap.set(type, existing);
      }
    } else {
      const type = workout.workoutType || 'other';
      const existing = typeMap.get(type) || { count: 0, miles: 0, minutes: 0 };
      existing.count += 1;
      existing.miles += workout.distanceMiles || 0;
      existing.minutes += workout.durationMinutes || 0;
      typeMap.set(type, existing);
    }
  }

  const distribution = Array.from(typeMap.entries())
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

  return {
    distribution,
    totalMiles: Math.round(totalMiles),
    totalMinutes: Math.round(totalMinutes),
  };
}
