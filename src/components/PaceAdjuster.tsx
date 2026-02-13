'use client';

import { useState, useEffect } from 'react';
import { Timer, ArrowRight, AlertTriangle } from 'lucide-react';
import { calculatePaceAdjustment, parsePaceToSeconds, getSeverityColor, getSeverityLabel } from '@/lib/conditions';
import type { ConditionsSeverity } from '@/lib/conditions';
import type { WorkoutType } from '@/lib/schema';
import { workoutTypes } from '@/lib/schema';
import { cn } from '@/lib/utils';

interface PaceAdjusterProps {
  severity: ConditionsSeverity;
  acclimatizationScore: number;
  defaultPaceSeconds?: number;
  onPaceChange?: (paceSeconds: number) => void;
}

const workoutTypeLabels: Record<WorkoutType, string> = {
  easy: 'Easy',
  steady: 'Steady',
  tempo: 'Tempo',
  interval: 'Intervals',
  long: 'Long',
  race: 'Race',
  recovery: 'Recovery',
  cross_train: 'Cross Train',
  other: 'Other',
};

export function PaceAdjuster({
  severity,
  acclimatizationScore,
  defaultPaceSeconds,
  onPaceChange,
}: PaceAdjusterProps) {
  const [paceInput, setPaceInput] = useState('');
  const [workoutType, setWorkoutType] = useState<WorkoutType>('easy');
  const [paceSeconds, setPaceSeconds] = useState<number | null>(null);

  // Initialize with default pace
  useEffect(() => {
    if (defaultPaceSeconds && !paceInput) {
      const minutes = Math.floor(defaultPaceSeconds / 60);
      const seconds = defaultPaceSeconds % 60;
      setPaceInput(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      setPaceSeconds(defaultPaceSeconds);
    }
  }, [defaultPaceSeconds, paceInput]);

  const handlePaceChange = (value: string) => {
    setPaceInput(value);

    // Try to parse the pace
    const parsed = parsePaceToSeconds(value);
    if (parsed !== null) {
      setPaceSeconds(parsed);
      onPaceChange?.(parsed);
    }
  };

  const adjustment = paceSeconds
    ? calculatePaceAdjustment(paceSeconds, severity, workoutType, acclimatizationScore)
    : null;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Timer className="w-5 h-5 text-teal-600" />
        <h3 className="font-semibold text-primary">Pace Adjuster</h3>
      </div>

      {/* Conditions Summary */}
      <div className="flex items-center gap-3 mb-4">
        <span className={cn('px-3 py-1 rounded-full text-sm font-medium', getSeverityColor(severity.severityScore))}>
          {getSeverityLabel(severity.severityScore)} ({severity.severityScore}/100)
        </span>
        {severity.heatIndex && severity.primaryFactor.includes('heat') && (
          <span className="text-sm text-textTertiary">Heat Index: {severity.heatIndex}°F</span>
        )}
      </div>

      {/* Inputs Row */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-textSecondary mb-1">Target Pace</label>
          <input
            type="text"
            value={paceInput}
            onChange={(e) => handlePaceChange(e.target.value)}
            placeholder="7:00"
            className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center text-lg font-medium"
          />
          <p className="text-xs text-textTertiary mt-1 text-center">min:sec /mile</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-textSecondary mb-1">Workout Type</label>
          <select
            value={workoutType}
            onChange={(e) => setWorkoutType(e.target.value as WorkoutType)}
            className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          >
            {workoutTypes.filter(t => t !== 'cross_train' && t !== 'other').map((type) => (
              <option key={type} value={type}>
                {workoutTypeLabels[type]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Adjustment Display */}
      {adjustment && (
        <div className="border-t border-borderSecondary pt-4">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="text-center">
              <p className="text-xs text-textTertiary mb-1">Target</p>
              <p className="text-2xl font-bold text-tertiary">{adjustment.originalPace}</p>
            </div>
            <ArrowRight className="w-6 h-6 text-tertiary" />
            <div className="text-center">
              <p className="text-xs text-textTertiary mb-1">Adjusted</p>
              <p className="text-3xl font-bold text-teal-600">{adjustment.adjustedPace}</p>
            </div>
          </div>

          {adjustment.adjustmentSeconds > 0 && (
            <p className="text-sm text-textSecondary text-center mb-3">
              +{adjustment.adjustmentSeconds} sec/mile due to {adjustment.reason.toLowerCase()}
            </p>
          )}

          <div className="bg-bgTertiary rounded-lg p-3">
            <p className="text-sm text-textSecondary">{adjustment.recommendation}</p>
          </div>

          {adjustment.warnings.length > 0 && (
            <div className="mt-3 space-y-2">
              {adjustment.warnings.map((warning, i) => (
                <div key={i} className="flex items-start gap-2 text-rose-600">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{warning}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!paceSeconds && (
        <p className="text-sm text-textTertiary text-center">
          Enter your target pace (e.g., 8:00) to see the adjusted pace
        </p>
      )}
    </div>
  );
}

// Compact version for inline use
interface CompactPaceAdjusterProps {
  severity: ConditionsSeverity;
  acclimatizationScore: number;
  paceSeconds: number;
  workoutType: WorkoutType;
}

export function CompactPaceDisplay({
  severity,
  acclimatizationScore,
  paceSeconds,
  workoutType,
}: CompactPaceAdjusterProps) {
  const adjustment = calculatePaceAdjustment(paceSeconds, severity, workoutType, acclimatizationScore);

  return (
    <div className="flex items-center gap-3">
      <span className="text-textTertiary">{adjustment.originalPace}</span>
      <ArrowRight className="w-4 h-4 text-tertiary" />
      <span className="text-lg font-bold text-teal-600">{adjustment.adjustedPace}</span>
      {adjustment.adjustmentSeconds > 0 && (
        <span className="text-xs text-textTertiary">(+{adjustment.adjustmentSeconds}s)</span>
      )}
    </div>
  );
}
