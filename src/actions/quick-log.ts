'use server';

import { db } from '@/lib/db';
import { workouts } from '@/lib/schema';
import { getActiveProfileId } from '@/lib/profile-server';
import { revalidatePath } from 'next/cache';
import { eq, desc } from 'drizzle-orm';

interface QuickLogData {
  distanceMiles: number;
  durationMinutes: number;
  workoutType: string;
  effort: number;
}

export async function logQuickWorkout(data: QuickLogData) {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) {
      throw new Error('No active profile');
    }

    // Calculate average pace
    const avgPaceSeconds = Math.round((data.durationMinutes * 60) / data.distanceMiles);

    // Convert effort to RPE (1-5 effort scale to 1-10 RPE scale)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _rpe = Math.round(data.effort * 2);

    // Create the workout
    const [newWorkout] = await db.insert(workouts).values({
      profileId,
      date: new Date().toISOString().split('T')[0],
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

    // Revalidate relevant pages
    revalidatePath('/');
    revalidatePath('/today');
    revalidatePath('/workouts');
    revalidatePath('/analytics');

    return {
      success: true,
      workoutId: newWorkout.id,
      message: `Logged ${data.distanceMiles.toFixed(1)} mile ${data.workoutType} run`,
    };

  } catch (error) {
    console.error('Error in logQuickWorkout:', error);
    throw new Error('Failed to log workout');
  }
}

/**
 * Get suggested values based on recent workouts
 */
export async function getQuickLogDefaults(): Promise<{
  distance: number;
  duration: number;
  type: string;
} | null> {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) return null;

    // Get last 10 workouts
    const recentWorkouts = await db
      .select()
      .from(workouts)
      .where(eq(workouts.profileId, profileId))
      .orderBy(desc(workouts.date))
      .limit(10);

    if (recentWorkouts.length === 0) {
      return {
        distance: 5,
        duration: 45,
        type: 'easy',
      };
    }

    // Calculate averages
    const avgDistance = recentWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0) / recentWorkouts.length;
    const avgDuration = recentWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0) / recentWorkouts.length;

    // Find most common workout type
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
      distance: Math.round(avgDistance * 10) / 10, // Round to 0.1
      duration: Math.round(avgDuration),
      type: mostCommonType,
    };

  } catch (error) {
    console.error('Error getting quick log defaults:', error);
    return null;
  }
}