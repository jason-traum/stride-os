'use client';

import { cn } from '@/lib/utils';
import { WorkoutCard } from './WorkoutCard';
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
  onWorkoutStatusChange?: (workoutId: number, status: 'completed' | 'skipped') => void;
  onWorkoutModify?: (workout: PlannedWorkout) => void;
}

const phaseColors: Record<string, { bg: string; text: string; badge: string }> = {
  base: { bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100' },
  build: { bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100' },
  peak: { bg: 'bg-red-50', text: 'text-red-700', badge: 'bg-red-100' },
  taper: { bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100' },
  recovery: { bg: 'bg-slate-50', text: 'text-slate-600', badge: 'bg-slate-100' },
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
  onWorkoutStatusChange,
  onWorkoutModify,
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

  return (
    <div
      className={cn(
        'border rounded-xl overflow-hidden',
        isCurrentWeek ? 'ring-2 ring-blue-400 ring-offset-2' : '',
        colors.bg
      )}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">Week {weekNumber}</span>
              {isCurrentWeek && (
                <span className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full font-medium">
                  Current
                </span>
              )}
              {isDownWeek && (
                <span className="px-2 py-0.5 text-xs bg-slate-200 text-slate-600 rounded-full font-medium">
                  Recovery
                </span>
              )}
            </div>
            <span className="text-sm text-slate-500">{formatDateRange()}</span>
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
              <Target className="w-4 h-4 text-slate-400" />
              <span className="font-medium text-slate-700">
                {completedMileage > 0 ? `${completedMileage}/` : ''}{targetMileage} mi
              </span>
            </div>
          </div>

          {/* Expand icon */}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-slate-200/50">
          {/* Focus */}
          <div className="px-4 py-3 bg-white/50 border-b border-slate-200/50">
            <div className="flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <span className="text-slate-600">{focus}</span>
            </div>
          </div>

          {/* Calendar grid */}
          <div className="p-4">
            <div className="grid grid-cols-7 gap-2">
              {DAYS_OF_WEEK.map(day => (
                <div key={day} className="text-center">
                  <div className="text-xs font-medium text-slate-500 mb-2">{day}</div>
                  <div className="space-y-1">
                    {workoutsByDay[day]?.map(workout => (
                      <WorkoutCard
                        key={workout.id}
                        workout={workout}
                        compact
                      />
                    )) || (
                      <div className="p-2 rounded-lg bg-white/50 text-xs text-slate-400 border border-dashed border-slate-200">
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
            <h4 className="text-sm font-medium text-slate-700">Workouts</h4>
            {workouts.map(workout => (
              <WorkoutCard
                key={workout.id}
                workout={workout}
                showDate
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
