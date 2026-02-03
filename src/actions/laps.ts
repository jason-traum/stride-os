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
  const segments = await db.query.workoutSegments.findMany({
    where: eq(workoutSegments.workoutId, workoutId),
    orderBy: (seg, { asc }) => [asc(seg.segmentNumber)],
  });

  return segments.map((seg) => ({
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
  }>
): Promise<void> {
  // Delete existing laps
  await db.delete(workoutSegments).where(eq(workoutSegments.workoutId, workoutId));

  // Insert new laps
  if (laps.length > 0) {
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
  }
}
