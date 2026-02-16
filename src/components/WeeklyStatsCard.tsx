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
      return <TrendingUp className="w-4 h-4 text-dream-500" />;
    } else if (stats.weekOverWeekMileageChange < -5) {
      return <TrendingDown className="w-4 h-4 text-rose-500" />;
    }
    return <Minus className="w-4 h-4 text-tertiary" />;
  };

  const getTrendLabel = () => {
    if (stats.weekOverWeekMileageChange === null) return null;
    const prefix = stats.weekOverWeekMileageChange > 0 ? '+' : '';
    return `${prefix}${stats.weekOverWeekMileageChange}% vs last week`;
  };

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-primary">This Week</h3>
        {stats.weekOverWeekMileageChange !== null && (
          <div className="flex items-center gap-1 text-sm text-textTertiary">
            {getTrendIcon()}
            <span>{getTrendLabel()}</span>
          </div>
        )}
      </div>

      {/* Main stat - Weekly Mileage */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-primary">{stats.totalMiles}</span>
          <span className="text-textTertiary">miles</span>
          {weeklyTarget && (
            <span className="text-sm text-tertiary">/ {weeklyTarget} target</span>
          )}
        </div>

        {/* Progress bar */}
        {progressPercent !== null && (
          <div className="mt-2">
            <div className="w-full bg-bgTertiary rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  progressPercent >= 100
                    ? 'bg-dream-500'
                    : progressPercent >= 75
                    ? 'bg-dream-400'
                    : progressPercent >= 50
                    ? 'bg-surface-3'
                    : 'bg-textTertiary'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-textTertiary mt-1">{progressPercent}% of weekly target</p>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-surface-1 rounded-lg flex items-center justify-center">
            <Footprints className="w-4 h-4 text-dream-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">{stats.runCount}</p>
            <p className="text-xs text-textTertiary">runs</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-dream-50 dark:bg-dream-900/30 rounded-lg flex items-center justify-center">
            <Timer className="w-4 h-4 text-dream-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">
              {Math.floor(stats.totalMinutes / 60)}h {stats.totalMinutes % 60}m
            </p>
            <p className="text-xs text-textTertiary">time</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-dream-50 dark:bg-dream-900/30 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-dream-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">
              {stats.avgPace ? formatPace(stats.avgPace) : '--'}/mi
            </p>
            <p className="text-xs text-textTertiary">avg pace</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-rose-50 dark:bg-rose-900/30 rounded-lg flex items-center justify-center">
            <Flame className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary">
              {stats.avgRpe ? stats.avgRpe.toFixed(1) : '--'}
            </p>
            <p className="text-xs text-textTertiary">avg RPE</p>
          </div>
        </div>
      </div>

      {/* Longest run */}
      {stats.longestRun > 0 && (
        <div className="mt-4 pt-3 border-t border-borderSecondary">
          <p className="text-xs text-textTertiary">
            Longest run: <span className="font-medium text-textSecondary">{stats.longestRun} miles</span>
          </p>
        </div>
      )}
    </div>
  );
}
