'use client';

import { useState, useTransition } from 'react';
import { ArrowRight, Check, AlertTriangle, Clock, Footprints, Sparkles, X, Loader2 } from 'lucide-react';
import { approveCoachAction, rejectCoachAction } from '@/actions/coach-actions';

// ==================== Original PlanDiffCard ====================

interface WorkoutData {
  name: string;
  type: string;
  distance: number | null;
  duration: number | null;
  pace: string | null;
}

interface PlanDiffCardProps {
  planned: WorkoutData;
  actual: WorkoutData;
  explanation?: string;
  executionScore?: number;
}

type DiffStatus = 'match' | 'over' | 'under' | 'different';

function getDiffStatus(planned: number | null, actual: number | null, tolerance: number = 0.1): DiffStatus {
  if (planned === null || actual === null) return 'different';
  const diff = (actual - planned) / planned;
  if (Math.abs(diff) <= tolerance) return 'match';
  return diff > 0 ? 'over' : 'under';
}

function getDiffIcon(status: DiffStatus) {
  switch (status) {
    case 'match':
      return <Check className="w-4 h-4 text-green-500" />;
    case 'over':
      return <ArrowRight className="w-4 h-4 text-dream-500 rotate-[-45deg]" />;
    case 'under':
      return <ArrowRight className="w-4 h-4 text-dream-500 rotate-45" />;
    default:
      return <AlertTriangle className="w-4 h-4 text-tertiary" />;
  }
}

function getDiffColor(status: DiffStatus) {
  switch (status) {
    case 'match':
      return 'bg-green-950 border-green-800 text-green-300';
    case 'over':
      return 'bg-surface-1 border-default text-dream-300';
    case 'under':
      return 'bg-surface-1 border-default text-dream-300';
    default:
      return 'bg-bgTertiary border-borderPrimary text-textSecondary';
  }
}

export function PlanDiffCard({ planned, actual, explanation, executionScore }: PlanDiffCardProps) {
  const distanceStatus = getDiffStatus(planned.distance, actual.distance);
  const typeMatch = planned.type === actual.type;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-300 bg-green-950';
    if (score >= 75) return 'text-dream-300 bg-dream-500/10';
    if (score >= 60) return 'text-dream-300 bg-dream-500/10';
    return 'text-red-300 bg-red-950';
  };

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary overflow-hidden">
      {/* Header with Execution Score */}
      <div className="flex items-center justify-between px-4 py-3 bg-bgTertiary border-b border-borderPrimary">
        <h3 className="font-semibold text-primary">Plan vs Actual</h3>
        {executionScore !== undefined && (
          <div className={`px-3 py-1 rounded-full text-sm font-bold ${getScoreColor(executionScore)}`}>
            {executionScore}/100
          </div>
        )}
      </div>

      {/* Comparison Grid */}
      <div className="p-4">
        <div className="grid grid-cols-[1fr,auto,1fr] gap-4 items-center">
          {/* Planned */}
          <div className="bg-bgTertiary rounded-lg p-3">
            <div className="text-xs font-medium text-textTertiary uppercase tracking-wide mb-2">
              Planned
            </div>
            <div className="font-medium text-primary">{planned.name}</div>
            <div className="flex items-center gap-2 mt-1 text-sm text-textSecondary">
              {planned.distance && (
                <span className="flex items-center gap-1">
                  <Footprints className="w-3 h-3" />
                  {planned.distance} mi
                </span>
              )}
              {planned.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {planned.duration} min
                </span>
              )}
            </div>
            {planned.pace && (
              <div className="text-xs text-textTertiary mt-1">{planned.pace}</div>
            )}
          </div>

          {/* Arrow */}
          <ArrowRight className="w-6 h-6 text-tertiary" />

          {/* Actual */}
          <div className="bg-surface-1 rounded-lg p-3 border border-default">
            <div className="text-xs font-medium text-dream-600 uppercase tracking-wide mb-2">
              Actual
            </div>
            <div className="font-medium text-primary">{actual.name}</div>
            <div className="flex items-center gap-2 mt-1 text-sm text-textSecondary">
              {actual.distance && (
                <span className="flex items-center gap-1">
                  <Footprints className="w-3 h-3" />
                  {actual.distance} mi
                </span>
              )}
              {actual.duration && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {actual.duration} min
                </span>
              )}
            </div>
            {actual.pace && (
              <div className="text-xs text-textTertiary mt-1">{actual.pace}</div>
            )}
          </div>
        </div>

        {/* Diff Badges */}
        <div className="flex flex-wrap gap-2 mt-4">
          {/* Distance diff */}
          {planned.distance && actual.distance && (
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getDiffColor(distanceStatus)}`}>
              {getDiffIcon(distanceStatus)}
              <span>
                {distanceStatus === 'match'
                  ? 'Distance: On target'
                  : distanceStatus === 'over'
                  ? `+${(actual.distance - planned.distance).toFixed(1)} mi`
                  : `${(actual.distance - planned.distance).toFixed(1)} mi`}
              </span>
            </div>
          )}

          {/* Type match */}
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${
            typeMatch ? 'bg-green-950 border-green-800 text-green-300' : 'bg-surface-1 border-default text-dream-300'
          }`}>
            {typeMatch ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            <span>
              {typeMatch ? 'Type: Match' : `Type: ${actual.type} vs ${planned.type}`}
            </span>
          </div>
        </div>

        {/* Explanation */}
        {explanation && (
          <div className="mt-4 p-3 bg-bgTertiary rounded-lg">
            <p className="text-sm text-textSecondary">{explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ==================== Coach Action Approval Card ====================

interface CoachActionChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface CoachActionCardProps {
  actionId: number;
  actionType: string;
  description: string;
  timestamp: string;
  changes?: CoachActionChange[];
  workoutName?: string;
  workoutDate?: string;
}

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return '--';
  if (field === 'distance' || field === 'target_distance_miles') return `${value} mi`;
  if (field === 'duration' || field === 'target_duration_minutes') return `${value} min`;
  if (field === 'pace' || field === 'target_pace_seconds_per_mile') {
    const secs = Number(value);
    if (!isNaN(secs)) {
      const mins = Math.floor(secs / 60);
      const remainder = secs % 60;
      return `${mins}:${remainder.toString().padStart(2, '0')}/mi`;
    }
    return String(value);
  }
  return String(value);
}

function getActionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    plan_modification: 'Plan Change',
    workout_adjustment: 'Workout Adjustment',
    schedule_change: 'Schedule Change',
    mode_activation: 'Mode Change',
    recommendation: 'Recommendation',
  };
  return labels[type] || type;
}

export function CoachActionCard({
  actionId,
  actionType,
  description,
  timestamp,
  changes,
  workoutName,
  workoutDate,
}: CoachActionCardProps) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      const result = await approveCoachAction(actionId);
      if (result.success) {
        setStatus('approved');
      }
    });
  };

  const handleReject = () => {
    startTransition(async () => {
      const result = await rejectCoachAction(actionId);
      if (result.success) {
        setStatus('rejected');
      }
    });
  };

  if (status === 'approved') {
    return (
      <div className="bg-green-950/30 rounded-xl border border-green-800/40 p-4">
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <Check className="w-4 h-4" />
          <span className="font-medium">Applied</span>
          <span className="text-green-400/60">&mdash; {description}</span>
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="bg-bgTertiary/50 rounded-xl border border-borderPrimary/40 p-4 opacity-60">
        <div className="flex items-center gap-2 text-textTertiary text-sm">
          <X className="w-4 h-4" />
          <span className="font-medium">Dismissed</span>
          <span className="text-textTertiary/60">&mdash; {description}</span>
        </div>
      </div>
    );
  }

  const timeAgo = getTimeAgo(timestamp);

  return (
    <div className="bg-bgSecondary rounded-xl border border-dream-500/30 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-dream-500/5 border-b border-dream-500/20">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-dream-400" />
          <span className="text-xs font-semibold text-dream-400 uppercase tracking-wide">
            {getActionTypeLabel(actionType)}
          </span>
        </div>
        <span className="text-xs text-textTertiary">{timeAgo}</span>
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="text-sm text-textPrimary font-medium">{description}</p>

        {/* Workout context */}
        {workoutName && (
          <div className="mt-2 text-xs text-textSecondary">
            {workoutName}{workoutDate ? ` (${workoutDate})` : ''}
          </div>
        )}

        {/* Change details */}
        {changes && changes.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {changes.map((change, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-textTertiary capitalize min-w-[70px]">{change.field}:</span>
                <span className="text-textSecondary">{formatFieldValue(change.field, change.from)}</span>
                <ArrowRight className="w-3 h-3 text-textTertiary flex-shrink-0" />
                <span className="text-dream-300 font-medium">{formatFieldValue(change.field, change.to)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium text-sm transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Apply
          </button>
          <button
            onClick={handleReject}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-bgTertiary hover:bg-red-950 border border-borderPrimary hover:border-red-800 text-textSecondary hover:text-red-300 font-medium text-sm transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Pending Coach Suggestions Section ====================

export interface PendingAction {
  id: number;
  actionType: string;
  description: string;
  timestamp: string;
  parsedSnapshot: {
    workoutName?: string;
    workoutDate?: string;
    changes?: CoachActionChange[];
    [key: string]: unknown;
  } | null;
}

interface PendingCoachSuggestionsProps {
  actions: PendingAction[];
}

export function PendingCoachSuggestions({ actions }: PendingCoachSuggestionsProps) {
  if (actions.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-textPrimary flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-dream-400" />
        Coach Suggestions
        <span className="text-xs text-dream-400 bg-dream-500/10 px-2 py-0.5 rounded-full">
          {actions.length}
        </span>
      </h3>
      <div className="space-y-3">
        {actions.map((action) => (
          <CoachActionCard
            key={action.id}
            actionId={action.id}
            actionType={action.actionType}
            description={action.description}
            timestamp={action.timestamp}
            changes={action.parsedSnapshot?.changes}
            workoutName={action.parsedSnapshot?.workoutName}
            workoutDate={action.parsedSnapshot?.workoutDate}
          />
        ))}
      </div>
    </div>
  );
}

// ==================== Helpers ====================

function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays}d ago`;
}
