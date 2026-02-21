'use server';

import { db } from '@/lib/db';
import { workouts } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { createProfileAction } from '@/lib/action-utils';

// ============================================================
// Types
// ============================================================

export interface DeviceStats {
  deviceName: string;
  workoutCount: number;
  totalMiles: number;
  avgPaceSeconds: number | null;
  avgHr: number | null;
  firstUsed: string; // ISO date
  lastUsed: string;  // ISO date
  /** Breakdown of workout type counts for this device */
  typeCounts: Record<string, number>;
}

export interface DeviceTrackingResult {
  devices: DeviceStats[];
  totalWorkoutsWithDevice: number;
  totalWorkoutsWithoutDevice: number;
}

// ============================================================
// Server action
// ============================================================

export const getDeviceTrackingData = createProfileAction(
  async (profileId: number): Promise<DeviceTrackingResult> => {
    type WorkoutRow = typeof workouts.$inferSelect;

    // Get all workouts for this profile
    const allWorkouts: WorkoutRow[] = await db
      .select()
      .from(workouts)
      .where(eq(workouts.profileId, profileId));

    const withDevice = allWorkouts.filter(
      (w) => w.stravaDeviceName && w.stravaDeviceName.trim() !== ''
    );
    const withoutDevice = allWorkouts.length - withDevice.length;

    if (withDevice.length === 0) {
      return {
        devices: [],
        totalWorkoutsWithDevice: 0,
        totalWorkoutsWithoutDevice: withoutDevice,
      };
    }

    // Group by device name
    const deviceMap = new Map<
      string,
      {
        count: number;
        totalMiles: number;
        totalPace: number;
        paceCount: number;
        totalHr: number;
        hrCount: number;
        firstDate: string;
        lastDate: string;
        typeCounts: Record<string, number>;
      }
    >();

    for (const w of withDevice) {
      const name = w.stravaDeviceName!.trim();
      let entry = deviceMap.get(name);

      if (!entry) {
        entry = {
          count: 0,
          totalMiles: 0,
          totalPace: 0,
          paceCount: 0,
          totalHr: 0,
          hrCount: 0,
          firstDate: w.date,
          lastDate: w.date,
          typeCounts: {},
        };
        deviceMap.set(name, entry);
      }

      entry.count++;
      entry.totalMiles += w.distanceMiles ?? 0;

      if (w.avgPaceSeconds && w.avgPaceSeconds > 0 && w.avgPaceSeconds < 1800) {
        entry.totalPace += w.avgPaceSeconds;
        entry.paceCount++;
      }

      const hr = w.avgHr || w.avgHeartRate;
      if (hr && hr > 0) {
        entry.totalHr += hr;
        entry.hrCount++;
      }

      // Track date range
      if (w.date < entry.firstDate) entry.firstDate = w.date;
      if (w.date > entry.lastDate) entry.lastDate = w.date;

      // Track workout types
      entry.typeCounts[w.workoutType] = (entry.typeCounts[w.workoutType] || 0) + 1;
    }

    // Build result sorted by most used device first
    const devices: DeviceStats[] = Array.from(deviceMap.entries())
      .map(([deviceName, entry]) => ({
        deviceName,
        workoutCount: entry.count,
        totalMiles: Math.round(entry.totalMiles * 10) / 10,
        avgPaceSeconds:
          entry.paceCount > 0
            ? Math.round(entry.totalPace / entry.paceCount)
            : null,
        avgHr:
          entry.hrCount > 0 ? Math.round(entry.totalHr / entry.hrCount) : null,
        firstUsed: entry.firstDate,
        lastUsed: entry.lastDate,
        typeCounts: entry.typeCounts,
      }))
      .sort((a, b) => b.workoutCount - a.workoutCount);

    return {
      devices,
      totalWorkoutsWithDevice: withDevice.length,
      totalWorkoutsWithoutDevice: withoutDevice,
    };
  },
  'getDeviceTrackingData'
);
