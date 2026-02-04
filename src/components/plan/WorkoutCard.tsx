'use client';

import { cn } from '@/lib/utils';
import { formatPace, WorkoutStructure, WorkoutSegment } from '@/lib/training/types';
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

interface WorkoutCardProps {
  workout: PlannedWorkout;
  compact?: boolean;
  showDate?: boolean;
  onStatusChange?: (status: 'completed' | 'skipped') => void;
  onModify?: () => void;
}

const workoutTypeColors: Record<string, { bg: string; border: string; text: string }> = {
  easy: { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
  long: { bg: 'bg-teal-50', border: 'border-teal-300', text: 'text-teal-700' },
  tempo: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
  threshold: { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-800' },
  interval: { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-700' },
  steady: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' },
  recovery: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  race: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  cross_train: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700' },
  other: { bg: 'bg-stone-50', border: 'border-stone-200', text: 'text-stone-600' },
};

const statusIcons = {
  scheduled: Circle,
  completed: CheckCircle2,
  skipped: XCircle,
  modified: Circle,
};

// Format a workout segment into a human-readable string
function formatSegment(segment: WorkoutSegment): string {
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

    if (segment.pace || segment.paceDescription) {
      intervalDesc += ` @ ${segment.paceDescription || segment.pace}`;
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
    if (segment.pace || segment.paceDescription) {
      ladderDesc += ` @ ${segment.paceDescription || segment.pace}`;
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
    const paceLabels: Record<string, string> = {
      recovery: 'recovery pace',
      easy: 'easy pace',
      easy_long: 'easy long run pace',
      general_aerobic: 'GA pace',
      steady: 'steady pace',
      marathon: 'marathon pace',
      half_marathon: 'half marathon pace',
      tempo: 'tempo pace',
      threshold: 'threshold pace',
      vo2max: 'VO2max pace',
      interval: 'interval pace',
      repetition: 'rep pace',
    };
    parts.push(`@ ${paceLabels[segment.pace] || segment.pace}`);
  }

  // Add notes
  if (segment.notes) {
    parts.push(`(${segment.notes})`);
  }

  return parts.join(' ');
}

// Format the entire workout structure
function formatWorkoutStructure(structureJson: string): string[] {
  try {
    const structure: WorkoutStructure = JSON.parse(structureJson);
    if (!structure.segments || structure.segments.length === 0) {
      return [];
    }
    return structure.segments.map(formatSegment);
  } catch {
    return [];
  }
}

export function WorkoutCard({ workout, compact = false, showDate = false, onStatusChange, onModify }: WorkoutCardProps) {
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
          workout.isKeyWorkout && 'ring-2 ring-offset-1 ring-teal-400'
        )}
      >
        <div className="flex items-center justify-between">
          <span className={cn('font-medium truncate', colors.text)}>{workout.name}</span>
          {workout.targetDistanceMiles && (
            <span className="text-xs text-stone-500 ml-2">{workout.targetDistanceMiles}mi</span>
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
        workout.isKeyWorkout && 'ring-2 ring-offset-2 ring-teal-400'
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {showDate && (
              <p className="text-xs text-stone-500 mb-1">{formatDate(workout.date)}</p>
            )}
            <div className="flex items-center gap-2">
              <StatusIcon
                className={cn(
                  'w-4 h-4',
                  workout.status === 'completed' && 'text-green-500',
                  workout.status === 'skipped' && 'text-stone-400',
                  workout.status === 'scheduled' && 'text-stone-300'
                )}
              />
              <h3 className={cn('font-semibold', colors.text)}>{workout.name}</h3>
              {workout.isKeyWorkout && (
                <span className="px-1.5 py-0.5 text-xs bg-teal-50 text-teal-700 rounded font-medium">
                  Key
                </span>
              )}
            </div>
            <p className="text-sm text-stone-600 mt-1">{workout.description}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4 mt-3">
          {workout.targetDistanceMiles && (
            <div className="flex items-center text-sm text-stone-600">
              <MapPin className="w-4 h-4 mr-1" />
              {workout.targetDistanceMiles} miles
            </div>
          )}
          {workout.targetDurationMinutes && (
            <div className="flex items-center text-sm text-stone-600">
              <Clock className="w-4 h-4 mr-1" />
              {workout.targetDurationMinutes} min
            </div>
          )}
          {workout.targetPaceSecondsPerMile && (
            <div className="flex items-center text-sm text-stone-600">
              <Zap className="w-4 h-4 mr-1" />
              {formatPace(workout.targetPaceSecondsPerMile)}/mi
            </div>
          )}
        </div>

        {/* Expand toggle */}
        {(workout.rationale || workout.structure) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center text-sm text-stone-500 hover:text-stone-700 mt-3"
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
          <div className="mt-3 pt-3 border-t border-stone-200 space-y-3">
            {workout.rationale && (
              <div>
                <h4 className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">
                  Purpose
                </h4>
                <p className="text-sm text-stone-600">{workout.rationale}</p>
              </div>
            )}
            {workout.structure && formatWorkoutStructure(workout.structure).length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-1">
                  Structure
                </h4>
                <ol className="text-sm text-stone-600 space-y-1 list-decimal list-inside">
                  {formatWorkoutStructure(workout.structure).map((step, idx) => (
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
        <div className="flex border-t border-stone-200/50">
          {onStatusChange && (
            <>
              <button
                onClick={() => onStatusChange('completed')}
                className="flex-1 py-2 text-sm font-medium text-green-600 hover:bg-green-50 transition-colors"
              >
                Mark Complete
              </button>
              <button
                onClick={() => onStatusChange('skipped')}
                className="flex-1 py-2 text-sm font-medium text-stone-500 hover:bg-stone-50 transition-colors border-l border-stone-200/50"
              >
                Skip
              </button>
            </>
          )}
          {onModify && (
            <button
              onClick={onModify}
              className="flex items-center justify-center gap-1 px-4 py-2 text-sm font-medium text-teal-600 hover:bg-slate-50 transition-colors border-l border-stone-200/50"
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
