'use client';

import { useState, useEffect } from 'react';
import { format, addDays, startOfWeek, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { PlanBuilder, type TrainingBlock, type WorkoutTemplate } from '@/lib/plan-builder';

interface TwoWeekPlanProps {
  phase?: string;
  targetRace?: { date: string; distance: string };
  weeklyMileage?: number;
  onWorkoutClick?: (workout: WorkoutTemplate) => void;
}

export function TwoWeekPlan({
  phase = 'build',
  targetRace = { date: '2026-04-15', distance: 'half_marathon' },
  weeklyMileage = 40,
  onWorkoutClick
}: TwoWeekPlanProps) {
  const [trainingBlock, setTrainingBlock] = useState<TrainingBlock | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutTemplate | null>(null);

  useEffect(() => {
    const builder = new PlanBuilder();
    const block = builder.generateTwoWeekBlock(
      startOfWeek(new Date(), { weekStartsOn: 1 }),
      phase,
      targetRace,
      weeklyMileage,
      {
        longRunDay: 'Saturday',
        hardWorkoutDays: ['Tuesday', 'Thursday'],
        restDay: 'Sunday'
      }
    );
    setTrainingBlock(block);
  }, [phase, weeklyMileage]);

  if (!trainingBlock) return null;

  const workoutTypeColors: Record<string, string> = {
    recovery: 'bg-sky-50 text-sky-700',
    easy: 'bg-sky-50 text-sky-700',
    steady: 'bg-emerald-50 text-emerald-700',
    marathon: 'bg-emerald-50 text-emerald-700',
    tempo: 'bg-amber-50 text-amber-700',
    threshold: 'bg-orange-50 text-orange-700',
    interval: 'bg-rose-50 text-rose-700',
    repetition: 'bg-red-50 text-red-700',
    long: 'bg-indigo-50 text-indigo-700',
    long_run: 'bg-indigo-50 text-indigo-700',
    race: 'bg-purple-50 text-purple-700',
    rest: 'bg-surface-2 text-secondary',
    cross_train: 'bg-pink-50 text-pink-700',
    other: 'bg-stone-50 text-stone-700',
  };

  const workoutTypeIcons: Record<string, string> = {
    easy: '',
    tempo: '',
    interval: '',
    long_run: '',
    recovery: '',
    rest: '',
    race: ''
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">2-Week Training Plan</h2>
        <span className="text-sm text-secondary">
          Phase: <span className="font-medium capitalize">{phase}</span>
        </span>
      </div>

      {trainingBlock.weeks.map((week) => (
        <div key={week.weekNumber} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              Week {week.weekNumber}: {week.theme}
            </h3>
            <span className="text-sm text-secondary">
              {week.totalMileage} miles • {week.keyWorkouts} key workouts
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {week.workouts.map((workout) => {
              const isWorkoutToday = isToday(new Date(workout.date));
              const daysOut = Math.ceil(
                (new Date(workout.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );

              return (
                <div
                  key={workout.date}
                  onClick={() => {
                    setSelectedWorkout(workout);
                    onWorkoutClick?.(workout);
                  }}
                  className={cn(
                    'p-3 rounded-lg border cursor-pointer transition-all',
                    isWorkoutToday ? 'border-teal-500 shadow-md' : 'border-default',
                    selectedWorkout?.date === workout.date ? 'ring-2 ring-teal-500' : '',
                    'hover:shadow-md'
                  )}
                >
                  <div className="text-xs font-medium text-secondary mb-1">
                    {format(new Date(workout.date), 'EEE d')}
                  </div>

                  <div className="flex items-center gap-1 mb-2">
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      workoutTypeColors[workout.workoutType]
                    )}>
                      {workout.workoutType.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="text-xs text-secondary">
                    {workout.estimatedMinutes > 0 && (
                      <div>{workout.estimatedMinutes} min</div>
                    )}
                    {daysOut <= 3 && daysOut >= 0 && (
                      <div className="text-teal-600 font-medium mt-1">
                        {daysOut === 0 ? 'Today' : `In ${daysOut} days`}
                      </div>
                    )}
                  </div>

                  {workout.flexibility === 'high' && daysOut > 3 && (
                    <div className="text-xs text-tertiary mt-1">Flexible</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {selectedWorkout && (
        <div className="p-4 bg-surface-1 rounded-lg">
          <h4 className="font-medium mb-2">
            {format(new Date(selectedWorkout.date), 'EEEE, MMMM d')}
          </h4>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-secondary">Type:</span>{' '}
              <span className="font-medium capitalize">
                {selectedWorkout.workoutType.replace('_', ' ')}
              </span>
            </div>
            <div>
              <span className="text-secondary">Focus:</span>{' '}
              {selectedWorkout.primaryFocus}
            </div>
            <div>
              <span className="text-secondary">Duration:</span>{' '}
              {selectedWorkout.estimatedMinutes} minutes
            </div>
            <div>
              <span className="text-secondary">Priority:</span>{' '}
              {selectedWorkout.priority}/5
            </div>
            {selectedWorkout.notes && (
              <div>
                <span className="text-secondary">Notes:</span>{' '}
                {selectedWorkout.notes}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-xs text-tertiary italic">
        * This is a rough template. Workouts will be refined based on your fatigue, performance, and life context as each date approaches.
      </div>
    </div>
  );
}