'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import Link from 'next/link';

interface WorkoutDay {
  date: string;
  miles: number;
  workoutType: string;
  workoutId?: number;
}

interface MonthlyCalendarProps {
  workouts: WorkoutDay[];
}

function getWorkoutTypeColor(type: string): string {
  const colors: Record<string, string> = {
    easy: 'bg-green-500',
    long: 'bg-blue-500',
    recovery: 'bg-cyan-500',
    steady: 'bg-yellow-500',
    tempo: 'bg-orange-500',
    interval: 'bg-red-500',
    race: 'bg-purple-500',
    cross_train: 'bg-pink-500',
    other: 'bg-slate-500',
  };
  return colors[type] || colors.other;
}

function getWorkoutTypeBgLight(type: string): string {
  const colors: Record<string, string> = {
    easy: 'bg-green-100',
    long: 'bg-blue-100',
    recovery: 'bg-cyan-100',
    steady: 'bg-yellow-100',
    tempo: 'bg-orange-100',
    interval: 'bg-red-100',
    race: 'bg-purple-100',
    cross_train: 'bg-pink-100',
    other: 'bg-slate-100',
  };
  return colors[type] || colors.other;
}

export function MonthlyCalendar({ workouts }: MonthlyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  // Build a map of date -> workouts
  const workoutMap = useMemo(() => {
    const map = new Map<string, WorkoutDay[]>();
    for (const workout of workouts) {
      const existing = map.get(workout.date) || [];
      existing.push(workout);
      map.set(workout.date, existing);
    }
    return map;
  }, [workouts]);

  // Get calendar data for current month
  const calendarData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of month
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Build weeks array
    const weeks: Array<Array<{ date: Date | null; dateStr: string; workouts: WorkoutDay[] }>> = [];
    let currentWeek: Array<{ date: Date | null; dateStr: string; workouts: WorkoutDay[] }> = [];

    // Add empty cells for days before the first
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push({ date: null, dateStr: '', workouts: [] });
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      const dayWorkouts = workoutMap.get(dateStr) || [];

      currentWeek.push({ date, dateStr, workouts: dayWorkouts });

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Add empty cells for remaining days
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({ date: null, dateStr: '', workouts: [] });
      }
      weeks.push(currentWeek);
    }

    return weeks;
  }, [currentDate, workoutMap]);

  // Navigation
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calculate monthly totals
  const monthlyStats = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthStart = new Date(year, month, 1).toISOString().split('T')[0];
    const monthEnd = new Date(year, month + 1, 0).toISOString().split('T')[0];

    let totalMiles = 0;
    let runCount = 0;

    for (const [date, dayWorkouts] of Array.from(workoutMap.entries())) {
      if (date >= monthStart && date <= monthEnd) {
        for (const w of dayWorkouts) {
          totalMiles += w.miles;
          runCount++;
        }
      }
    }

    return { totalMiles: Math.round(totalMiles * 10) / 10, runCount };
  }, [currentDate, workoutMap]);

  const today = new Date().toISOString().split('T')[0];
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-slate-900">Training Calendar</h3>
        </div>
        <div className="text-sm text-slate-500">
          {monthlyStats.runCount} runs • {monthlyStats.totalMiles} mi
        </div>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPreviousMonth}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="flex items-center gap-3">
          <span className="font-medium text-slate-900">{monthName}</span>
          <button
            onClick={goToToday}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Today
          </button>
        </div>
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-slate-500"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {calendarData.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
            {week.map((day, dayIndex) => {
              const isToday = day.dateStr === today;
              const hasWorkout = day.workouts.length > 0;
              const primaryWorkout = day.workouts[0];

              return (
                <div
                  key={dayIndex}
                  className={cn(
                    'min-h-[60px] p-1 border-r border-slate-100 last:border-r-0',
                    !day.date && 'bg-slate-50',
                    isToday && 'bg-blue-50'
                  )}
                >
                  {day.date && (
                    <div className="h-full flex flex-col">
                      {/* Day number */}
                      <span
                        className={cn(
                          'text-xs font-medium mb-1',
                          isToday ? 'text-blue-600' : 'text-slate-600'
                        )}
                      >
                        {day.date.getDate()}
                      </span>

                      {/* Workout indicator */}
                      {hasWorkout && primaryWorkout && (
                        <Link
                          href={primaryWorkout.workoutId ? `/workout/${primaryWorkout.workoutId}` : '/history'}
                          className={cn(
                            'flex-1 rounded p-1 text-center transition-colors hover:opacity-80',
                            getWorkoutTypeBgLight(primaryWorkout.workoutType)
                          )}
                        >
                          <div
                            className={cn(
                              'w-2 h-2 rounded-full mx-auto mb-0.5',
                              getWorkoutTypeColor(primaryWorkout.workoutType)
                            )}
                          />
                          <span className="text-[10px] font-medium text-slate-700">
                            {primaryWorkout.miles.toFixed(1)}
                          </span>
                          {day.workouts.length > 1 && (
                            <span className="text-[9px] text-slate-500 block">
                              +{day.workouts.length - 1}
                            </span>
                          )}
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-2 justify-center">
        {[
          { type: 'easy', label: 'Easy' },
          { type: 'long', label: 'Long' },
          { type: 'tempo', label: 'Tempo' },
          { type: 'interval', label: 'Interval' },
          { type: 'race', label: 'Race' },
        ].map(({ type, label }) => (
          <div key={type} className="flex items-center gap-1">
            <div className={cn('w-2 h-2 rounded-full', getWorkoutTypeColor(type))} />
            <span className="text-[10px] text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
