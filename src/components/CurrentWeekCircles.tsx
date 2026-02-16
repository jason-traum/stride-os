'use client';

import { cn } from '@/lib/utils';
import { Check, Calendar, Dumbbell } from 'lucide-react';
import type { DailyWorkoutData } from '@/actions/analytics';
import { getWorkoutTypeBgColor } from '@/lib/workout-colors';

interface CurrentWeekCirclesProps {
  days: DailyWorkoutData[];
}

function getWorkoutTypeColor(type: string | null): string {
  if (!type) return 'bg-stone-400 dark:bg-stone-500';
  return getWorkoutTypeBgColor(type);
}

function getWorkoutTypeLabel(type: string | null): string {
  if (!type) return '';

  const labels: Record<string, string> = {
    easy: 'Easy',
    long: 'Long',
    tempo: 'Tempo',
    interval: 'Interval',
    recovery: 'Recovery',
    race: 'Race',
    steady: 'Steady',
    cross_train: 'Cross',
    other: 'Other',
  };
  return labels[type] || type;
}

export function CurrentWeekCircles({ days }: CurrentWeekCirclesProps) {
  const completedCount = days.filter(d => d.hasWorkout).length;
  const totalMiles = days.reduce((sum, d) => sum + d.miles, 0);

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-dream-500" />
          <h3 className="font-semibold text-primary">This Week</h3>
        </div>
        <div className="text-sm text-textTertiary">
          {completedCount} run{completedCount !== 1 ? 's' : ''} • {totalMiles} mi
        </div>
      </div>

      {/* Day Circles */}
      <div className="flex justify-between items-center">
        {days.map((day) => (
          <div key={day.date} className="flex flex-col items-center gap-1">
            {/* Day label */}
            <span
              className={cn(
                'text-xs font-medium',
                day.isToday ? 'text-dream-600' : 'text-textTertiary'
              )}
            >
              {day.dayLabel}
            </span>

            {/* Circle */}
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center transition-all',
                day.hasWorkout
                  ? getWorkoutTypeColor(day.workoutType)
                  : day.isToday
                    ? 'border-2 border-dream-500 bg-bgTertiary'
                    : day.isFuture
                      ? 'border-2 border-dashed border-borderPrimary bg-bgTertiary'
                      : 'border-2 border-borderPrimary bg-bgTertiary'
              )}
            >
              {day.hasWorkout ? (
                <Check className="w-5 h-5 text-white" />
              ) : day.isToday ? (
                <Dumbbell className="w-4 h-4 text-dream-400" />
              ) : null}
            </div>

            {/* Miles or workout type */}
            <span
              className={cn(
                'text-[10px]',
                day.hasWorkout ? 'text-textSecondary font-medium' : 'text-tertiary'
              )}
            >
              {day.hasWorkout
                ? day.miles > 0
                  ? `${day.miles}mi`
                  : getWorkoutTypeLabel(day.workoutType)
                : day.isFuture
                  ? ''
                  : 'Rest'}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      {completedCount > 0 && (
        <div className="mt-4 pt-3 border-t border-borderSecondary">
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(days.filter(d => d.workoutType).map(d => d.workoutType))).map(
              (type) => (
                <div key={type} className="flex items-center gap-1">
                  <div
                    className={cn('w-2 h-2 rounded-full', getWorkoutTypeColor(type))}
                  />
                  <span className="text-xs text-textTertiary">
                    {getWorkoutTypeLabel(type)}
                  </span>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
