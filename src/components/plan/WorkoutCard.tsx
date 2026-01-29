'use client';

import { cn } from '@/lib/utils';
import { formatPace } from '@/lib/training/types';
import {
  Clock,
  MapPin,
  Zap,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Circle,
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
}

const workoutTypeColors: Record<string, { bg: string; border: string; text: string }> = {
  easy: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  long: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  tempo: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  interval: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
  steady: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
  recovery: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' },
  race: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  other: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' },
};

const statusIcons = {
  scheduled: Circle,
  completed: CheckCircle2,
  skipped: XCircle,
  modified: Circle,
};

export function WorkoutCard({ workout, compact = false, showDate = false, onStatusChange }: WorkoutCardProps) {
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
          workout.isKeyWorkout && 'ring-2 ring-offset-1 ring-blue-400'
        )}
      >
        <div className="flex items-center justify-between">
          <span className={cn('font-medium truncate', colors.text)}>{workout.name}</span>
          {workout.targetDistanceMiles && (
            <span className="text-xs text-slate-500 ml-2">{workout.targetDistanceMiles}mi</span>
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
        workout.isKeyWorkout && 'ring-2 ring-offset-2 ring-blue-400'
      )}
    >
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {showDate && (
              <p className="text-xs text-slate-500 mb-1">{formatDate(workout.date)}</p>
            )}
            <div className="flex items-center gap-2">
              <StatusIcon
                className={cn(
                  'w-4 h-4',
                  workout.status === 'completed' && 'text-green-500',
                  workout.status === 'skipped' && 'text-slate-400',
                  workout.status === 'scheduled' && 'text-slate-300'
                )}
              />
              <h3 className={cn('font-semibold', colors.text)}>{workout.name}</h3>
              {workout.isKeyWorkout && (
                <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded font-medium">
                  Key
                </span>
              )}
            </div>
            <p className="text-sm text-slate-600 mt-1">{workout.description}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4 mt-3">
          {workout.targetDistanceMiles && (
            <div className="flex items-center text-sm text-slate-600">
              <MapPin className="w-4 h-4 mr-1" />
              {workout.targetDistanceMiles} miles
            </div>
          )}
          {workout.targetDurationMinutes && (
            <div className="flex items-center text-sm text-slate-600">
              <Clock className="w-4 h-4 mr-1" />
              {workout.targetDurationMinutes} min
            </div>
          )}
          {workout.targetPaceSecondsPerMile && (
            <div className="flex items-center text-sm text-slate-600">
              <Zap className="w-4 h-4 mr-1" />
              {formatPace(workout.targetPaceSecondsPerMile)}/mi
            </div>
          )}
        </div>

        {/* Expand toggle */}
        {(workout.rationale || workout.structure) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center text-sm text-slate-500 hover:text-slate-700 mt-3"
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
          <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
            {workout.rationale && (
              <div>
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                  Purpose
                </h4>
                <p className="text-sm text-slate-600">{workout.rationale}</p>
              </div>
            )}
            {workout.structure && (
              <div>
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                  Structure
                </h4>
                <pre className="text-xs text-slate-600 bg-white/50 p-2 rounded overflow-x-auto">
                  {JSON.stringify(JSON.parse(workout.structure), null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {onStatusChange && workout.status === 'scheduled' && (
        <div className="flex border-t border-slate-200/50">
          <button
            onClick={() => onStatusChange('completed')}
            className="flex-1 py-2 text-sm font-medium text-green-600 hover:bg-green-50 transition-colors"
          >
            Mark Complete
          </button>
          <button
            onClick={() => onStatusChange('skipped')}
            className="flex-1 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors border-l border-slate-200/50"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}
