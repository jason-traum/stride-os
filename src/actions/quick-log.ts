'use server';

import { db } from '@/lib/db';
import { workouts } from '@/lib/schema';
import { toLocalDateString } from '@/lib/utils';
import { revalidatePath } from 'next/cache';
import { eq, desc } from 'drizzle-orm';
import { createProfileAction } from '@/lib/action-utils';

interface QuickLogData {
  distanceMiles: number;
  durationMinutes: number;
  workoutType: string;
  effort: number;
}

export const logQuickWorkout = createProfileAction(
  async (profileId: number, data: QuickLogData) => {
    const avgPaceSeconds = Math.round((data.durationMinutes * 60) / data.distanceMiles);

    const [newWorkout] = await db.insert(workouts).values({
      profileId,
      date: toLocalDateString(new Date()),
      workoutType: data.workoutType,
      distanceMiles: data.distanceMiles,
      distanceMeters: data.distanceMiles * 1609.34,
      durationMinutes: data.durationMinutes,
      avgPaceSeconds,
      source: 'manual',
      notes: `Quick logged: ${data.workoutType} run, effort ${data.effort}/5`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    revalidatePath('/');
    revalidatePath('/today');
    revalidatePath('/workouts');
    revalidatePath('/analytics');

    return {
      workoutId: newWorkout.id,
      message: `Logged ${data.distanceMiles.toFixed(1)} mile ${data.workoutType} run`,
    };
  },
  'logQuickWorkout'
);

export const getQuickLogDefaults = createProfileAction(
  async (profileId: number): Promise<{
    distance: number;
    duration: number;
    type: string;
  }> => {
    const recentWorkouts = await db
      .select()
      .from(workouts)
      .where(eq(workouts.profileId, profileId))
      .orderBy(desc(workouts.date))
      .limit(10);

    if (recentWorkouts.length === 0) {
      return { distance: 5, duration: 45, type: 'easy' };
    }

    const avgDistance = recentWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0) / recentWorkouts.length;
    const avgDuration = recentWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0) / recentWorkouts.length;

    const typeCounts = new Map<string, number>();
    recentWorkouts.forEach(w => {
      if (w.workoutType) {
        typeCounts.set(w.workoutType, (typeCounts.get(w.workoutType) || 0) + 1);
      }
    });

    let mostCommonType = 'easy';
    let maxCount = 0;
    typeCounts.forEach((count, type) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonType = type;
      }
    });

    return {
      distance: Math.round(avgDistance * 10) / 10,
      duration: Math.round(avgDuration),
      type: mostCommonType,
    };
  },
  'getQuickLogDefaults'
);
