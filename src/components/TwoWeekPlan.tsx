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

  const workoutTypeColors = {
    easy: 'bg-green-100 text-green-800',
    tempo: 'bg-orange-100 text-orange-800',
    interval: 'bg-red-100 text-red-800',
    long_run: 'bg-blue-100 text-blue-800',
    recovery: 'bg-teal-100 text-teal-800',
    rest: 'bg-gray-100 text-gray-600',
    race: 'bg-purple-100 text-purple-800'
  };

  const workoutTypeIcons = {
    easy: '🏃',
    tempo: '⚡',
    interval: '🚀',
    long_run: '🏔️',
    recovery: '🧘',
    rest: '😴',
    race: '🏁'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">2-Week Training Plan</h2>
        <span className="text-sm text-gray-600">
          Phase: <span className="font-medium capitalize">{phase}</span>
        </span>
      </div>

      {trainingBlock.weeks.map((week) => (
        <div key={week.weekNumber} className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              Week {week.weekNumber}: {week.theme}
            </h3>
            <span className="text-sm text-gray-600">
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
                    isWorkoutToday ? 'border-teal-500 shadow-md' : 'border-gray-200',
                    selectedWorkout?.date === workout.date ? 'ring-2 ring-teal-500' : '',
                    'hover:shadow-md'
                  )}
                >
                  <div className="text-xs font-medium text-gray-600 mb-1">
                    {format(new Date(workout.date), 'EEE d')}
                  </div>

                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-lg">{workoutTypeIcons[workout.workoutType]}</span>
                    <span className={cn(
                      'text-xs px-2 py-0.5 rounded-full',
                      workoutTypeColors[workout.workoutType]
                    )}>
                      {workout.workoutType.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="text-xs text-gray-600">
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
                    <div className="text-xs text-gray-400 mt-1">Flexible</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {selectedWorkout && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="font-medium mb-2">
            {format(new Date(selectedWorkout.date), 'EEEE, MMMM d')}
          </h4>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-gray-600">Type:</span>{' '}
              <span className="font-medium capitalize">
                {selectedWorkout.workoutType.replace('_', ' ')}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Focus:</span>{' '}
              {selectedWorkout.primaryFocus}
            </div>
            <div>
              <span className="text-gray-600">Duration:</span>{' '}
              {selectedWorkout.estimatedMinutes} minutes
            </div>
            <div>
              <span className="text-gray-600">Priority:</span>{' '}
              {'⭐'.repeat(selectedWorkout.priority)}
            </div>
            {selectedWorkout.notes && (
              <div>
                <span className="text-gray-600">Notes:</span>{' '}
                {selectedWorkout.notes}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500 italic">
        * This is a rough template. Workouts will be refined based on your fatigue, performance, and life context as each date approaches.
      </div>
    </div>
  );
}