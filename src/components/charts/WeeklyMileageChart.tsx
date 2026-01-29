'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface WeekData {
  weekStart: string;  // ISO date of week start
  miles: number;
  target?: number;
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
  if (!target) return 'bg-blue-500';

  const percent = (miles / target) * 100;
  if (percent >= 100) return 'bg-green-500';
  if (percent >= 90) return 'bg-blue-500';
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

  // Take the last 8 weeks of data
  const chartData = useMemo(() => {
    const sliced = data.slice(-8);
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
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900 mb-4">Weekly Mileage</h3>
        <div className="h-48 flex items-center justify-center text-slate-500">
          No mileage data available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-900">Weekly Mileage</h3>
        {effectiveTarget && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="w-3 h-0.5 bg-slate-400 inline-block" />
            <span>{effectiveTarget} mi target</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-green-500" />
          <span className="text-slate-600">Above target</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
          <span className="text-slate-600">On track</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-yellow-500" />
          <span className="text-slate-600">Below target</span>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        {/* Target Line */}
        {targetLinePercent !== null && (
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-slate-400 z-10 pointer-events-none"
            style={{ bottom: `${targetLinePercent}%` }}
          >
            <span className="absolute -top-2.5 -right-1 text-[10px] text-slate-500 bg-white px-1">
              {effectiveTarget}
            </span>
          </div>
        )}

        {/* Bars Container */}
        <div className="flex items-end justify-between gap-1 sm:gap-2 h-48 px-1">
          {chartData.map((week, index) => {
            const target = week.target ?? weeklyTarget;
            const heightPercent = (week.miles / maxValue) * 100;
            const barColor = getBarColor(week.miles, target);
            const statusLabel = getStatusLabel(week.miles, target);

            return (
              <div
                key={week.weekStart}
                className="flex-1 flex flex-col items-center min-w-0"
              >
                {/* Bar with value */}
                <div className="relative w-full h-full flex flex-col items-center justify-end">
                  {/* Mileage value above bar */}
                  <span
                    className={cn(
                      'text-[10px] sm:text-xs font-medium text-slate-700 mb-1 transition-opacity duration-300',
                      mounted ? 'opacity-100' : 'opacity-0'
                    )}
                    style={{ transitionDelay: `${index * 50 + 200}ms` }}
                  >
                    {week.miles.toFixed(1)}
                  </span>

                  {/* Bar */}
                  <div
                    className={cn(
                      'w-full max-w-[40px] rounded-t-md transition-all duration-500 ease-out',
                      barColor
                    )}
                    style={{
                      height: mounted ? `${heightPercent}%` : '0%',
                      transitionDelay: `${index * 50}ms`,
                    }}
                    role="img"
                    aria-label={`${week.miles} miles for week of ${formatWeekLabel(week.weekStart)}. ${statusLabel}`}
                  />
                </div>

                {/* Week Label */}
                <span
                  className={cn(
                    'text-[10px] sm:text-xs text-slate-500 mt-2 truncate w-full text-center transition-opacity duration-300',
                    mounted ? 'opacity-100' : 'opacity-0'
                  )}
                  style={{ transitionDelay: `${index * 50 + 100}ms` }}
                >
                  {formatWeekLabel(week.weekStart)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-slate-500">Total:</span>{' '}
          <span className="font-medium text-slate-900">
            {chartData.reduce((sum, d) => sum + d.miles, 0).toFixed(1)} mi
          </span>
        </div>
        <div>
          <span className="text-slate-500">Avg:</span>{' '}
          <span className="font-medium text-slate-900">
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
        'bg-white rounded-xl border border-slate-200 p-5 shadow-sm',
        className
      )}
    >
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-32 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
      </div>

      {/* Legend skeleton */}
      <div className="flex gap-3 mb-4">
        <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
        <div className="h-3 w-16 bg-slate-200 rounded animate-pulse" />
        <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
      </div>

      {/* Bars skeleton */}
      <div className="flex items-end justify-between gap-2 h-48 px-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div
              className="w-full max-w-[40px] bg-slate-200 rounded-t-md animate-pulse"
              style={{
                height: `${30 + Math.random() * 50}%`,
                animationDelay: `${i * 100}ms`,
              }}
            />
            <div className="h-3 w-8 bg-slate-200 rounded mt-2 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Summary skeleton */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex gap-4">
        <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
      </div>
    </div>
  );
}
