'use server';

import { db, workouts } from '@/lib/db';
import { eq, and, isNull, isNotNull, desc } from 'drizzle-orm';
import { fetchHistoricalWeather } from '@/lib/weather';
import { computeWorkoutFitnessSignals } from './fitness-signals';

/**
 * Decode the first point from a Google-encoded polyline string.
 * Returns [latitude, longitude] or null if decoding fails.
 */
function decodeFirstPolylinePoint(encoded: string): [number, number] | null {
  try {
    let index = 0;
    let lat = 0;
    let lng = 0;

    // Decode latitude
    let shift = 0;
    let result = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    // Decode longitude
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    return [lat / 1e5, lng / 1e5];
  } catch {
    return null;
  }
}

export interface BackfillWeatherResult {
  total: number;
  updated: number;
  failed: number;
  skipped: number;
}

/**
 * Backfill weather data for existing workouts that have GPS data (polyline)
 * but no weather data. Uses Open-Meteo Archive API.
 */
export async function backfillWeather(options?: {
  limit?: number;
  dryRun?: boolean;
}): Promise<BackfillWeatherResult> {
  const limit = options?.limit ?? 500;
  const dryRun = options?.dryRun ?? false;

  // Find workouts with polyline but no weather data
  const workoutsToProcess = await db.query.workouts.findMany({
    where: and(
      isNull(workouts.weatherTempF),
      isNotNull(workouts.polyline),
    ),
    columns: {
      id: true,
      date: true,
      polyline: true,
      profileId: true,
      durationMinutes: true,
      createdAt: true,
    },
    orderBy: [desc(workouts.date)],
    limit,
  });

  const result: BackfillWeatherResult = {
    total: workoutsToProcess.length,
    updated: 0,
    failed: 0,
    skipped: 0,
  };

  if (dryRun) {
    return result;
  }

  for (const workout of workoutsToProcess) {
    try {
      if (!workout.polyline) {
        result.skipped++;
        continue;
      }

      const point = decodeFirstPolylinePoint(workout.polyline);
      if (!point) {
        result.skipped++;
        continue;
      }

      const [lat, lon] = point;

      // Use workout date; approximate time as 07:00 if not stored
      const weatherDate = workout.date;
      const weatherTime = '07:00';

      const weather = await fetchHistoricalWeather(lat, lon, weatherDate, weatherTime, workout.durationMinutes ?? undefined);

      if (!weather) {
        result.failed++;
        // Rate limit between calls
        await new Promise(r => setTimeout(r, 200));
        continue;
      }

      await db.update(workouts)
        .set({
          weatherTempF: weather.temperature,
          weatherFeelsLikeF: weather.feelsLike,
          weatherHumidityPct: weather.humidity,
          weatherWindMph: weather.windSpeed,
          weatherConditions: weather.condition,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(workouts.id, workout.id));

      // Recompute fitness signals now that weather data exists
      try {
        await computeWorkoutFitnessSignals(workout.id, workout.profileId);
      } catch {
        // Non-critical
      }

      result.updated++;

      // Rate limit: 200ms between API calls
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      console.error(`[backfillWeather] Failed for workout ${workout.id}:`, error);
      result.failed++;
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return result;
}
