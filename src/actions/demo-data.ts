'use server';

import { db, workouts, assessments } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

/**
 * Generate sample workout data for the last 30 days
 * This helps new users see what a populated app looks like
 */
export async function loadSampleData() {
  const now = new Date();
  const sampleWorkouts: Array<{
    date: string;
    distanceMiles: number;
    durationMinutes: number;
    workoutType: 'easy' | 'long' | 'tempo' | 'interval' | 'recovery';
    notes?: string;
  }> = [];

  // Generate 4 weeks of sample data
  for (let week = 0; week < 4; week++) {
    const weekOffset = week * 7;
    
    // Monday - Easy
    sampleWorkouts.push({
      date: formatDate(now, weekOffset + 6),
      distanceMiles: 5,
      durationMinutes: 48,
      workoutType: 'easy',
      notes: 'Morning run, felt good',
    });

    // Tuesday - Tempo or Intervals (alternating weeks)
    if (week % 2 === 0) {
      sampleWorkouts.push({
        date: formatDate(now, weekOffset + 5),
        distanceMiles: 6,
        durationMinutes: 50,
        workoutType: 'tempo',
        notes: '2 mile warm-up, 3 miles tempo, 1 mile cool-down',
      });
    } else {
      sampleWorkouts.push({
        date: formatDate(now, weekOffset + 5),
        distanceMiles: 5.5,
        durationMinutes: 45,
        workoutType: 'interval',
        notes: '6x800m at 5K pace with 400m jog recovery',
      });
    }

    // Wednesday - Recovery
    sampleWorkouts.push({
      date: formatDate(now, weekOffset + 4),
      distanceMiles: 3,
      durationMinutes: 30,
      workoutType: 'recovery',
    });

    // Thursday - Easy
    sampleWorkouts.push({
      date: formatDate(now, weekOffset + 3),
      distanceMiles: 5,
      durationMinutes: 47,
      workoutType: 'easy',
    });

    // Saturday - Long Run
    sampleWorkouts.push({
      date: formatDate(now, weekOffset + 1),
      distanceMiles: 10 + week,
      durationMinutes: 95 + (week * 10),
      workoutType: 'long',
      notes: 'Long run with progression finish',
    });

    // Sunday - Easy
    sampleWorkouts.push({
      date: formatDate(now, weekOffset),
      distanceMiles: 4,
      durationMinutes: 40,
      workoutType: 'easy',
      notes: 'Recovery from long run',
    });
  }

  // Insert workouts
  for (const workout of sampleWorkouts) {
    const avgPaceSeconds = Math.round((workout.durationMinutes * 60) / workout.distanceMiles);
    
    const [inserted] = await db.insert(workouts).values({
      date: workout.date,
      distanceMiles: workout.distanceMiles,
      durationMinutes: workout.durationMinutes,
      avgPaceSeconds,
      workoutType: workout.workoutType,
      notes: workout.notes || null,
      source: 'demo',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    // Add assessment for some workouts
    if (Math.random() > 0.3) {
      const verdicts = ['great', 'good', 'good', 'fine', 'rough'] as const;
      const verdict = verdicts[Math.floor(Math.random() * verdicts.length)];
      const rpe = verdict === 'great' ? 5 + Math.floor(Math.random() * 2) :
                  verdict === 'good' ? 6 + Math.floor(Math.random() * 2) :
                  verdict === 'fine' ? 7 :
                  8 + Math.floor(Math.random() * 2);

      await db.insert(assessments).values({
        workoutId: inserted.id,
        verdict,
        rpe,
        legsFeel: 5 + Math.floor(Math.random() * 4),
        createdAt: new Date().toISOString(),
      });
    }
  }

  revalidatePath('/');
  revalidatePath('/today');
  revalidatePath('/history');
  revalidatePath('/analytics');

  return { success: true, workoutsCreated: sampleWorkouts.length };
}

/**
 * Clear all demo data
 */
export async function clearDemoData() {
  // Delete demo workouts (assessments will cascade or be orphaned)
  await db.delete(workouts).where(eq(workouts.source, 'demo'));
  
  revalidatePath('/');
  revalidatePath('/today');
  revalidatePath('/history');
  revalidatePath('/analytics');

  return { success: true };
}

function formatDate(from: Date, daysAgo: number): string {
  const date = new Date(from);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}
