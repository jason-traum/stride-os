'use server';

import { db, userSettings, workouts, raceResults, stravaBestEfforts } from '@/lib/db';
import { eq, and, gte } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import {
  refreshStravaToken,
  getStravaActivities,
  getStravaActivity,
  getStravaActivityLaps,
  getStravaActivityStreams,
  convertStravaActivity,
  convertStravaLap,
  classifyLaps,
  isTokenExpired,
} from '@/lib/strava';
import type { StravaBestEffort as StravaBestEffortAPI } from '@/lib/strava';
import { saveWorkoutLaps } from './laps';
import { recordVdotEntry } from './vdot-history';
import { calculateVDOT } from '@/lib/training/vdot-calculator';
import { RACE_DISTANCES } from '@/lib/training/types';
import { syncVdotFromPredictionEngine } from './vdot-sync';
import { computeWorkoutFitnessSignals } from './fitness-signals';
import { cacheWorkoutStreams } from '@/lib/workout-stream-cache';
import { encryptToken, decryptToken } from '@/lib/token-crypto';
import { linkWorkoutToShoeByGearId } from './gear-sync';
import { getActiveProfileId } from '@/lib/profile-server';
import { getOrCreateSettingsForProfile, getValidAccessToken } from './strava-auth';

/**
 * Match a distance in meters to the closest standard race distance.
 * Returns the distance key (e.g., '5K', 'half_marathon') if within 5% tolerance, or null.
 */
export function matchRaceDistance(distanceMeters: number): string | null {
  let bestKey: string | null = null;
  let bestPct = Infinity;
  for (const [key, info] of Object.entries(RACE_DISTANCES)) {
    const pct = Math.abs(distanceMeters - info.meters) / info.meters;
    if (pct < bestPct) {
      bestPct = pct;
      bestKey = key;
    }
  }
  return bestPct <= 0.05 ? bestKey : null;
}

export async function fetchAndCacheStravaStreams(params: {
  accessToken: string;
  activityId: number;
  workoutId: number;
  profileId?: number | null;
  fallbackMaxHr?: number | null;
}): Promise<void> {
  const streams = await getStravaActivityStreams(
    params.accessToken,
    params.activityId,
    ['heartrate', 'time', 'distance', 'velocity_smooth', 'altitude', 'cadence']
  );

  const hrStream = streams.find(s => s.type === 'heartrate');
  const timeStream = streams.find(s => s.type === 'time');
  const distanceStream = streams.find(s => s.type === 'distance');
  const velocityStream = streams.find(s => s.type === 'velocity_smooth');
  const altitudeStream = streams.find(s => s.type === 'altitude');
  const cadenceStream = streams.find(s => s.type === 'cadence');

  if (!timeStream || timeStream.data.length < 2) return;

  const distanceMiles = distanceStream
    ? distanceStream.data.map(d => d * 0.000621371)
    : timeStream.data.map((_, i) => i * 0.005);

  const paceData = velocityStream
    ? velocityStream.data.map(v => v > 0 ? 1609.34 / v : 0)
    : [];

  const altitudeFeet = altitudeStream
    ? altitudeStream.data.map((m: number) => m * 3.28084)
    : [];

  // Strava returns cadence as steps per minute for one foot; multiply by 2 for total spm
  const cadenceSpm = cadenceStream
    ? cadenceStream.data.map((c: number) => c * 2)
    : [];

  let maxHr = params.fallbackMaxHr || 0;
  if (hrStream && hrStream.data.length > 0) {
    const streamMax = Math.max(...hrStream.data);
    if (streamMax > maxHr) maxHr = streamMax;
  }

  await cacheWorkoutStreams({
    workoutId: params.workoutId,
    profileId: params.profileId,
    source: 'strava',
    data: {
      distance: distanceMiles,
      heartrate: hrStream?.data || [],
      velocity: paceData,
      altitude: altitudeFeet,
      cadence: cadenceSpm,
      time: timeStream.data,
      maxHr,
    },
  });
}

/** Save Strava best efforts for a workout (delete + re-insert) */
export async function saveBestEffortsForWorkout(workoutId: number, efforts: StravaBestEffortAPI[]) {
  await db.delete(stravaBestEfforts).where(eq(stravaBestEfforts.workoutId, workoutId));
  const validEfforts = efforts.filter(e =>
    e.distance > 0 && e.moving_time > 0 && e.elapsed_time > 0
  );
  if (validEfforts.length === 0) return;
  await db.insert(stravaBestEfforts).values(
    validEfforts.map(e => ({
      workoutId,
      stravaEffortId: e.id,
      name: e.name,
      distanceMeters: e.distance,
      elapsedTimeSeconds: e.elapsed_time,
      movingTimeSeconds: e.moving_time,
      prRank: e.pr_rank,
    }))
  );
}

/**
 * Sync activities from Strava
 * Uses the active profile's Strava connection
 */
export async function syncStravaActivities(options?: {
  since?: string; // ISO date
  until?: string; // ISO date — end of range (exclusive), defaults to now
  fullSync?: boolean;
  profileId?: number; // Optional: pass explicitly for admin/CLI usage (bypasses cookies)
  debug?: boolean;
  forceReimport?: boolean; // Delete existing workout and re-import from Strava
}): Promise<{
  success: boolean;
  imported: number;
  skipped: number;
  error?: string;
  debugInfo?: unknown[];
}> {
  try {
    let profileId: number | undefined = options?.profileId;
    let accessToken: string | null = null;

    if (profileId) {
      // Admin/CLI path: look up settings directly by profileId
      const settings = await getOrCreateSettingsForProfile(profileId);
      if (!settings?.stravaAccessToken || !settings?.stravaRefreshToken) {
        return { success: false, imported: 0, skipped: 0, error: 'Not connected to Strava' };
      }
      if (settings.stravaTokenExpiresAt && isTokenExpired(settings.stravaTokenExpiresAt)) {
        const newTokens = await refreshStravaToken(decryptToken(settings.stravaRefreshToken));
        await db.update(userSettings).set({
          stravaAccessToken: encryptToken(newTokens.accessToken),
          stravaRefreshToken: encryptToken(newTokens.refreshToken),
          stravaTokenExpiresAt: newTokens.expiresAt,
          updatedAt: new Date().toISOString(),
        }).where(eq(userSettings.id, settings.id));
        accessToken = newTokens.accessToken;
      } else {
        accessToken = decryptToken(settings.stravaAccessToken);
      }
    } else {
      accessToken = await getValidAccessToken();
      profileId = await getActiveProfileId();
    }

    if (!accessToken) {
      return { success: false, imported: 0, skipped: 0, error: 'Not connected to Strava' };
    }

    // Use the active profile's settings
    const settings = await getOrCreateSettingsForProfile(profileId);
    if (!settings) {
      return { success: false, imported: 0, skipped: 0, error: 'Settings not found' };
    }

    // Determine date range
    let afterTimestamp: number | undefined;

    if (options?.fullSync) {
      // Full sync: last 4 years
      const fourYearsAgo = new Date();
      fourYearsAgo.setFullYear(fourYearsAgo.getFullYear() - 4);
      afterTimestamp = Math.floor(fourYearsAgo.getTime() / 1000);
    } else if (options?.since) {
      afterTimestamp = Math.floor(new Date(options.since).getTime() / 1000);
    } else if (settings.stravaLastSyncAt) {
      // Incremental sync: since last sync
      afterTimestamp = Math.floor(new Date(settings.stravaLastSyncAt).getTime() / 1000);
    } else {
      // First sync: last 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      afterTimestamp = Math.floor(ninetyDaysAgo.getTime() / 1000);
    }

    // Compute optional end-of-range timestamp
    let beforeTimestamp: number | undefined;
    if (options?.until) {
      beforeTimestamp = Math.floor(new Date(options.until).getTime() / 1000);
    }

    // Fetch activities from Strava
    const activities = await getStravaActivities(accessToken, {
      after: afterTimestamp,
      before: beforeTimestamp,
      perPage: 100,
      maxPages: 50, // Support larger syncs (up to 5000 activities)
    });


    // Activity type classification
    const RUNNING_ACTIVITY_TYPES = ['Run', 'VirtualRun', 'TrailRun'];
    const CROSS_TRAIN_TYPE_MAP: Record<string, string> = {
      'Ride': 'bike',
      'VirtualRide': 'bike',
      'EBikeRide': 'bike',
      'GravelRide': 'bike',
      'MountainBikeRide': 'bike',
      'Swim': 'swim',
      'Walk': 'walk_hike',
      'Hike': 'walk_hike',
      'WeightTraining': 'strength',
      'Yoga': 'yoga',
      'Workout': 'strength',
      'Crossfit': 'strength',
      'Elliptical': 'other',
      'StairStepper': 'other',
      'Rowing': 'other',
      'NordicSki': 'other',
      'RockClimbing': 'other',
      'Snowboard': 'other',
      'AlpineSki': 'other',
      'IceSkate': 'other',
      'InlineSkate': 'other',
      'Skateboard': 'other',
      'Surfing': 'other',
      'Pilates': 'yoga',
      'Handcycle': 'bike',
    };

    // Include both running and cross-training activities
    const importableActivities = activities.filter(activity =>
      RUNNING_ACTIVITY_TYPES.includes(activity.type) || CROSS_TRAIN_TYPE_MAP[activity.type] !== undefined
    );


    let imported = 0;
    let skipped = 0;
    const debugInfo: unknown[] = [];
    const debug = options?.debug ?? false;

    if (debug) {
      debugInfo.push({
        totalActivities: activities.length,
        importableActivities: importableActivities.length,
        activityTypes: activities.map(a => ({ id: a.id, type: a.type, sport_type: a.sport_type, name: a.name, date: a.start_date_local })),
      });
    }

    // Import each activity
    for (const activity of importableActivities) {
      try {
        // Check if already imported (by checking if workout exists with this Strava ID)
        const existingWorkout = await db.query.workouts.findFirst({
          where: and(
            eq(workouts.stravaActivityId, activity.id),
          ),
        });

        if (existingWorkout) {
          if (options?.forceReimport) {
            if (debug) debugInfo.push({ action: 'forceReimportDelete', stravaId: activity.id, deletedWorkoutId: existingWorkout.id });
            await db.delete(workouts).where(eq(workouts.id, existingWorkout.id));
          } else {
            if (debug) debugInfo.push({ skipReason: 'existingByStravaId', stravaId: activity.id, existingWorkoutId: existingWorkout.id, existingDate: existingWorkout.date });
            skipped++;
            continue;
          }
        }

        // Also check by date and distance (to avoid duplicates from manual entry)
        const workoutData = convertStravaActivity(activity);
        const existingByDate = await db.query.workouts.findFirst({
          where: and(
            eq(workouts.date, workoutData.date),
            gte(workouts.distanceMiles, workoutData.distanceMiles - 0.1),
          ),
        });

        if (existingByDate && Math.abs((existingByDate.distanceMiles || 0) - workoutData.distanceMiles) < 0.2) {
          if (debug) debugInfo.push({ skipReason: 'existingByDate', stravaId: activity.id, date: workoutData.date, distance: workoutData.distanceMiles, existingWorkoutId: existingByDate.id, existingDate: existingByDate.date, existingDist: existingByDate.distanceMiles });
          // Likely same workout — enrich with full Strava data
          let matchWeatherFields: {
            weatherTempF?: number;
            weatherFeelsLikeF?: number;
            weatherHumidityPct?: number;
            weatherWindMph?: number;
            weatherConditions?: 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunderstorm';
          } = {};
          if (activity.start_latlng && activity.start_latlng.length === 2) {
            try {
              const { fetchHistoricalWeather } = await import('@/lib/weather');
              const weatherDate = activity.start_date_local.split('T')[0];
              const weatherTime = activity.start_date_local.split('T')[1]?.substring(0, 5) || '07:00';
              const matchDurationMins = activity.moving_time ? Math.round(activity.moving_time / 60) : undefined;
              const weather = await fetchHistoricalWeather(
                activity.start_latlng[0],
                activity.start_latlng[1],
                weatherDate,
                weatherTime,
                matchDurationMins
              );
              if (weather) {
                matchWeatherFields = {
                  weatherTempF: weather.temperature,
                  weatherFeelsLikeF: weather.feelsLike,
                  weatherHumidityPct: weather.humidity,
                  weatherWindMph: weather.windSpeed,
                  weatherConditions: weather.condition,
                };
              }
            } catch {
              // Weather fetch failure is non-critical
            }
          }
          await db.update(workouts)
            .set({
              stravaActivityId: activity.id,
              source: 'strava',
              avgHeartRate: workoutData.avgHeartRate ?? existingByDate.avgHeartRate,
              elevationGainFeet: workoutData.elevationGainFeet ?? existingByDate.elevationGainFeet,
              polyline: workoutData.polyline ?? existingByDate.polyline,
              durationMinutes: workoutData.durationMinutes ?? existingByDate.durationMinutes,
              avgPaceSeconds: workoutData.avgPaceSeconds ?? existingByDate.avgPaceSeconds,
              // Comprehensive Strava fields
              stravaDescription: workoutData.stravaDescription,
              stravaKudosCount: workoutData.stravaKudosCount,
              stravaCommentCount: workoutData.stravaCommentCount,
              stravaAchievementCount: workoutData.stravaAchievementCount,
              stravaPhotoCount: workoutData.stravaPhotoCount,
              stravaAthleteCount: workoutData.stravaAthleteCount,
              stravaMaxSpeed: workoutData.stravaMaxSpeed,
              stravaAverageCadence: workoutData.stravaAverageCadence,
              stravaSufferScore: workoutData.stravaSufferScore,
              stravaPerceivedExertion: workoutData.stravaPerceivedExertion,
              stravaGearId: workoutData.stravaGearId,
              stravaDeviceName: workoutData.stravaDeviceName,
              startLatitude: workoutData.startLatitude,
              startLongitude: workoutData.startLongitude,
              endLatitude: workoutData.endLatitude,
              endLongitude: workoutData.endLongitude,
              stravaIsTrainer: workoutData.stravaIsTrainer,
              stravaIsCommute: workoutData.stravaIsCommute,
              startTimeLocal: workoutData.startTimeLocal,
              ...matchWeatherFields,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(workouts.id, existingByDate.id));

          // Fetch laps + streams + fitness signals for matched workout
          if (existingByDate.id) {
            try {
              const stravaLaps = await getStravaActivityLaps(accessToken, activity.id);
              if (stravaLaps.length > 0) {
                const convertedLaps = classifyLaps(stravaLaps.map(convertStravaLap));
                await saveWorkoutLaps(existingByDate.id, convertedLaps);
              }
            } catch {
              // Non-critical
            }

            try {
              await fetchAndCacheStravaStreams({
                accessToken,
                activityId: activity.id,
                workoutId: existingByDate.id,
                profileId: settings.profileId,
                fallbackMaxHr: workoutData.avgHeartRate || null,
              });
            } catch {
              // Non-critical
            }

            try {
              await computeWorkoutFitnessSignals(existingByDate.id, settings.profileId);
            } catch {
              // Non-critical
            }

            // Auto-link workout to shoe based on Strava gear ID
            try {
              await linkWorkoutToShoeByGearId(existingByDate.id, workoutData.stravaGearId, settings.profileId);
            } catch {
              // Non-critical
            }
          }

          skipped++;
          continue;
        }

        // Capture elapsed time (includes stops) separately from moving time
        const elapsedTimeMinutes = activity.elapsed_time
          ? Math.round(activity.elapsed_time / 60)
          : undefined;

        // Fetch weather data for the workout location/time (non-blocking)
        // Uses mid-race time for longer workouts to model temperature rise
        let weatherFields: {
          weatherTempF?: number;
          weatherFeelsLikeF?: number;
          weatherHumidityPct?: number;
          weatherWindMph?: number;
          weatherConditions?: 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunderstorm';
        } = {};
        if (activity.start_latlng && activity.start_latlng.length === 2) {
          try {
            const { fetchHistoricalWeather } = await import('@/lib/weather');
            const weatherDate = activity.start_date_local.split('T')[0];
            const weatherTime = activity.start_date_local.split('T')[1]?.substring(0, 5) || '07:00';
            const durationMins = activity.moving_time ? Math.round(activity.moving_time / 60) : undefined;
            const weather = await fetchHistoricalWeather(
              activity.start_latlng[0],
              activity.start_latlng[1],
              weatherDate,
              weatherTime,
              durationMins
            );
            if (weather) {
              weatherFields = {
                weatherTempF: weather.temperature,
                weatherFeelsLikeF: weather.feelsLike,
                weatherHumidityPct: weather.humidity,
                weatherWindMph: weather.windSpeed,
                weatherConditions: weather.condition,
              };
            }
          } catch (weatherError) {
            console.warn(`Failed to fetch weather for activity ${activity.id}:`, weatherError);
          }
        }

        // Determine activity type and cross-training fields
        const isRun = RUNNING_ACTIVITY_TYPES.includes(activity.type);
        const activityType = isRun ? 'run' : (CROSS_TRAIN_TYPE_MAP[activity.type] || 'other');
        const workoutType = isRun ? workoutData.workoutType : 'cross_train';

        // Estimate cross-training intensity from Strava suffer score or perceived exertion
        let crossTrainIntensity: string | null = null;
        if (!isRun) {
          const pe = activity.perceived_exertion ?? 0;
          const ss = activity.suffer_score ?? 0;
          if (pe >= 7 || ss >= 100) crossTrainIntensity = 'hard';
          else if (pe >= 4 || ss >= 40) crossTrainIntensity = 'moderate';
          else crossTrainIntensity = 'easy';
        }

        // Calculate basic training load for cross-training
        let crossTrainLoad: number | null = null;
        if (!isRun && crossTrainIntensity && workoutData.durationMinutes) {
          const { calculateCrossTrainLoad } = await import('@/lib/utils');
          crossTrainLoad = calculateCrossTrainLoad(workoutData.durationMinutes, crossTrainIntensity, activityType);
        }

        // Import new workout with profileId from settings
        const insertResult = await db.insert(workouts).values({
          profileId: settings.profileId,
          date: workoutData.date,
          distanceMiles: workoutData.distanceMiles,
          durationMinutes: workoutData.durationMinutes,
          elapsedTimeMinutes,
          avgPaceSeconds: isRun ? workoutData.avgPaceSeconds : null,
          workoutType,
          activityType,
          crossTrainIntensity,
          trainingLoad: crossTrainLoad,
          stravaName: workoutData.stravaName,
          notes: workoutData.notes,
          source: 'strava',
          stravaActivityId: activity.id,
          avgHeartRate: workoutData.avgHeartRate,
          elevationGainFeet: workoutData.elevationGainFeet,
          polyline: workoutData.polyline,
          // Comprehensive Strava fields
          stravaDescription: workoutData.stravaDescription,
          stravaKudosCount: workoutData.stravaKudosCount,
          stravaCommentCount: workoutData.stravaCommentCount,
          stravaAchievementCount: workoutData.stravaAchievementCount,
          stravaPhotoCount: workoutData.stravaPhotoCount,
          stravaAthleteCount: workoutData.stravaAthleteCount,
          stravaMaxSpeed: workoutData.stravaMaxSpeed,
          stravaAverageCadence: workoutData.stravaAverageCadence,
          stravaSufferScore: workoutData.stravaSufferScore,
          stravaPerceivedExertion: workoutData.stravaPerceivedExertion,
          stravaGearId: workoutData.stravaGearId,
          stravaDeviceName: workoutData.stravaDeviceName,
          startLatitude: workoutData.startLatitude,
          startLongitude: workoutData.startLongitude,
          endLatitude: workoutData.endLatitude,
          endLongitude: workoutData.endLongitude,
          stravaIsTrainer: workoutData.stravaIsTrainer,
          stravaIsCommute: workoutData.stravaIsCommute,
          startTimeLocal: workoutData.startTimeLocal,
          ...weatherFields,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }).returning({ id: workouts.id });

        const newWorkoutId = insertResult[0]?.id;

        // Running-specific post-processing (laps, streams, best efforts, fitness signals)
        if (newWorkoutId && isRun) {
          try {
            const stravaLaps = await getStravaActivityLaps(accessToken, activity.id);
            if (stravaLaps.length > 0) {
              const convertedLaps = classifyLaps(stravaLaps.map(convertStravaLap));
              await saveWorkoutLaps(newWorkoutId, convertedLaps);
            }
          } catch (lapError) {
            console.warn(`Failed to fetch laps for activity ${activity.id}:`, lapError);
          }

          try {
            await fetchAndCacheStravaStreams({
              accessToken,
              activityId: activity.id,
              workoutId: newWorkoutId,
              profileId: settings.profileId,
              fallbackMaxHr: workoutData.avgHeartRate || null,
            });
          } catch (streamError) {
            console.warn(`Failed to cache streams for activity ${activity.id}:`, streamError);
          }

          try {
            const detailActivity = await getStravaActivity(accessToken, activity.id);
            if (detailActivity.best_efforts && detailActivity.best_efforts.length > 0) {
              await saveBestEffortsForWorkout(newWorkoutId, detailActivity.best_efforts);
            }
          } catch {
            // Non-critical
          }

          try {
            await computeWorkoutFitnessSignals(newWorkoutId, settings.profileId);
          } catch {
            // Don't fail sync for signal computation
          }

          try {
            await linkWorkoutToShoeByGearId(newWorkoutId, workoutData.stravaGearId, settings.profileId);
          } catch {
            // Non-critical: don't fail sync for gear linking
          }
        }

        // Track if this is a race (Strava workout_type 1 or 11, or name-detected) — runs only
        if (isRun && workoutData.workoutType === 'race') {
          if (workoutData.distanceMiles && workoutData.durationMinutes) {
            const distanceMeters = workoutData.distanceMiles * 1609.34;
            const timeSeconds = workoutData.durationMinutes * 60;
            const raceVdot = calculateVDOT(distanceMeters, timeSeconds);

            // Record to VDOT history
            if (raceVdot >= 15 && raceVdot <= 85) {
              try {
                await recordVdotEntry(raceVdot, 'race', {
                  date: workoutData.date,
                  sourceId: newWorkoutId,
                  confidence: 'high',
                  notes: `Strava race: ${workoutData.notes || activity.name}`,
                  profileId: settings.profileId,
                });
              } catch {
                // Don't fail sync for history recording
              }
            }

            // Auto-create race result if distance matches a standard race
            if (newWorkoutId) {
              try {
                const distanceLabel = matchRaceDistance(distanceMeters);
                if (distanceLabel) {
                  const existing = await db.query.raceResults.findFirst({
                    where: and(
                      eq(raceResults.workoutId, newWorkoutId),
                    ),
                  });
                  if (!existing) {
                    // Infer effort level from HR data
                    const avgHr = workoutData.avgHeartRate || 0;
                    const maxHr = activity.max_heartrate || 0;
                    const hrRatio = maxHr > 0 ? avgHr / maxHr : null;
                    const effortLevel: 'all_out' | 'hard' | 'moderate' =
                      hrRatio != null && hrRatio >= 0.9 ? 'all_out'
                      : hrRatio != null && hrRatio >= 0.84 ? 'hard'
                      : 'moderate';

                    const raceDistanceInfo = RACE_DISTANCES[distanceLabel];
                    const [insertedResult] = await db.insert(raceResults).values({
                      profileId: settings.profileId,
                      raceName: activity.name || null,
                      date: workoutData.date,
                      distanceMeters: raceDistanceInfo.meters,
                      distanceLabel,
                      finishTimeSeconds: Math.round(timeSeconds),
                      calculatedVdot: raceVdot >= 15 && raceVdot <= 85 ? raceVdot : null,
                      effortLevel,
                      workoutId: newWorkoutId,
                      createdAt: new Date().toISOString(),
                    }).returning();

                    // Auto-link to a planned race if possible
                    if (insertedResult?.id) {
                      try {
                        const { autoMatchRaceToResult } = await import('@/actions/races');
                        await autoMatchRaceToResult(
                          insertedResult.id,
                          raceDistanceInfo.meters,
                          workoutData.date,
                          settings.profileId,
                        );
                      } catch {
                        // Non-critical: don't fail sync for auto-match
                      }
                    }
                  }
                }
              } catch {
                // Don't fail sync for race result creation
              }
            }
          }
        }

        imported++;
      } catch (error) {
        console.error(`Failed to import activity ${activity.id}:`, error);
        if (debug) {
          const errObj: Record<string, unknown> = { error: 'importFailed', stravaId: activity.id, message: error instanceof Error ? error.message : String(error) };
          if (error && typeof error === 'object') {
            const e = error as Record<string, unknown>;
            if (e.code) errObj.code = e.code;
            if (e.detail) errObj.detail = e.detail;
            if (e.constraint) errObj.constraint = e.constraint;
            if (e.column) errObj.column = e.column;
            if (e.cause) errObj.cause = String(e.cause);
          }
          debugInfo.push(errObj);
        }
        skipped++;
      }
    }

    // Update last sync time
    await db.update(userSettings)
      .set({
        stravaLastSyncAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));

    // Update VDOT using multi-signal prediction engine after every sync
    // Every workout (even easy runs with HR) can improve the estimate
    if (imported > 0) {
      try {
        await syncVdotFromPredictionEngine(settings.profileId, { skipSmoothing: true });
      } catch (err) {
        console.error('[Strava Sync] VDOT sync failed:', err);
      }
    }

    revalidatePath('/history');
    revalidatePath('/analytics');
    revalidatePath('/today');
    revalidatePath('/races');

    return { success: true, imported, skipped, ...(debug ? { debugInfo } : {}) };
  } catch (error) {
    console.error('Failed to sync Strava activities:', error);
    return { success: false, imported: 0, skipped: 0, error: 'Failed to sync activities' };
  }
}
