'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AnimatedSection } from '@/components/AnimatedSection';

interface WeekData {
  weekStart: string;  // ISO date of week start
  miles: number;
  minutes?: number;  // Time on feet
  trimp?: number;    // Training impulse (HR-based load)
  target?: number;
  targetMinutes?: number;
  isCurrentWeek?: boolean;
}

type MetricType = 'miles' | 'time' | 'trimp';

interface WeeklyMileageChartProps {
  data: WeekData[];
  weeklyTarget?: number;
  weeklyTargetMinutes?: number;
  showMetricToggle?: boolean;
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
 * Determines the bar color based on value vs target - softer/more transparent tones
 * - Soft teal: above target (exceeded goal)
 * - Soft stone: on track (within 90-100% of target)
 * - Soft red: below target (less than 90%)
 * - Lightest stone: current week (in progress)
 */
function getBarColorEarthy(value: number, target: number | undefined, isCurrentWeek?: boolean): string {
  if (isCurrentWeek) return 'bg-stone-600/70';
  if (!target) return 'bg-stone-500/60';

  const percent = (value / target) * 100;
  if (percent >= 100) return 'bg-dream-500/70';
  if (percent >= 90) return 'bg-stone-500/60';
  return 'bg-red-500/70';
}

/**
 * Gets the status label for accessibility and tooltips
 */
function getStatusLabel(value: number, target: number | undefined, isCurrentWeek?: boolean): string {
  if (isCurrentWeek) return 'In progress';
  if (!target) return '';

  const percent = (value / target) * 100;
  if (percent >= 100) return 'Above target';
  if (percent >= 90) return 'On track';
  return 'Below target';
}

export function WeeklyMileageChart({ data, weeklyTarget, weeklyTargetMinutes, showMetricToggle = true }: WeeklyMileageChartProps) {
  const [mounted, setMounted] = useState(false);
  const [metric, setMetric] = useState<MetricType>('miles');

  // Check if we have time/trimp data
  const hasTimeData = data.some(d => d.minutes && d.minutes > 0);
  const hasTrimpData = data.some(d => d.trimp && d.trimp > 0);

  // Trigger animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Take the last 12 weeks of data and mark current week
  const chartData = useMemo(() => {
    const now = new Date();
    const currentWeekStart = new Date(now);
    // Start of current week (Monday) - convert Sunday=0 to offset 6, others shift by 1
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    currentWeekStart.setDate(now.getDate() - daysToMonday);
    currentWeekStart.setHours(0, 0, 0, 0);

    const sliced = data.slice(-12).map(week => {
      const weekDate = new Date(week.weekStart);
      weekDate.setHours(0, 0, 0, 0);
      // Check if this week starts on the same day as current week
      const isSameWeek = Math.abs(weekDate.getTime() - currentWeekStart.getTime()) < 24 * 60 * 60 * 1000;
      return {
        ...week,
        isCurrentWeek: isSameWeek,
      };
    });

    return sliced;
  }, [data]);

  // Get value based on current metric
  const getValue = (week: WeekData): number => {
    if (metric === 'time') return week.minutes || 0;
    if (metric === 'trimp') return week.trimp || 0;
    return week.miles;
  };

  const getTarget = (): number | undefined => {
    if (metric === 'time') return weeklyTargetMinutes;
    if (metric === 'trimp') return undefined; // No target for TRIMP
    return weeklyTarget;
  };

  const formatValue = (val: number): string => {
    if (metric === 'time') {
      const hrs = Math.floor(val / 60);
      const mins = Math.round(val % 60);
      return hrs > 0 ? `${hrs}h${mins > 0 ? mins : ''}` : `${mins}m`;
    }
    if (metric === 'trimp') return Math.round(val).toString();
    return val.toFixed(0);
  };

  const getUnit = (): string => {
    if (metric === 'time') return 'hrs';
    if (metric === 'trimp') return 'TRIMP';
    return 'mi';
  };

  // Calculate the max value for scaling (include target in calculation)
  const maxValue = useMemo(() => {
    const maxVal = Math.max(...chartData.map(d => getValue(d)), 0);
    const target = getTarget() || 0;
    // Add 10% padding to max for visual breathing room
    return Math.max(maxVal, target) * 1.1 || 10;
  }, [chartData, weeklyTarget, weeklyTargetMinutes, metric]);

  // Determine the effective target for the horizontal line
  const effectiveTarget = getTarget();

  // Calculate target line position as percentage
  const targetLinePercent = effectiveTarget
    ? Math.min(100, (effectiveTarget / maxValue) * 100)
    : null;

  if (chartData.length === 0) {
    return (
      <AnimatedSection>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h3 className="font-semibold text-primary mb-4">Weekly Volume</h3>
          <div className="h-48 flex items-center justify-center text-textTertiary">
            No data available
          </div>
        </div>
      </AnimatedSection>
    );
  }

  const metricLabel = metric === 'time' ? 'Time on Feet' : metric === 'trimp' ? 'Training Load' : 'Mileage';

  return (
    <AnimatedSection>
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      {/* Header with metric toggle */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-primary">Weekly {metricLabel}</h3>
        {showMetricToggle && (hasTimeData || hasTrimpData) && (
          <div className="flex gap-1 bg-bgTertiary p-0.5 rounded-lg">
            <button
              onClick={() => setMetric('miles')}
              className={cn(
                'px-2 py-1 text-xs rounded-md transition-colors',
                metric === 'miles' ? 'bg-bgSecondary text-primary shadow-sm' : 'text-textTertiary hover:text-textSecondary'
              )}
            >
              Miles
            </button>
            {hasTimeData && (
              <button
                onClick={() => setMetric('time')}
                className={cn(
                  'px-2 py-1 text-xs rounded-md transition-colors',
                  metric === 'time' ? 'bg-bgSecondary text-primary shadow-sm' : 'text-textTertiary hover:text-textSecondary'
                )}
              >
                Time
              </button>
            )}
            {hasTrimpData && (
              <button
                onClick={() => setMetric('trimp')}
                className={cn(
                  'px-2 py-1 text-xs rounded-md transition-colors',
                  metric === 'trimp' ? 'bg-bgSecondary text-primary shadow-sm' : 'text-textTertiary hover:text-textSecondary'
                )}
              >
                TRIMP
              </button>
            )}
          </div>
        )}
      </div>

      {/* Target display */}
      {effectiveTarget && (
        <div className="flex items-center gap-2 text-xs text-textTertiary mb-3">
          <span className="w-3 h-0.5 bg-stone-500 inline-block" />
          <span>{metric === 'time' ? formatValue(effectiveTarget) : effectiveTarget} {getUnit()} target</span>
        </div>
      )}

      {/* Legend - softer tones */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-dream-500/70" />
          <span className="text-textSecondary">Above target</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-stone-500/60" />
          <span className="text-textSecondary">On track</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-red-500/70" />
          <span className="text-textSecondary">Below target</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm bg-stone-600/70" />
          <span className="text-textSecondary">In progress</span>
        </div>
      </div>

      {/* Chart Container */}
      <div className="relative">
        {/* Target Line */}
        {targetLinePercent !== null && (
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-strong z-10 pointer-events-none"
            style={{ bottom: `${targetLinePercent}%` }}
          >
            <span className="absolute -top-2.5 -right-1 text-[10px] text-textTertiary bg-bgSecondary px-1">
              {metric === 'time' ? formatValue(effectiveTarget) : effectiveTarget}
            </span>
          </div>
        )}

        {/* Bars Container */}
        <div className="flex items-end h-48">
          {chartData.map((week, index) => {
            const value = getValue(week);
            const target = getTarget();
            const heightPercent = (value / maxValue) * 100;
            const barColor = getBarColorEarthy(value, target, week.isCurrentWeek);
            const statusLabel = getStatusLabel(value, target, week.isCurrentWeek);
            const isCurrentWeek = week.isCurrentWeek;
            const showLabel = !(index % 2 !== 0 && chartData.length > 8);

            return (
              <div
                key={week.weekStart}
                className="flex-1 relative min-w-0 h-full flex flex-col justify-end"
              >
                {/* Value label — sits above bar */}
                <span
                  className={cn(
                    'text-[8px] sm:text-[10px] font-medium text-textSecondary text-center w-full block mb-0.5 transition-opacity duration-300',
                    mounted ? 'opacity-100' : 'opacity-0'
                  )}
                  style={{ transitionDelay: `${index * 30 + 200}ms` }}
                >
                  {value > 0 ? formatValue(value) : ''}
                </span>

                {/* Bar with date label inside */}
                <div
                  className={cn(
                    'w-full transition-all duration-500 ease-out relative overflow-hidden',
                    barColor,
                    index === 0 && 'rounded-tl-md',
                    index === chartData.length - 1 && 'rounded-tr-md'
                  )}
                  style={{
                    height: mounted ? `${Math.max(heightPercent, 1.5)}%` : '0%',
                    transitionDelay: `${index * 30}ms`,
                  }}
                  role="img"
                  aria-label={`${formatValue(value)} ${getUnit()} for week of ${formatWeekLabel(week.weekStart)}. ${statusLabel}`}
                >
                  {/* Date label inside bar at bottom */}
                  {showLabel && (
                    <span
                      className={cn(
                        'absolute bottom-1 left-0 right-0 text-[7px] sm:text-[9px] font-medium text-white/80 text-center truncate px-0.5 transition-opacity duration-300',
                        mounted ? 'opacity-100' : 'opacity-0',
                        'hidden sm:block'
                      )}
                      style={{ transitionDelay: `${index * 30 + 100}ms` }}
                    >
                      {isCurrentWeek ? 'Now' : formatWeekLabel(week.weekStart)}
                    </span>
                  )}
                </div>

                {/* Fallback label below bar on mobile (always visible) */}
                {showLabel && (
                  <span
                    className={cn(
                      'text-[7px] sm:hidden text-white/70 text-center w-full block mt-0.5 truncate transition-opacity duration-300',
                      mounted ? 'opacity-100' : 'opacity-0'
                    )}
                    style={{ transitionDelay: `${index * 30 + 100}ms` }}
                  >
                    {isCurrentWeek ? 'Now' : formatWeekLabel(week.weekStart)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 pt-3 border-t border-borderSecondary flex flex-wrap gap-4 text-sm">
        <div>
          <span className="text-textTertiary">Total:</span>{' '}
          <span className="font-medium text-primary">
            {formatValue(chartData.reduce((sum, d) => sum + getValue(d), 0))} {getUnit()}
          </span>
        </div>
        <div>
          <span className="text-textTertiary">Avg:</span>{' '}
          <span className="font-medium text-primary">
            {formatValue(chartData.reduce((sum, d) => sum + getValue(d), 0) / chartData.length)}/wk
          </span>
        </div>
      </div>
    </div>
    </AnimatedSection>
  );
}

/**
 * Skeleton component for WeeklyMileageChart loading state
 */
export function SkeletonChart({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm',
        className
      )}
    >
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-32 bg-bgTertiary rounded animate-pulse" />
        <div className="h-4 w-20 bg-bgTertiary rounded animate-pulse" />
      </div>

      {/* Legend skeleton */}
      <div className="flex gap-3 mb-4">
        <div className="h-3 w-20 bg-bgTertiary rounded animate-pulse" />
        <div className="h-3 w-16 bg-bgTertiary rounded animate-pulse" />
        <div className="h-3 w-20 bg-bgTertiary rounded animate-pulse" />
      </div>

      {/* Bars skeleton */}
      <div className="flex items-end justify-between gap-2 h-48 px-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div
              className="w-full max-w-[40px] bg-bgTertiary rounded-t-md animate-pulse"
              style={{
                height: `${30 + Math.random() * 50}%`,
                animationDelay: `${i * 100}ms`,
              }}
            />
            <div className="h-3 w-8 bg-bgTertiary rounded mt-2 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Summary skeleton */}
      <div className="mt-4 pt-3 border-t border-borderSecondary flex gap-4">
        <div className="h-4 w-24 bg-bgTertiary rounded animate-pulse" />
        <div className="h-4 w-24 bg-bgTertiary rounded animate-pulse" />
      </div>
    </div>
  );
}
