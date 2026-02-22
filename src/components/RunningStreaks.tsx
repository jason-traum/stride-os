'use client';

import { useState, useEffect } from 'react';
import { Flame, Trophy, TrendingUp, Loader2 } from 'lucide-react';
import { getStreakData, type StreakData } from '@/actions/running-streaks';

function getEncouragingMessage(data: StreakData): string {
  if (data.streakStatus === 'no_data') {
    return 'Log your first run to start tracking!';
  }
  if (data.currentStreak === 0) {
    return 'Start a new streak today!';
  }
  if (data.currentStreak >= data.longestStreak && data.longestStreak > 1) {
    return 'New all-time record! Keep pushing!';
  }
  if (data.currentStreak >= data.longestStreak - 2 && data.longestStreak > 3) {
    return 'Closing in on your record!';
  }
  if (data.currentStreak >= 14) {
    return 'Incredible consistency. Champion mentality.';
  }
  if (data.currentStreak >= 7) {
    return 'Full week and counting. Respect.';
  }
  if (data.currentStreak >= 3) {
    return 'Building momentum. Keep it going!';
  }
  return 'Every day counts. Keep showing up.';
}

function getStreakColor(streak: number): string {
  if (streak >= 14) return 'text-violet-400';
  if (streak >= 7) return 'text-rose-400';
  if (streak >= 3) return 'text-orange-400';
  if (streak >= 1) return 'text-amber-400';
  return 'text-textTertiary';
}

function getFlameIntensity(streak: number): string {
  if (streak >= 14) return 'text-violet-400 animate-pulse';
  if (streak >= 7) return 'text-rose-400';
  if (streak >= 3) return 'text-orange-400';
  if (streak >= 1) return 'text-amber-400';
  return 'text-textTertiary';
}

export function RunningStreaks() {
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStreakData().then(result => {
      if (result.success) setData(result.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm border-l-4 border-l-orange-500/40">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-4 h-4 text-orange-400" />
          <span className="text-sm font-semibold text-textPrimary">Consistency</span>
        </div>
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-textTertiary" />
        </div>
      </div>
    );
  }

  if (!data || data.streakStatus === 'no_data') {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm border-l-4 border-l-orange-500/40">
        <div className="flex items-center gap-2 mb-3">
          <Flame className="w-4 h-4 text-textTertiary" />
          <span className="text-sm font-semibold text-textPrimary">Consistency</span>
        </div>
        <p className="text-sm text-textTertiary">Log your first run to start tracking streaks!</p>
      </div>
    );
  }

  const message = getEncouragingMessage(data);
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm border-l-4 border-l-orange-500/40">
      {/* Header row: streak + longest */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Current streak */}
          <div className="flex items-center gap-1.5">
            <Flame className={`w-5 h-5 ${getFlameIntensity(data.currentStreak)}`} />
            <span className={`text-2xl font-bold ${getStreakColor(data.currentStreak)}`}>
              {data.currentStreak}
            </span>
            <span className="text-xs text-textTertiary">day streak</span>
          </div>

          {/* Divider */}
          <div className="h-5 w-px bg-borderSecondary" />

          {/* Longest streak */}
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500/60" />
            <span className="text-sm font-semibold text-textSecondary">{data.longestStreak}</span>
            <span className="text-xs text-textTertiary">best</span>
          </div>
        </div>

        {/* Weekly consistency badge */}
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-dream-500" />
          <span className="text-sm font-semibold text-textPrimary">{data.weeklyConsistency}%</span>
          <span className="text-xs text-textTertiary">consistent</span>
        </div>
      </div>

      {/* Weekly consistency progress bar */}
      <div className="mb-3">
        <div className="h-1.5 bg-bgTertiary rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-dream-600 to-dream-400"
            style={{ width: `${Math.min(data.weeklyConsistency, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-textTertiary">
            {data.currentWeekStatus.runsThisWeek} run{data.currentWeekStatus.runsThisWeek !== 1 ? 's' : ''} this week
          </span>
          <span className="text-[10px] text-textTertiary">
            avg {data.currentWeekStatus.typicalRunsPerWeek}/wk
          </span>
        </div>
      </div>

      {/* 12-week mini heatmap */}
      <div className="mb-2">
        <div className="grid gap-[3px]" style={{
          gridTemplateColumns: 'repeat(12, 1fr)',
          gridTemplateRows: 'repeat(7, 1fr)',
        }}>
          {/* Render column by column (weeks), row by row (days Mon-Sun) */}
          {Array.from({ length: 7 }, (_, dayIdx) =>
            Array.from({ length: 12 }, (_, weekIdx) => {
              const cell = data.heatmap.find(
                h => h.weekIndex === weekIdx && h.dayOfWeek === dayIdx
              );
              if (!cell) {
                return (
                  <div
                    key={`${weekIdx}-${dayIdx}`}
                    className="aspect-square rounded-[2px] bg-transparent"
                  />
                );
              }

              const isToday = cell.date === todayStr;
              const isFuture = cell.date > todayStr;

              return (
                <div
                  key={cell.date}
                  className={`aspect-square rounded-[2px] transition-colors ${
                    isFuture
                      ? 'bg-transparent'
                      : cell.hasRun
                        ? isToday
                          ? 'bg-dream-400 ring-1 ring-dream-300'
                          : 'bg-dream-500'
                        : isToday
                          ? 'bg-bgTertiary ring-1 ring-textTertiary/30'
                          : 'bg-bgTertiary'
                  }`}
                  title={`${cell.date}${cell.hasRun ? ' - ran' : ''}`}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Encouraging message */}
      <p className="text-xs text-textTertiary italic">{message}</p>
    </div>
  );
}
