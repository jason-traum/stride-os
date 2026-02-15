'use client';

import { useState, useMemo, useTransition } from 'react';
import { WorkoutCard, formatDurationFull } from './WorkoutList';
import type { WorkoutWithRelations } from './WorkoutList';
import { EditWorkoutModal } from './EditWorkoutModal';
import { deleteWorkout, getWorkouts } from '@/actions/workouts';
import { formatDistance } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { useProfile } from '@/lib/profile-context';

interface GroupedWorkoutListProps {
  initialWorkouts: WorkoutWithRelations[];
  totalCount: number;
  pageSize: number;
}

interface WeekGroup {
  key: string; // e.g. "2026-02-10"
  label: string; // e.g. "This Week", "Last Week", "Week of Feb 3"
  workouts: WorkoutWithRelations[];
  totalMiles: number;
  totalMinutes: number;
  runCount: number;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMondayKey(dateStr: string): string {
  // Parse as local date to avoid timezone issues
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const monday = getMonday(date);
  return monday.toISOString().split('T')[0];
}

function getWeekLabel(mondayKey: string): string {
  const now = new Date();
  const thisMonday = getMonday(now);
  const thisMondayKey = thisMonday.toISOString().split('T')[0];

  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastMondayKey = lastMonday.toISOString().split('T')[0];

  if (mondayKey === thisMondayKey) return 'This Week';
  if (mondayKey === lastMondayKey) return 'Last Week';

  const [year, month, day] = mondayKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return `Week of ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function groupByWeek(workouts: WorkoutWithRelations[]): WeekGroup[] {
  const map = new Map<string, WorkoutWithRelations[]>();

  for (const w of workouts) {
    const key = getMondayKey(w.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(w);
  }

  // Sort weeks descending (most recent first)
  const sortedKeys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));

  return sortedKeys.map(key => {
    const weekWorkouts = map.get(key)!;
    return {
      key,
      label: getWeekLabel(key),
      workouts: weekWorkouts,
      totalMiles: weekWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0),
      totalMinutes: weekWorkouts.reduce((sum, w) => sum + (w.durationMinutes || 0), 0),
      runCount: weekWorkouts.length,
    };
  });
}

export function GroupedWorkoutList({ initialWorkouts, totalCount, pageSize }: GroupedWorkoutListProps) {
  const [workouts, setWorkouts] = useState<WorkoutWithRelations[]>(initialWorkouts);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutWithRelations | null>(null);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<number | null>(null);
  const [isLoadingMore, startLoadMore] = useTransition();
  const { activeProfile } = useProfile();

  const hasMore = workouts.length < totalCount;

  const weekGroups = useMemo(() => groupByWeek(workouts), [workouts]);

  const handleLoadMore = () => {
    startLoadMore(async () => {
      const moreWorkouts = await getWorkouts(pageSize, activeProfile?.id, workouts.length);
      setWorkouts(prev => [...prev, ...(moreWorkouts as WorkoutWithRelations[])]);
    });
  };

  const handleDelete = async (workoutId: number) => {
    if (confirm('Are you sure you want to delete this workout? This cannot be undone.')) {
      setDeletingWorkoutId(workoutId);
      try {
        await deleteWorkout(workoutId);
        setWorkouts(prev => prev.filter(w => w.id !== workoutId));
      } catch (error) {
        console.error('Failed to delete workout:', error);
        alert('Failed to delete workout. Please try again.');
      } finally {
        setDeletingWorkoutId(null);
      }
    }
  };

  return (
    <>
      <div className="space-y-6">
        {weekGroups.map((group) => (
          <div key={group.key}>
            {/* Week header */}
            <div className="flex items-baseline justify-between mb-3 px-1">
              <h3 className="font-semibold text-textPrimary">{group.label}</h3>
              <span className="text-sm text-textTertiary">
                {group.runCount} {group.runCount === 1 ? 'run' : 'runs'} · {formatDistance(group.totalMiles)} mi · {formatDurationFull(group.totalMinutes)}
              </span>
            </div>

            {/* Workout cards */}
            <div className="space-y-3">
              {group.workouts.map((workout) => (
                <WorkoutCard
                  key={workout.id}
                  workout={workout}
                  onEdit={setEditingWorkout}
                  onDelete={handleDelete}
                  isDeleting={deletingWorkoutId === workout.id}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="pt-4 text-center">
          <button
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className="btn-secondary inline-flex items-center gap-2"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>Load more ({totalCount - workouts.length} remaining)</>
            )}
          </button>
        </div>
      )}

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
