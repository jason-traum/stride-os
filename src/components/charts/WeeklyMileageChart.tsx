'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface WeekData {
  weekStart: string;  // ISO date of week start
  miles: number;
  target?: number;
  isCurrentWeek?: boolean;
}

interface WeeklyMileageChartProps {
  data: WeekData[];
  weeklyTarget?: number;
}

/**
 * Formats a week start date to a display label (e.g., "Jan 6")
 */
function formatWeekLabel(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Determines the bar color based on miles vs target
 * - Green: above target (exceeded goal)
 * - Blue: on track (within 90-100% of target)
 * - Yellow: below target (less than 90%)
 */
function getBarColor(miles: number, target: number | undefined): string {
  if (!target) return 'bg-amber-500';

  const percent = (miles / target) * 100;
  if (percent >= 100) return 'bg-green-500';
  if (percent >= 90) return 'bg-amber-500';
  return 'bg-yellow-500';
}

/**
 * Gets the status label for accessibility and tooltips
 */
function getStatusLabel(miles: number, target: number | undefined): string {
  if (!target) return '';

  const percent = (miles / target) * 100;
  if (percent >= 100) return 'Above target';
  if (percent >= 90) return 'On track';
  return 'Below target';
}

export function WeeklyMileageChart({ data, weeklyTarget }: WeeklyMileageChartProps) {
  const [mounted, setMounted] = useState(false);

  // Trigger animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Take the last 12 weeks of data and mark current week
  const chartData = useMemo(() => {
    const now = new Date();
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    const currentWeekStr = currentWeekStart.toISOString().split('T')[0];

    const sliced = data.slice(-12).map(week => ({
      ...week,
      isCurrentWeek: week.weekStart === currentWeekStr ||
        // Also check if within same week (in case of date format differences)
        Math.abs(new Date(week.weekStart).getTime() - currentWeekStart.getTime()) < 7 * 24 * 60 * 60 * 1000 &&
        new Date(week.weekStart) <= now,
    }));

    // Mark the last week as current if it's within the current week timeframe
    if (sliced.length > 0) {
      const lastWeek = sliced[sliced.length - 1];
      const lastWeekDate = new Date(lastWeek.weekStart);
      if (lastWeekDate >= currentWeekStart) {
        sliced[sliced.length - 1] = { ...lastWeek, isCurrentWeek: true };
      }
    }

    return sliced;
  }, [data]);

  // Calculate the max value for scaling (include target in calculation)
  const maxValue = useMemo(() => {
    const maxMiles = Math.max(...chartData.map(d => d.miles), 0);
    const targets = chartData.map(d => d.target ?? weeklyTarget ?? 0);
    const maxTarget = Math.max(...targets, 0);
    // Add 10% padding to max for visual breathing room
    return Math.max(maxMiles, maxTarget) * 1.1 || 10;
  }, [chartData, weeklyTarget]);

  // Determine the effective target for the horizontal line
  const effectiveTarget = weeklyTarget ?? chartData.find(d => d.target)?.target;

  // Calculate target line position as percentage
  const targetLinePercent = effectiveTarget
    ? Math.min(100, (effectiveTarget / maxValue) * 100)
    : null;

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h3 className="font-semibold text-stone-900 mb-4">Weekly Mileage</h3>
        <div className="h-48 flex items-center justify-center text-stone-500">
          No mileage data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-stone-900">Weekly Mileage</h3>
        {effectiveTarget && (
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <span className="w-3 h-0.5 bg-stone-400 inline-block" />
            <span>{effectiveTarget} mi target</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
          <span className="text-stone-600">Above target</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
          <span className="text-stone-600">On track</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-yellow-500" />
          <span className="text-stone-600">Below target</span>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        {/* Target Line */}
        {targetLinePercent !== null && (
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-stone-400 z-10 pointer-events-none"
            style={{ bottom: `${targetLinePercent}%` }}
          >
            <span className="absolute -top-2.5 -right-1 text-[10px] text-stone-500 bg-white px-1">
              {effectiveTarget}
            </span>
          </div>
        )}

        {/* Bars Container - h-48 = 192px, no gaps between bars */}
        <div className="flex items-end h-48">
          {chartData.map((week, index) => {
            const target = week.target ?? weeklyTarget;
            const heightPercent = (week.miles / maxValue) * 100;
            // Convert percentage to pixels (192px container minus ~24px for label = ~168px for bar area)
            const heightPx = (heightPercent / 100) * 168;
            const barColor = getBarColor(week.miles, target);
            const statusLabel = getStatusLabel(week.miles, target);
            const isCurrentWeek = week.isCurrentWeek;

            return (
              <div
                key={week.weekStart}
                className="flex-1 flex flex-col items-center justify-end min-w-0"
              >
                {/* Mileage value above bar */}
                <span
                  className={cn(
                    'text-[8px] sm:text-[10px] font-medium text-stone-700 mb-0.5 transition-opacity duration-300',
                    mounted ? 'opacity-100' : 'opacity-0'
                  )}
                  style={{ transitionDelay: `${index * 30 + 200}ms` }}
                >
                  {week.miles > 0 ? week.miles.toFixed(0) : ''}
                </span>

                {/* Bar - no gaps, full width, current week translucent */}
                <div
                  className={cn(
                    'w-full transition-all duration-500 ease-out',
                    barColor,
                    isCurrentWeek ? 'opacity-50' : 'opacity-100',
                    // Only round the outside corners
                    index === 0 && 'rounded-tl-md',
                    index === chartData.length - 1 && 'rounded-tr-md'
                  )}
                  style={{
                    height: mounted ? `${Math.max(heightPx, 2)}px` : '0px',
                    transitionDelay: `${index * 30}ms`,
                  }}
                  role="img"
                  aria-label={`${week.miles} miles for week of ${formatWeekLabel(week.weekStart)}. ${statusLabel}${isCurrentWeek ? ' (current week - in progress)' : ''}`}
                />

                {/* Week Label - only show every 2nd or 3rd for space */}
                <span
                  className={cn(
                    'text-[8px] sm:text-[10px] text-stone-500 mt-1 truncate w-full text-center transition-opacity duration-300',
                    mounted ? 'opacity-100' : 'opacity-0',
                    // Show fewer labels on mobile
                    index % 2 !== 0 && chartData.length > 8 && 'hidden sm:block'
                  )}
                  style={{ transitionDelay: `${index * 30 + 100}ms` }}
                >
                  {isCurrentWeek ? 'Now' : formatWeekLabel(week.weekStart)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-stone-500">Total:</span>{' '}
          <span className="font-medium text-stone-900">
            {chartData.reduce((sum, d) => sum + d.miles, 0).toFixed(1)} mi
          </span>
        </div>
        <div>
          <span className="text-stone-500">Avg:</span>{' '}
          <span className="font-medium text-stone-900">
            {(chartData.reduce((sum, d) => sum + d.miles, 0) / chartData.length).toFixed(1)} mi/wk
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton component for WeeklyMileageChart loading state
 */
export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-stone-200 p-5 shadow-sm',
        className
      )}
    >
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-32 bg-stone-200 rounded animate-pulse" />
        <div className="h-4 w-20 bg-stone-200 rounded animate-pulse" />
      </div>

      {/* Legend skeleton */}
      <div className="flex gap-3 mb-4">
        <div className="h-3 w-20 bg-stone-200 rounded animate-pulse" />
        <div className="h-3 w-16 bg-stone-200 rounded animate-pulse" />
        <div className="h-3 w-20 bg-stone-200 rounded animate-pulse" />
      </div>

      {/* Bars skeleton */}
      <div className="flex items-end justify-between gap-2 h-48 px-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div
              className="w-full max-w-[40px] bg-stone-200 rounded-t-md animate-pulse"
              style={{
                height: `${30 + Math.random() * 50}%`,
                animationDelay: `${i * 100}ms`,
              }}
            />
            <div className="h-3 w-8 bg-stone-200 rounded mt-2 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Summary skeleton */}
      <div className="mt-4 pt-3 border-t border-stone-100 flex gap-4">
        <div className="h-4 w-24 bg-stone-200 rounded animate-pulse" />
        <div className="h-4 w-24 bg-stone-200 rounded animate-pulse" />
      </div>
    </div>
  );
}
