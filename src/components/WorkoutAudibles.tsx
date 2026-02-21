'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, Check, Target, Zap } from 'lucide-react';
import { applyAudible } from '@/actions/training-plan';
import { formatPace, getWorkoutTypeLabel } from '@/lib/utils';
import type { AudibleOption } from '@/actions/workout-audibles';

interface WorkoutAudiblesProps {
  workoutId: number;
  options: AudibleOption[];
}

export function WorkoutAudibles({ workoutId, options }: WorkoutAudiblesProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [applied, setApplied] = useState(false);

  const selected = options.find((o) => o.id === selectedId) ?? null;

  function handleApply() {
    if (!selected) return;
    startTransition(async () => {
      await applyAudible(workoutId, selected.modification);
      setApplied(true);
    });
  }

  if (applied) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-emerald-500/30 p-4">
        <div className="flex items-center gap-2 text-emerald-400">
          <Check className="w-5 h-5" />
          <span className="font-medium">Workout updated</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary">
      {/* Toggle */}
      <button
        onClick={() => {
          setExpanded(!expanded);
          if (expanded) setSelectedId(null);
        }}
        className="w-full flex items-center justify-between px-4 py-3 text-textSecondary text-sm"
      >
        <span>Not feeling it?</span>
        {expanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>

      {/* Pills & Preview */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Option pills */}
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedId(selectedId === opt.id ? null : opt.id)}
                className={`px-3 py-2 rounded-xl text-sm border transition-colors ${
                  selectedId === opt.id
                    ? 'bg-dream-600/15 text-dream-400 border-dream-500/30'
                    : 'bg-bgTertiary text-textSecondary border-borderSecondary hover:border-borderPrimary'
                }`}
              >
                {opt.emoji} {opt.label}
              </button>
            ))}
          </div>

          {/* Selected preview */}
          {selected && (
            <div className="bg-bgTertiary rounded-xl p-4 border border-borderSecondary space-y-3">
              <p className="text-sm text-textSecondary">{selected.description}</p>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-textPrimary">{selected.preview.name}</span>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-bgSecondary text-textSecondary">
                    {getWorkoutTypeLabel(selected.preview.workoutType)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-4">
                  {selected.preview.targetDistanceMiles !== null && (
                    <div className="flex items-center text-sm text-textSecondary">
                      <Target className="w-4 h-4 mr-1 text-textTertiary" />
                      {selected.preview.targetDistanceMiles} mi
                    </div>
                  )}
                  {selected.preview.targetPaceSecondsPerMile !== null && (
                    <div className="flex items-center text-sm text-textSecondary">
                      <Zap className="w-4 h-4 mr-1 text-textTertiary" />
                      {formatPace(selected.preview.targetPaceSecondsPerMile)}/mi
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={handleApply}
                disabled={isPending}
                className="w-full py-2.5 rounded-xl bg-dream-600 text-white font-medium text-sm disabled:opacity-50 transition-opacity"
              >
                {isPending ? 'Applying...' : 'Use This Instead'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
