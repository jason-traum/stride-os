'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Share2, Check, BarChart3 } from 'lucide-react';
import { cn, formatDistance, formatPace, formatDuration, getWorkoutTypeLabel, getWorkoutTypeColor } from '@/lib/utils';
import type { WeeklyRecapData } from '@/actions/weekly-recap';

interface WeeklyRecapCardProps {
  recap: WeeklyRecapData;
  profileId: number;
}

export function WeeklyRecapCard({ recap, profileId }: WeeklyRecapCardProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/share/weekly?profileId=${profileId}`;

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: try native share API
      if (navigator.share) {
        await navigator.share({
          title: `Week of ${recap.weekLabel} | Dreamy`,
          url: shareUrl,
        });
      }
    }
  }

  const TrendIcon = recap.fitnessTrend === 'up'
    ? TrendingUp
    : recap.fitnessTrend === 'down'
      ? TrendingDown
      : Minus;

  const trendColor = recap.fitnessTrend === 'up'
    ? 'text-emerald-400'
    : recap.fitnessTrend === 'down'
      ? 'text-red-400'
      : 'text-slate-400';

  const trendBg = recap.fitnessTrend === 'up'
    ? 'bg-emerald-500/10 border-emerald-500/20'
    : recap.fitnessTrend === 'down'
      ? 'bg-red-500/10 border-red-500/20'
      : 'bg-slate-500/10 border-slate-500/20';

  const trendLabel = recap.fitnessTrend === 'up'
    ? 'Fitness Rising'
    : recap.fitnessTrend === 'down'
      ? 'Fitness Declining'
      : 'Fitness Stable';

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm overflow-hidden border-l-4 border-l-indigo-500/40">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-borderPrimary">
        <BarChart3 className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-medium text-textPrimary">
          Week of {recap.weekLabel}
        </span>
        <div className={cn(
          'ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border',
          trendBg,
          trendColor
        )}>
          <TrendIcon className="w-3 h-3" />
          {trendLabel}
          {recap.ctlChange !== null && (
            <span className="opacity-80">
              ({recap.ctlChange > 0 ? '+' : ''}{recap.ctlChange.toFixed(1)})
            </span>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="p-4">
        <div className="grid grid-cols-4 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold text-textPrimary">{formatDistance(recap.totalMiles)}</div>
            <div className="text-[10px] uppercase tracking-wider text-textTertiary mt-0.5">miles</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-textPrimary">{recap.totalRuns}</div>
            <div className="text-[10px] uppercase tracking-wider text-textTertiary mt-0.5">runs</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-textPrimary">{formatDuration(recap.totalDurationMinutes)}</div>
            <div className="text-[10px] uppercase tracking-wider text-textTertiary mt-0.5">time</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-textPrimary">{formatPace(recap.avgPaceSeconds)}</div>
            <div className="text-[10px] uppercase tracking-wider text-textTertiary mt-0.5">avg pace</div>
          </div>
        </div>

        {/* Key workout highlight */}
        {recap.keyWorkout && (
          <div className="mt-3 pt-3 border-t border-borderSecondary">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-textTertiary">Key Workout</span>
              <span className={cn(
                'px-2 py-0.5 rounded text-[10px] font-medium',
                getWorkoutTypeColor(recap.keyWorkout.workoutType)
              )}>
                {getWorkoutTypeLabel(recap.keyWorkout.workoutType)}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-sm text-textSecondary">
              <span className="font-medium text-textPrimary truncate">
                {recap.keyWorkout.stravaName || getWorkoutTypeLabel(recap.keyWorkout.workoutType)}
              </span>
              {recap.keyWorkout.distanceMiles && (
                <span>{formatDistance(recap.keyWorkout.distanceMiles)} mi</span>
              )}
              {recap.keyWorkout.avgPaceSeconds && recap.keyWorkout.avgPaceSeconds < 1800 && (
                <span>{formatPace(recap.keyWorkout.avgPaceSeconds)}/mi</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Share button */}
      <button
        onClick={handleShare}
        className="w-full flex items-center justify-center gap-2 py-2.5 border-t border-borderPrimary text-xs font-medium text-violet-400 hover:bg-violet-500/5 transition-colors"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5" />
            Link copied!
          </>
        ) : (
          <>
            <Share2 className="w-3.5 h-3.5" />
            Share your week
          </>
        )}
      </button>
    </div>
  );
}
