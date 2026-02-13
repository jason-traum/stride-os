'use client';

import { useState } from 'react';
import { RefreshCw, Check, AlertTriangle, Database, Loader2, Calendar, Clock } from 'lucide-react';
import { backfillStravaIds, getMissingStravaIdStats, type BackfillResult } from '@/actions/backfill-strava';
import { format, subDays, subMonths } from 'date-fns';

export function StravaBackfillSlider() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getMissingStravaIdStats>> | null>(null);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [sliderValue, setSliderValue] = useState(7); // Default to 7 days

  // Calculate days based on slider position
  const calculateDays = (value: number): number => {
    if (value <= 30) {
      // 1-30 days: direct mapping
      return value;
    } else if (value <= 42) {
      // 31-42: months 2-12 (increments of 1 month)
      const monthIndex = value - 30;
      return 30 * (monthIndex + 1);
    } else {
      // 43-48: 15, 18, 21, 24 months (increments of 3 months)
      const index = value - 42;
      return 30 * (15 + (index * 3));
    }
  };

  const getDaysFromSlider = (): number => {
    return calculateDays(sliderValue);
  };

  const getDateRangeDisplay = (): { days: number; startDate: string; label: string } => {
    const days = getDaysFromSlider();
    const startDate = format(subDays(new Date(), days), 'MMM d, yyyy');

    let label: string;
    if (days <= 30) {
      label = `${days} day${days > 1 ? 's' : ''}`;
    } else if (days <= 365) {
      const months = Math.round(days / 30);
      label = `${months} month${months > 1 ? 's' : ''}`;
    } else {
      const years = Math.round(days / 365 * 10) / 10;
      label = `${years} year${years > 1 ? 's' : ''}`;
    }

    return { days, startDate, label };
  };

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
    const days = getDaysFromSlider();

    try {
      const r = await backfillStravaIds({ daysBack: days, dryRun });
      setResult(r);
      if (!dryRun && r.matched > 0) {
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

  const { days, startDate, label } = getDateRangeDisplay();

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <Database className="w-5 h-5 text-[#FC4C02]" />
        <div>
          <h3 className="font-semibold text-stone-900">Smart Strava Backfill</h3>
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
            <p className="text-lg font-semibold text-[#FC4C02]">{stats.withoutStravaId}</p>
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

      {/* Time Range Slider */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Time Range
          </label>
          <div className="text-sm text-[#FC4C02] font-semibold">
            {label}
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="range"
            min="1"
            max="48"
            value={sliderValue}
            onChange={(e) => setSliderValue(Number(e.target.value))}
            className="w-full h-2 bg-gradient-to-r from-stone-300 via-stone-400 to-stone-500 rounded-lg appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-stone-700 [&::-webkit-slider-thumb]:border-2
              [&::-webkit-slider-thumb]:border-stone-600 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-stone-700 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-stone-600
              [&::-moz-range-thumb]:shadow-lg [&::-moz-range-thumb]:cursor-pointer"
          />

          {/* Scale labels */}
          <div className="flex justify-between text-xs text-stone-500">
            <span>1 day</span>
            <span>1 mo</span>
            <span>6 mo</span>
            <span>1 yr</span>
            <span>2 yrs</span>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 text-sm text-stone-600 bg-stone-50 rounded-lg p-2">
          <Calendar className="w-4 h-4 text-stone-400" />
          <span>Searching from <span className="font-medium">{startDate}</span> to today</span>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="mb-4 flex gap-2">
        <span className="text-xs text-stone-500">Quick select:</span>
        {[
          { value: 7, label: '1 week' },
          { value: 30, label: '1 month' },
          { value: 33, label: '3 months' },
          { value: 36, label: '6 months' },
          { value: 42, label: '1 year' },
        ].map((preset) => (
          <button
            key={preset.value}
            onClick={() => setSliderValue(preset.value)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              sliderValue === preset.value
                ? 'bg-[#FC4C02] text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => runBackfill(true)}
          disabled={loading}
          className="flex-1 px-4 py-2 text-sm font-medium text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Preview ({days} days)
        </button>
        <button
          onClick={() => runBackfill(false)}
          disabled={loading}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#FC4C02] rounded-lg hover:bg-[#E34402] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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

      {/* Help text */}
      <div className="mt-4 text-xs text-stone-500">
        <p className="font-medium mb-1">Tips:</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>Start with a smaller range to test matching</li>
          <li>Preview first to see what will be matched</li>
          <li>Matching uses distance (±5%) and duration (±10%)</li>
        </ul>
      </div>
    </div>
  );
}