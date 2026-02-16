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
// Steady and marathon are aerobic efforts — they belong in the "easy" bucket
// for 80/20 purposes. Only tempo+ is truly hard (lactate threshold and above).
function getIntensityZone(workoutType: string): 'easy' | 'moderate' | 'hard' {
  switch (workoutType) {
    case 'easy':
    case 'recovery':
    case 'long':
    case 'steady':
    case 'marathon':
      return 'easy';
    case 'tempo':
    case 'threshold':
      return 'moderate';
    case 'interval':
    case 'repetition':
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
    recovery: 'Recovery',
    easy: 'Easy',
    long: 'Long',
    steady: 'Steady',
    marathon: 'Marathon',
    tempo: 'Tempo',
    threshold: 'Threshold',
    interval: 'Intervals',
    repetition: 'Repetition',
    race: 'Race',
    cross_train: 'Cross Train',
    other: 'Other',
  };
  return labels[type] || type;
}

// Intensity order for sorting (low → high)
const INTENSITY_ORDER: Record<string, number> = {
  recovery: 0,
  easy: 1,
  long: 2,
  steady: 3,
  marathon: 4,
  tempo: 5,
  threshold: 6,
  interval: 7,
  repetition: 8,
  race: 9,
  cross_train: 10,
  other: 11,
};

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

  // Merge "long" into "easy" for the breakdown (it's just a longer easy run)
  // and sort by intensity progression (easy → hard)
  const mergedData = useMemo(() => {
    const merged: TrainingFocusData[] = [];
    let easyEntry: TrainingFocusData | null = null;
    for (const item of data) {
      if (item.workoutType === 'long' || item.workoutType === 'easy') {
        if (!easyEntry) {
          easyEntry = { workoutType: 'easy', count: 0, miles: 0, minutes: 0 };
        }
        easyEntry.count += item.count;
        easyEntry.miles += item.miles;
        easyEntry.minutes += item.minutes;
      } else {
        merged.push(item);
      }
    }
    if (easyEntry) merged.push(easyEntry);
    return merged;
  }, [data]);

  const sortedData = [...mergedData].sort((a, b) =>
    (INTENSITY_ORDER[a.workoutType] ?? 99) - (INTENSITY_ORDER[b.workoutType] ?? 99)
  );

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-dream-500" />
          <h3 className="font-semibold text-primary">Training Focus</h3>
        </div>
        <div className="text-xs text-textTertiary">Last 90 days</div>
      </div>

      {/* 80/20 Gauge */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-textSecondary">Intensity Distribution</span>
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            isBalanced ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' :
            isTooHard ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' :
            'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300'
          )}>
            {isBalanced ? 'Well Balanced' :
             isTooHard ? 'High Intensity' :
             isTooEasy ? 'Could Add Intensity' : 'Balanced'}
          </span>
        </div>

        {/* Stacked bar */}
        <div className="h-8 rounded-full overflow-hidden flex bg-bgTertiary">
          {easyPercent > 0 && (
            <div
              className="bg-sky-500 flex items-center justify-center text-white text-xs font-medium"
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
        <div className="flex flex-col gap-1.5 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-sky-500 flex-shrink-0" />
            <span className="text-xs text-textSecondary">Aerobic ({easyPercent}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-400 flex-shrink-0" />
            <span className="text-xs text-textSecondary">Tempo ({moderatePercent}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500 flex-shrink-0" />
            <span className="text-xs text-textSecondary">Hard ({hardPercent}%)</span>
          </div>
        </div>

        {/* 80/20 Target indicator */}
        <div className="mt-3 flex items-start gap-2 p-2 bg-bgTertiary rounded-lg">
          <Info className="w-4 h-4 text-tertiary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-textSecondary">
            {isBalanced
              ? "Good aerobic base. Most of your volume is easy/steady effort with hard work mixed in."
              : isTooHard
                ? "High intensity ratio. A lot of your time is at tempo or harder — make sure you're recovering well."
                : "Mostly aerobic running. Consider adding tempo or interval sessions to sharpen fitness."}
          </p>
        </div>
      </div>

      {/* Workout Type Breakdown */}
      <div>
        <h4 className="text-sm font-medium text-textSecondary mb-3">By Workout Type</h4>
        <div className="space-y-2">
          {sortedData.map((item) => {
            const percent = totalMiles > 0 ? (item.miles / totalMiles) * 100 : 0;
            return (
              <div key={item.workoutType} className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getWorkoutTypeColor(item.workoutType) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-textSecondary">{getWorkoutTypeLabel(item.workoutType)}</span>
                    <span className="text-xs text-textTertiary">
                      {item.count} run{item.count !== 1 ? 's' : ''} • {item.miles.toFixed(1)} mi
                    </span>
                  </div>
                  <div className="h-1.5 bg-bgTertiary rounded-full overflow-hidden">
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
