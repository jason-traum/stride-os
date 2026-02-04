'use client';

import { ArrowRight, Check, X, AlertTriangle, Clock, Activity, Footprints } from 'lucide-react';

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
      return <ArrowRight className="w-4 h-4 text-amber-500 rotate-[-45deg]" />;
    case 'under':
      return <ArrowRight className="w-4 h-4 text-amber-500 rotate-45" />;
    default:
      return <AlertTriangle className="w-4 h-4 text-stone-400" />;
  }
}

function getDiffColor(status: DiffStatus) {
  switch (status) {
    case 'match':
      return 'bg-green-50 border-green-200 text-green-700';
    case 'over':
      return 'bg-amber-50 border-amber-200 text-amber-700';
    case 'under':
      return 'bg-amber-50 border-amber-200 text-amber-700';
    default:
      return 'bg-stone-50 border-stone-200 text-stone-700';
  }
}

export function PlanDiffCard({ planned, actual, explanation, executionScore }: PlanDiffCardProps) {
  const distanceStatus = getDiffStatus(planned.distance, actual.distance);
  const typeMatch = planned.type === actual.type;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 75) return 'text-amber-600 bg-amber-100';
    if (score >= 60) return 'text-amber-600 bg-amber-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
      {/* Header with Execution Score */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-b border-stone-200">
        <h3 className="font-semibold text-stone-900">Plan vs Actual</h3>
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
          <div className="bg-stone-50 rounded-lg p-3">
            <div className="text-xs font-medium text-stone-500 uppercase tracking-wide mb-2">
              Planned
            </div>
            <div className="font-medium text-stone-900">{planned.name}</div>
            <div className="flex items-center gap-2 mt-1 text-sm text-stone-600">
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
              <div className="text-xs text-stone-500 mt-1">{planned.pace}</div>
            )}
          </div>

          {/* Arrow */}
          <ArrowRight className="w-6 h-6 text-stone-300" />

          {/* Actual */}
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
            <div className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-2">
              Actual
            </div>
            <div className="font-medium text-stone-900">{actual.name}</div>
            <div className="flex items-center gap-2 mt-1 text-sm text-stone-600">
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
              <div className="text-xs text-stone-500 mt-1">{actual.pace}</div>
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
            typeMatch ? 'bg-green-50 border-green-200 text-green-700' : 'bg-amber-50 border-amber-200 text-amber-700'
          }`}>
            {typeMatch ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
            <span>
              {typeMatch ? 'Type: Match' : `Type: ${actual.type} vs ${planned.type}`}
            </span>
          </div>
        </div>

        {/* Explanation */}
        {explanation && (
          <div className="mt-4 p-3 bg-stone-50 rounded-lg">
            <p className="text-sm text-stone-600">{explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}
