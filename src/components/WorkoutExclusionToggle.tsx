'use client';

import { useState, useTransition, useRef } from 'react';
import { toggleWorkoutExclusion, updateExcludeReason } from '@/actions/workout-exclusion';
import { ShieldAlert, Bot } from 'lucide-react';

interface WorkoutExclusionToggleProps {
  workoutId: number;
  excluded: boolean;
  autoExcluded: boolean;
  reason: string | null;
}

export function WorkoutExclusionToggle({
  workoutId,
  excluded: initialExcluded,
  autoExcluded,
  reason: initialReason,
}: WorkoutExclusionToggleProps) {
  const [excluded, setExcluded] = useState(initialExcluded);
  const [reason, setReason] = useState(initialReason || '');
  const [isPending, startTransition] = useTransition();
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  function handleToggle() {
    const newExcluded = !excluded;
    setExcluded(newExcluded);
    startTransition(async () => {
      await toggleWorkoutExclusion(workoutId, newExcluded, reason || undefined);
    });
  }

  function handleReasonBlur() {
    if (reason !== (initialReason || '')) {
      startTransition(async () => {
        await updateExcludeReason(workoutId, reason);
      });
    }
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className={`w-5 h-5 ${excluded ? 'text-amber-500' : 'text-textTertiary'}`} />
          <div>
            <h3 className="text-sm font-medium text-textPrimary">Exclude from Fitness Estimates</h3>
            <p className="text-xs text-textTertiary mt-0.5">
              Excluded workouts still count for mileage and training load.
            </p>
          </div>
          {autoExcluded && excluded && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-xs font-medium">
              <Bot className="w-3 h-3" />
              Auto-detected
            </span>
          )}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={excluded}
          disabled={isPending}
          onClick={handleToggle}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dream-500 focus-visible:ring-offset-2 disabled:opacity-50 ${
            excluded ? 'bg-amber-500' : 'bg-bgTertiary'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
              excluded ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {excluded && (
        <div className="mt-4 pt-4 border-t border-borderSecondary">
          <label htmlFor={`exclude-reason-${workoutId}`} className="text-xs text-textSecondary mb-1.5 block">
            Reason / Notes
          </label>
          <textarea
            ref={reasonRef}
            id={`exclude-reason-${workoutId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={handleReasonBlur}
            placeholder="e.g. Sick day, hungover, bad HR data..."
            rows={2}
            className="w-full rounded-lg border border-borderPrimary bg-bgPrimary px-3 py-2 text-sm text-textPrimary placeholder:text-textTertiary focus:outline-none focus:ring-2 focus:ring-dream-500 resize-none"
          />
        </div>
      )}
    </div>
  );
}
