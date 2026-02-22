'use server';

import { db, workoutSegments } from '@/lib/db';
import { eq } from 'drizzle-orm';

export interface WorkoutLap {
  lapNumber: number;
  distanceMiles: number;
  durationSeconds: number;
  avgPaceSeconds: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  elevationGainFeet: number | null;
  lapType: string;
}

/**
 * Get laps/splits for a workout
 */
export async function getWorkoutLaps(workoutId: number): Promise<WorkoutLap[]> {
  const segments: import('@/lib/schema').WorkoutSegment[] = await db.query.workoutSegments.findMany({
    where: eq(workoutSegments.workoutId, workoutId),
    orderBy: (seg: { segmentNumber: import('drizzle-orm').Column }, { asc }: { asc: (col: import('drizzle-orm').Column) => import('drizzle-orm').SQL }) => [asc(seg.segmentNumber)],
  });

  return segments.map((seg: import('@/lib/schema').WorkoutSegment) => ({
    lapNumber: seg.segmentNumber,
    distanceMiles: seg.distanceMiles || 0,
    durationSeconds: seg.durationSeconds || 0,
    avgPaceSeconds: seg.paceSecondsPerMile || 0,
    avgHeartRate: seg.avgHr,
    maxHeartRate: seg.maxHr,
    elevationGainFeet: seg.elevationGainFt,
    lapType: seg.segmentType,
  }));
}

/**
 * Save laps for a workout (replaces existing)
 * SAFETY: If new laps array is empty, keeps existing laps to prevent data loss
 */
export async function saveWorkoutLaps(
  workoutId: number,
  laps: Array<{
    lapNumber: number;
    distanceMiles: number;
    durationSeconds: number;
    avgPaceSeconds: number;
    avgHeartRate?: number | null;
    maxHeartRate?: number | null;
    elevationGainFeet?: number | null;
    lapType?: string;
  }>,
  options?: { forceReplace?: boolean }
): Promise<void> {
  // SAFETY: Don't delete existing laps if new array is empty (unless forced)
  if (laps.length === 0 && !options?.forceReplace) {
    return;
  }

  // Delete existing laps only when we have new data
  if (laps.length > 0) {
    await db.delete(workoutSegments).where(eq(workoutSegments.workoutId, workoutId));

    await db.insert(workoutSegments).values(
      laps.map((lap) => ({
        workoutId,
        segmentNumber: lap.lapNumber,
        segmentType: (lap.lapType || 'steady') as 'warmup' | 'work' | 'recovery' | 'cooldown' | 'steady',
        distanceMiles: lap.distanceMiles,
        durationSeconds: lap.durationSeconds,
        paceSecondsPerMile: lap.avgPaceSeconds,
        avgHr: lap.avgHeartRate,
        maxHr: lap.maxHeartRate,
        elevationGainFt: lap.elevationGainFeet,
        createdAt: new Date().toISOString(),
      }))
    );
  } else if (options?.forceReplace) {
    // Only delete if explicitly forced
    await db.delete(workoutSegments).where(eq(workoutSegments.workoutId, workoutId));
  }
}

/**
 * Delete all laps for a workout (explicit deletion)
 */
export async function deleteWorkoutLaps(workoutId: number): Promise<void> {
  await db.delete(workoutSegments).where(eq(workoutSegments.workoutId, workoutId));
}
