'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  formatDate,
  formatDistance,
  formatPace,
  formatDuration,
  getVerdictColor,
  getWorkoutTypeLabel,
  getWorkoutTypeColor,
} from '@/lib/utils';
import { EditWorkoutModal } from './EditWorkoutModal';
import { Pencil, ChevronRight } from 'lucide-react';
import type { Workout, Shoe, Assessment } from '@/lib/schema';

type WorkoutWithRelations = Workout & { shoe?: Shoe | null; assessment?: Assessment | null };

interface WorkoutListProps {
  workouts: WorkoutWithRelations[];
}

export function WorkoutList({ workouts }: WorkoutListProps) {
  const [editingWorkout, setEditingWorkout] = useState<WorkoutWithRelations | null>(null);

  return (
    <>
      <div className="space-y-3">
        {workouts.map((workout) => (
          <div
            key={workout.id}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-all shadow-sm"
          >
            <div className="flex items-start justify-between">
              <Link href={`/workout/${workout.id}`} className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-slate-900">
                    {formatDate(workout.date)}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${getWorkoutTypeColor(
                      workout.workoutType
                    )}`}
                  >
                    {getWorkoutTypeLabel(workout.workoutType)}
                  </span>
                  {workout.assessment && (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getVerdictColor(
                        workout.assessment.verdict
                      )}`}
                    >
                      {workout.assessment.verdict}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
                  <span className="font-medium">
                    {formatDistance(workout.distanceMiles)} mi
                  </span>
                  <span>{formatDuration(workout.durationMinutes)}</span>
                  <span>{formatPace(workout.avgPaceSeconds)} /mi</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-500">
                  {workout.shoe && (
                    <span className="bg-slate-100 px-2 py-0.5 rounded">
                      {workout.shoe.name}
                    </span>
                  )}
                  {workout.routeName && (
                    <span className="bg-slate-100 px-2 py-0.5 rounded">
                      {workout.routeName}
                    </span>
                  )}
                </div>
              </Link>

              <div className="flex items-center gap-1 ml-4">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setEditingWorkout(workout);
                  }}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit workout"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <Link
                  href={`/workout/${workout.id}`}
                  className="p-2 text-slate-400 hover:text-slate-600"
                >
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingWorkout && (
        <EditWorkoutModal
          workout={editingWorkout}
          onClose={() => setEditingWorkout(null)}
        />
      )}
    </>
  );
}
