'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn, parseLocalDate } from '@/lib/utils';

interface PaceDataPoint {
  date: string;
  paceSeconds: number;
  workoutType: string;
  fastestSplitSeconds?: number; // Fastest segment pace (any distance)
  goalPaceSeconds?: number; // Target pace from planned workout
  goalSource?: string; // 'planned', 'easy_zone', etc.
}

interface PaceTrendChartProps {
  data: PaceDataPoint[];
}

type TimeRange = '1M' | '3M' | '6M';
type WorkoutFilter = 'all' | 'easy' | 'tempo' | 'interval';

// Format pace seconds to mm:ss string
function formatPace(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Get color for workout type - using centralized color system
import { getWorkoutTypeHexColor } from '@/lib/workout-colors';

function getDotColor(type: string): string {
  return getWorkoutTypeHexColor(type);
}

export function PaceTrendChart({ data }: PaceTrendChartProps) {
  const [mounted, setMounted] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');
  const [workoutFilter, setWorkoutFilter] = useState<WorkoutFilter>('all');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Filter and process data
  const filteredData = useMemo(() => {
    const now = new Date();
    let cutoff: Date;

    switch (timeRange) {
      case '1M':
        cutoff = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case '3M':
        cutoff = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case '6M':
        cutoff = new Date(now.setMonth(now.getMonth() - 6));
        break;
    }

    const cutoffStr = cutoff.toISOString().split('T')[0];

    return data
      .filter(d => d.date >= cutoffStr)
      .filter(d => {
        if (workoutFilter === 'all') return true;
        if (workoutFilter === 'easy') return ['easy', 'recovery', 'long'].includes(d.workoutType);
        if (workoutFilter === 'tempo') return ['tempo', 'steady', 'threshold'].includes(d.workoutType);
        if (workoutFilter === 'interval') return ['interval', 'race'].includes(d.workoutType);
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data, timeRange, workoutFilter]);

  // Calculate chart dimensions and scales
  const chartHeight = 260;
  const chartPadding = { top: 30, right: 20, bottom: 40, left: 50 };

  const { minPace, maxPace, linePath, dots } = useMemo(() => {
    if (filteredData.length === 0) {
      return { minPace: 360, maxPace: 600, linePath: '', dots: [] };
    }

    // For intervals/races, use fastest split if available; otherwise use average
    const paces = filteredData.map(d => {
      if (['interval', 'race'].includes(d.workoutType) && d.fastestSplitSeconds) {
        return d.fastestSplitSeconds;
      }
      return d.paceSeconds;
    });
    // Note: lower pace = faster, so min is actually fastest
    const min = Math.min(...paces);
    const max = Math.max(...paces);
    const padding = (max - min) * 0.15 || 30;

    const minVal = Math.max(240, min - padding); // Don't go below 4:00/mi
    const maxVal = Math.min(900, max + padding); // Don't go above 15:00/mi

    const width = 100; // Percentage
    const yScale = (pace: number) =>
      chartPadding.top + ((pace - minVal) / (maxVal - minVal)) * (chartHeight - chartPadding.top - chartPadding.bottom);
    const xScale = (i: number) =>
      chartPadding.left + (i / Math.max(1, filteredData.length - 1)) * (width - chartPadding.left - chartPadding.right);

    // Get display pace for a data point
    // For quality workouts (interval, race, tempo), show fastest split if available
    // For easy/long/recovery, show average pace
    const getDisplayPace = (d: PaceDataPoint) => {
      const qualityTypes = ['interval', 'race', 'tempo', 'threshold'];
      if (qualityTypes.includes(d.workoutType) && d.fastestSplitSeconds) {
        return d.fastestSplitSeconds;
      }
      return d.paceSeconds;
    };

    // Build line path (coordinates in viewBox units, not percentages)
    const path = filteredData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(getDisplayPace(d))}`)
      .join(' ');

    // Build dots
    const dotList = filteredData.map((d, i) => ({
      x: xScale(i),
      y: yScale(getDisplayPace(d)),
      goalY: d.goalPaceSeconds ? yScale(d.goalPaceSeconds) : undefined,
      displayPace: getDisplayPace(d),
      goalPace: d.goalPaceSeconds,
      goalSource: d.goalSource,
      color: getDotColor(d.workoutType),
      data: d,
      index: i,
      isFastestSplit: ['interval', 'race', 'tempo', 'threshold'].includes(d.workoutType) && !!d.fastestSplitSeconds,
      hasGoal: !!d.goalPaceSeconds,
    }));

    return {
      minPace: minVal,
      maxPace: maxVal,
      linePath: path,
      dots: dotList,
    };
  }, [filteredData, chartHeight]);

  if (data.length === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h3 className="font-semibold text-primary mb-4">Pace Trend</h3>
        <div className="h-48 flex items-center justify-center text-textTertiary">
          Log workouts with pace data to see trends
        </div>
      </div>
    );
  }

  const hoveredDot = hoveredIndex !== null ? dots[hoveredIndex] : null;

  // Calculate y-axis labels (faster at top, slower at bottom)
  const yLabels = [minPace, (minPace + maxPace) / 2, maxPace].map(pace => ({
    pace,
    y: chartPadding.top + ((pace - minPace) / (maxPace - minPace)) * (chartHeight - chartPadding.top - chartPadding.bottom),
    label: formatPace(Math.round(pace)),
  }));

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      {/* Header with Legend */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-semibold text-primary">Pace by Workout Type</h3>
          <p className="text-xs text-textTertiary mt-0.5">
            {workoutFilter === 'easy' && 'Easy run average pace'}
            {workoutFilter === 'tempo' && 'Tempo/threshold pace · Best effort shown'}
            {workoutFilter === 'interval' && 'Best split from intervals & races'}
            {workoutFilter === 'all' && 'Actual vs goal · Best splits for quality workouts'}
          </p>
        </div>
        <div className="flex gap-1">
          {(['1M', '3M', '6M'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-2 py-1 text-xs font-medium rounded transition-colors',
                timeRange === range
                  ? 'bg-accent-teal text-white'
                  : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Legend - using centralized colors */}
      <div className="flex flex-wrap gap-3 mb-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-sky-500 dark:bg-sky-600" />
          <span className="text-textTertiary">Easy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-indigo-400" />
          <span className="text-textTertiary">Long</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-emerald-400" />
          <span className="text-textTertiary">Steady</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-amber-400 dark:bg-amber-600" />
          <span className="text-textTertiary">Tempo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-orange-500 dark:bg-orange-700" />
          <span className="text-textTertiary">Threshold</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-rose-500 dark:bg-rose-700" />
          <span className="text-textTertiary">Intervals</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-purple-500 dark:bg-purple-700" />
          <span className="text-textTertiary">Race</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 border-t-2 border-dashed border-slate-400" />
          <span className="text-textTertiary">Goal</span>
        </div>
      </div>

      {/* Workout Type Filter */}
      <div className="flex gap-2 mb-3">
        {(['all', 'easy', 'tempo', 'interval'] as WorkoutFilter[]).map(filter => (
          <button
            key={filter}
            onClick={() => setWorkoutFilter(filter)}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-full transition-colors capitalize',
              workoutFilter === filter
                ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
            )}
          >
            {filter === 'all' ? 'All Runs' : filter}
          </button>
        ))}
      </div>

      {/* Chart - Bar Chart */}
      {filteredData.length > 0 ? (
        <div
          className="relative w-full"
          style={{ height: chartHeight }}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Y-axis labels - positioned absolutely outside SVG */}
          <div className="absolute left-0 top-0 bottom-0 w-10 flex flex-col justify-between py-4">
            {yLabels.map((label, i) => (
              <div
                key={i}
                className="text-[10px] text-tertiary text-right pr-2"
              >
                {label.label}
              </div>
            ))}
          </div>

          {/* Bar Chart Container */}
          <div
            className="absolute right-0 flex items-end gap-0.5"
            style={{ left: 44, width: 'calc(100% - 56px)', top: 20, bottom: 32 }}
          >
            {dots.map((dot, i) => {
              // Calculate bar height - faster pace = taller bar
              // Container height is chartHeight - 20px top - 32px bottom = ~208px
              const containerHeight = chartHeight - 52;
              const paceRange = maxPace - minPace || 1;
              // Invert: faster (lower seconds) should be taller
              const barHeight = ((maxPace - dot.displayPace) / paceRange) * containerHeight;
              const goalBarHeight = dot.goalPace
                ? ((maxPace - dot.goalPace) / paceRange) * containerHeight
                : 0;

              return (
                <div
                  key={i}
                  className="flex-1 relative flex flex-col items-center justify-end cursor-pointer group"
                  style={{ minWidth: 4, maxWidth: 24 }}
                  onMouseEnter={() => setHoveredIndex(i)}
                >
                  {/* Goal marker line */}
                  {dot.hasGoal && goalBarHeight > 0 && (
                    <div
                      className="absolute w-full border-t-2 border-dashed border-slate-400 z-10"
                      style={{ bottom: goalBarHeight }}
                    />
                  )}
                  {/* Main bar */}
                  <div
                    className={cn(
                      'w-full rounded-t transition-all duration-300',
                      hoveredIndex === i ? 'opacity-100' : 'opacity-85',
                      mounted ? 'scale-y-100' : 'scale-y-0'
                    )}
                    style={{
                      height: Math.max(4, barHeight),
                      backgroundColor: dot.color,
                      transformOrigin: 'bottom',
                      transitionDelay: `${i * 10}ms`
                    }}
                  />
                  {/* Hover highlight */}
                  {hoveredIndex === i && (
                    <div
                      className="absolute inset-0 bg-black/5 rounded-t pointer-events-none"
                      style={{ height: Math.max(4, barHeight), bottom: 0, top: 'auto' }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Grid lines overlay */}
          <div
            className="absolute pointer-events-none"
            style={{ left: 44, right: 12, top: chartPadding.top, bottom: chartPadding.bottom }}
          >
            {[0, 0.5, 1].map((pct, i) => (
              <div
                key={i}
                className="absolute w-full border-t border-borderPrimary"
                style={{ top: `${pct * 100}%` }}
              />
            ))}
          </div>

          {/* Tooltip */}
          {hoveredDot && hoveredIndex !== null && (
            <div
              className="absolute bg-stone-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none z-20"
              style={{
                left: `calc(44px + ${(hoveredIndex / Math.max(1, dots.length)) * 100}% * (100% - 56px) / 100%)`,
                top: 10,
                transform: 'translateX(-50%)',
              }}
            >
              <div className="font-medium">
                {parseLocalDate(hoveredDot.data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: hoveredDot.color }}
                />
                <span className="capitalize">{hoveredDot.data.workoutType}</span>
                <span className="font-bold">{formatPace(hoveredDot.displayPace)}/mi</span>
              </div>
              {hoveredDot.isFastestSplit && (
                <div className="text-tertiary text-[10px] mt-1">
                  Best split (avg: {formatPace(hoveredDot.data.paceSeconds)})
                </div>
              )}
              {hoveredDot.hasGoal && hoveredDot.goalPace && (
                <div className="text-teal-300 text-[10px] mt-1 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 border border-slate-400" />
                  Goal: {formatPace(hoveredDot.goalPace)}/mi
                  {hoveredDot.displayPace < hoveredDot.goalPace && (
                    <span className="text-teal-400 ml-1">
                      ({Math.round(hoveredDot.goalPace - hoveredDot.displayPace)}s faster!)
                    </span>
                  )}
                  {hoveredDot.displayPace > hoveredDot.goalPace && (
                    <span className="text-rose-300 ml-1">
                      ({Math.round(hoveredDot.displayPace - hoveredDot.goalPace)}s slower)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="h-48 flex items-center justify-center text-textTertiary text-sm">
          No {workoutFilter !== 'all' ? workoutFilter : ''} runs in this period
        </div>
      )}
    </div>
  );
}
