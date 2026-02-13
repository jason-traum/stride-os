'use client';

import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface VolumeSummaryCardsProps {
  thisWeekMiles: number;
  lastWeekMiles: number;
  thisMonthMiles: number;
  lastMonthMiles: number;
  ytdMiles: number;
  lastYearSameTimeMiles?: number;
}

function formatChange(current: number, previous: number): {
  value: string;
  trend: 'up' | 'down' | 'same';
  color: string;
} {
  if (previous === 0) {
    return { value: '+' + current.toFixed(1), trend: 'up', color: 'text-teal-600' };
  }

  const diff = current - previous;
  const percent = Math.round((diff / previous) * 100);

  if (percent === 0) {
    return { value: '0%', trend: 'same', color: 'text-textTertiary' };
  }

  return {
    value: `${percent > 0 ? '+' : ''}${percent}%`,
    trend: percent > 0 ? 'up' : 'down',
    color: percent > 0 ? 'text-teal-600' : 'text-textSecondary',
  };
}

export function VolumeSummaryCards({
  thisWeekMiles,
  lastWeekMiles,
  thisMonthMiles,
  lastMonthMiles,
  ytdMiles,
  lastYearSameTimeMiles,
}: VolumeSummaryCardsProps) {
  const weekChange = formatChange(thisWeekMiles, lastWeekMiles);
  const monthChange = formatChange(thisMonthMiles, lastMonthMiles);
  const ytdChange = lastYearSameTimeMiles
    ? formatChange(ytdMiles, lastYearSameTimeMiles)
    : null;

  const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'same' }) => {
    if (trend === 'up') return <TrendingUp className="w-3.5 h-3.5" />;
    if (trend === 'down') return <TrendingDown className="w-3.5 h-3.5" />;
    return <Minus className="w-3.5 h-3.5" />;
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
      {/* This Week */}
      <div className="flex-shrink-0 bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm min-w-[140px]">
        <div className="text-xs text-textTertiary font-medium mb-1">This Week</div>
        <div className="text-2xl font-bold text-primary">{thisWeekMiles.toFixed(1)}</div>
        <div className="text-xs text-tertiary">miles</div>
        <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', weekChange.color)}>
          <TrendIcon trend={weekChange.trend} />
          <span>{weekChange.value} vs last week</span>
        </div>
      </div>

      {/* This Month */}
      <div className="flex-shrink-0 bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm min-w-[140px]">
        <div className="text-xs text-textTertiary font-medium mb-1">This Month</div>
        <div className="text-2xl font-bold text-primary">{thisMonthMiles.toFixed(1)}</div>
        <div className="text-xs text-tertiary">miles</div>
        <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', monthChange.color)}>
          <TrendIcon trend={monthChange.trend} />
          <span>{monthChange.value} vs last month</span>
        </div>
      </div>

      {/* Year to Date */}
      <div className="flex-shrink-0 bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm min-w-[140px]">
        <div className="text-xs text-textTertiary font-medium mb-1">Year to Date</div>
        <div className="text-2xl font-bold text-primary">{ytdMiles.toFixed(0)}</div>
        <div className="text-xs text-tertiary">miles</div>
        {ytdChange && (
          <div className={cn('flex items-center gap-1 mt-2 text-xs font-medium', ytdChange.color)}>
            <TrendIcon trend={ytdChange.trend} />
            <span>{ytdChange.value} vs last year</span>
          </div>
        )}
      </div>
    </div>
  );
}
