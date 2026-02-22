'use server';

import { db } from '@/lib/db';
import { workouts, workoutSegments, type Workout, type WorkoutSegment } from '@/lib/schema';
import { desc, eq, gte, and, inArray } from 'drizzle-orm';
import { createProfileAction } from '@/lib/action-utils';
import { getSettings } from './settings';
import {
  detectThresholdPace,
  type ThresholdWorkoutData,
  type ThresholdSplitData,
  type ThresholdEstimate,
} from '@/lib/training/threshold-detector';

export type { ThresholdEstimate };

/**
 * Fetch workout data from the last 180 days and run the threshold-pace
 * detection algorithm.  Returns a ThresholdEstimate with pace, confidence,
 * method, evidence, and optional VDOT validation.
 */
export const getThresholdEstimate = createProfileAction(
  async (profileId: number): Promise<ThresholdEstimate> => {
    // 180-day lookback window
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 180);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Fetch workouts with pace, HR, duration, distance, elevation
    const rows: Workout[] = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          gte(workouts.date, startDateStr)
        )
      )
      .orderBy(desc(workouts.date));

    // Filter to running workouts with meaningful data
    const runningRows = rows.filter(
      w =>
        w.distanceMiles &&
        w.distanceMiles > 0 &&
        w.durationMinutes &&
        w.durationMinutes > 0 &&
        w.avgPaceSeconds &&
        w.avgPaceSeconds > 0 &&
        !['cross_train', 'other'].includes(w.workoutType)
    );

    if (runningRows.length === 0) {
      return detectThresholdPace([]);
    }

    // Fetch segments for per-mile split HR data (sustainability boundary signal)
    const workoutIds = runningRows.map(w => w.id);
    const allSegments = await db
      .select()
      .from(workoutSegments)
      .where(inArray(workoutSegments.workoutId, workoutIds));

    // Group segments by workout ID
    const segmentsByWorkout = new Map<number, WorkoutSegment[]>();
    for (const seg of allSegments) {
      const list = segmentsByWorkout.get(seg.workoutId) || [];
      list.push(seg);
      segmentsByWorkout.set(seg.workoutId, list);
    }

    // Map DB rows to ThresholdWorkoutData interface
    const workoutData: ThresholdWorkoutData[] = runningRows.map(w => {
      const segs = segmentsByWorkout.get(w.id);
      let splits: ThresholdSplitData[] | undefined;

      if (segs && segs.length > 0) {
        splits = segs
          .sort((a, b) => a.segmentNumber - b.segmentNumber)
          .filter(s => s.distanceMiles && s.distanceMiles > 0)
          .map(s => ({
            splitNumber: s.segmentNumber,
            distanceMiles: s.distanceMiles!,
            durationSeconds: s.durationSeconds ?? 0,
            paceSecondsPerMile:
              s.paceSecondsPerMile ??
              (s.durationSeconds && s.distanceMiles
                ? Math.round(s.durationSeconds / s.distanceMiles)
                : 0),
            heartRate: s.avgHr ?? null,
          }));
      }

      // Use avgHeartRate first, fall back to avgHr
      const heartRate = w.avgHeartRate ?? w.avgHr ?? null;

      return {
        id: w.id,
        date: w.date,
        distanceMiles: w.distanceMiles!,
        durationSeconds: (w.durationMinutes ?? 0) * 60,
        averagePaceSecondsPerMile: w.avgPaceSeconds!,
        averageHeartRate: heartRate,
        maxHeartRate: w.maxHr ?? null,
        elevationGainFeet: w.elevationGainFeet ?? w.elevationGainFt ?? null,
        splits,
      };
    });

    // Get the user's VDOT from settings for validation (if available)
    const settings = await getSettings(profileId);
    const knownVdot =
      settings?.vdot && settings.vdot >= 15 && settings.vdot <= 85
        ? settings.vdot
        : undefined;

    return detectThresholdPace(workoutData, { knownVdot });
  },
  'getThresholdEstimate'
);
