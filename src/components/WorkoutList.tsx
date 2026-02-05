'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  formatDate,
  formatDistance,
  formatPace,
  getVerdictColor,
  getWorkoutTypeLabel,
  getWorkoutTypeColor,
} from '@/lib/utils';
import { EditWorkoutModal } from './EditWorkoutModal';
import { Pencil, ChevronRight, Heart, TrendingUp, Mountain } from 'lucide-react';
import type { Workout, Shoe, Assessment, WorkoutSegment } from '@/lib/schema';

type WorkoutWithRelations = Workout & {
  shoe?: Shoe | null;
  assessment?: Assessment | null;
  segments?: WorkoutSegment[];
};

interface WorkoutListProps {
  workouts: WorkoutWithRelations[];
}

// Format duration nicely: "1h 23m" or "45m 30s" or "32m"
function formatDurationFull(minutes: number | null | undefined): string {
  if (!minutes) return '--';

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}

// Mini lap chart showing pace variation
function MiniLapChart({ segments, avgPace }: { segments: WorkoutSegment[]; avgPace: number | null }) {
  if (!segments || segments.length < 2) return null;

  // Sort by segment number
  const sorted = [...segments].sort((a, b) => a.segmentNumber - b.segmentNumber);
  const avgPaceRef = avgPace || Math.round(sorted.reduce((sum, s) => sum + (s.paceSecondsPerMile || 0), 0) / sorted.length);

  return (
    <div className="flex h-4 gap-px rounded overflow-hidden mt-2" title="Lap pace variation">
      {sorted.map((seg, i) => {
        const pace = seg.paceSecondsPerMile || 0;
        const diff = (pace - avgPaceRef) / avgPaceRef;

        // Color based on pace relative to average
        // Faster = teal (positive), Average = slate, Slower = rose (caution)
        let bgColor = 'bg-slate-300'; // baseline/average
        if (diff > 0.05) bgColor = 'bg-rose-300';
        if (diff > 0.1) bgColor = 'bg-rose-400';
        if (diff > 0.15) bgColor = 'bg-rose-500';
        if (diff < -0.05) bgColor = 'bg-teal-300';
        if (diff < -0.1) bgColor = 'bg-teal-400';
        if (diff < -0.15) bgColor = 'bg-teal-500';

        return (
          <div
            key={i}
            className={`${bgColor} flex-1 min-w-1`}
            title={`Mile ${seg.segmentNumber}: ${formatPace(pace)}/mi`}
          />
        );
      })}
    </div>
  );
}

export function WorkoutList({ workouts }: WorkoutListProps) {
  const [editingWorkout, setEditingWorkout] = useState<WorkoutWithRelations | null>(null);

  return (
    <>
      <div className="space-y-3">
        {workouts.map((workout) => (
          <div
            key={workout.id}
            className="bg-white rounded-xl border border-stone-200 p-4 hover:border-stone-300 transition-all shadow-sm"
          >
            <div className="flex items-start justify-between">
              <Link href={`/workout/${workout.id}`} className="flex-1">
                {/* Header row: date, type, verdict */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-stone-900">
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

                {/* Main stats row: distance, duration, pace */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-700">
                  <span className="font-semibold text-stone-900">
                    {formatDistance(workout.distanceMiles)} mi
                  </span>
                  <span>{formatDurationFull(workout.durationMinutes)}</span>
                  <span>{formatPace(workout.avgPaceSeconds)} /mi</span>
                </div>

                {/* Secondary stats row: HR, elevation, load */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-stone-500">
                  {(workout.avgHeartRate || workout.avgHr) && (
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3 text-red-400" />
                      {workout.avgHeartRate || workout.avgHr} bpm
                    </span>
                  )}
                  {(workout.elevationGainFeet || workout.elevationGainFt) && (
                    <span className="flex items-center gap-1">
                      <Mountain className="w-3 h-3 text-emerald-500" />
                      {workout.elevationGainFeet || workout.elevationGainFt} ft
                    </span>
                  )}
                  {workout.trainingLoad && workout.trainingLoad > 0 && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-teal-500" />
                      Load {workout.trainingLoad}
                    </span>
                  )}
                  {workout.assessment?.rpe && (
                    <span className="text-stone-400">
                      RPE {workout.assessment.rpe}
                    </span>
                  )}
                </div>

                {/* Tags row: shoe, route, source */}
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-stone-500">
                  {workout.shoe && (
                    <span className="bg-stone-100 px-2 py-0.5 rounded truncate max-w-[140px]">
                      {workout.shoe.name}
                    </span>
                  )}
                  {workout.routeName && (
                    <span className="bg-stone-100 px-2 py-0.5 rounded truncate max-w-[140px]">
                      {workout.routeName}
                    </span>
                  )}
                  {workout.source && workout.source !== 'manual' && (
                    <span className="bg-stone-50 px-2 py-0.5 rounded text-stone-400 capitalize">
                      {workout.source}
                    </span>
                  )}
                </div>

                {/* Mini lap chart */}
                {Array.isArray(workout.segments) && workout.segments.length >= 2 && (
                  <MiniLapChart segments={workout.segments} avgPace={workout.avgPaceSeconds} />
                )}
              </Link>

              <div className="flex items-center gap-1 ml-4">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setEditingWorkout(workout);
                  }}
                  className="p-2 text-stone-400 hover:text-teal-600 hover:bg-slate-50 rounded-lg transition-colors"
                  title="Edit workout"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <Link
                  href={`/workout/${workout.id}`}
                  className="p-2 text-stone-400 hover:text-stone-600"
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
