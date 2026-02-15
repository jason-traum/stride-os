'use client';

import { ArrowRight, Check, AlertTriangle, Clock, Footprints } from 'lucide-react';

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
      return <ArrowRight className="w-4 h-4 text-teal-500 rotate-[-45deg]" />;
    case 'under':
      return <ArrowRight className="w-4 h-4 text-teal-500 rotate-45" />;
    default:
      return <AlertTriangle className="w-4 h-4 text-tertiary" />;
  }
}

function getDiffColor(status: DiffStatus) {
  switch (status) {
    case 'match':
      return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300';
    case 'over':
      return 'bg-surface-1 border-default text-teal-700 dark:text-teal-300';
    case 'under':
      return 'bg-surface-1 border-default text-teal-700 dark:text-teal-300';
    default:
      return 'bg-bgTertiary border-borderPrimary text-textSecondary';
  }
}

export function PlanDiffCard({ planned, actual, explanation, executionScore }: PlanDiffCardProps) {
  const distanceStatus = getDiffStatus(planned.distance, actual.distance);
  const typeMatch = planned.type === actual.type;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 75) return 'text-teal-600 bg-teal-50';
    if (score >= 60) return 'text-teal-600 bg-teal-50';
    return 'text-red-600 bg-red-100';
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
            <div className="text-xs font-medium text-teal-600 uppercase tracking-wide mb-2">
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
            typeMatch ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' : 'bg-surface-1 border-default text-teal-700 dark:text-teal-300'
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
