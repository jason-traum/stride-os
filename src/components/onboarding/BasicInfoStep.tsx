'use client';

import { RunnerPersona } from '@/lib/schema';
import { StepNavigation } from './StepNavigation';

const PERSONA_OPTIONS: { value: RunnerPersona; label: string; description: string }[] = [
  { value: 'newer_runner', label: 'The Newer Runner', description: "I'm building the habit. Tell me what to do and explain why." },
  { value: 'busy_runner', label: 'The Busy Runner', description: "I have goals but life comes first. I need flexibility." },
  { value: 'self_coached', label: 'The Self-Coached Athlete', description: "I know what I'm doing. I want a smart training partner, not a boss." },
  { value: 'coach_guided', label: 'The Coach-Guided Runner', description: "I work with a human coach. I need a tracking and communication tool." },
  { value: 'type_a_planner', label: 'The Type-A Planner', description: "I love structure. Give me the plan and I'll follow it to the letter." },
  { value: 'data_optimizer', label: 'The Data Optimizer', description: "I want all the metrics. Show me the numbers and let me analyze." },
  { value: 'other', label: 'Other / Mix', description: "I'll tell you more about my preferences." },
];

interface BasicInfoStepProps {
  name: string;
  setName: (v: string) => void;
  runnerPersona: RunnerPersona | '';
  setRunnerPersona: (v: RunnerPersona) => void;
  runnerPersonaNotes: string;
  setRunnerPersonaNotes: (v: string) => void;
  currentWeeklyMileage: number;
  setCurrentWeeklyMileage: (v: number) => void;
  runsPerWeekCurrent: number;
  setRunsPerWeekCurrent: (v: number) => void;
  currentLongRunMax: number;
  setCurrentLongRunMax: (v: number) => void;
  onNext: () => void;
  canProceed: boolean;
}

export default function BasicInfoStep({
  name,
  setName,
  runnerPersona,
  setRunnerPersona,
  runnerPersonaNotes,
  setRunnerPersonaNotes,
  currentWeeklyMileage,
  setCurrentWeeklyMileage,
  runsPerWeekCurrent,
  setRunsPerWeekCurrent,
  currentLongRunMax,
  setCurrentLongRunMax,
  onNext,
  canProceed,
}: BasicInfoStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-primary">Tell us about yourself</h2>
        <p className="text-tertiary text-sm mt-1">We&apos;ll use this to personalize your training</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">
          What&apos;s your name?<span className="text-red-400 ml-1">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          aria-required="true"
          aria-invalid={name.trim() === '' ? 'true' : undefined}
          className="w-full px-4 py-3 bg-surface-2 border border-default rounded-lg text-primary placeholder-text-disabled focus:ring-2 focus:ring-dream-500 focus:border-transparent"
          placeholder="Enter your name"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">
          Which best describes how you like to train?<span className="text-red-400 ml-1">*</span>
        </label>
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1" role="radiogroup" aria-required="true">
          {PERSONA_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setRunnerPersona(option.value)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${
                runnerPersona === option.value
                  ? 'bg-dream-600 border-dream-500 text-white'
                  : 'bg-surface-2 border-default text-secondary hover:bg-surface-3'
              }`}
            >
              <p className="font-medium text-sm">{option.label}</p>
              <p className={`text-xs mt-0.5 ${runnerPersona === option.value ? 'text-tertiary' : 'text-tertiary'}`}>
                {option.description}
              </p>
            </button>
          ))}
        </div>
        {runnerPersona === 'other' && (
          <div className="mt-3">
            <textarea
              value={runnerPersonaNotes}
              onChange={(e) => setRunnerPersonaNotes(e.target.value)}
              placeholder="Tell us more about how you like to train..."
              className="w-full px-4 py-3 bg-surface-2 border border-default rounded-lg text-primary placeholder-text-disabled focus:ring-2 focus:ring-dream-500 focus:border-transparent resize-none"
              rows={2}
            />
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">
          Current weekly mileage
        </label>
        <div className="flex items-center space-x-3">
          <input
            type="range"
            min="0"
            max="100"
            value={currentWeeklyMileage}
            onChange={(e) => setCurrentWeeklyMileage(Number(e.target.value))}
            className="flex-1 h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer"
          />
          <span className="w-20 text-right text-primary font-medium">{currentWeeklyMileage} mi</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">
          Runs per week
        </label>
        <div className="flex items-center space-x-3">
          <input
            type="range"
            min="2"
            max="7"
            value={runsPerWeekCurrent}
            onChange={(e) => setRunsPerWeekCurrent(Number(e.target.value))}
            className="flex-1 h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer"
          />
          <span className="w-20 text-right text-primary font-medium">{runsPerWeekCurrent} days</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">
          Comfortable long run distance
        </label>
        <div className="flex items-center space-x-3">
          <input
            type="range"
            min="3"
            max="26"
            value={currentLongRunMax}
            onChange={(e) => setCurrentLongRunMax(Number(e.target.value))}
            className="flex-1 h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer"
          />
          <span className="w-20 text-right text-primary font-medium">{currentLongRunMax} mi</span>
        </div>
      </div>

      <StepNavigation onBack={() => {}} onNext={onNext} nextDisabled={!canProceed} hideBack />
    </div>
  );
}
