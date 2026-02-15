'use server';

import { db, workouts } from '@/lib/db';
import { getActiveProfileId } from '@/lib/profile-server';
import { parseLocalDate } from '@/lib/utils';

interface StravaActivity {
  name: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  sport_type: string;
  start_date: string;
  average_speed: number;
  max_speed: number;
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

      // Skip non-running activities
      if (!workoutData || !['Run', 'Trail Run', 'Treadmill'].includes(workoutData.workoutType)) {
        skipped.push(activity);
        continue;
      }

      // Check if already exists
      const exists = await db.query.workouts.findFirst({
        where: (workouts, { and, eq }) => and(
          eq(workouts.profileId, profileId),
          eq(workouts.date, workoutData.date),
          eq(workouts.distanceMiles, workoutData.distanceMiles)
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
        source: source === 'strava' ? 'strava' : 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      imported.push(activity);
    } catch (error) {
      console.error('Failed to import activity:', error);
      skipped.push(activity);
    }
  }

  return {
    imported: imported.length,
    skipped: skipped.length,
    total: activities.length
  };
}

function convertStravaActivity(activity: StravaActivity) {
  if (!['Run', 'Trail Run', 'Treadmill'].includes(activity.sport_type)) {
    return null;
  }

  const distanceMiles = activity.distance * 0.000621371;
  const durationMinutes = Math.round(activity.moving_time / 60);
  const avgPaceSeconds = durationMinutes > 0 ? Math.round((durationMinutes * 60) / distanceMiles) : 0;

  return {
    date: activity.start_date.split('T')[0],
    distanceMiles: Math.round(distanceMiles * 100) / 100,
    durationMinutes,
    avgPaceSeconds,
    avgHr: activity.average_heartrate,
    maxHr: activity.max_heartrate,
    elevationGainFt: Math.round(activity.total_elevation_gain * 3.28084),
    workoutType: 'easy' as const,
    notes: activity.name
  };
}

function convertGarminActivity(activity: GarminActivity) {
  if (!activity['Activity Type']?.toLowerCase().includes('running')) {
    return null;
  }

  // Parse Garmin date format (varies by export)
  const date = parseLocalDate(activity.Date).toISOString().split('T')[0];

  // Parse distance (can be "5.00 km" or "3.1 mi")
  let distanceMiles = 0;
  if (activity.Distance) {
    const distanceMatch = activity.Distance.match(/(\d+\.?\d*)\s*(km|mi)?/);
    if (distanceMatch) {
      const value = parseFloat(distanceMatch[1]);
      const unit = distanceMatch[2] || 'mi';
      distanceMiles = unit === 'km' ? value * 0.621371 : value;
    }
  }

  // Parse time "45:30" or "1:23:45"
  let durationMinutes = 0;
  if (activity.Time) {
    const parts = activity.Time.split(':').map(Number);
    if (parts.length === 2) {
      durationMinutes = parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      durationMinutes = parts[0] * 60 + parts[1];
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
    notes: activity.Title || 'Imported from Garmin'
  };
}