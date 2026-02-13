'use client';

import { cn } from '@/lib/utils';
import { WorkoutCard, UserPaceSettings } from './WorkoutCard';
import { ChevronDown, ChevronUp, Target, TrendingUp } from 'lucide-react';
import { useState } from 'react';

interface PlannedWorkout {
  id: number;
  date: string;
  name: string;
  description: string;
  workoutType: string;
  targetDistanceMiles: number | null;
  targetDurationMinutes: number | null;
  targetPaceSecondsPerMile: number | null;
  rationale: string | null;
  isKeyWorkout: boolean | null;
  status: 'scheduled' | 'completed' | 'skipped' | 'modified' | null;
  structure: string | null;
  alternatives: string | null;
}

interface WeekViewProps {
  weekNumber: number;
  startDate: string;
  endDate: string;
  phase: string;
  targetMileage: number;
  focus: string;
  isDownWeek: boolean;
  workouts: PlannedWorkout[];
  isCurrentWeek?: boolean;
  isPastWeek?: boolean;
  onWorkoutStatusChange?: (workoutId: number, status: 'completed' | 'skipped') => void;
  onWorkoutModify?: (workout: PlannedWorkout) => void;
  paceSettings?: UserPaceSettings;
}

const phaseColors: Record<string, { bg: string; text: string; badge: string }> = {
  base: { bg: 'bg-stone-100', text: 'text-textSecondary', badge: 'bg-stone-200' },
  build: { bg: 'bg-teal-50', text: 'text-teal-700 dark:text-teal-300', badge: 'bg-teal-100' },
  peak: { bg: 'bg-rose-50', text: 'text-rose-700', badge: 'bg-rose-100' },
  taper: { bg: 'bg-surface-1', text: 'text-secondary', badge: 'bg-surface-2' },
  recovery: { bg: 'bg-bgTertiary', text: 'text-textSecondary', badge: 'bg-stone-100' },
};

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeekView({
  weekNumber,
  startDate,
  endDate,
  phase,
  targetMileage,
  focus,
  isDownWeek,
  workouts,
  isCurrentWeek = false,
  isPastWeek = false,
  onWorkoutStatusChange,
  onWorkoutModify,
  paceSettings,
}: WeekViewProps) {
  const [expanded, setExpanded] = useState(isCurrentWeek);
  const colors = phaseColors[phase] || phaseColors.recovery;

  // Calculate completed mileage
  const completedMileage = workouts
    .filter(w => w.status === 'completed')
    .reduce((sum, w) => sum + (w.targetDistanceMiles || 0), 0);

  // Group workouts by day
  const workoutsByDay: Record<string, PlannedWorkout[]> = {};
  for (const workout of workouts) {
    const dayOfWeek = new Date(workout.date + 'T00:00:00').getDay();
    // Convert Sunday (0) to 6, others shift down by 1
    const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const dayKey = DAYS_OF_WEEK[dayIndex];
    if (!workoutsByDay[dayKey]) {
      workoutsByDay[dayKey] = [];
    }
    workoutsByDay[dayKey].push(workout);
  }

  const formatDateRange = () => {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${startStr} - ${endStr}`;
  };

  // Calculate completion status for past weeks
  const completionRate = workouts.length > 0
    ? workouts.filter(w => w.status === 'completed').length / workouts.length
    : 0;

  return (
    <div
      className={cn(
        'border rounded-xl overflow-hidden',
        isCurrentWeek ? 'ring-2 ring-teal-400 ring-offset-2' : '',
        isPastWeek ? 'opacity-75 border-borderPrimary' : '',
        isPastWeek ? 'bg-bgTertiary' : colors.bg
      )}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-bgSecondary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-primary">Week {weekNumber}</span>
              {isCurrentWeek && (
                <span className="px-2 py-0.5 text-xs bg-teal-500 text-white rounded-full font-medium">
                  Current
                </span>
              )}
              {isDownWeek && (
                <span className="px-2 py-0.5 text-xs bg-stone-200 text-textSecondary rounded-full font-medium">
                  Recovery
                </span>
              )}
            </div>
            <span className="text-sm text-textTertiary">{formatDateRange()}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Phase badge */}
          <span className={cn('px-2 py-1 text-xs font-medium rounded capitalize', colors.badge, colors.text)}>
            {phase}
          </span>

          {/* Mileage */}
          <div className="text-right">
            <div className="flex items-center gap-1">
              <Target className="w-4 h-4 text-tertiary" />
              <span className="font-medium text-textSecondary">
                {completedMileage > 0 ? `${completedMileage}/` : ''}{targetMileage} mi
              </span>
            </div>
          </div>

          {/* Expand icon */}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-tertiary" />
          ) : (
            <ChevronDown className="w-5 h-5 text-tertiary" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-borderPrimary/50">
          {/* Focus */}
          <div className="px-4 py-3 bg-bgSecondary/50 border-b border-borderPrimary/50">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-tertiary" />
              <span className="text-textSecondary">{focus}</span>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="p-4">
            <div className="grid grid-cols-7 gap-2">
              {DAYS_OF_WEEK.map(day => (
                <div key={day} className="text-center">
                  <div className="text-xs font-medium text-textTertiary mb-2">{day}</div>
                  <div className="space-y-1">
                    {workoutsByDay[day]?.map(workout => (
                      <WorkoutCard
                        key={workout.id}
                        workout={workout}
                        compact
                        paceSettings={paceSettings}
                      />
                    )) || (
                      <div className="p-2 rounded-lg bg-bgSecondary/50 text-xs text-tertiary border border-dashed border-borderPrimary">
                        Rest
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed workout list */}
          <div className="px-4 pb-4 space-y-3">
            <h4 className="text-sm font-medium text-textSecondary">Workouts</h4>
            {workouts.map(workout => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                showDate
                paceSettings={paceSettings}
                onStatusChange={
                  onWorkoutStatusChange
                    ? (status) => onWorkoutStatusChange(workout.id, status)
                    : undefined
                }
                onModify={
                  onWorkoutModify
                    ? () => onWorkoutModify(workout)
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
