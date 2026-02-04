'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Target, Info } from 'lucide-react';
import { getWorkoutTypeHexColor } from '@/lib/workout-colors';

interface TrainingFocusData {
  workoutType: string;
  count: number;
  miles: number;
  minutes: number;
}

interface TrainingFocusChartProps {
  data: TrainingFocusData[];
  totalMiles: number;
  totalMinutes: number;
}

// Categorize workout types into intensity zones
function getIntensityZone(workoutType: string): 'easy' | 'moderate' | 'hard' {
  switch (workoutType) {
    case 'easy':
    case 'recovery':
    case 'long':
      return 'easy';
    case 'steady':
      return 'moderate';
    case 'tempo':
    case 'threshold':
    case 'interval':
    case 'race':
      return 'hard';
    default:
      return 'easy';
  }
}

function getWorkoutTypeColor(type: string): string {
  return getWorkoutTypeHexColor(type);
}

function getWorkoutTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    easy: 'Easy',
    long: 'Long',
    recovery: 'Recovery',
    steady: 'Steady',
    tempo: 'Tempo',
    interval: 'Intervals',
    race: 'Race',
    cross_train: 'Cross Train',
    other: 'Other',
  };
  return labels[type] || type;
}

export function TrainingFocusChart({ data, totalMiles, totalMinutes }: TrainingFocusChartProps) {
  // Calculate zone distribution
  const zoneData = useMemo(() => {
    const zones = {
      easy: { miles: 0, minutes: 0, count: 0 },
      moderate: { miles: 0, minutes: 0, count: 0 },
      hard: { miles: 0, minutes: 0, count: 0 },
    };

    for (const item of data) {
      const zone = getIntensityZone(item.workoutType);
      zones[zone].miles += item.miles;
      zones[zone].minutes += item.minutes;
      zones[zone].count += item.count;
    }

    return zones;
  }, [data]);

  // Calculate percentages (by time, which is more accurate for 80/20)
  const easyPercent = totalMinutes > 0 ? Math.round((zoneData.easy.minutes / totalMinutes) * 100) : 0;
  const moderatePercent = totalMinutes > 0 ? Math.round((zoneData.moderate.minutes / totalMinutes) * 100) : 0;
  const hardPercent = totalMinutes > 0 ? Math.round((zoneData.hard.minutes / totalMinutes) * 100) : 0;

  // Determine if following 80/20 principle
  const isBalanced = easyPercent >= 75 && easyPercent <= 85;
  const isTooHard = easyPercent < 70;
  const isTooEasy = easyPercent > 90;

  // Sort data by count for display
  const sortedData = [...data].sort((a, b) => b.count - a.count);

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-teal-500" />
          <h3 className="font-semibold text-stone-900">Training Focus</h3>
        </div>
        <div className="text-xs text-stone-500">Last 90 days</div>
      </div>

      {/* 80/20 Gauge */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-stone-700">Intensity Distribution</span>
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            isBalanced ? 'bg-green-100 text-green-700' :
            isTooHard ? 'bg-rose-50 text-rose-700' :
            'bg-teal-50 text-teal-700'
          )}>
            {isBalanced ? 'Well Balanced' :
             isTooHard ? 'Running Too Hard' :
             isTooEasy ? 'Could Add Intensity' : 'Balanced'}
          </span>
        </div>

        {/* Stacked bar */}
        <div className="h-8 rounded-full overflow-hidden flex bg-stone-100">
          {easyPercent > 0 && (
            <div
              className="bg-teal-400 flex items-center justify-center text-white text-xs font-medium"
              style={{ width: `${easyPercent}%` }}
            >
              {easyPercent >= 15 && `${easyPercent}%`}
            </div>
          )}
          {moderatePercent > 0 && (
            <div
              className="bg-amber-400 flex items-center justify-center text-white text-xs font-medium"
              style={{ width: `${moderatePercent}%` }}
            >
              {moderatePercent >= 10 && `${moderatePercent}%`}
            </div>
          )}
          {hardPercent > 0 && (
            <div
              className="bg-rose-500 flex items-center justify-center text-white text-xs font-medium"
              style={{ width: `${hardPercent}%` }}
            >
              {hardPercent >= 10 && `${hardPercent}%`}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-teal-400" />
            <span className="text-xs text-stone-600">Easy ({easyPercent}%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <span className="text-xs text-stone-600">Moderate ({moderatePercent}%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-rose-500" />
            <span className="text-xs text-stone-600">Hard ({hardPercent}%)</span>
          </div>
        </div>

        {/* 80/20 Target indicator */}
        <div className="mt-3 flex items-start gap-2 p-2 bg-stone-50 rounded-lg">
          <Info className="w-4 h-4 text-stone-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-stone-600">
            {isBalanced
              ? "You're following the 80/20 principle well. Most training should be easy to allow quality in hard sessions."
              : isTooHard
                ? "Consider more easy running. The 80/20 rule suggests ~80% easy effort to maximize adaptation from hard workouts."
                : "You have room to add intensity. Consider adding tempo or interval work for faster improvement."}
          </p>
        </div>
      </div>

      {/* Workout Type Breakdown */}
      <div>
        <h4 className="text-sm font-medium text-stone-700 mb-3">By Workout Type</h4>
        <div className="space-y-2">
          {sortedData.slice(0, 6).map((item) => {
            const percent = totalMiles > 0 ? (item.miles / totalMiles) * 100 : 0;
            return (
              <div key={item.workoutType} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getWorkoutTypeColor(item.workoutType) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-stone-700">{getWorkoutTypeLabel(item.workoutType)}</span>
                    <span className="text-xs text-stone-500">
                      {item.count} run{item.count !== 1 ? 's' : ''} • {item.miles.toFixed(1)} mi
                    </span>
                  </div>
                  <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${percent}%`,
                        backgroundColor: getWorkoutTypeColor(item.workoutType),
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
