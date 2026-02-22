'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  cn,
  formatDate,
  formatDistance,
  formatPace,
  getVerdictColor,
  getWorkoutTypeLabel,
  getWorkoutTypeColor,
  getActivityTypeLabel,
  getCrossTrainIntensityLabel,
  isCrossTraining,
} from '@/lib/utils';
import { EditWorkoutModal } from './EditWorkoutModal';
import { Pencil, ChevronRight, Heart, TrendingUp, Mountain, Trash2, Loader2, Bike, Waves, Dumbbell, Footprints, PersonStanding, Activity } from 'lucide-react';
import { classifySplitEfforts } from '@/lib/training/effort-classifier';
import { getSegmentBarColor } from '@/lib/workout-colors';
import type { Workout, Shoe, Assessment, WorkoutSegment } from '@/lib/schema';
import { deleteWorkout, getWorkouts } from '@/actions/workouts';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/lib/profile-context';

export type WorkoutWithRelations = Workout & {
  shoe?: Shoe | null;
  assessment?: Assessment | null;
  segments?: WorkoutSegment[];
};

interface WorkoutListProps {
  initialWorkouts?: WorkoutWithRelations[];
  workouts?: WorkoutWithRelations[];
  totalCount?: number;
  pageSize?: number;
}

// Format duration nicely: "1h 23m" or "45m 30s" or "32m"
export function formatDurationFull(minutes: number | null | undefined): string {
  if (!minutes) return '--';

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours > 0) {
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${mins}m`;
}

// Mini lap chart using effort classification (matches workout detail page)
function MiniLapChart({ segments, avgPace, workoutType }: { segments: WorkoutSegment[]; avgPace: number | null; workoutType: string }) {
  if (!segments || segments.length < 2) return null;

  const sorted = [...segments].sort((a, b) => a.segmentNumber - b.segmentNumber);
  const avgPaceRef = avgPace || Math.round(sorted.reduce((sum, s) => sum + (s.paceSecondsPerMile || 0), 0) / sorted.length);

  // Map segments to the Lap format expected by the effort classifier
  const laps = sorted.map(seg => ({
    lapNumber: seg.segmentNumber,
    distanceMiles: seg.distanceMiles || 1,
    durationSeconds: seg.durationSeconds || ((seg.paceSecondsPerMile || 480) * (seg.distanceMiles || 1)),
    avgPaceSeconds: seg.paceSecondsPerMile || 480,
    avgHeartRate: seg.avgHr,
    maxHeartRate: seg.maxHr,
    elevationGainFeet: seg.elevationGainFt,
    lapType: seg.segmentType || 'steady',
  }));

  const classified = classifySplitEfforts(laps, { workoutType, avgPaceSeconds: avgPaceRef });

  return (
    <div className="flex h-4 gap-px rounded overflow-hidden mt-2" title="Effort per mile">
      {classified.map((split, i) => {
        const pace = sorted[i].paceSecondsPerMile || 0;
        // Intensity based on pace relative to average
        const diff = avgPaceRef ? (pace - avgPaceRef) / avgPaceRef : 0;
        let intensity: 300 | 400 | 500 | 600 = 400;
        if (diff < -0.1) intensity = 600;
        else if (diff < -0.05) intensity = 500;
        else if (diff > 0.05) intensity = 300;

        const bgColor = getSegmentBarColor(split.category, intensity);

        return (
          <div
            key={i}
            className="flex-1 min-w-1"
            style={{ backgroundColor: bgColor }}
            title={`Mile ${split.lapNumber}: ${formatPace(pace)}/mi (${split.categoryLabel})`}
          />
        );
      })}
    </div>
  );
}

// HR zone colors
const zoneColors = [
  'bg-sky-400',     // Z1 - Easy/Recovery
  'bg-sky-500',     // Z2 - Moderate/Aerobic
  'bg-indigo-500',  // Z3 - Tempo/Threshold
  'bg-violet-500',  // Z4 - Hard/VO2max
  'bg-red-500',     // Z5 - Max effort
];
const zoneNames = ['Recovery', 'Aerobic', 'Tempo', 'Threshold', 'VO2max'];

function getHRZone(hr: number, maxHr: number): number {
  const pct = hr / maxHr;
  if (pct >= 0.9) return 4; // Z5
  if (pct >= 0.8) return 3; // Z4
  if (pct >= 0.7) return 2; // Z3
  if (pct >= 0.6) return 1; // Z2
  return 0; // Z1
}

// Mini HR zone bar showing zone per lap
function MiniHRZoneBar({ segments, maxHr }: { segments: WorkoutSegment[]; maxHr: number }) {
  const sorted = [...segments].sort((a, b) => a.segmentNumber - b.segmentNumber);
  const hasHR = sorted.some(s => s.avgHr && s.avgHr > 0);
  if (!hasHR || sorted.length < 2) return null;

  return (
    <div className="flex h-4 gap-px rounded overflow-hidden mt-1" title="HR zone per lap">
      {sorted.map((seg, i) => {
        const hr = seg.avgHr || 0;
        if (hr <= 0) return <div key={i} className="bg-bgTertiary flex-1 min-w-1" />;
        const zone = getHRZone(hr, maxHr);
        return (
          <div
            key={i}
            className={`${zoneColors[zone]} flex-1 min-w-1`}
            title={`Mile ${seg.segmentNumber}: ${hr} bpm · Z${zone + 1} ${zoneNames[zone]}`}
          />
        );
      })}
    </div>
  );
}

// Activity type icon for cross-training
function CrossTrainIcon({ activityType, className }: { activityType: string; className?: string }) {
  switch (activityType) {
    case 'bike': return <Bike className={className} />;
    case 'swim': return <Waves className={className} />;
    case 'strength': return <Dumbbell className={className} />;
    case 'walk_hike': return <Footprints className={className} />;
    case 'yoga': return <PersonStanding className={className} />;
    case 'other': return <Activity className={className} />;
    default: return null;
  }
}

// Generic Strava activity names that add no value (auto-generated by Strava based on time of day)
/** Compute weather pace adjustment (seconds/mile) — conservative, research-backed inline version */
function getWeatherAdj(tempF: number | null, humidity: number | null): number {
  if (tempF == null || humidity == null) return 0;
  let adj = 0;
  const OPTIMAL = 45;
  if (tempF > OPTIMAL) {
    if (tempF > 85) {
      adj += (70 - OPTIMAL) * 0.4 + (85 - 70) * 1.0 + (tempF - 85) * 1.5;
    } else if (tempF > 70) {
      adj += (70 - OPTIMAL) * 0.4 + (tempF - 70) * 1.0;
    } else {
      adj += (tempF - OPTIMAL) * 0.4;
    }
    if (tempF > 65 && humidity > 50) {
      adj += (humidity - 50) * 0.1;
    } else if (tempF > 55 && humidity > 60) {
      adj += (humidity - 60) * 0.05;
    }
  } else if (tempF < 35) {
    adj += (35 - tempF) * 0.2;
  }
  return Math.round(adj);
}

const GENERIC_STRAVA_NAMES = new Set([
  'morning run',
  'afternoon run',
  'evening run',
  'lunch run',
  'night run',
  'early morning run',
]);

function getStravaActivityName(workout: WorkoutWithRelations): string | null {
  if (workout.source !== 'strava') return null;
  const name = (workout.stravaName || workout.notes)?.trim();
  if (!name) return null;
  if (GENERIC_STRAVA_NAMES.has(name.toLowerCase())) return null;
  return name;
}

// --- Exported WorkoutCard component ---

interface WorkoutCardProps {
  workout: WorkoutWithRelations;
  onEdit?: (workout: WorkoutWithRelations) => void;
  onDelete?: (workoutId: number) => void;
  isDeleting?: boolean;
  selectable?: boolean;
  isSelected?: boolean;
  onSelect?: (workoutId: number) => void;
}

export function WorkoutCard({ workout, onEdit, onDelete, isDeleting, selectable, isSelected, onSelect }: WorkoutCardProps) {
  return (
    <div
      className={cn(
        "bg-bgSecondary rounded-xl border p-4 hover:border-borderPrimary/80 transition-all shadow-sm",
        isSelected ? 'border-red-500/60 bg-red-950/10' : 'border-borderPrimary'
      )}
    >
      <div className="flex items-start justify-between">
        {selectable && (
          <button
            onClick={() => onSelect?.(workout.id)}
            className="mr-2 shrink-0 p-2 -ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <div className={cn(
              'w-6 h-6 rounded border-2 flex items-center justify-center transition-colors',
              isSelected ? 'bg-red-500 border-red-500 text-white' : 'border-borderSecondary hover:border-textTertiary'
            )}>
              {isSelected && <span className="text-xs font-bold">✓</span>}
            </div>
          </button>
        )}
        <Link href={`/workout/${workout.id}`} className="flex-1">
          {/* Header row: date, type, verdict */}
          <div className="flex items-center gap-2 mb-2">
            {/* Cross-training activity icon */}
            {isCrossTraining(workout.activityType || 'run') && (
              <CrossTrainIcon activityType={workout.activityType || 'other'} className="w-4 h-4 text-violet-400 shrink-0" />
            )}
            <span className="font-medium text-textPrimary">
              {formatDate(workout.date)}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                isCrossTraining(workout.activityType || 'run')
                  ? 'bg-violet-900 text-violet-200'
                  : getWorkoutTypeColor(workout.workoutType)
              }`}
            >
              {isCrossTraining(workout.activityType || 'run')
                ? getActivityTypeLabel(workout.activityType || 'other')
                : getWorkoutTypeLabel(workout.workoutType)}
            </span>
            {/* Show intensity for cross-training */}
            {isCrossTraining(workout.activityType || 'run') && workout.crossTrainIntensity && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-stone-800 text-stone-300">
                {getCrossTrainIntensityLabel(workout.crossTrainIntensity)}
              </span>
            )}
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

          {/* Strava activity name (only if custom) */}
          {getStravaActivityName(workout) && (
            <div className="text-sm text-textSecondary -mt-0.5 mb-1.5 italic truncate">
              {getStravaActivityName(workout)}
            </div>
          )}

          {/* Main stats row: distance, duration, pace */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-textSecondary">
            {/* Show distance if available (cross-training may not have it) */}
            {workout.distanceMiles && workout.distanceMiles > 0 ? (
              <span className="font-semibold text-textPrimary">
                {formatDistance(workout.distanceMiles)} mi
              </span>
            ) : null}
            <span>{formatDurationFull(workout.durationMinutes)}</span>
            {/* Show pace only for runs */}
            {!isCrossTraining(workout.activityType || 'run') && workout.avgPaceSeconds && workout.avgPaceSeconds > 0 && (
              <span>
                {formatPace(workout.avgPaceSeconds)} /mi
                {(() => {
                  const adj = getWeatherAdj(workout.weatherTempF, workout.weatherHumidityPct);
                  if (adj > 0 && workout.avgPaceSeconds) {
                    const effPace = workout.avgPaceSeconds - adj;
                    if (effPace > 0 && effPace < workout.avgPaceSeconds) {
                      return <span className="text-xs text-sky-400 ml-1">eff. {formatPace(effPace)}</span>;
                    }
                  }
                  return null;
                })()}
              </span>
            )}
          </div>

          {/* Secondary stats row: HR, elevation, load */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-textTertiary">
            {(workout.avgHeartRate || workout.avgHr) && (
              <span className="flex items-center gap-1">
                <Heart className="w-3 h-3 text-red-400" />
                {workout.avgHeartRate || workout.avgHr} bpm
              </span>
            )}
            {(workout.elevationGainFeet || workout.elevationGainFt) && (
              <span className="flex items-center gap-1">
                <Mountain className="w-3 h-3 text-emerald-500" />
                {Math.round(workout.elevationGainFeet || workout.elevationGainFt || 0)} ft
              </span>
            )}
            {workout.trainingLoad && workout.trainingLoad > 0 && (
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-dream-500" />
                Load {workout.trainingLoad}
              </span>
            )}
            {workout.assessment?.rpe && (
              <span className="text-textTertiary">
                RPE {workout.assessment.rpe}
              </span>
            )}
          </div>

          {/* Tags row: shoe, route, source */}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-textTertiary">
            {workout.shoe && (
              <span className="bg-bgTertiary px-2 py-0.5 rounded truncate max-w-[140px]">
                {workout.shoe.name}
              </span>
            )}
            {workout.routeName && (
              <span className="bg-bgTertiary px-2 py-0.5 rounded truncate max-w-[140px]">
                {workout.routeName}
              </span>
            )}
            {workout.source && workout.source !== 'manual' && (
              <span className="bg-bgTertiary px-2 py-0.5 rounded text-textTertiary capitalize">
                {workout.source}
              </span>
            )}
          </div>

          {/* Mini lap charts */}
          {Array.isArray(workout.segments) && workout.segments.length >= 2 && (
            <>
              <MiniLapChart segments={workout.segments} avgPace={workout.avgPaceSeconds} workoutType={workout.workoutType} />
              {workout.maxHr && workout.maxHr > 0 && (
                <MiniHRZoneBar segments={workout.segments} maxHr={workout.maxHr} />
              )}
            </>
          )}
        </Link>

        <div className="flex items-center gap-1 ml-4">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(workout);
              }}
              className="p-2 text-textTertiary hover:text-accentTeal hover:bg-bgInteractive-hover rounded-lg transition-colors"
              title="Edit workout"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(workout.id);
              }}
              disabled={isDeleting}
              className="p-2 text-textTertiary hover:text-red-600 hover:bg-red-950 rounded-lg transition-colors disabled:opacity-50"
              title="Delete workout"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <Link
            href={`/workout/${workout.id}`}
            className="p-2 text-textTertiary hover:text-textSecondary"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// --- WorkoutList (original flat list, preserved for backward compat) ---

export function WorkoutList({ initialWorkouts, workouts: legacyWorkouts, totalCount = 0, pageSize = 30 }: WorkoutListProps) {
  const allInitial = initialWorkouts || legacyWorkouts || [];
  const [workouts, setWorkouts] = useState<WorkoutWithRelations[]>(allInitial);
  const [editingWorkout, setEditingWorkout] = useState<WorkoutWithRelations | null>(null);
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<number | null>(null);
  const [isLoadingMore, startLoadMore] = useTransition();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _router = useRouter();
  const { activeProfile } = useProfile();

  const hasMore = workouts.length < totalCount;

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
      <div className="space-y-3">
        {workouts.map((workout) => (
          <WorkoutCard
            key={workout.id}
            workout={workout}
            onEdit={setEditingWorkout}
            onDelete={handleDelete}
            isDeleting={deletingWorkoutId === workout.id}
          />
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="pt-2 text-center">
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
