import { NextRequest, NextResponse } from 'next/server';
import { db, userSettings, workouts } from '@/lib/db';
import { eq, and, gte } from 'drizzle-orm';
import type { UserSettings } from '@/lib/schema';
import {
  classifyLaps,
  convertStravaActivity,
  convertStravaLap,
  getStravaActivity,
  getStravaActivityLaps,
  isTokenExpired,
  refreshStravaToken,
} from '@/lib/strava';
import { saveWorkoutLaps } from '@/actions/laps';
import { encryptToken, decryptToken } from '@/lib/token-crypto';

// Webhook event types from Strava
interface StravaWebhookEvent {
  aspect_type: 'create' | 'update' | 'delete';
  event_time: number;
  object_id: number;
  object_type: 'activity' | 'athlete';
  owner_id: number;
  subscription_id: number;
  updates?: {
    title?: string;
    type?: string;
    private?: boolean;
  };
}

const RUNNING_ACTIVITY_TYPES = ['Run', 'VirtualRun', 'TrailRun'];

// GET endpoint for webhook subscription verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');


  // Verify the subscription
  if (mode === 'subscribe' && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ 'hub.challenge': challenge });
  }

  return NextResponse.json({ error: 'Invalid verification' }, { status: 403 });
}

// POST endpoint for webhook events
export async function POST(request: NextRequest) {
  try {
    const event: StravaWebhookEvent = await request.json();

    // Handle different event types
    if (event.object_type === 'athlete') {
      // Handle athlete updates (like deauthorization)
      await handleAthleteEvent(event);
    } else if (event.object_type === 'activity') {
      // Handle activity events
      await handleActivityEvent(event);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Strava Webhook] Error processing event:', error);
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 });
  }
}

async function handleAthleteEvent(event: StravaWebhookEvent) {
  if (event.aspect_type === 'update') {
    // Check if this is a deauthorization
    const settings = await db.query.userSettings.findFirst({
      where: eq(userSettings.stravaAthleteId, event.owner_id)
    });

    if (settings) {

      // Clear Strava tokens
      await db.update(userSettings)
        .set({
          stravaAccessToken: null,
          stravaRefreshToken: null,
          stravaTokenExpiresAt: null,
          stravaAutoSync: false,
          updatedAt: new Date().toISOString()
        })
        .where(eq(userSettings.id, settings.id));
    }
  }
}

async function handleActivityEvent(event: StravaWebhookEvent) {
  // Find user by athlete ID
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.stravaAthleteId, event.owner_id)
  });

  if (!settings || !settings.stravaAutoSync) {
    return;
  }

  switch (event.aspect_type) {
    case 'create':
      // Import newly created activities so webhook events become real auto-sync.
      if (!settings.profileId) return;

      const accessToken = await getValidAccessTokenForSettings(settings);
      if (!accessToken) return;

      try {
        const activity = await getStravaActivity(accessToken, event.object_id);
        const isRunning = RUNNING_ACTIVITY_TYPES.includes(activity.type) || RUNNING_ACTIVITY_TYPES.includes(activity.sport_type);
        if (!isRunning) return;

        const existingWorkout = await db.query.workouts.findFirst({
          where: and(
            eq(workouts.profileId, settings.profileId),
            eq(workouts.stravaActivityId, event.object_id)
          ),
        });
        if (existingWorkout) return;

        const workoutData = convertStravaActivity(activity);
        const existingByDate = await db.query.workouts.findFirst({
          where: and(
            eq(workouts.profileId, settings.profileId),
            eq(workouts.date, workoutData.date),
            gte(workouts.distanceMiles, workoutData.distanceMiles - 0.1)
          ),
        });

        let workoutId: number | null = null;
        if (existingByDate && Math.abs((existingByDate.distanceMiles || 0) - workoutData.distanceMiles) < 0.2) {
          await db.update(workouts)
            .set({
              source: 'strava',
              stravaActivityId: activity.id,
              stravaName: activity.name || existingByDate.stravaName,
              polyline: workoutData.polyline,
              updatedAt: new Date().toISOString(),
            })
            .where(eq(workouts.id, existingByDate.id));
          workoutId = existingByDate.id;
        } else {
          const elapsedTimeMinutes = activity.elapsed_time
            ? Math.round(activity.elapsed_time / 60)
            : undefined;

          // Fetch weather data for the workout location/time (non-blocking)
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
              const weather = await fetchHistoricalWeather(
                activity.start_latlng[0],
                activity.start_latlng[1],
                weatherDate,
                weatherTime
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
              console.warn(`[Strava Webhook] Failed to fetch weather for activity ${activity.id}:`, weatherError);
            }
          }

          const insertResult = await db.insert(workouts).values({
            profileId: settings.profileId,
            date: workoutData.date,
            distanceMiles: workoutData.distanceMiles,
            durationMinutes: workoutData.durationMinutes,
            elapsedTimeMinutes,
            avgPaceSeconds: workoutData.avgPaceSeconds,
            workoutType: workoutData.workoutType as 'recovery' | 'easy' | 'steady' | 'marathon' | 'tempo' | 'threshold' | 'interval' | 'repetition' | 'long' | 'race' | 'cross_train' | 'other',
            notes: workoutData.notes,
            stravaName: activity.name || '',
            source: 'strava',
            stravaActivityId: activity.id,
            avgHeartRate: workoutData.avgHeartRate,
            elevationGainFeet: workoutData.elevationGainFeet,
            polyline: workoutData.polyline,
            ...weatherFields,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }).returning({ id: workouts.id });

          workoutId = insertResult[0]?.id ?? null;
        }

        if (workoutId) {
          const stravaLaps = await getStravaActivityLaps(accessToken, activity.id);
          if (stravaLaps.length > 0) {
            const convertedLaps = classifyLaps(stravaLaps.map(convertStravaLap));
            await saveWorkoutLaps(workoutId, convertedLaps);
          }
        }

        await db.update(userSettings)
          .set({
            stravaLastSyncAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(userSettings.id, settings.id));
      } catch (error) {
        console.error('[Strava Webhook] Failed to import activity.create event:', error);
      }
      break;

    case 'update':
      if (event.updates?.title) {
        // Update activity title if it exists
        await db.update(workouts)
          .set({
            stravaName: event.updates.title,
            notes: event.updates.title,
            updatedAt: new Date().toISOString()
          })
          .where(and(
            eq(workouts.stravaActivityId, event.object_id),
            eq(workouts.profileId, settings.profileId!)
          ));
      }
      break;

    case 'delete':
      // If the user deleted the activity in Strava, remove the synced local copy.
      await db.delete(workouts).where(and(
        eq(workouts.stravaActivityId, event.object_id),
        eq(workouts.profileId, settings.profileId!)
      ));
      break;
  }
}

async function getValidAccessTokenForSettings(settings: UserSettings): Promise<string | null> {
  if (!settings.stravaAccessToken) {
    return null;
  }

  if (!settings.stravaTokenExpiresAt || !isTokenExpired(settings.stravaTokenExpiresAt)) {
    return decryptToken(settings.stravaAccessToken);
  }

  if (!settings.stravaRefreshToken) {
    return null;
  }

  try {
    const newTokens = await refreshStravaToken(decryptToken(settings.stravaRefreshToken));
    await db.update(userSettings)
      .set({
        stravaAccessToken: encryptToken(newTokens.accessToken),
        stravaRefreshToken: encryptToken(newTokens.refreshToken),
        stravaTokenExpiresAt: newTokens.expiresAt,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));
    return newTokens.accessToken;
  } catch (error) {
    console.error('[Strava Webhook] Failed to refresh Strava token:', error);
    return null;
  }
}
