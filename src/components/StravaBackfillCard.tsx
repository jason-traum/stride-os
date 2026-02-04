'use client';

import { useState } from 'react';
import { RefreshCw, Check, AlertTriangle, Database, Loader2 } from 'lucide-react';
import { backfillStravaIds, getMissingStravaIdStats, type BackfillResult } from '@/actions/backfill-strava';

export function StravaBackfillCard() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getMissingStravaIdStats>> | null>(null);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [daysBack, setDaysBack] = useState(90);

  const checkStats = async () => {
    setChecking(true);
    try {
      const s = await getMissingStravaIdStats();
      setStats(s);
    } catch (error) {
      console.error('Failed to get stats:', error);
    }
    setChecking(false);
  };

  const runBackfill = async (dryRun: boolean) => {
    setLoading(true);
    setResult(null);
    try {
      const r = await backfillStravaIds({ daysBack, dryRun });
      setResult(r);
      // Refresh stats after backfill
      if (!dryRun) {
        await checkStats();
      }
    } catch (error) {
      setResult({
        matched: 0,
        lapsAdded: 0,
        errors: [`Failed: ${error}`],
        details: [],
      });
    }
    setLoading(false);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <Database className="w-5 h-5 text-orange-500" />
        <div>
          <h3 className="font-semibold text-stone-900">Backfill Strava Data</h3>
          <p className="text-xs text-stone-500">Match workouts to Strava activities and fetch lap data</p>
        </div>
      </div>

      {/* Stats */}
      {stats ? (
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div className="bg-stone-50 rounded-lg p-3">
            <p className="text-stone-500 text-xs">With Strava ID</p>
            <p className="text-lg font-semibold text-stone-900">{stats.withStravaId}</p>
          </div>
          <div className="bg-stone-50 rounded-lg p-3">
            <p className="text-stone-500 text-xs">Missing Strava ID</p>
            <p className="text-lg font-semibold text-orange-600">{stats.withoutStravaId}</p>
          </div>
          <div className="bg-stone-50 rounded-lg p-3">
            <p className="text-stone-500 text-xs">With Lap Data</p>
            <p className="text-lg font-semibold text-teal-600">{stats.withLaps}</p>
          </div>
          <div className="bg-stone-50 rounded-lg p-3">
            <p className="text-stone-500 text-xs">Missing Laps</p>
            <p className="text-lg font-semibold text-rose-600">{stats.withoutLaps}</p>
          </div>
        </div>
      ) : (
        <button
          onClick={checkStats}
          disabled={checking}
          className="w-full mb-4 px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors flex items-center justify-center gap-2"
        >
          {checking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Check Status
        </button>
      )}

      {/* Days selector */}
      <div className="mb-4">
        <label className="text-xs text-stone-500 block mb-1">Days to look back</label>
        <select
          value={daysBack}
          onChange={(e) => setDaysBack(Number(e.target.value))}
          className="w-full px-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value={30}>30 days</option>
          <option value={60}>60 days</option>
          <option value={90}>90 days</option>
          <option value={180}>180 days</option>
          <option value={365}>1 year</option>
        </select>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => runBackfill(true)}
          disabled={loading}
          className="flex-1 px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Preview
        </button>
        <button
          onClick={() => runBackfill(false)}
          disabled={loading}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Run Backfill
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className={`mt-4 p-3 rounded-lg ${result.errors.length > 0 ? 'bg-rose-50' : 'bg-teal-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            {result.errors.length > 0 ? (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            ) : (
              <Check className="w-4 h-4 text-teal-600" />
            )}
            <span className={`text-sm font-medium ${result.errors.length > 0 ? 'text-rose-700' : 'text-teal-700'}`}>
              {result.matched} matched, {result.lapsAdded} laps added
            </span>
          </div>

          {result.errors.length > 0 && (
            <div className="text-xs text-rose-600 space-y-1">
              {result.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}

          {result.details.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto text-xs text-stone-600 space-y-1">
              {result.details.slice(0, 10).map((d, i) => (
                <p key={i}>
                  {d.date}: Workout #{d.workoutId} → Strava {d.stravaId} ({d.lapCount} laps)
                </p>
              ))}
              {result.details.length > 10 && (
                <p className="text-stone-400">...and {result.details.length - 10} more</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
