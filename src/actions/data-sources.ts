'use server';

import { db } from '@/lib/db';
import { workouts, userSettings, assessments, workoutSegments } from '@/lib/schema';
import { eq, ne, count, sql } from 'drizzle-orm';
import { getSettings } from './settings';
import { syncStravaActivities, getStravaStatus } from './strava';
import { syncIntervalsActivities, getIntervalsStatus } from './intervals';
import { revalidatePath } from 'next/cache';

export type DataSourceType = 'strava' | 'intervals' | 'manual' | 'garmin' | 'apple_health' | 'demo';

export interface DataSourceStats {
  source: DataSourceType;
  workoutCount: number;
  totalMiles: number;
  dateRange?: {
    oldest: string;
    newest: string;
  };
}

export interface DataSourceStatus {
  hasRealData: boolean;
  hasDemoData: boolean;
  preferRealData: boolean;
  sources: DataSourceStats[];
  connectedServices: {
    strava: boolean;
    intervals: boolean;
  };
  recommendation: string;
}

/**
 * Get comprehensive data source status
 */
export async function getDataSourceStatus(): Promise<DataSourceStatus> {
  // Get workout counts by source
  const sourceStats = await db
    .select({
      source: workouts.source,
      count: count(),
      totalMiles: sql<number>`COALESCE(SUM(${workouts.distanceMiles}), 0)`,
      oldest: sql<string>`MIN(${workouts.date})`,
      newest: sql<string>`MAX(${workouts.date})`,
    })
    .from(workouts)
    .groupBy(workouts.source);

  const sources: DataSourceStats[] = sourceStats.map((s) => ({
    source: (s.source || 'manual') as DataSourceType,
    workoutCount: Number(s.count),
    totalMiles: Math.round(Number(s.totalMiles) * 10) / 10,
    dateRange: s.oldest && s.newest ? { oldest: s.oldest, newest: s.newest } : undefined,
  }));

  // Check connected services
  const [stravaStatus, intervalsStatus] = await Promise.all([
    getStravaStatus(),
    getIntervalsStatus(),
  ]);

  // Check for real vs demo data
  const realSources = sources.filter((s) => s.source !== 'demo');
  const demoSource = sources.find((s) => s.source === 'demo');

  const hasRealData = realSources.some((s) => s.workoutCount > 0);
  const hasDemoData = (demoSource?.workoutCount || 0) > 0;

  // Get settings for preference
  const settings = await getSettings();
  const preferRealData = settings?.preferRealData ?? true;

  // Generate recommendation
  let recommendation = '';
  if (!hasRealData && !hasDemoData) {
    if (stravaStatus.isConnected) {
      recommendation = 'Sync your Strava data to get started.';
    } else {
      recommendation = 'Connect Strava or log workouts manually to get started.';
    }
  } else if (hasRealData && hasDemoData) {
    recommendation = 'You have both real and demo data. Consider clearing demo data to only see your actual workouts.';
  } else if (!hasRealData && hasDemoData) {
    if (stravaStatus.isConnected) {
      recommendation = 'You have demo data but Strava is connected. Sync Strava to replace demo data with your real workouts.';
    } else {
      recommendation = 'Currently using demo data. Connect Strava to see your real workouts.';
    }
  } else {
    recommendation = 'Your workout data is synced and ready.';
  }

  return {
    hasRealData,
    hasDemoData,
    preferRealData,
    sources,
    connectedServices: {
      strava: stravaStatus.isConnected,
      intervals: intervalsStatus.isConnected,
    },
    recommendation,
  };
}

/**
 * Check if user has any real (non-demo) workout data
 */
export async function hasRealWorkoutData(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _result = await db
    .select({ count: count() })
    .from(workouts)
    .where(ne(workouts.source, 'demo'));

  return Number(result[0]?.count || 0) > 0;
}

/**
 * Clear all demo data from the database
 */
export async function clearDemoData(): Promise<{ success: boolean; deletedCount: number }> {
  try {
    // Get demo workout IDs first
    const demoWorkouts = await db
      .select({ id: workouts.id })
      .from(workouts)
      .where(eq(workouts.source, 'demo'));

    const demoIds = demoWorkouts.map((w) => w.id);

    if (demoIds.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    // Delete related data first (foreign key constraints)
    for (const id of demoIds) {
      await db.delete(workoutSegments).where(eq(workoutSegments.workoutId, id));
      await db.delete(assessments).where(eq(assessments.workoutId, id));
    }

    // Delete demo workouts
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const result = await db.delete(workouts).where(eq(workouts.source, 'demo'));

    revalidatePath('/');
    revalidatePath('/history');
    revalidatePath('/analytics');
    revalidatePath('/today');

    return { success: true, deletedCount: demoIds.length };
  } catch (error) {
    console.error('Failed to clear demo data:', error);
    return { success: false, deletedCount: 0 };
  }
}

/**
 * Sync all connected data sources and optionally clear demo data
 */
export async function syncAllDataSources(options?: {
  clearDemo?: boolean;
  fullSync?: boolean;
}): Promise<{
  success: boolean;
  results: {
    strava?: { imported: number; skipped: number };
    intervals?: { imported: number; skipped: number };
    demoCleared?: number;
  };
  error?: string;
}> {
  const results: {
    strava?: { imported: number; skipped: number };
    intervals?: { imported: number; skipped: number };
    demoCleared?: number;
  } = {};

  try {
    const [stravaStatus, intervalsStatus] = await Promise.all([
      getStravaStatus(),
      getIntervalsStatus(),
    ]);

    // Clear demo data first if requested and we have a connected service
    if (options?.clearDemo && (stravaStatus.isConnected || intervalsStatus.isConnected)) {
      const clearResult = await clearDemoData();
      results.demoCleared = clearResult.deletedCount;
    }

    // Sync Strava
    if (stravaStatus.isConnected) {
      console.log('[Data Sources] Syncing Strava...');
      const stravaResult = await syncStravaActivities({
        fullSync: options?.fullSync,
      });
      if (stravaResult.success) {
        results.strava = {
          imported: stravaResult.imported,
          skipped: stravaResult.skipped,
        };
      }
    }

    // Sync Intervals.icu
    if (intervalsStatus.isConnected) {
      console.log('[Data Sources] Syncing Intervals.icu...');
      const intervalsResult = await syncIntervalsActivities({
        fullSync: options?.fullSync,
      });
      if (intervalsResult.success) {
        results.intervals = {
          imported: intervalsResult.imported,
          skipped: intervalsResult.skipped,
        };
      }
    }

    revalidatePath('/');
    revalidatePath('/history');
    revalidatePath('/analytics');
    revalidatePath('/today');

    return { success: true, results };
  } catch (error) {
    console.error('Failed to sync data sources:', error);
    return {
      success: false,
      results,
      error: error instanceof Error ? error.message : 'Sync failed',
    };
  }
}

/**
 * Set preference for real vs demo data
 */
export async function setDataPreference(preferReal: boolean): Promise<{ success: boolean }> {
  try {
    const settings = await getSettings();
    if (!settings) {
      return { success: false };
    }

    await db
      .update(userSettings)
      .set({
        preferRealData: preferReal,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));

    // If switching to prefer real data and we have real data, clear demo
    if (preferReal) {
      const hasReal = await hasRealWorkoutData();
      if (hasReal) {
        await clearDemoData();
      }
    }

    revalidatePath('/settings');
    return { success: true };
  } catch (error) {
    console.error('Failed to set data preference:', error);
    return { success: false };
  }
}

/**
 * Initialize data - sync real data if available, otherwise seed demo
 * Call this on app startup or settings page
 */
export async function initializeWorkoutData(): Promise<{
  action: 'synced' | 'demo_seeded' | 'none';
  details: string;
}> {
  const status = await getDataSourceStatus();

  // If we have real data, we're good
  if (status.hasRealData) {
    // Optionally clear lingering demo data
    if (status.hasDemoData && status.preferRealData) {
      await clearDemoData();
    }
    return { action: 'none', details: 'Real workout data already present.' };
  }

  // If Strava is connected but no data, sync it
  if (status.connectedServices.strava) {
    console.log('[Initialize] Strava connected, syncing data...');
    const syncResult = await syncAllDataSources({ clearDemo: true, fullSync: true });
    if (syncResult.success && (syncResult.results.strava?.imported || 0) > 0) {
      return {
        action: 'synced',
        details: `Synced ${syncResult.results.strava?.imported} workouts from Strava.`,
      };
    }
  }

  // If Intervals is connected but no data, sync it
  if (status.connectedServices.intervals) {
    console.log('[Initialize] Intervals.icu connected, syncing data...');
    const syncResult = await syncAllDataSources({ clearDemo: true, fullSync: true });
    if (syncResult.success && (syncResult.results.intervals?.imported || 0) > 0) {
      return {
        action: 'synced',
        details: `Synced ${syncResult.results.intervals?.imported} workouts from Intervals.icu.`,
      };
    }
  }

  // No connected services and no data - demo data should be seeded separately
  // (via /api/seed-demo endpoint or demo-data action)
  if (!status.hasDemoData) {
    return {
      action: 'none',
      details: 'No connected services. Connect Strava or seed demo data to get started.',
    };
  }

  return { action: 'demo_seeded', details: 'Using demo data.' };
}

/**
 * Get summary of what data would be affected by clearing demo
 */
export async function getDemoClearPreview(): Promise<{
  workoutCount: number;
  totalMiles: number;
  dateRange?: { oldest: string; newest: string };
}> {
  const result = await db
    .select({
      count: count(),
      totalMiles: sql<number>`COALESCE(SUM(${workouts.distanceMiles}), 0)`,
      oldest: sql<string>`MIN(${workouts.date})`,
      newest: sql<string>`MAX(${workouts.date})`,
    })
    .from(workouts)
    .where(eq(workouts.source, 'demo'));

  const row = result[0];
  return {
    workoutCount: Number(row?.count || 0),
    totalMiles: Math.round(Number(row?.totalMiles || 0) * 10) / 10,
    dateRange: row?.oldest && row?.newest ? { oldest: row.oldest, newest: row.newest } : undefined,
  };
}
