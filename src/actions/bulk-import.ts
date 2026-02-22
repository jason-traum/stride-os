'use server';

import { db, workouts } from '@/lib/db';
import { eq, and, gte, lte } from 'drizzle-orm';
import { createProfileAction } from '@/lib/action-utils';
import { revalidatePath } from 'next/cache';
import type { ParsedStravaActivity } from '@/lib/strava-csv-parser';

export interface BulkImportResult {
  imported: number;
  skipped: number;
  matched: number;
  errors: number;
  total: number;
}

/**
 * Import parsed Strava CSV activities into the database.
 *
 * Activities are deduplicated by:
 *   1. strava_activity_id (exact match)
 *   2. date + distance within 0.1 miles (fuzzy match)
 *
 * Fuzzy-matched activities get their strava_activity_id updated.
 * Truly new activities are inserted.
 */
async function _importFromStravaCSV(
  profileId: number,
  activities: ParsedStravaActivity[],
): Promise<BulkImportResult> {
  let imported = 0;
  let skipped = 0;
  let matched = 0;
  let errors = 0;

  for (const activity of activities) {
    try {
      // Skip activities with no meaningful distance
      if (!activity.distanceMiles || activity.distanceMiles < 0.1) {
        skipped++;
        continue;
      }

      // 1. Check for exact strava_activity_id match
      if (activity.activityId) {
        const existingByStravaId = await db.query.workouts.findFirst({
          where: and(
            eq(workouts.stravaActivityId, activity.activityId),
          ),
        });

        if (existingByStravaId) {
          skipped++;
          continue;
        }
      }

      // 2. Check for fuzzy duplicate (same date + distance within 0.1 mi)
      const distanceLow = activity.distanceMiles - 0.1;
      const distanceHigh = activity.distanceMiles + 0.1;
      const existingByDateDist = await db.query.workouts.findFirst({
        where: and(
          eq(workouts.profileId, profileId),
          eq(workouts.date, activity.date),
          gte(workouts.distanceMiles, distanceLow),
          lte(workouts.distanceMiles, distanceHigh),
        ),
      });

      if (existingByDateDist) {
        // Update existing workout with strava ID if it doesn't have one
        if (activity.activityId && !existingByDateDist.stravaActivityId) {
          await db.update(workouts)
            .set({
              stravaActivityId: activity.activityId,
              stravaName: existingByDateDist.stravaName || activity.name,
              stravaDescription: existingByDateDist.stravaDescription || activity.description,
              stravaGearId: existingByDateDist.stravaGearId || activity.gearId,
              stravaPerceivedExertion: existingByDateDist.stravaPerceivedExertion || activity.perceivedExertion,
              stravaAverageCadence: existingByDateDist.stravaAverageCadence || activity.avgCadence,
              stravaMaxSpeed: existingByDateDist.stravaMaxSpeed || activity.maxSpeedMph,
              startTimeLocal: existingByDateDist.startTimeLocal || activity.startTimeLocal,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(workouts.id, existingByDateDist.id));
        }
        matched++;
        continue;
      }

      // 3. Insert new activity
      const now = new Date().toISOString();
      await db.insert(workouts).values({
        profileId,
        date: activity.date,
        distanceMiles: activity.distanceMiles,
        durationMinutes: activity.durationMinutes,
        avgPaceSeconds: activity.avgPaceSeconds,
        avgHr: activity.avgHr,
        maxHr: activity.maxHr,
        elevationGainFt: activity.elevationGainFt,
        elevationGainFeet: activity.elevationGainFt,
        workoutType: 'easy', // default, reprocess-workouts will classify
        source: 'strava',
        notes: activity.description || null,
        stravaActivityId: activity.activityId,
        stravaName: activity.name,
        stravaDescription: activity.description,
        weatherTempF: activity.weatherTempF,
        weatherFeelsLikeF: activity.weatherFeelsLikeF,
        weatherHumidityPct: activity.weatherHumidityPct,
        weatherWindMph: activity.weatherWindMph,
        weatherConditions: activity.weatherConditions as 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunderstorm' | null | undefined,
        stravaGearId: activity.gearId,
        stravaMaxSpeed: activity.maxSpeedMph,
        stravaAverageCadence: activity.avgCadence,
        stravaPerceivedExertion: activity.perceivedExertion,
        startTimeLocal: activity.startTimeLocal,
        elapsedTimeMinutes: activity.elapsedTimeMinutes,
        trainingLoad: activity.trainingLoad,
        createdAt: now,
        updatedAt: now,
      });

      imported++;
    } catch (error) {
      console.error('Failed to import activity:', activity.activityId, error);
      errors++;
    }
  }

  // Revalidate pages that show workout data
  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/today');

  return {
    imported,
    skipped,
    matched,
    errors,
    total: activities.length,
  };
}

export const importFromStravaCSV = createProfileAction(_importFromStravaCSV, 'importFromStravaCSV');
