'use client';

import { useState, useMemo, useTransition, useCallback } from 'react';
import { WorkoutCard, formatDurationFull } from './WorkoutList';
import type { WorkoutWithRelations } from './WorkoutList';
import { EditWorkoutModal } from './EditWorkoutModal';
import { deleteWorkout, getWorkouts, getFilteredWorkouts, bulkDeleteWorkouts, type WorkoutFilters } from '@/actions/workouts';
import { formatDistance } from '@/lib/utils';
import { Loader2, Filter, X, Trash2, CheckSquare } from 'lucide-react';
import { useProfile } from '@/lib/profile-context';
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList';

interface GroupedWorkoutListProps {
  initialWorkouts: WorkoutWithRelations[];
  totalCount: number;
  pageSize: number;
}

interface WeekGroup {
  key: string;
  label: string;
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

/** Parse "mm:ss" to total seconds, or return undefined */
function parsePaceInput(val: string): number | undefined {
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  const parts = trimmed.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    if (!isNaN(mins) && !isNaN(secs)) return mins * 60 + secs;
  }
  return undefined;
}

export function GroupedWorkoutList({ initialWorkouts, totalCount, pageSize }: GroupedWorkoutListProps) {
  const [workouts, setWorkouts] = useState<WorkoutWithRelations[]>(initialWorkouts);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutWithRelations | null>(null);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<number | null>(null);
  const [isLoadingMore, startLoadMore] = useTransition();
  const { activeProfile } = useProfile();

  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterMinDist, setFilterMinDist] = useState('');
  const [filterMaxDist, setFilterMaxDist] = useState('');
  const [filterSlowerThan, setFilterSlowerThan] = useState(''); // mm:ss — show runs slower than this
  const [filterFasterThan, setFilterFasterThan] = useState(''); // mm:ss — show runs faster than this
  const [isFiltering, startFiltering] = useTransition();
  const [activeFilters, setActiveFilters] = useState<WorkoutFilters | null>(null);
  const [filteredCount, setFilteredCount] = useState(totalCount);

  // Bulk select state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const hasMore = workouts.length < filteredCount;
  const weekGroups = useMemo(() => groupByWeek(workouts), [workouts]);

  const hasActiveFilters = activeFilters != null;

  const handleApplyFilters = () => {
    const filters: WorkoutFilters = {};
    if (filterStartDate) filters.startDate = filterStartDate;
    if (filterEndDate) filters.endDate = filterEndDate;
    const minDist = parseFloat(filterMinDist);
    const maxDist = parseFloat(filterMaxDist);
    if (!isNaN(minDist)) filters.minDistance = minDist;
    if (!isNaN(maxDist)) filters.maxDistance = maxDist;
    // "Slower than" = minPace (higher seconds = slower)
    const slowerThan = parsePaceInput(filterSlowerThan);
    if (slowerThan) filters.minPace = slowerThan;
    // "Faster than" = maxPace (lower seconds = faster)
    const fasterThan = parsePaceInput(filterFasterThan);
    if (fasterThan) filters.maxPace = fasterThan;

    const hasAny = Object.keys(filters).length > 0;

    startFiltering(async () => {
      if (hasAny) {
        const [filtered, count] = await Promise.all([
          getFilteredWorkouts(filters, activeProfile?.id, pageSize),
          import('@/actions/workouts').then(m => m.getFilteredWorkoutCount(filters, activeProfile?.id)),
        ]);
        setWorkouts(filtered as WorkoutWithRelations[]);
        setFilteredCount(count);
        setActiveFilters(filters);
      } else {
        // Clear filters — reload default
        const [all, count] = await Promise.all([
          getWorkouts(pageSize, activeProfile?.id),
          import('@/actions/workouts').then(m => m.getWorkoutCount(activeProfile?.id)),
        ]);
        setWorkouts(all as WorkoutWithRelations[]);
        setFilteredCount(count);
        setActiveFilters(null);
      }
      setSelectedIds(new Set());
    });
  };

  const handleClearFilters = () => {
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterMinDist('');
    setFilterMaxDist('');
    setFilterSlowerThan('');
    setFilterFasterThan('');
    startFiltering(async () => {
      const [all, count] = await Promise.all([
        getWorkouts(pageSize, activeProfile?.id),
        import('@/actions/workouts').then(m => m.getWorkoutCount(activeProfile?.id)),
      ]);
      setWorkouts(all as WorkoutWithRelations[]);
      setFilteredCount(count);
      setActiveFilters(null);
      setSelectedIds(new Set());
    });
  };

  const handleLoadMore = () => {
    startLoadMore(async () => {
      const moreWorkouts = activeFilters
        ? await getFilteredWorkouts(activeFilters, activeProfile?.id, pageSize, workouts.length)
        : await getWorkouts(pageSize, activeProfile?.id, workouts.length);
      setWorkouts(prev => [...prev, ...(moreWorkouts as WorkoutWithRelations[])]);
    });
  };

  const handleDelete = async (workoutId: number) => {
    if (confirm('Are you sure you want to delete this workout? This cannot be undone.')) {
      setDeletingWorkoutId(workoutId);
      try {
        await deleteWorkout(workoutId);
        setWorkouts(prev => prev.filter(w => w.id !== workoutId));
        setFilteredCount(prev => prev - 1);
        setSelectedIds(prev => { const next = new Set(prev); next.delete(workoutId); return next; });
      } catch (error) {
        console.error('Failed to delete workout:', error);
        alert('Failed to delete workout. Please try again.');
      } finally {
        setDeletingWorkoutId(null);
      }
    }
  };

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    if (selectedIds.size === workouts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(workouts.map(w => w.id)));
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    if (!confirm(`Delete ${count} workout${count > 1 ? 's' : ''}? This cannot be undone.`)) return;

    setIsBulkDeleting(true);
    try {
      await bulkDeleteWorkouts(Array.from(selectedIds));
      setWorkouts(prev => prev.filter(w => !selectedIds.has(w.id)));
      setFilteredCount(prev => prev - count);
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch (error) {
      console.error('Bulk delete failed:', error);
      alert('Failed to delete workouts. Please try again.');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  return (
    <>
      {/* Filter Bar */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors min-h-[44px] ${
              hasActiveFilters
                ? 'bg-dream-500/15 border-dream-500/30 text-primary'
                : 'bg-surface-2 border-borderSecondary text-textTertiary hover:text-primary'
            }`}
          >
            <Filter className="w-4 h-4" />
            {hasActiveFilters ? `Filtered (${filteredCount})` : 'Filter'}
          </button>

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="flex items-center gap-1 text-sm text-textTertiary hover:text-primary transition-colors px-2 py-2 min-h-[44px]"
            >
              <X className="w-4 h-4" />
              Clear
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={() => {
              setSelectMode(!selectMode);
              if (selectMode) setSelectedIds(new Set());
            }}
            className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors min-h-[44px] ${
              selectMode
                ? 'bg-red-500/15 border-red-500/30 text-red-400'
                : 'bg-surface-2 border-borderSecondary text-textTertiary hover:text-primary'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            {selectMode ? 'Cancel' : 'Select'}
          </button>
        </div>

        {/* Expanded filter panel */}
        {showFilters && (
          <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 mb-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-textTertiary mb-1">Start Date</label>
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={e => setFilterStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-1 text-primary border border-strong rounded-lg text-sm focus:ring-2 focus:ring-dream-500 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs text-textTertiary mb-1">End Date</label>
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-1 text-primary border border-strong rounded-lg text-sm focus:ring-2 focus:ring-dream-500 min-h-[44px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-textTertiary mb-1">Min Distance (mi)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 0.5"
                  value={filterMinDist}
                  onChange={e => setFilterMinDist(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-1 text-primary border border-strong rounded-lg text-sm focus:ring-2 focus:ring-dream-500 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs text-textTertiary mb-1">Max Distance (mi)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 15"
                  value={filterMaxDist}
                  onChange={e => setFilterMaxDist(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-1 text-primary border border-strong rounded-lg text-sm focus:ring-2 focus:ring-dream-500 min-h-[44px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-textTertiary mb-1">Faster Than (mm:ss/mi)</label>
                <input
                  type="text"
                  placeholder="e.g. 7:00"
                  value={filterFasterThan}
                  onChange={e => setFilterFasterThan(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-1 text-primary border border-strong rounded-lg text-sm font-mono focus:ring-2 focus:ring-dream-500 min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-xs text-textTertiary mb-1">Slower Than (mm:ss/mi)</label>
                <input
                  type="text"
                  placeholder="e.g. 12:00"
                  value={filterSlowerThan}
                  onChange={e => setFilterSlowerThan(e.target.value)}
                  className="w-full px-3 py-2.5 bg-surface-1 text-primary border border-strong rounded-lg text-sm font-mono focus:ring-2 focus:ring-dream-500 min-h-[44px]"
                />
              </div>
            </div>

            <button
              onClick={handleApplyFilters}
              disabled={isFiltering}
              className="btn-primary text-sm w-full flex items-center justify-center gap-2"
            >
              {isFiltering ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Filtering...
                </>
              ) : (
                'Apply Filters'
              )}
            </button>
          </div>
        )}

        {/* Bulk action bar */}
        {selectMode && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-red-950/20 border border-red-500/30 rounded-lg px-4 py-2 mb-4">
            <span className="text-sm text-red-400 font-medium">
              {selectedIds.size} selected
            </span>
            <button
              onClick={handleSelectAll}
              className="text-xs text-textTertiary hover:text-primary transition-colors"
            >
              {selectedIds.size === workouts.length ? 'Deselect All' : 'Select All'}
            </button>
            <div className="flex-1" />
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              {isBulkDeleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              Delete Selected
            </button>
          </div>
        )}
      </div>

      <AnimatedList className="space-y-6">
        {weekGroups.map((group) => (
          <AnimatedListItem key={group.key}>
            {/* Week header */}
            <div className="flex items-baseline justify-between mb-3 px-1">
              <h3 className="font-semibold text-textPrimary">{group.label}</h3>
              <span className="text-sm text-textTertiary">
                {group.runCount} {group.runCount === 1 ? 'activity' : 'activities'} · {group.totalMiles > 0 ? `${formatDistance(group.totalMiles)} mi · ` : ''}{formatDurationFull(group.totalMinutes)}
              </span>
            </div>

            {/* Workout cards */}
            <AnimatedList className="space-y-3">
              {group.workouts.map((workout) => (
                <AnimatedListItem key={workout.id}>
                  <WorkoutCard
                    workout={workout}
                    onEdit={setEditingWorkout}
                    onDelete={handleDelete}
                    isDeleting={deletingWorkoutId === workout.id}
                    selectable={selectMode}
                    isSelected={selectedIds.has(workout.id)}
                    onSelect={toggleSelect}
                  />
                </AnimatedListItem>
              ))}
            </AnimatedList>
          </AnimatedListItem>
        ))}
      </AnimatedList>

      {workouts.length === 0 && hasActiveFilters && (
        <div className="text-center py-8 text-textTertiary">
          <p className="text-sm">No workouts match your filters.</p>
          <button onClick={handleClearFilters} className="text-sm text-dream-500 hover:text-dream-400 mt-2">
            Clear filters
          </button>
        </div>
      )}

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
              <>Load more ({filteredCount - workouts.length} remaining)</>
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
