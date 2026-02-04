'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface PaceDataPoint {
  date: string;
  paceSeconds: number;
  workoutType: string;
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

// Get dot color for workout type
function getDotColor(type: string): string {
  const colors: Record<string, string> = {
    easy: '#5eead4',      // teal-300 - soft teal
    long: '#2dd4bf',      // teal-400 - medium teal
    tempo: '#f9a8d4',     // pink-300 - soft pink
    interval: '#e879f9',  // fuchsia-400
    recovery: '#a5f3fc',  // cyan-200 - very soft cyan
    race: '#c084fc',      // purple-400
    steady: '#a1a1aa',    // zinc-400 - neutral
    cross_train: '#f0abfc', // fuchsia-300
    other: '#a8a29e',     // stone-400
  };
  return colors[type] || colors.other;
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

    const paces = filteredData.map(d => d.paceSeconds);
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

    // Build line path (coordinates in viewBox units, not percentages)
    const path = filteredData
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.paceSeconds)}`)
      .join(' ');

    // Build dots
    const dotList = filteredData.map((d, i) => ({
      x: xScale(i),
      y: yScale(d.paceSeconds),
      color: getDotColor(d.workoutType),
      data: d,
      index: i,
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
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h3 className="font-semibold text-stone-900 mb-4">Pace Trend</h3>
        <div className="h-48 flex items-center justify-center text-stone-500">
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
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-stone-900">Pace Trend</h3>
          <p className="text-xs text-stone-500 mt-0.5">Average pace per run</p>
        </div>
        <div className="flex gap-1">
          {(['1M', '3M', '6M'] as TimeRange[]).map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                'px-2 py-1 text-xs font-medium rounded transition-colors',
                timeRange === range
                  ? 'bg-teal-600 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Workout Type Filter */}
      <div className="flex gap-2 mb-4">
        {(['all', 'easy', 'tempo', 'interval'] as WorkoutFilter[]).map(filter => (
          <button
            key={filter}
            onClick={() => setWorkoutFilter(filter)}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-full transition-colors capitalize',
              workoutFilter === filter
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            )}
          >
            {filter === 'all' ? 'All Runs' : filter}
          </button>
        ))}
      </div>

      {/* Chart */}
      {filteredData.length > 0 ? (
        <div
          className="relative"
          style={{ height: chartHeight }}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-0" style={{ width: `${chartPadding.left}%` }}>
            {yLabels.map((label, i) => (
              <div
                key={i}
                className="absolute text-[10px] text-stone-400 text-right pr-1"
                style={{
                  top: label.y,
                  right: 0,
                  transform: 'translateY(-50%)',
                }}
              >
                {label.label}
              </div>
            ))}
          </div>

          {/* SVG Chart */}
          <svg
            className="w-full h-full"
            viewBox={`0 0 100 ${chartHeight}`}
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Grid lines */}
            {yLabels.map((label, i) => (
              <line
                key={i}
                x1={`${chartPadding.left}%`}
                y1={label.y}
                x2="100%"
                y2={label.y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
            ))}

            {/* Line connecting dots */}
            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1.5"
                className={cn('transition-all duration-500', mounted ? 'opacity-100' : 'opacity-0')}
              />
            )}

            {/* Dots */}
            {dots.map((dot, i) => (
              <circle
                key={i}
                cx={dot.x}
                cy={dot.y}
                r={hoveredIndex === i ? 5 : 3.5}
                fill={dot.color}
                stroke="white"
                strokeWidth="1.5"
                className={cn(
                  'cursor-pointer transition-all duration-200',
                  mounted ? 'opacity-100' : 'opacity-0'
                )}
                style={{ transitionDelay: `${i * 15}ms` }}
              />
            ))}
          </svg>

          {/* Interactive overlay */}
          <div className="absolute inset-0" style={{ left: `${chartPadding.left}%` }}>
            {dots.map((dot, i) => (
              <div
                key={i}
                className="absolute cursor-crosshair"
                style={{
                  left: `${((dot.x - chartPadding.left) / (100 - chartPadding.left - chartPadding.right)) * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: `${100 / dots.length}%`,
                  transform: 'translateX(-50%)',
                }}
                onMouseEnter={() => setHoveredIndex(i)}
              />
            ))}
          </div>

          {/* Tooltip */}
          {hoveredDot && (
            <div
              className="absolute bg-stone-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none z-10"
              style={{
                left: `${hoveredDot.x}%`,
                top: hoveredDot.y > chartHeight / 2 ? '10px' : 'auto',
                bottom: hoveredDot.y <= chartHeight / 2 ? '40px' : 'auto',
                transform: 'translateX(-50%)',
              }}
            >
              <div className="font-medium">
                {new Date(hoveredDot.data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: hoveredDot.color }}
                />
                <span className="capitalize">{hoveredDot.data.workoutType}</span>
                <span className="font-bold">{formatPace(hoveredDot.data.paceSeconds)}/mi</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="h-48 flex items-center justify-center text-stone-500 text-sm">
          No {workoutFilter !== 'all' ? workoutFilter : ''} runs in this period
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-teal-300" />
          <span className="text-stone-600">Easy/Long</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-pink-300" />
          <span className="text-stone-600">Tempo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-fuchsia-400" />
          <span className="text-stone-600">Intervals</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-purple-400" />
          <span className="text-stone-600">Race</span>
        </div>
      </div>
    </div>
  );
}
