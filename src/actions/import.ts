'use server';

import { db, workouts } from '@/lib/db';
import { eq, and, gte, lte } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import { parseLocalDate } from '@/lib/utils';
import { revalidatePath } from 'next/cache';

interface StravaActivity {
  name?: string;
  distance: number;
  moving_time: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  type?: string;        // Strava bulk export uses "type"
  sport_type?: string;  // Strava API uses "sport_type"
  start_date?: string;
  start_date_local?: string;
  average_speed?: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
}

interface GarminActivity {
  'Activity Type': string;
  Date: string;
  Distance: string;
  'Time': string;
  'Avg HR': string;
  'Max HR': string;
  'Elev Gain': string;
  Title: string;
}

const STRAVA_RUN_TYPES = ['Run', 'Trail Run', 'Treadmill', 'VirtualRun'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function importActivities(activities: any[], source: 'strava' | 'garmin') {
  const profileId = await getActiveProfileId();
  const imported = [];
  const skipped = [];

  for (const activity of activities) {
    try {
      let workoutData;

      if (source === 'strava') {
        workoutData = convertStravaActivity(activity);
      } else {
        workoutData = convertGarminActivity(activity);
      }

      // convertStravaActivity / convertGarminActivity return null for non-running
      if (!workoutData) {
        skipped.push(activity);
        continue;
      }

      // Skip activities with no meaningful distance
      if (!workoutData.distanceMiles || workoutData.distanceMiles < 0.1) {
        skipped.push(activity);
        continue;
      }

      // Dedup check: same date + distance within 0.1 miles
      const distanceLow = workoutData.distanceMiles - 0.1;
      const distanceHigh = workoutData.distanceMiles + 0.1;
      const exists = await db.query.workouts.findFirst({
        where: and(
          eq(workouts.profileId, profileId),
          eq(workouts.date, workoutData.date),
          gte(workouts.distanceMiles, distanceLow),
          lte(workouts.distanceMiles, distanceHigh),
        )
      });

      if (exists) {
        skipped.push(activity);
        continue;
      }

      // Insert workout
      await db.insert(workouts).values({
        profileId,
        ...workoutData,
        source: source === 'strava' ? 'strava' : 'garmin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      imported.push(activity);
    } catch (error) {
      console.error('Failed to import activity:', error);
      skipped.push(activity);
    }
  }

  revalidatePath('/');
  revalidatePath('/history');
  revalidatePath('/today');

  return {
    imported: imported.length,
    skipped: skipped.length,
    total: activities.length
  };
}

function convertStravaActivity(activity: StravaActivity) {
  // Handle both Strava bulk export ("type") and API ("sport_type")
  const activityType = activity.sport_type || activity.type || '';
  if (!STRAVA_RUN_TYPES.includes(activityType)) {
    return null;
  }

  const distanceMiles = activity.distance * 0.000621371;
  const durationMinutes = Math.round(activity.moving_time / 60);
  const avgPaceSeconds = distanceMiles > 0 && durationMinutes > 0
    ? Math.round((durationMinutes * 60) / distanceMiles)
    : 0;

  // Prefer start_date_local (bulk export), fall back to start_date (API)
  const dateStr = activity.start_date_local || activity.start_date || '';
  const date = dateStr.split('T')[0];

  if (!date) return null;

  return {
    date,
    distanceMiles: Math.round(distanceMiles * 100) / 100,
    durationMinutes,
    avgPaceSeconds,
    avgHr: activity.average_heartrate ? Math.round(activity.average_heartrate) : undefined,
    maxHr: activity.max_heartrate ? Math.round(activity.max_heartrate) : undefined,
    elevationGainFt: activity.total_elevation_gain
      ? +(activity.total_elevation_gain * 3.28084).toFixed(1)
      : undefined,
    workoutType: 'easy' as const,
    stravaName: activity.name || null,
    notes: null,
  };
}

function convertGarminActivity(activity: GarminActivity) {
  if (!activity['Activity Type']?.toLowerCase().includes('running')) {
    return null;
  }

  // Parse Garmin date format (varies by export)
  const date = parseLocalDate(activity.Date).toISOString().split('T')[0];

  // Parse distance (can be "5.00 km" or "3.1 mi" or just "5.00")
  let distanceMiles = 0;
  if (activity.Distance) {
    const cleaned = activity.Distance.replace(/"/g, '').trim();
    const distanceMatch = cleaned.match(/(\d+\.?\d*)\s*(km|mi)?/);
    if (distanceMatch) {
      const value = parseFloat(distanceMatch[1]);
      const unit = distanceMatch[2] || 'mi';
      distanceMiles = unit === 'km' ? value * 0.621371 : value;
    }
  }

  // Parse time "45:30" (mm:ss) or "1:23:45" (h:mm:ss)
  let durationMinutes = 0;
  if (activity.Time) {
    const cleaned = activity.Time.replace(/"/g, '').trim();
    const parts = cleaned.split(':').map(Number);
    if (parts.length === 2) {
      // mm:ss
      durationMinutes = Math.round(parts[0] + parts[1] / 60);
    } else if (parts.length === 3) {
      // h:mm:ss
      durationMinutes = Math.round(parts[0] * 60 + parts[1] + parts[2] / 60);
    }
  }

  const avgPaceSeconds = durationMinutes > 0 && distanceMiles > 0
    ? Math.round((durationMinutes * 60) / distanceMiles)
    : 0;

  return {
    date,
    distanceMiles: Math.round(distanceMiles * 100) / 100,
    durationMinutes,
    avgPaceSeconds,
    avgHr: activity['Avg HR'] ? parseInt(activity['Avg HR']) : undefined,
    maxHr: activity['Max HR'] ? parseInt(activity['Max HR']) : undefined,
    elevationGainFt: activity['Elev Gain'] ? parseInt(activity['Elev Gain']) : undefined,
    workoutType: 'easy' as const,
    notes: activity.Title || 'Imported from Garmin',
  };
}