// Force dynamic rendering - page depends on database
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { MapPin, TrendingUp, Calendar, ChevronRight, Route } from 'lucide-react';
import { db } from '@/lib/db';
import { canonicalRoutes, workouts } from '@/lib/schema';
import { eq, desc, and, isNotNull } from 'drizzle-orm';
import { formatPace } from '@/lib/utils';

interface RouteWithStats {
  id: number;
  name: string;
  distanceMiles: number;
  elevationGainFeet: number | null;
  runCount: number;
  bestTimeSeconds: number | null;
  bestPaceSeconds: number | null;
  lastRunDate: string | null;
  recentTimes: number[];
}

async function getRoutes(): Promise<RouteWithStats[]> {
  const routes = await db
    .select({
      id: canonicalRoutes.id,
      name: canonicalRoutes.name,
      distanceMiles: canonicalRoutes.distanceMiles,
      elevationGainFeet: canonicalRoutes.elevationGainFeet,
      runCount: canonicalRoutes.runCount,
      bestTimeSeconds: canonicalRoutes.bestTimeSeconds,
      bestPaceSeconds: canonicalRoutes.bestPaceSeconds,
    })
    .from(canonicalRoutes)
    .orderBy(desc(canonicalRoutes.runCount));

  // For each route, get recent runs
  const routesWithStats: RouteWithStats[] = await Promise.all(
    routes.map(async (route) => {
      const recentRuns = await db
        .select({
          date: workouts.date,
          durationMinutes: workouts.durationMinutes,
        })
        .from(workouts)
        .where(
          and(
            eq(workouts.routeId, route.id),
            isNotNull(workouts.durationMinutes)
          )
        )
        .orderBy(desc(workouts.date))
        .limit(10);

      const recentTimes = recentRuns
        .filter((r) => r.durationMinutes !== null)
        .map((r) => Math.round((r.durationMinutes || 0) * 60));

      return {
        ...route,
        distanceMiles: route.distanceMiles || 0,
        lastRunDate: recentRuns[0]?.date || null,
        recentTimes,
      };
    })
  );

  return routesWithStats;
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function ProgressChart({ times, distance }: { times: number[]; distance: number }) {
  if (times.length < 2) {
    return (
      <div className="h-16 flex items-center justify-center text-sm text-tertiary">
        Need more runs to show progress
      </div>
    );
  }

  const reversedTimes = [...times].reverse(); // Oldest first for chart
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const range = maxTime - minTime || 1;

  return (
    <div className="h-16 flex items-end gap-1">
      {reversedTimes.map((time, i) => {
        const height = 20 + ((maxTime - time) / range) * 80;
        const isBest = time === minTime;
        const isRecent = i === reversedTimes.length - 1;

        return (
          <div
            key={i}
            className="flex-1 rounded-t transition-all"
            style={{
              height: `${height}%`,
              backgroundColor: isBest
                ? '#22c55e'
                : isRecent
                ? '#3b82f6'
                : '#e2e8f0',
            }}
            title={`${formatTime(time)} (${formatPace(time / distance)}/mi)`}
          />
        );
      })}
    </div>
  );
}

function RouteCard({ route }: { route: RouteWithStats }) {
  const improvement =
    route.recentTimes.length >= 2
      ? route.recentTimes[route.recentTimes.length - 1] - route.recentTimes[0]
      : null;

  return (
    <Link
      href={`/routes/${route.id}`}
      className="bg-surface-1 rounded-xl border border-default p-5 hover:border-dream-300 hover:shadow-md transition-all group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-primary group-hover:text-dream-600 transition-colors">
            {route.name}
          </h3>
          <div className="flex items-center gap-3 mt-1 text-sm text-textTertiary">
            <span className="flex items-center gap-1">
              <Route className="w-3.5 h-3.5" />
              {route.distanceMiles.toFixed(1)} mi
            </span>
            {route.elevationGainFeet && (
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                {Math.round(route.elevationGainFeet)} ft
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-tertiary group-hover:text-dream-500 transition-colors" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary">{route.runCount}</div>
          <div className="text-xs text-textTertiary">runs</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {route.bestTimeSeconds ? formatTime(route.bestTimeSeconds) : '--'}
          </div>
          <div className="text-xs text-textTertiary">best time</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-dream-600">
            {route.bestPaceSeconds ? `${formatPace(route.bestPaceSeconds)}/mi` : '--'}
          </div>
          <div className="text-xs text-textTertiary">best pace</div>
        </div>
      </div>

      {/* Progress Chart */}
      <div className="bg-bgTertiary rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-textSecondary">Recent Progress</span>
          {improvement !== null && (
            <span
              className={`text-xs font-medium ${
                improvement < 0 ? 'text-green-600' : improvement > 0 ? 'text-red-500' : 'text-textTertiary'
              }`}
            >
              {improvement < 0 ? '↓' : improvement > 0 ? '↑' : '→'}{' '}
              {Math.abs(improvement)}s
            </span>
          )}
        </div>
        <ProgressChart times={route.recentTimes} distance={route.distanceMiles} />
      </div>

      {/* Last run */}
      {route.lastRunDate && (
        <div className="mt-3 pt-3 border-t border-subtle flex items-center gap-2 text-xs text-tertiary">
          <Calendar className="w-3 h-3" />
          Last run: {new Date(route.lastRunDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </div>
      )}
    </Link>
  );
}

export default async function RoutesPage() {
  const routes = await getRoutes();

  // Calculate overall stats
  const totalRoutes = routes.length;
  const totalRuns = routes.reduce((sum, r) => sum + r.runCount, 0);
  const routesWithPR = routes.filter(
    (r) => r.recentTimes.length > 1 && r.recentTimes[0] < r.recentTimes[r.recentTimes.length - 1]
  ).length;

  return (
    <div className="min-h-screen bg-bgTertiary">
      {/* Header */}
      <header className="bg-surface-1 border-b border-default px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-primary">My Routes</h1>
          <p className="text-sm text-textSecondary mt-1">Track progress on your regular running routes</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Summary Stats */}
        <div className="bg-gradient-to-r from-dream-600 to-indigo-600 rounded-xl p-5 text-white">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold">{totalRoutes}</div>
              <div className="text-sm text-dream-100">Routes</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{totalRuns}</div>
              <div className="text-sm text-dream-100">Total Runs</div>
            </div>
            <div>
              <div className="text-3xl font-bold">{routesWithPR}</div>
              <div className="text-sm text-dream-100">Recent PRs</div>
            </div>
          </div>
        </div>

        {/* Routes List */}
        {routes.length === 0 ? (
          <div className="bg-surface-1 rounded-xl border border-default p-8 text-center">
            <div className="w-16 h-16 bg-bgTertiary rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-tertiary" />
            </div>
            <h3 className="font-semibold text-primary mb-2">No routes yet</h3>
            <p className="text-sm text-textTertiary max-w-xs mx-auto">
              Routes are automatically detected when you run the same path multiple times.
              Keep logging your runs!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {routes.map((route) => (
              <RouteCard key={route.id} route={route} />
            ))}
          </div>
        )}

        {/* How it works */}
        <div className="bg-bgTertiary rounded-xl p-4">
          <h4 className="font-medium text-secondary text-sm mb-2">How route tracking works</h4>
          <ul className="text-sm text-textSecondary space-y-1">
            <li>• Routes are detected from GPS data when you run similar paths</li>
            <li>• Run a route 3+ times to unlock progress tracking</li>
            <li>• Track your best times and see improvement over time</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
