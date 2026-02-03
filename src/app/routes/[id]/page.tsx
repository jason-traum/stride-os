// Force dynamic rendering - page depends on database
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, TrendingUp, TrendingDown, Clock, Calendar, Award, MapPin, Route, Zap } from 'lucide-react';
import { db } from '@/lib/db';
import { canonicalRoutes, workouts } from '@/lib/schema';
import { eq, desc, and, isNotNull } from 'drizzle-orm';

interface RouteRun {
  id: number;
  date: string;
  durationMinutes: number | null;
  avgPaceSeconds: number | null;
  avgHr: number | null;
  workoutType: string | null;
  notes: string | null;
}

interface RouteDetail {
  id: number;
  name: string;
  distanceMiles: number;
  elevationGainFeet: number | null;
  runCount: number;
  bestTimeSeconds: number | null;
  bestPaceSeconds: number | null;
  fingerprint: string | null;
  runs: RouteRun[];
}

async function getRoute(id: number): Promise<RouteDetail | null> {
  const route = await db
    .select()
    .from(canonicalRoutes)
    .where(eq(canonicalRoutes.id, id))
    .limit(1);

  if (route.length === 0) return null;

  const runs = await db
    .select({
      id: workouts.id,
      date: workouts.date,
      durationMinutes: workouts.durationMinutes,
      avgPaceSeconds: workouts.avgPaceSeconds,
      avgHr: workouts.avgHr,
      workoutType: workouts.workoutType,
      notes: workouts.notes,
    })
    .from(workouts)
    .where(eq(workouts.routeId, id))
    .orderBy(desc(workouts.date));

  return {
    ...route[0],
    distanceMiles: route[0].distanceMiles || 0,
    runs,
  };
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

function formatPace(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}/mi`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function RunHistoryItem({
  run,
  distance,
  bestTime,
  index,
}: {
  run: RouteRun;
  distance: number;
  bestTime: number | null;
  index: number;
}) {
  const timeSeconds = run.durationMinutes ? Math.round(run.durationMinutes * 60) : null;
  const isPR = timeSeconds !== null && bestTime !== null && timeSeconds <= bestTime;
  const paceSeconds = run.avgPaceSeconds || (timeSeconds && distance ? timeSeconds / distance : null);

  return (
    <div className={`p-4 rounded-lg ${isPR ? 'bg-green-50 border border-green-200' : 'bg-white border border-slate-200'}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">#{index + 1}</span>
            {isPR && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                <Award className="w-3 h-3" />
                PR
              </span>
            )}
          </div>
          <div className="text-sm text-slate-600 mt-1">{formatDate(run.date)}</div>
        </div>
        <div className="text-right">
          {timeSeconds && (
            <div className={`text-lg font-bold ${isPR ? 'text-green-600' : 'text-slate-900'}`}>
              {formatTime(timeSeconds)}
            </div>
          )}
          {paceSeconds && (
            <div className="text-sm text-slate-500">{formatPace(paceSeconds)}</div>
          )}
        </div>
      </div>

      {/* Additional stats */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
        {run.avgHr && (
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            {run.avgHr} bpm
          </span>
        )}
        {run.workoutType && (
          <span className="capitalize">{run.workoutType.replace(/_/g, ' ')}</span>
        )}
      </div>

      {run.notes && (
        <p className="mt-2 text-sm text-slate-600 italic">{run.notes}</p>
      )}
    </div>
  );
}

export default async function RouteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const route = await getRoute(parseInt(id, 10));

  if (!route) {
    notFound();
  }

  // Calculate stats
  const times = route.runs
    .filter((r) => r.durationMinutes !== null)
    .map((r) => Math.round((r.durationMinutes || 0) * 60));

  const avgTime = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null;
  const recentTimes = times.slice(0, 5);
  const olderTimes = times.slice(5, 10);
  const recentAvg = recentTimes.length > 0 ? recentTimes.reduce((a, b) => a + b, 0) / recentTimes.length : null;
  const olderAvg = olderTimes.length > 0 ? olderTimes.reduce((a, b) => a + b, 0) / olderTimes.length : null;
  const trend = recentAvg && olderAvg ? recentAvg - olderAvg : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <Link
            href="/routes"
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            All Routes
          </Link>
          <h1 className="text-xl font-bold text-slate-900">{route.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Route className="w-4 h-4" />
              {route.distanceMiles.toFixed(2)} mi
            </span>
            {route.elevationGainFeet && (
              <span className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                {route.elevationGainFeet} ft gain
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {route.runCount} runs
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Best Stats */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-5 text-white">
          <h3 className="text-sm font-medium text-green-100 mb-3">Personal Records</h3>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-3xl font-bold">
                {route.bestTimeSeconds ? formatTime(route.bestTimeSeconds) : '--:--'}
              </div>
              <div className="text-sm text-green-100">Best Time</div>
            </div>
            <div>
              <div className="text-3xl font-bold">
                {route.bestPaceSeconds ? formatPace(route.bestPaceSeconds) : '--:--'}
              </div>
              <div className="text-sm text-green-100">Best Pace</div>
            </div>
          </div>
        </div>

        {/* Trend Card */}
        {trend !== null && (
          <div className={`rounded-xl p-4 ${trend < 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
            <div className="flex items-center gap-3">
              {trend < 0 ? (
                <TrendingDown className="w-6 h-6 text-green-600" />
              ) : (
                <TrendingUp className="w-6 h-6 text-amber-600" />
              )}
              <div>
                <p className={`font-medium ${trend < 0 ? 'text-green-700' : 'text-amber-700'}`}>
                  {trend < 0 ? 'Improving!' : 'Slowing down'}
                </p>
                <p className={`text-sm ${trend < 0 ? 'text-green-600' : 'text-amber-600'}`}>
                  Recent 5 runs are {Math.abs(Math.round(trend))}s {trend < 0 ? 'faster' : 'slower'} on average
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Statistics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xl font-bold text-slate-900">
                {avgTime ? formatTime(Math.round(avgTime)) : '--:--'}
              </div>
              <div className="text-xs text-slate-500">Average Time</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xl font-bold text-slate-900">
                {avgTime && route.distanceMiles
                  ? formatPace(Math.round(avgTime / route.distanceMiles))
                  : '--:--'}
              </div>
              <div className="text-xs text-slate-500">Average Pace</div>
            </div>
          </div>
        </div>

        {/* Run History */}
        <div>
          <h3 className="font-semibold text-slate-900 mb-4">Run History</h3>
          <div className="space-y-3">
            {route.runs.map((run, i) => (
              <RunHistoryItem
                key={run.id}
                run={run}
                distance={route.distanceMiles}
                bestTime={route.bestTimeSeconds}
                index={i}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
