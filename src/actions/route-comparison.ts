'use server';

import { db } from '@/lib/db';
import { canonicalRoutes, workouts, type CanonicalRoute } from '@/lib/schema';
import { eq, desc, and, isNotNull } from 'drizzle-orm';
import { createProfileAction } from '@/lib/action-utils';

// ==================== Types ====================

export interface RouteWorkoutEntry {
  id: number;
  date: string;
  durationMinutes: number | null;
  avgPaceSeconds: number | null;
  avgHr: number | null;
  workoutType: string;
  isPR: boolean;
}

export interface RoutePaceTrend {
  direction: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  /** Pace change in seconds/mile (negative = getting faster) */
  paceDeltaPerRun: number | null;
  /** Recent 3-run average pace vs older 3-run average */
  recentVsOlderDelta: number | null;
}

export interface FrequentRoute {
  id: number;
  name: string;
  distanceMiles: number;
  elevationGainFt: number | null;
  runCount: number;
  bestPaceSeconds: number | null;
  avgPaceSeconds: number | null;
  lastRunDate: string | null;
  trend: RoutePaceTrend;
  /** The 3 most recent paces for sparkline rendering */
  recentPaces: number[];
}

export interface RouteHistoryResult {
  route: {
    id: number;
    name: string;
    distanceMiles: number;
    elevationGainFt: number | null;
    bestPaceSeconds: number | null;
    bestTimeSeconds: number | null;
  };
  workouts: RouteWorkoutEntry[];
  trend: RoutePaceTrend;
}

// ==================== Helpers ====================

function computeTrend(paces: number[]): RoutePaceTrend {
  if (paces.length < 3) {
    return { direction: 'insufficient_data', paceDeltaPerRun: null, recentVsOlderDelta: null };
  }

  // paces are ordered most-recent-first
  const recent = paces.slice(0, 3);
  const older = paces.slice(3, 6);

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;

  if (older.length === 0) {
    // Only 3 runs: compare first vs last
    const delta = paces[0] - paces[paces.length - 1];
    const direction = delta < -3 ? 'improving' : delta > 3 ? 'declining' : 'stable';
    return { direction, paceDeltaPerRun: Math.round(delta / (paces.length - 1)), recentVsOlderDelta: null };
  }

  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  const recentVsOlderDelta = Math.round(recentAvg - olderAvg);

  // Negative delta means recent is faster (improving)
  const direction = recentVsOlderDelta < -3 ? 'improving' : recentVsOlderDelta > 3 ? 'declining' : 'stable';

  // Simple linear pace change per run
  const n = paces.length;
  let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumXY += i * paces[i];
    sumX += i;
    sumY += paces[i];
    sumX2 += i * i;
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const paceDeltaPerRun = Math.round(slope * 10) / 10;

  return { direction, paceDeltaPerRun, recentVsOlderDelta };
}

// ==================== Server Actions ====================

/**
 * Get full history of workouts on a specific route, sorted by date (newest first).
 */
export const getRouteHistory = createProfileAction(
  async (profileId: number, routeId: number): Promise<RouteHistoryResult | null> => {
    // Get the route
    const routeRows: CanonicalRoute[] = await db
      .select()
      .from(canonicalRoutes)
      .where(and(eq(canonicalRoutes.id, routeId), eq(canonicalRoutes.profileId, profileId)));

    if (routeRows.length === 0) return null;
    const route = routeRows[0];

    // Get all workouts on this route
    const rows: { id: number; date: string; durationMinutes: number | null; avgPaceSeconds: number | null; avgHr: number | null; workoutType: string }[] = await db
      .select({
        id: workouts.id,
        date: workouts.date,
        durationMinutes: workouts.durationMinutes,
        avgPaceSeconds: workouts.avgPaceSeconds,
        avgHr: workouts.avgHr,
        workoutType: workouts.workoutType,
      })
      .from(workouts)
      .where(and(eq(workouts.routeId, routeId), eq(workouts.profileId, profileId)))
      .orderBy(desc(workouts.date));

    // Find PR pace
    const allPaces = rows.filter((r: { avgPaceSeconds: number | null }) => r.avgPaceSeconds != null).map((r: { avgPaceSeconds: number | null }) => r.avgPaceSeconds!);
    const bestPace = allPaces.length > 0 ? Math.min(...allPaces) : null;

    const entries: RouteWorkoutEntry[] = rows.map((r: { id: number; date: string; durationMinutes: number | null; avgPaceSeconds: number | null; avgHr: number | null; workoutType: string }) => ({
      id: r.id,
      date: r.date,
      durationMinutes: r.durationMinutes,
      avgPaceSeconds: r.avgPaceSeconds,
      avgHr: r.avgHr,
      workoutType: r.workoutType,
      isPR: r.avgPaceSeconds != null && bestPace != null && r.avgPaceSeconds <= bestPace,
    }));

    // Mark only the single fastest run as PR (in case of ties, pick the earliest)
    if (bestPace != null) {
      const prEntries = entries.filter(e => e.isPR);
      if (prEntries.length > 1) {
        // Keep only the earliest (last in the date-descending list)
        for (let i = 0; i < prEntries.length - 1; i++) {
          prEntries[i].isPR = false;
        }
      }
    }

    const trend = computeTrend(allPaces);

    return {
      route: {
        id: route.id,
        name: route.name,
        distanceMiles: route.distanceMiles || 0,
        elevationGainFt: route.totalElevationGain,
        bestPaceSeconds: route.bestPaceSeconds,
        bestTimeSeconds: route.bestTimeSeconds,
      },
      workouts: entries,
      trend,
    };
  },
  'getRouteHistory'
);

/**
 * Get the user's most frequently run routes with computed stats and trends.
 */
export const getFrequentRoutes = createProfileAction(
  async (profileId: number, limit: number = 10): Promise<FrequentRoute[]> => {
    // Get routes sorted by run count
    const routes: CanonicalRoute[] = await db
      .select()
      .from(canonicalRoutes)
      .where(eq(canonicalRoutes.profileId, profileId))
      .orderBy(desc(canonicalRoutes.runCount))
      .limit(limit);

    if (routes.length === 0) return [];

    // For each route, fetch recent workouts to compute trends
    const results: FrequentRoute[] = await Promise.all(
      routes.map(async (route: CanonicalRoute) => {
        const recentRuns: { date: string; avgPaceSeconds: number | null }[] = await db
          .select({
            date: workouts.date,
            avgPaceSeconds: workouts.avgPaceSeconds,
          })
          .from(workouts)
          .where(
            and(
              eq(workouts.routeId, route.id),
              eq(workouts.profileId, profileId),
              isNotNull(workouts.avgPaceSeconds)
            )
          )
          .orderBy(desc(workouts.date))
          .limit(10);

        const paces = recentRuns
          .filter((r: { avgPaceSeconds: number | null }) => r.avgPaceSeconds != null)
          .map((r: { avgPaceSeconds: number | null }) => r.avgPaceSeconds!);

        const trend = computeTrend(paces);

        return {
          id: route.id,
          name: route.name,
          distanceMiles: route.distanceMiles || 0,
          elevationGainFt: route.totalElevationGain,
          runCount: route.runCount,
          bestPaceSeconds: route.bestPaceSeconds,
          avgPaceSeconds: route.averagePaceSeconds,
          lastRunDate: recentRuns[0]?.date || null,
          trend,
          recentPaces: paces.slice(0, 8).reverse(), // oldest-first for chart rendering
        };
      })
    );

    return results;
  },
  'getFrequentRoutes'
);
