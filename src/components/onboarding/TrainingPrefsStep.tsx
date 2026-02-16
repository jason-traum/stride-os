'use client';

import { Settings2 } from 'lucide-react';
import { StepHeader } from './StepHeader';
import { StepNavigation } from './StepNavigation';

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

const AGGRESSIVENESS_OPTIONS = [
  { value: 'conservative', label: 'Conservative', description: 'Slower mileage build-up, more recovery time' },
  { value: 'moderate', label: 'Moderate', description: 'Balanced approach for most runners' },
  { value: 'aggressive', label: 'Aggressive', description: 'Faster progression for experienced runners' },
] as const;

interface TrainingPrefsStepProps {
  currentWeeklyMileage: number;
  peakWeeklyMileageTarget: number;
  setPeakWeeklyMileageTarget: (v: number) => void;
  preferredLongRunDay: string;
  setPreferredLongRunDay: (v: string) => void;
  requiredRestDays: string[];
  toggleRestDay: (day: string) => void;
  qualitySessionsPerWeek: number;
  setQualitySessionsPerWeek: (v: number) => void;
  planAggressiveness: 'conservative' | 'moderate' | 'aggressive';
  setPlanAggressiveness: (v: 'conservative' | 'moderate' | 'aggressive') => void;
  onBack: () => void;
  onNext: () => void;
  canProceed: boolean;
}

export default function TrainingPrefsStep({
  currentWeeklyMileage,
  peakWeeklyMileageTarget,
  setPeakWeeklyMileageTarget,
  preferredLongRunDay,
  setPreferredLongRunDay,
  requiredRestDays,
  toggleRestDay,
  qualitySessionsPerWeek,
  setQualitySessionsPerWeek,
  planAggressiveness,
  setPlanAggressiveness,
  onBack,
  onNext,
  canProceed,
}: TrainingPrefsStepProps) {
  return (
    <div className="space-y-6">
      <StepHeader
        icon={Settings2}
        iconColor="text-dream-500"
        title="Training Preferences"
        subtitle="Customize how your plan is built"
      />

      {/* Peak weekly mileage target */}
      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">Peak weekly mileage target</label>
        <div className="flex items-center space-x-3">
          <input
            type="range"
            min={currentWeeklyMileage}
            max="100"
            value={peakWeeklyMileageTarget}
            onChange={(e) => setPeakWeeklyMileageTarget(Number(e.target.value))}
            aria-required="true"
            className="flex-1 h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer"
          />
          <span className="w-20 text-right text-primary font-medium">{peakWeeklyMileageTarget} mi</span>
        </div>
        <p className="text-xs text-textTertiary mt-1">
          {peakWeeklyMileageTarget > currentWeeklyMileage * 1.5
            ? 'Ambitious goal - plan will build you up gradually'
            : 'Manageable increase from your current mileage'}
        </p>
      </div>

      {/* Preferred long run day */}
      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">Preferred long run day</label>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-required="true">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day.value}
              onClick={() => setPreferredLongRunDay(day.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                preferredLongRunDay === day.value
                  ? 'bg-dream-600 text-white'
                  : 'bg-surface-2 text-secondary hover:bg-surface-3'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      {/* Required rest days */}
      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">Required rest days</label>
        <div className="flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day.value}
              onClick={() => toggleRestDay(day.value)}
              disabled={day.value === preferredLongRunDay}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                requiredRestDays.includes(day.value)
                  ? 'bg-rose-500 text-white'
                  : day.value === preferredLongRunDay
                    ? 'bg-surface-0 text-disabled cursor-not-allowed'
                    : 'bg-surface-2 text-secondary hover:bg-surface-3'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-textTertiary mt-1">Select days when you cannot run</p>
      </div>

      {/* Quality sessions per week */}
      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">Quality sessions per week</label>
        <div className="flex items-center space-x-3">
          <input
            type="range"
            min="1"
            max="3"
            value={qualitySessionsPerWeek}
            onChange={(e) => setQualitySessionsPerWeek(Number(e.target.value))}
            aria-required="true"
            className="flex-1 h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer"
          />
          <span className="w-20 text-right text-primary font-medium">{qualitySessionsPerWeek}</span>
        </div>
        <p className="text-xs text-textTertiary mt-1">Hard workouts like tempo runs, intervals, etc.</p>
      </div>

      {/* Plan aggressiveness */}
      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">Plan aggressiveness</label>
        <div className="space-y-2" role="radiogroup" aria-required="true">
          {AGGRESSIVENESS_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setPlanAggressiveness(option.value)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                planAggressiveness === option.value
                  ? 'bg-dream-600/20 border-dream-500 text-primary'
                  : 'bg-surface-2 border-default text-secondary hover:border-strong'
              }`}
            >
              <div className="font-medium">{option.label}</div>
              <div className="text-xs text-tertiary">{option.description}</div>
            </button>
          ))}
        </div>
      </div>

      <StepNavigation onBack={onBack} onNext={onNext} nextDisabled={!canProceed} />
    </div>
  );
}
