'use client';

import { cn, formatPace } from '@/lib/utils';
import { WorkoutStructure, WorkoutSegment } from '@/lib/training/types';
import {
  Clock,
  MapPin,
  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Circle,
  Edit2,
} from 'lucide-react';
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

export interface UserPaceSettings {
  easyPaceSeconds?: number | null;
  marathonPaceSeconds?: number | null;
  tempoPaceSeconds?: number | null;
  thresholdPaceSeconds?: number | null;
  intervalPaceSeconds?: number | null;
  vdot?: number | null;
}

interface WorkoutCardProps {
  workout: PlannedWorkout;
  compact?: boolean;
  showDate?: boolean;
  onStatusChange?: (status: 'completed' | 'skipped') => void;
  onModify?: () => void;
  paceSettings?: UserPaceSettings;
}

const workoutTypeColors: Record<string, { bg: string; border: string; text: string }> = {
  recovery: { bg: 'bg-surface-2', border: 'border-borderPrimary', text: 'text-slate-300' },
  easy: { bg: 'bg-sky-900', border: 'border-sky-800', text: 'text-sky-300' },
  long: { bg: 'bg-dream-900', border: 'border-dream-800', text: 'text-dream-300' },
  steady: { bg: 'bg-sky-900', border: 'border-sky-800', text: 'text-sky-300' },
  marathon: { bg: 'bg-blue-900', border: 'border-blue-800', text: 'text-blue-300' },
  tempo: { bg: 'bg-indigo-900', border: 'border-indigo-800', text: 'text-indigo-300' },
  threshold: { bg: 'bg-violet-900', border: 'border-violet-800', text: 'text-violet-300' },
  interval: { bg: 'bg-red-900', border: 'border-red-800', text: 'text-red-300' },
  repetition: { bg: 'bg-rose-900', border: 'border-rose-800', text: 'text-rose-300' },
  race: { bg: 'bg-amber-900', border: 'border-amber-800', text: 'text-amber-300' },
  cross_train: { bg: 'bg-violet-900', border: 'border-violet-800', text: 'text-violet-300' },
  other: { bg: 'bg-bgTertiary', border: 'border-borderPrimary', text: 'text-textSecondary' },
};

const statusIcons = {
  scheduled: Circle,
  completed: CheckCircle2,
  skipped: XCircle,
  modified: Circle,
};

// Get actual pace value (seconds/mi) for a pace zone
function getPaceForZone(zone: string, paceSettings?: UserPaceSettings): number | null {
  if (!paceSettings) return null;

  // Derive paces from settings (with reasonable defaults if not set)
  const easy = paceSettings.easyPaceSeconds || null;
  const marathon = paceSettings.marathonPaceSeconds || (easy ? easy - 30 : null);
  const tempo = paceSettings.tempoPaceSeconds || (easy ? easy - 60 : null);
  const threshold = paceSettings.thresholdPaceSeconds || (tempo ? tempo - 10 : null);
  const interval = paceSettings.intervalPaceSeconds || (threshold ? threshold - 20 : null);

  const paceMap: Record<string, number | null> = {
    recovery: easy ? easy + 45 : null,
    easy: easy,
    easy_long: easy ? easy + 15 : null,
    general_aerobic: easy ? easy - 10 : null,
    steady: easy ? easy - 15 : null,
    marathon: marathon,
    half_marathon: marathon ? marathon - 15 : null,
    tempo: tempo,
    threshold: threshold,
    vo2max: interval ? interval + 5 : null,
    interval: interval,
    repetition: interval ? interval - 15 : null,
  };

  return paceMap[zone] ?? null;
}

// Format pace with zone label
function formatPaceWithZone(zone: string, paceSettings?: UserPaceSettings): string {
  const paceLabels: Record<string, string> = {
    recovery: 'recovery',
    easy: 'easy',
    easy_long: 'easy long',
    general_aerobic: 'GA',
    steady: 'steady',
    marathon: 'marathon',
    half_marathon: 'HM',
    tempo: 'tempo',
    threshold: 'threshold',
    vo2max: 'VO2max',
    interval: 'interval',
    repetition: 'rep',
  };

  const label = paceLabels[zone] || zone;
  const paceSeconds = getPaceForZone(zone, paceSettings);

  if (paceSeconds) {
    return `${label} pace (${formatPace(paceSeconds)}/mi)`;
  }
  return `${label} pace`;
}

// Format a workout segment into a human-readable string
function formatSegment(segment: WorkoutSegment, paceSettings?: UserPaceSettings): string {
  const parts: string[] = [];

  // Get the segment type label
  const typeLabels: Record<string, string> = {
    warmup: 'Warm-up',
    cooldown: 'Cool-down',
    work: 'Main',
    recovery: 'Recovery',
    steady: 'Steady',
    intervals: 'Intervals',
    hills: 'Hills',
    fartlek: 'Fartlek',
    strides: 'Strides',
    ladder: 'Ladder',
  };

  const typeLabel = typeLabels[segment.type] || segment.type;

  // Handle intervals specially
  if (segment.type === 'intervals' && segment.repeats) {
    let intervalDesc = `${segment.repeats}x`;

    if (segment.workDistanceMeters) {
      intervalDesc += ` ${segment.workDistanceMeters}m`;
    } else if (segment.workDistanceMiles) {
      intervalDesc += ` ${segment.workDistanceMiles}mi`;
    } else if (segment.workDurationMinutes || segment.workDurationSeconds) {
      const mins = segment.workDurationMinutes || 0;
      const secs = segment.workDurationSeconds || 0;
      if (mins && secs) {
        intervalDesc += ` ${mins}:${secs.toString().padStart(2, '0')}`;
      } else if (mins) {
        intervalDesc += ` ${mins}min`;
      } else {
        intervalDesc += ` ${secs}s`;
      }
    }

    if (segment.paceDescription) {
      intervalDesc += ` @ ${segment.paceDescription}`;
    } else if (segment.pace) {
      intervalDesc += ` @ ${formatPaceWithZone(segment.pace, paceSettings)}`;
    }

    if (segment.restMinutes || segment.restSeconds) {
      const restTotal = (segment.restMinutes || 0) * 60 + (segment.restSeconds || 0);
      const restMins = Math.floor(restTotal / 60);
      const restSecs = restTotal % 60;
      intervalDesc += ` w/ ${restMins}:${restSecs.toString().padStart(2, '0')} ${segment.restType || 'jog'} rest`;
    }

    return intervalDesc;
  }

  // Handle ladder workouts
  if (segment.type === 'ladder' && segment.distancesMeters) {
    const ladder = segment.distancesMeters.join('-') + '-' + [...segment.distancesMeters].reverse().join('-') + 'm';
    let ladderDesc = `Ladder: ${ladder}`;
    if (segment.paceDescription) {
      ladderDesc += ` @ ${segment.paceDescription}`;
    } else if (segment.pace) {
      ladderDesc += ` @ ${formatPaceWithZone(segment.pace, paceSettings)}`;
    }
    return ladderDesc;
  }

  // Handle hills
  if (segment.type === 'hills' && segment.repeats) {
    let hillDesc = `${segment.repeats}x hill`;
    if (segment.workDurationSeconds) {
      hillDesc += ` (${segment.workDurationSeconds}s)`;
    }
    return hillDesc;
  }

  // Handle strides
  if (segment.type === 'strides' && segment.repeats) {
    let strideDesc = `${segment.repeats} strides`;
    if (segment.workDistanceMeters) {
      strideDesc = `${segment.repeats}x${segment.workDistanceMeters}m strides`;
    }
    return strideDesc;
  }

  // Standard segment
  parts.push(typeLabel);

  // Add distance or duration
  if (segment.distanceMiles) {
    parts.push(`${segment.distanceMiles}mi`);
  } else if (segment.distanceMeters) {
    parts.push(`${segment.distanceMeters}m`);
  } else if (segment.durationMinutes) {
    parts.push(`${segment.durationMinutes}min`);
  } else if (segment.percentage) {
    parts.push(`${segment.percentage}%`);
  }

  // Add pace
  if (segment.paceDescription) {
    parts.push(`@ ${segment.paceDescription}`);
  } else if (segment.pace) {
    parts.push(`@ ${formatPaceWithZone(segment.pace, paceSettings)}`);
  }

  // Add notes
  if (segment.notes) {
    parts.push(`(${segment.notes})`);
  }

  return parts.join(' ');
}

// Format the entire workout structure
function formatWorkoutStructure(structureJson: string, paceSettings?: UserPaceSettings): string[] {
  try {
    const structure: WorkoutStructure = JSON.parse(structureJson);
    if (!structure.segments || structure.segments.length === 0) {
      return [];
    }
    return structure.segments.map(seg => formatSegment(seg, paceSettings));
  } catch {
    return [];
  }
}

export function WorkoutCard({ workout, compact = false, showDate = false, onStatusChange, onModify, paceSettings }: WorkoutCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colors = workoutTypeColors[workout.workoutType] || workoutTypeColors.other;
  const StatusIcon = statusIcons[workout.status as keyof typeof statusIcons] || Circle;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  if (compact) {
    return (
      <div
        className={cn(
          'p-2 rounded-lg border text-sm',
          colors.bg,
          colors.border,
          workout.isKeyWorkout && 'ring-2 ring-offset-1 ring-dream-400 ring-offset-surface-0'
        )}
      >
        <div className="flex items-center justify-between">
          <span className={cn('font-medium truncate', colors.text)}>{workout.name}</span>
          {workout.targetDistanceMiles && (
            <span className="text-xs text-textTertiary ml-2">{workout.targetDistanceMiles}mi</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden',
        colors.bg,
        colors.border,
        workout.isKeyWorkout && 'ring-2 ring-offset-2 ring-dream-400 ring-offset-surface-0'
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {showDate && (
              <p className="text-xs text-textTertiary mb-1">{formatDate(workout.date)}</p>
            )}
            <div className="flex items-center gap-2">
              <StatusIcon
                className={cn(
                  'w-4 h-4',
                  workout.status === 'completed' && 'text-green-500',
                  workout.status === 'skipped' && 'text-tertiary',
                  workout.status === 'scheduled' && 'text-tertiary'
                )}
              />
              <h3 className={cn('font-semibold', colors.text)}>{workout.name}</h3>
              {workout.isKeyWorkout && (
                <span className="px-1.5 py-0.5 text-xs bg-dream-500/10 text-dream-300 rounded font-medium">
                  Key
                </span>
              )}
            </div>
            <p className="text-sm text-textSecondary mt-1">{workout.description}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4 mt-3">
          {workout.targetDistanceMiles && (
            <div className="flex items-center text-sm text-textSecondary">
              <MapPin className="w-4 h-4 mr-1" />
              {workout.targetDistanceMiles} miles
            </div>
          )}
          {workout.targetDurationMinutes && (
            <div className="flex items-center text-sm text-textSecondary">
              <Clock className="w-4 h-4 mr-1" />
              {workout.targetDurationMinutes} min
            </div>
          )}
          {workout.targetPaceSecondsPerMile && (
            <div className="flex items-center text-sm text-textSecondary">
              <Zap className="w-4 h-4 mr-1" />
              {formatPace(workout.targetPaceSecondsPerMile)}/mi
            </div>
          )}
        </div>

        {/* Expand toggle */}
        {(workout.rationale || workout.structure) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center text-sm text-textTertiary hover:text-textSecondary mt-3"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                Less details
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                More details
              </>
            )}
          </button>
        )}

        {/* Expanded content */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-borderPrimary space-y-3">
            {workout.rationale && (
              <div>
                <h4 className="text-xs font-medium text-textTertiary uppercase tracking-wide mb-1">
                  Purpose
                </h4>
                <p className="text-sm text-textSecondary">{workout.rationale}</p>
              </div>
            )}
            {workout.structure && formatWorkoutStructure(workout.structure, paceSettings).length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-textTertiary uppercase tracking-wide mb-1">
                  Structure
                </h4>
                <ol className="text-sm text-textSecondary space-y-1 list-decimal list-inside">
                  {formatWorkoutStructure(workout.structure, paceSettings).map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {(onStatusChange || onModify) && workout.status === 'scheduled' && (
        <div className="flex border-t border-borderPrimary/50">
          {onStatusChange && (
            <>
              <button
                onClick={() => onStatusChange('completed')}
                className="flex-1 py-2 text-sm font-medium text-green-600 bg-green-950 transition-colors"
              >
                Mark Complete
              </button>
              <button
                onClick={() => onStatusChange('skipped')}
                className="flex-1 py-2 text-sm font-medium text-textTertiary hover:bg-bgTertiary transition-colors border-l border-borderPrimary/50"
              >
                Skip
              </button>
            </>
          )}
          {onModify && (
            <button
              onClick={onModify}
              className="flex items-center justify-center gap-1 px-4 py-2 text-sm font-medium text-dream-600 hover:bg-surface-1 transition-colors border-l border-borderPrimary/50"
            >
              <Edit2 className="w-4 h-4" />
              Modify
            </button>
          )}
        </div>
      )}
    </div>
  );
}
