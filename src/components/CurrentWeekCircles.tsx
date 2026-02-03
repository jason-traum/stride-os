'use client';

import { cn } from '@/lib/utils';
import { Check, Calendar, Dumbbell } from 'lucide-react';
import type { DailyWorkoutData } from '@/actions/analytics';

interface CurrentWeekCirclesProps {
  days: DailyWorkoutData[];
}

function getWorkoutTypeColor(type: string | null): string {
  if (!type) return 'bg-slate-400';

  const colors: Record<string, string> = {
    easy: 'bg-green-500',
    long: 'bg-blue-500',
    tempo: 'bg-orange-500',
    interval: 'bg-red-500',
    recovery: 'bg-cyan-500',
    race: 'bg-purple-500',
    steady: 'bg-yellow-500',
    cross_train: 'bg-pink-500',
    other: 'bg-slate-500',
  };
  return colors[type] || colors.other;
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
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-slate-900">This Week</h3>
        </div>
        <div className="text-sm text-slate-500">
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
                day.isToday ? 'text-blue-600' : 'text-slate-500'
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
                    ? 'border-2 border-blue-500 bg-blue-50'
                    : day.isFuture
                      ? 'border-2 border-dashed border-slate-200 bg-slate-50'
                      : 'border-2 border-slate-200 bg-slate-50'
              )}
            >
              {day.hasWorkout ? (
                <Check className="w-5 h-5 text-white" />
              ) : day.isToday ? (
                <Dumbbell className="w-4 h-4 text-blue-400" />
              ) : null}
            </div>

            {/* Miles or workout type */}
            <span
              className={cn(
                'text-[10px]',
                day.hasWorkout ? 'text-slate-700 font-medium' : 'text-slate-400'
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
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap gap-2">
            {Array.from(new Set(days.filter(d => d.workoutType).map(d => d.workoutType))).map(
              (type) => (
                <div key={type} className="flex items-center gap-1">
                  <div
                    className={cn('w-2 h-2 rounded-full', getWorkoutTypeColor(type))}
                  />
                  <span className="text-xs text-slate-500">
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
