'use client';

import { TrendingUp, TrendingDown, Minus, Activity, Timer, Footprints, Flame } from 'lucide-react';
import { formatPace } from '@/lib/utils';
import type { WeeklyStats } from '@/actions/analytics';

interface WeeklyStatsCardProps {
  stats: WeeklyStats;
  weeklyTarget?: number;
}

export function WeeklyStatsCard({ stats, weeklyTarget }: WeeklyStatsCardProps) {
  const progressPercent = weeklyTarget
    ? Math.min(100, Math.round((stats.totalMiles / weeklyTarget) * 100))
    : null;

  const getTrendIcon = () => {
    if (stats.weekOverWeekMileageChange === null) return null;
    if (stats.weekOverWeekMileageChange > 5) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (stats.weekOverWeekMileageChange < -5) {
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    return <Minus className="w-4 h-4 text-slate-400" />;
  };

  const getTrendLabel = () => {
    if (stats.weekOverWeekMileageChange === null) return null;
    const prefix = stats.weekOverWeekMileageChange > 0 ? '+' : '';
    return `${prefix}${stats.weekOverWeekMileageChange}% vs last week`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">This Week</h3>
        {stats.weekOverWeekMileageChange !== null && (
          <div className="flex items-center gap-1 text-sm text-slate-500">
            {getTrendIcon()}
            <span>{getTrendLabel()}</span>
          </div>
        )}
      </div>

      {/* Main stat - Weekly Mileage */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-slate-900">{stats.totalMiles}</span>
          <span className="text-slate-500">miles</span>
          {weeklyTarget && (
            <span className="text-sm text-slate-400">/ {weeklyTarget} target</span>
          )}
        </div>

        {/* Progress bar */}
        {progressPercent !== null && (
          <div className="mt-2">
            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  progressPercent >= 100
                    ? 'bg-green-500'
                    : progressPercent >= 75
                    ? 'bg-blue-500'
                    : progressPercent >= 50
                    ? 'bg-yellow-500'
                    : 'bg-slate-300'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">{progressPercent}% of weekly target</p>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <Footprints className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">{stats.runCount}</p>
            <p className="text-xs text-slate-500">runs</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
            <Timer className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              {Math.floor(stats.totalMinutes / 60)}h {stats.totalMinutes % 60}m
            </p>
            <p className="text-xs text-slate-500">time</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              {stats.avgPace ? formatPace(stats.avgPace) : '--'}/mi
            </p>
            <p className="text-xs text-slate-500">avg pace</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
            <Flame className="w-4 h-4 text-orange-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">
              {stats.avgRpe ? stats.avgRpe.toFixed(1) : '--'}
            </p>
            <p className="text-xs text-slate-500">avg RPE</p>
          </div>
        </div>
      </div>

      {/* Longest run */}
      {stats.longestRun > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Longest run: <span className="font-medium text-slate-700">{stats.longestRun} miles</span>
          </p>
        </div>
      )}
    </div>
  );
}
