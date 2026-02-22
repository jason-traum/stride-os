'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  getPlanBuilderDefaults,
  previewPlan,
  generateCustomPlan,
  type PlanBuilderConfig,
  type PlanPreview,
} from '@/actions/plan-builder';
import { standardPlans } from '@/lib/training/standard-plans';
import { RACE_DISTANCES } from '@/lib/training/types';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  ChevronRight,
  Loader2,
  Target,
  Zap,
} from 'lucide-react';
import { useToast } from '@/components/Toast';

// ==================== Types ====================

interface BuilderDefaults {
  currentWeeklyMileage: number;
  peakWeeklyMileage: number;
  currentRunsPerWeek: number;
  longRunDay: string;
  qualityDays: string[];
  qualitySessionsPerWeek: number;
  aggressiveness: string;
  vdot: number | null;
  races: Array<{
    id: number;
    name: string;
    date: string;
    distanceLabel: string;
    distanceMeters: number;
    priority: string;
    trainingPlanGenerated: boolean | null;
  }>;
}

const DAYS_OPTIONS = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

function getDistanceLabel(key: string): string {
  const d = RACE_DISTANCES[key];
  return d ? d.label : key;
}

function getDaysUntilDate(dateStr: string): number {
  const target = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  return Math.ceil((target.getTime() - today.getTime()) / (86400000));
}

function getWeeksUntilDate(dateStr: string): number {
  return Math.floor(getDaysUntilDate(dateStr) / 7);
}

// ==================== Step Components ====================

function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const steps = ['Goal', 'Configure', 'Template', 'Preview'];
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
              i + 1 < currentStep
                ? 'bg-green-600 text-white'
                : i + 1 === currentStep
                  ? 'bg-dream-600 text-white'
                  : 'bg-surface-2 text-tertiary border border-default'
            }`}
          >
            {i + 1 < currentStep ? <Check className="w-4 h-4" /> : i + 1}
          </div>
          <span
            className={`text-sm hidden sm:inline ${
              i + 1 === currentStep ? 'text-primary font-medium' : 'text-tertiary'
            }`}
          >
            {label}
          </span>
          {i < totalSteps - 1 && (
            <ChevronRight className="w-4 h-4 text-tertiary" />
          )}
        </div>
      ))}
    </div>
  );
}

function StepGoalSelection({
  defaults,
  config,
  onUpdate,
}: {
  defaults: BuilderDefaults;
  config: Partial<PlanBuilderConfig>;
  onUpdate: (updates: Partial<PlanBuilderConfig>) => void;
}) {
  const aRaces = defaults.races.filter((r) => r.priority === 'A');
  const otherRaces = defaults.races.filter((r) => r.priority !== 'A');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-semibold text-primary mb-2">
          What&apos;s your goal?
        </h2>
        <p className="text-sm text-textSecondary">
          Choose a race to train for, or build a general fitness plan.
        </p>
      </div>

      {/* Goal type selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => onUpdate({ goalType: 'race', raceId: aRaces[0]?.id || otherRaces[0]?.id })}
          className={`p-4 rounded-xl border text-left transition-all ${
            config.goalType === 'race'
              ? 'border-dream-500 bg-dream-500/10 ring-1 ring-dream-500'
              : 'border-default bg-surface-1 hover:border-strong'
          }`}
        >
          <Target className="w-6 h-6 text-dream-500 mb-2" />
          <div className="font-medium text-primary">Train for a Race</div>
          <div className="text-sm text-textSecondary mt-1">
            Build a plan targeting a specific race date and distance
          </div>
        </button>

        <button
          onClick={() => onUpdate({ goalType: 'general_fitness', raceId: undefined })}
          className={`p-4 rounded-xl border text-left transition-all ${
            config.goalType === 'general_fitness'
              ? 'border-dream-500 bg-dream-500/10 ring-1 ring-dream-500'
              : 'border-default bg-surface-1 hover:border-strong'
          }`}
        >
          <Zap className="w-6 h-6 text-dream-500 mb-2" />
          <div className="font-medium text-primary">General Fitness</div>
          <div className="text-sm text-textSecondary mt-1">
            Build fitness without a specific race target
          </div>
        </button>
      </div>

      {/* Race selector */}
      {config.goalType === 'race' && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-secondary">
            Select a race
          </label>
          {defaults.races.length === 0 ? (
            <div className="p-4 rounded-xl bg-bgTertiary text-center">
              <p className="text-sm text-textTertiary mb-2">
                No upcoming races found.
              </p>
              <a href="/races" className="text-sm text-dream-500 font-medium hover:text-dream-400">
                Add a race first
              </a>
            </div>
          ) : (
            <div className="space-y-2">
              {aRaces.length > 0 && (
                <div className="text-xs text-textTertiary uppercase tracking-wider mb-1">
                  A Races
                </div>
              )}
              {aRaces.map((race) => (
                <button
                  key={race.id}
                  onClick={() => onUpdate({ raceId: race.id })}
                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                    config.raceId === race.id
                      ? 'border-dream-500 bg-dream-500/10'
                      : 'border-default bg-surface-1 hover:border-strong'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-primary text-sm">
                        {race.name}
                      </div>
                      <div className="text-xs text-textSecondary mt-0.5">
                        {getDistanceLabel(race.distanceLabel)} --{' '}
                        {new Date(race.date + 'T12:00:00').toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}{' '}
                        ({getWeeksUntilDate(race.date)} weeks away)
                      </div>
                    </div>
                    {race.trainingPlanGenerated && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900/30 text-orange-400">
                        Has plan
                      </span>
                    )}
                  </div>
                </button>
              ))}

              {otherRaces.length > 0 && (
                <>
                  <div className="text-xs text-textTertiary uppercase tracking-wider mt-3 mb-1">
                    B/C Races
                  </div>
                  {otherRaces.map((race) => (
                    <button
                      key={race.id}
                      onClick={() => onUpdate({ raceId: race.id })}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        config.raceId === race.id
                          ? 'border-dream-500 bg-dream-500/10'
                          : 'border-default bg-surface-1 hover:border-strong'
                      }`}
                    >
                      <div className="font-medium text-primary text-sm">
                        {race.name}
                      </div>
                      <div className="text-xs text-textSecondary mt-0.5">
                        {getDistanceLabel(race.distanceLabel)} --{' '}
                        {new Date(race.date + 'T12:00:00').toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Duration for general fitness */}
      {config.goalType === 'general_fitness' && (
        <div className="space-y-3">
          <label className="text-sm font-medium text-secondary">
            Plan duration (weeks)
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={8}
              max={24}
              value={config.planDurationWeeks || 12}
              onChange={(e) =>
                onUpdate({ planDurationWeeks: parseInt(e.target.value) })
              }
              className="flex-1 accent-dream-500"
            />
            <span className="text-lg font-semibold text-primary w-16 text-right">
              {config.planDurationWeeks || 12}w
            </span>
          </div>
          <div className="flex justify-between text-xs text-textTertiary">
            <span>8 weeks</span>
            <span>24 weeks</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StepConfiguration({
  defaults,
  config,
  onUpdate,
}: {
  defaults: BuilderDefaults;
  config: Partial<PlanBuilderConfig>;
  onUpdate: (updates: Partial<PlanBuilderConfig>) => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-semibold text-primary mb-2">
          Configure Your Plan
        </h2>
        <p className="text-sm text-textSecondary">
          Set your mileage targets and schedule preferences.
        </p>
      </div>

      {/* Starting mileage */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-secondary">
          Starting weekly mileage
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={5}
            max={120}
            value={config.startingWeeklyMileage ?? defaults.currentWeeklyMileage}
            onChange={(e) =>
              onUpdate({ startingWeeklyMileage: parseInt(e.target.value) || 0 })
            }
            className="w-24 px-3 py-2 border border-strong rounded-lg bg-surface-1 text-primary text-center focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
          />
          <span className="text-sm text-textSecondary">miles/week</span>
          <span className="text-xs text-textTertiary">
            (current avg: {defaults.currentWeeklyMileage})
          </span>
        </div>
      </div>

      {/* Peak mileage */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-secondary">
          Peak weekly mileage target
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={10}
            max={150}
            value={config.peakWeeklyMileage ?? defaults.peakWeeklyMileage}
            onChange={(e) =>
              onUpdate({ peakWeeklyMileage: parseInt(e.target.value) || 0 })
            }
            className="w-24 px-3 py-2 border border-strong rounded-lg bg-surface-1 text-primary text-center focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
          />
          <span className="text-sm text-textSecondary">miles/week</span>
        </div>
        {(config.peakWeeklyMileage ?? defaults.peakWeeklyMileage) >
          (config.startingWeeklyMileage ?? defaults.currentWeeklyMileage) * 1.5 && (
          <p className="text-xs text-orange-400">
            Peak is more than 50% above starting mileage. Consider a more gradual build.
          </p>
        )}
      </div>

      {/* Days per week */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-secondary">
          Running days per week
        </label>
        <div className="flex gap-2">
          {[3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              onClick={() => onUpdate({ daysPerWeek: n })}
              className={`w-12 h-10 rounded-lg font-medium text-sm transition-colors ${
                (config.daysPerWeek ?? defaults.currentRunsPerWeek) === n
                  ? 'bg-dream-600 text-white'
                  : 'bg-surface-2 text-secondary border border-default hover:border-strong'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs text-textTertiary">
          Currently running ~{defaults.currentRunsPerWeek} days/week
        </p>
      </div>

      {/* Long run day */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-secondary">
          Long run day
        </label>
        <div className="flex gap-2 flex-wrap">
          {DAYS_OPTIONS.filter((d) =>
            ['saturday', 'sunday'].includes(d.value)
          ).map((day) => (
            <button
              key={day.value}
              onClick={() => onUpdate({ longRunDay: day.value })}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                (config.longRunDay ?? defaults.longRunDay) === day.value
                  ? 'bg-dream-600 text-white'
                  : 'bg-surface-2 text-secondary border border-default hover:border-strong'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quality workout days */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-secondary">
          Quality workout days
        </label>
        <div className="flex gap-2 flex-wrap">
          {DAYS_OPTIONS.map((day) => {
            const selected = (
              config.qualityDays ?? defaults.qualityDays
            ).includes(day.value);
            return (
              <button
                key={day.value}
                onClick={() => {
                  const current = config.qualityDays ?? defaults.qualityDays;
                  const next = selected
                    ? current.filter((d) => d !== day.value)
                    : [...current, day.value];
                  onUpdate({ qualityDays: next });
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selected
                    ? 'bg-dream-600 text-white'
                    : 'bg-surface-2 text-secondary border border-default hover:border-strong'
                }`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quality sessions per week */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-secondary">
          Quality sessions per week
        </label>
        <div className="flex gap-2">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              onClick={() => onUpdate({ qualitySessionsPerWeek: n })}
              className={`w-12 h-10 rounded-lg font-medium text-sm transition-colors ${
                (config.qualitySessionsPerWeek ??
                  defaults.qualitySessionsPerWeek) === n
                  ? 'bg-dream-600 text-white'
                  : 'bg-surface-2 text-secondary border border-default hover:border-strong'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Aggressiveness */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-secondary">
          Plan aggressiveness
        </label>
        <div className="flex gap-2">
          {(['conservative', 'moderate', 'aggressive'] as const).map((level) => (
            <button
              key={level}
              onClick={() => onUpdate({ aggressiveness: level })}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                (config.aggressiveness ?? defaults.aggressiveness) === level
                  ? 'bg-dream-600 text-white'
                  : 'bg-surface-2 text-secondary border border-default hover:border-strong'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
        <p className="text-xs text-textTertiary">
          {(config.aggressiveness ?? defaults.aggressiveness) === 'conservative'
            ? 'Slower build, more down weeks. Best for injury-prone runners.'
            : (config.aggressiveness ?? defaults.aggressiveness) === 'moderate'
              ? 'Balanced progression with regular recovery. Recommended for most runners.'
              : 'Faster mileage build. For experienced runners with solid training history.'}
        </p>
      </div>
    </div>
  );
}

function StepTemplateSelection({
  config,
  onUpdate,
}: {
  config: Partial<PlanBuilderConfig>;
  onUpdate: (updates: Partial<PlanBuilderConfig>) => void;
}) {
  // Filter templates that match the selected race distance
  const selectedRace = config.raceId;
  const applicableTemplates = standardPlans.filter((plan) => {
    // For general fitness, show half marathon templates
    if (config.goalType === 'general_fitness') {
      return plan.raceDistance === 'half_marathon';
    }
    return true; // Show all templates when a race is selected (user can browse)
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-semibold text-primary mb-2">
          Choose a Template
        </h2>
        <p className="text-sm text-textSecondary">
          Pick a training philosophy, or let the algorithm customize your plan.
        </p>
      </div>

      {/* Custom / Algorithm option */}
      <button
        onClick={() => onUpdate({ templateId: 'custom' })}
        className={`w-full p-4 rounded-xl border text-left transition-all ${
          config.templateId === 'custom'
            ? 'border-dream-500 bg-dream-500/10 ring-1 ring-dream-500'
            : 'border-default bg-surface-1 hover:border-strong'
        }`}
      >
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-dream-500 mt-0.5 flex-shrink-0" />
          <div>
            <div className="font-medium text-primary">
              Custom (Algorithm Engine)
            </div>
            <div className="text-sm text-textSecondary mt-1">
              Uses your fitness data, preferences, and our training engine to build a
              personalized plan from scratch. Adapts mileage progression, workout
              selection, and recovery scheduling to your profile.
            </div>
            <div className="flex gap-2 mt-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-dream-500/20 text-dream-400">
                Recommended
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-3 text-tertiary">
                Adaptive
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* Standard templates */}
      <div className="space-y-3">
        <div className="text-xs text-textTertiary uppercase tracking-wider">
          Standard Templates
        </div>
        {applicableTemplates.map((plan) => (
          <button
            key={plan.id}
            onClick={() => onUpdate({ templateId: plan.id })}
            className={`w-full p-4 rounded-xl border text-left transition-all ${
              config.templateId === plan.id
                ? 'border-dream-500 bg-dream-500/10 ring-1 ring-dream-500'
                : 'border-default bg-surface-1 hover:border-strong'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-medium text-primary">{plan.name}</div>
                <div className="text-xs text-textTertiary mt-0.5">
                  by {plan.author} -- {plan.weeks} weeks -- peak{' '}
                  {plan.peakWeekMiles} mpw
                </div>
                <div className="text-sm text-textSecondary mt-1">
                  {plan.description}
                </div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-3 text-tertiary">
                    {getDistanceLabel(plan.raceDistance)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-3 text-tertiary">
                    {plan.runsPerWeek} days/wk
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-3 text-tertiary">
                    {plan.qualitySessionsPerWeek}Q
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-3 text-tertiary">
                    Req: {plan.requiredWeeklyMileage}+ mpw
                  </span>
                </div>
              </div>
            </div>
            {config.templateId === plan.id && (
              <div className="mt-3 pt-3 border-t border-default">
                <div className="text-xs text-textSecondary">
                  <strong className="text-primary">Philosophy:</strong>{' '}
                  {plan.philosophy}
                </div>
                <div className="text-xs text-textSecondary mt-1">
                  <strong className="text-primary">Key workouts:</strong>{' '}
                  {plan.keyWorkouts.join(', ')}
                </div>
                <div className="text-xs text-textSecondary mt-1">
                  <strong className="text-primary">Best for:</strong>{' '}
                  {plan.suitableFor}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepPreviewGenerate({
  config,
  preview,
  loadingPreview,
  generating,
  onGenerate,
}: {
  config: Partial<PlanBuilderConfig>;
  preview: PlanPreview | null;
  loadingPreview: boolean;
  generating: boolean;
  onGenerate: () => void;
}) {
  if (loadingPreview) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-dream-500" />
        <span className="ml-2 text-sm text-textSecondary">
          Calculating plan preview...
        </span>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="text-center py-12 bg-bgTertiary rounded-xl">
        <p className="text-textTertiary">
          Unable to generate preview. Check your configuration.
        </p>
      </div>
    );
  }

  // Build mileage chart bars
  const maxMileage = Math.max(...preview.weeklyMileages, 1);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-semibold text-primary mb-2">
          Plan Preview
        </h2>
        <p className="text-sm text-textSecondary">
          Review your plan structure before generating.
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface-1 rounded-xl p-3 border border-default">
          <div className="text-xs text-textTertiary">Duration</div>
          <div className="text-lg font-semibold text-primary">
            {preview.totalWeeks} weeks
          </div>
        </div>
        <div className="bg-surface-1 rounded-xl p-3 border border-default">
          <div className="text-xs text-textTertiary">Total Miles</div>
          <div className="text-lg font-semibold text-primary">
            {preview.totalMiles}
          </div>
        </div>
        <div className="bg-surface-1 rounded-xl p-3 border border-default">
          <div className="text-xs text-textTertiary">Peak Week</div>
          <div className="text-lg font-semibold text-primary">
            {preview.peakMileage} mi
          </div>
          <div className="text-xs text-textTertiary">Week {preview.peakWeek}</div>
        </div>
        <div className="bg-surface-1 rounded-xl p-3 border border-default">
          <div className="text-xs text-textTertiary">Phases</div>
          <div className="text-lg font-semibold text-primary">
            {preview.phases.length}
          </div>
        </div>
      </div>

      {/* Phase breakdown */}
      <div className="bg-surface-1 rounded-xl p-4 border border-default">
        <div className="text-sm font-medium text-secondary mb-3">
          Phase Breakdown
        </div>
        <div className="flex gap-1 h-6 rounded-full overflow-hidden">
          {preview.phases.map((phase) => {
            const pct = (phase.weeks / preview.totalWeeks) * 100;
            const colors: Record<string, string> = {
              base: 'bg-green-600',
              build: 'bg-orange-500',
              peak: 'bg-red-500',
              taper: 'bg-purple-500',
              recovery: 'bg-blue-500',
            };
            return (
              <div
                key={phase.phase}
                className={`${colors[phase.phase] || 'bg-surface-3'} relative group`}
                style={{ width: `${pct}%` }}
                title={`${phase.phase}: ${phase.weeks} weeks`}
              />
            );
          })}
        </div>
        <div className="flex gap-4 mt-2 flex-wrap">
          {preview.phases.map((phase) => {
            const dotColors: Record<string, string> = {
              base: 'bg-green-600',
              build: 'bg-orange-500',
              peak: 'bg-red-500',
              taper: 'bg-purple-500',
              recovery: 'bg-blue-500',
            };
            return (
              <div key={phase.phase} className="flex items-center gap-1.5 text-xs text-textSecondary">
                <div className={`w-2.5 h-2.5 rounded-full ${dotColors[phase.phase] || 'bg-surface-3'}`} />
                <span className="capitalize">{phase.phase}</span>
                <span className="text-textTertiary">{phase.weeks}w</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mileage progression chart */}
      <div className="bg-surface-1 rounded-xl p-4 border border-default">
        <div className="text-sm font-medium text-secondary mb-3">
          Weekly Mileage Progression
        </div>
        <div className="flex items-end gap-0.5 h-32">
          {preview.weeklyMileages.map((miles, i) => {
            const height = (miles / maxMileage) * 100;
            // Determine phase color
            let color = 'bg-green-600';
            for (const phase of preview.phases) {
              if (i + 1 >= phase.startWeek && i + 1 < phase.startWeek + phase.weeks) {
                const phaseColors: Record<string, string> = {
                  base: 'bg-green-600',
                  build: 'bg-orange-500',
                  peak: 'bg-red-500',
                  taper: 'bg-purple-500',
                  recovery: 'bg-blue-500',
                };
                color = phaseColors[phase.phase] || 'bg-surface-3';
              }
            }
            return (
              <div
                key={i}
                className="flex-1 flex flex-col justify-end group relative"
              >
                <div
                  className={`${color} rounded-t transition-all hover:opacity-80 min-h-[2px]`}
                  style={{ height: `${height}%` }}
                />
                <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-2 border border-default rounded px-2 py-1 text-xs text-primary whitespace-nowrap z-10 shadow-lg">
                  Wk {i + 1}: {miles} mi
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs text-textTertiary">
          <span>Wk 1</span>
          <span>Wk {preview.totalWeeks}</span>
        </div>
      </div>

      {/* Config summary */}
      <div className="bg-surface-1 rounded-xl p-4 border border-default">
        <div className="text-sm font-medium text-secondary mb-2">
          Plan Configuration
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="text-textTertiary">Starting mileage</div>
          <div className="text-primary font-medium">
            {config.startingWeeklyMileage} mpw
          </div>
          <div className="text-textTertiary">Peak mileage</div>
          <div className="text-primary font-medium">
            {config.peakWeeklyMileage} mpw
          </div>
          <div className="text-textTertiary">Running days</div>
          <div className="text-primary font-medium">
            {config.daysPerWeek} days/week
          </div>
          <div className="text-textTertiary">Quality sessions</div>
          <div className="text-primary font-medium">
            {config.qualitySessionsPerWeek}/week
          </div>
          <div className="text-textTertiary">Aggressiveness</div>
          <div className="text-primary font-medium capitalize">
            {config.aggressiveness}
          </div>
          <div className="text-textTertiary">Template</div>
          <div className="text-primary font-medium">
            {config.templateId === 'custom'
              ? 'Custom (Algorithm)'
              : standardPlans.find((p) => p.id === config.templateId)?.name || 'Custom'}
          </div>
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={generating}
        className="btn-primary w-full py-3 rounded-xl text-center font-medium flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {generating ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Generating Plan...
          </>
        ) : (
          <>
            <Check className="w-5 h-5" />
            Generate Plan
          </>
        )}
      </button>
    </div>
  );
}

// ==================== Main Page ====================

export default function PlanBuilderPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [defaults, setDefaults] = useState<BuilderDefaults | null>(null);
  const [step, setStep] = useState(1);
  const [config, setConfig] = useState<Partial<PlanBuilderConfig>>({
    goalType: 'race',
    templateId: 'custom',
    aggressiveness: 'moderate',
    qualitySessionsPerWeek: 2,
  });
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Load defaults
  useEffect(() => {
    async function load() {
      try {
        const result = await getPlanBuilderDefaults();
        const data = result.success ? result.data : null;
        if (data) {
          setDefaults(data);
          setConfig((prev) => ({
            ...prev,
            startingWeeklyMileage: data.currentWeeklyMileage,
            peakWeeklyMileage: data.peakWeeklyMileage,
            daysPerWeek: data.currentRunsPerWeek,
            longRunDay: data.longRunDay,
            qualityDays: data.qualityDays,
            qualitySessionsPerWeek: data.qualitySessionsPerWeek,
            aggressiveness: data.aggressiveness as PlanBuilderConfig['aggressiveness'],
            raceId: data.races.find((r: BuilderDefaults['races'][number]) => r.priority === 'A')?.id || data.races[0]?.id,
          }));
        }
      } catch (error) {
        console.error('Error loading builder defaults:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const updateConfig = useCallback(
    (updates: Partial<PlanBuilderConfig>) => {
      setConfig((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  // Load preview when entering step 4
  useEffect(() => {
    if (step === 4 && !loadingPreview) {
      setLoadingPreview(true);
      previewPlan(config as PlanBuilderConfig)
        .then((result) => {
          setPreview(result.success ? result.data : null);
        })
        .catch((err) => {
          console.error('Preview error:', err);
          setPreview(null);
        })
        .finally(() => setLoadingPreview(false));
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const canAdvance = () => {
    switch (step) {
      case 1:
        if (config.goalType === 'race') return !!config.raceId;
        if (config.goalType === 'general_fitness') return true;
        return false;
      case 2:
        return (
          (config.startingWeeklyMileage ?? 0) > 0 &&
          (config.peakWeeklyMileage ?? 0) > 0 &&
          (config.daysPerWeek ?? 0) >= 3
        );
      case 3:
        return !!config.templateId;
      default:
        return true;
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const actionResult = await generateCustomPlan(config as PlanBuilderConfig);
      if (actionResult.success && actionResult.data.success) {
        showToast('Training plan generated!', 'success');
        router.push('/plan');
      } else {
        const errorMsg = !actionResult.success ? actionResult.error : (actionResult.data.error || 'Error generating plan.');
        showToast(errorMsg, 'error');
      }
    } catch (error) {
      console.error('Error generating plan:', error);
      showToast('Unexpected error generating plan.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-dream-500" />
      </div>
    );
  }

  if (!defaults) {
    return (
      <div className="text-center py-12">
        <p className="text-textTertiary">
          Unable to load your profile. Please complete onboarding first.
        </p>
        <a href="/profile" className="text-dream-500 font-medium mt-2 inline-block">
          Go to Profile
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => (step > 1 ? setStep(step - 1) : router.push('/plan'))}
          className="p-2 rounded-lg hover:bg-surface-2 text-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-3xl font-bold text-primary">
          Build Training Plan
        </h1>
      </div>

      {/* Step indicator */}
      <StepIndicator currentStep={step} totalSteps={4} />

      {/* Step content */}
      <div className="bg-surface-1 rounded-xl p-6 border border-default">
        {step === 1 && (
          <StepGoalSelection
            defaults={defaults}
            config={config}
            onUpdate={updateConfig}
          />
        )}
        {step === 2 && (
          <StepConfiguration
            defaults={defaults}
            config={config}
            onUpdate={updateConfig}
          />
        )}
        {step === 3 && (
          <StepTemplateSelection config={config} onUpdate={updateConfig} />
        )}
        {step === 4 && (
          <StepPreviewGenerate
            config={config}
            preview={preview}
            loadingPreview={loadingPreview}
            generating={generating}
            onGenerate={handleGenerate}
          />
        )}
      </div>

      {/* Navigation buttons */}
      {step < 4 && (
        <div className="flex justify-between">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : router.push('/plan'))}
            className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-xl"
          >
            <ArrowLeft className="w-4 h-4" />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canAdvance()}
            className="btn-primary flex items-center gap-2 px-6 py-2 rounded-xl disabled:opacity-50"
          >
            Next
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
