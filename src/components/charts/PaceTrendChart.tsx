'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
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

type TimeRange = '1M' | '3M' | '6M' | '1Y';
type WorkoutFilter = 'all' | 'easy' | 'long' | 'tempo' | 'interval' | 'race';

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

const BAR_WIDTH = 18;
const BAR_GAP = 4;
const CHART_HEIGHT = 260;
const Y_AXIS_WIDTH = 44;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 32;

export function PaceTrendChart({ data }: PaceTrendChartProps) {
  const [mounted, setMounted] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('3M');
  const [workoutFilter, setWorkoutFilter] = useState<WorkoutFilter>('all');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Scroll to the right (most recent) on mount and when filter changes
  useEffect(() => {
    if (mounted && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [mounted, timeRange, workoutFilter]);

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
      case '1Y':
        cutoff = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
    }

    const cutoffStr = cutoff.toISOString().split('T')[0];

    return data
      .filter(d => d.date >= cutoffStr)
      .filter(d => {
        if (workoutFilter === 'all') return true;
        if (workoutFilter === 'easy') return ['easy', 'recovery', 'steady'].includes(d.workoutType);
        if (workoutFilter === 'long') return ['long', 'marathon'].includes(d.workoutType);
        if (workoutFilter === 'tempo') return ['tempo', 'threshold'].includes(d.workoutType);
        if (workoutFilter === 'interval') return ['interval', 'repetition'].includes(d.workoutType);
        if (workoutFilter === 'race') return d.workoutType === 'race';
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data, timeRange, workoutFilter]);

  // Calculate scales
  const { minPace, maxPace, dots } = useMemo(() => {
    if (filteredData.length === 0) {
      return { minPace: 360, maxPace: 600, dots: [] };
    }

    const paces = filteredData.map(d => {
      if (['interval', 'race'].includes(d.workoutType) && d.fastestSplitSeconds) {
        return d.fastestSplitSeconds;
      }
      return d.paceSeconds;
    });

    const min = Math.min(...paces);
    const max = Math.max(...paces);
    const padding = (max - min) * 0.15 || 30;

    const minVal = Math.max(240, min - padding);
    const maxVal = Math.min(900, max + padding);

    const getDisplayPace = (d: PaceDataPoint) => {
      const qualityTypes = ['interval', 'race', 'tempo', 'threshold'];
      if (qualityTypes.includes(d.workoutType) && d.fastestSplitSeconds) {
        return d.fastestSplitSeconds;
      }
      return d.paceSeconds;
    };

    const dotList = filteredData.map((d, i) => ({
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
      dots: dotList,
    };
  }, [filteredData]);

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

  const containerHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const paceRange = maxPace - minPace || 1;
  const scrollableWidth = dots.length * (BAR_WIDTH + BAR_GAP);

  // Y-axis labels
  const yLabels = [minPace, (minPace + maxPace) / 2, maxPace].map(pace => ({
    pace,
    label: formatPace(Math.round(pace)),
  }));

  const hoveredDot = hoveredIndex !== null ? dots[hoveredIndex] : null;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-semibold text-primary">Pace by Workout Type</h3>
          <p className="text-xs text-textTertiary mt-0.5">
            {workoutFilter === 'easy' && 'Easy & recovery runs'}
            {workoutFilter === 'long' && 'Long runs & marathon pace'}
            {workoutFilter === 'tempo' && 'Tempo & threshold · Best effort shown'}
            {workoutFilter === 'interval' && 'Intervals & reps · Best split shown'}
            {workoutFilter === 'race' && 'Race performances'}
            {workoutFilter === 'all' && 'All runs · Best splits for quality workouts'}
          </p>
        </div>
        <div className="flex gap-1">
          {(['1M', '3M', '6M', '1Y'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-2 py-1 text-xs font-medium rounded transition-colors',
                timeRange === range
                  ? 'bg-accent-dream text-white'
                  : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-sky-500 dark:bg-sky-600" />
          <span className="text-textTertiary">Easy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-dream-400" />
          <span className="text-textTertiary">Long</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-dream-400" />
          <span className="text-textTertiary">Steady</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-dream-500 dark:bg-dream-600" />
          <span className="text-textTertiary">Tempo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-violet-500 dark:bg-violet-600" />
          <span className="text-textTertiary">Threshold</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-red-500 dark:bg-red-600" />
          <span className="text-textTertiary">Intervals</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-2 rounded-sm bg-amber-500 dark:bg-amber-600" />
          <span className="text-textTertiary">Race</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 border-t-2 border-dashed border-slate-400" />
          <span className="text-textTertiary">Goal</span>
        </div>
      </div>

      {/* Workout Type Filter */}
      <div className="flex gap-2 mb-3">
        {(['all', 'easy', 'long', 'tempo', 'interval', 'race'] as WorkoutFilter[]).map(filter => {
          const labels: Record<WorkoutFilter, string> = {
            all: 'All',
            easy: 'Easy',
            long: 'Long',
            tempo: 'Tempo',
            interval: 'Intervals',
            race: 'Race',
          };
          return (
            <button
              key={filter}
              onClick={() => setWorkoutFilter(filter)}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-colors',
                workoutFilter === filter
                  ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                  : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
              )}
            >
              {labels[filter]}
            </button>
          );
        })}
      </div>

      {/* Chart with fixed Y-axis + scrollable bars */}
      {filteredData.length > 0 ? (
        <div className="relative" style={{ height: CHART_HEIGHT }}>
          {/* Fixed Y-axis */}
          <div
            className="absolute left-0 top-0 bottom-0 z-10 bg-bgSecondary"
            style={{ width: Y_AXIS_WIDTH }}
          >
            <div
              className="flex flex-col justify-between"
              style={{ paddingTop: PADDING_TOP, paddingBottom: PADDING_BOTTOM, height: '100%' }}
            >
              {yLabels.map((label, i) => (
                <div key={i} className="text-[10px] text-tertiary text-right pr-2">
                  {label.label}
                </div>
              ))}
            </div>
          </div>

          {/* Scrollable bar area */}
          <div
            ref={scrollRef}
            className="absolute overflow-x-auto overflow-y-hidden"
            style={{ left: Y_AXIS_WIDTH, right: 0, top: 0, bottom: 0 }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Grid lines (stretch to full scrollable width) */}
            <div
              className="absolute pointer-events-none"
              style={{
                top: PADDING_TOP,
                bottom: PADDING_BOTTOM,
                left: 0,
                width: Math.max(scrollableWidth, 100),
              }}
            >
              {[0, 0.5, 1].map((pct, i) => (
                <div
                  key={i}
                  className="absolute w-full border-t border-borderPrimary"
                  style={{ top: `${pct * 100}%` }}
                />
              ))}
            </div>

            {/* Bars */}
            <div
              className="flex items-end gap-[4px] relative"
              style={{
                height: containerHeight,
                marginTop: PADDING_TOP,
                paddingLeft: 4,
                paddingRight: 12,
                minWidth: scrollableWidth,
              }}
            >
              {dots.map((dot, i) => {
                const barHeight = ((maxPace - dot.displayPace) / paceRange) * containerHeight;
                const goalBarHeight = dot.goalPace
                  ? ((maxPace - dot.goalPace) / paceRange) * containerHeight
                  : 0;

                return (
                  <div
                    key={i}
                    className="relative flex flex-col items-center justify-end cursor-pointer"
                    style={{ width: BAR_WIDTH, flexShrink: 0 }}
                    onMouseEnter={() => setHoveredIndex(i)}
                  >
                    {/* Goal marker line */}
                    {dot.hasGoal && goalBarHeight > 0 && (
                      <div
                        className="absolute border-t-2 border-dashed border-slate-400 z-10"
                        style={{ bottom: goalBarHeight, width: BAR_WIDTH + 4, left: -2 }}
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
                        transitionDelay: `${Math.min(i * 10, 500)}ms`,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Date labels along the bottom */}
            <div
              className="flex gap-[4px]"
              style={{ paddingLeft: 4, paddingRight: 12, minWidth: scrollableWidth }}
            >
              {dots.map((dot, i) => {
                // Show date label every ~7 bars to avoid crowding
                const showLabel = i === 0 || i === dots.length - 1 || i % 7 === 0;
                return (
                  <div
                    key={i}
                    className="text-center"
                    style={{ width: BAR_WIDTH, flexShrink: 0 }}
                  >
                    {showLabel && (
                      <span className="text-[9px] text-textTertiary whitespace-nowrap">
                        {parseLocalDate(dot.data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tooltip */}
          {hoveredDot && hoveredIndex !== null && (
            <div
              className="absolute bg-stone-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none z-20"
              style={{
                top: 4,
                right: 8,
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
                <div className="text-dream-300 text-[10px] mt-1 flex items-center gap-1">
                  <span className="inline-block w-1.5 h-1.5 border border-slate-400" />
                  Goal: {formatPace(hoveredDot.goalPace)}/mi
                  {hoveredDot.displayPace < hoveredDot.goalPace && (
                    <span className="text-dream-400 ml-1">
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
