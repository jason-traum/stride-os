import StepHeader from './StepHeader';
import StepNavigation from './StepNavigation';
import { InjurySelector } from './InjurySelector';
import { Heart } from 'lucide-react';

interface InjuryRecoveryStepProps {
  commonInjuries: string[];
  setCommonInjuries: (v: string[]) => void;
  currentInjuries: string;
  setCurrentInjuries: (v: string) => void;
  needsExtraRest: boolean;
  setNeedsExtraRest: (v: boolean) => void;
  typicalSleepHours: number;
  setTypicalSleepHours: (v: number) => void;
  sleepQuality: string;
  setSleepQuality: (v: string) => void;
  stressLevel: string;
  setStressLevel: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function InjuryRecoveryStep({
  commonInjuries,
  setCommonInjuries,
  currentInjuries,
  setCurrentInjuries,
  needsExtraRest,
  setNeedsExtraRest,
  typicalSleepHours,
  setTypicalSleepHours,
  sleepQuality,
  setSleepQuality,
  stressLevel,
  setStressLevel,
  onBack,
  onNext,
}: InjuryRecoveryStepProps) {
  return (
    <div className="space-y-6">
      <StepHeader icon={Heart} title="Injury & Recovery" subtitle="Help us keep you healthy" />

      <InjurySelector
        selected={commonInjuries}
        onChange={setCommonInjuries}
        label="Past running injuries"
        description="Select any injuries you've dealt with"
      />

      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">
          Current injuries or pains (optional)
        </label>
        <textarea
          value={currentInjuries}
          onChange={(e) => setCurrentInjuries(e.target.value)}
          placeholder="e.g., Mild left knee pain after long runs..."
          className="w-full px-4 py-3 bg-surface-2 border border-default rounded-lg text-primary placeholder-text-disabled focus:ring-2 focus:ring-dream-500 focus:border-transparent resize-none"
          rows={2}
        />
      </div>

      <div className="flex items-center">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={needsExtraRest}
            onChange={(e) => setNeedsExtraRest(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-surface-2 peer-focus:ring-2 peer-focus:ring-dream-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-1 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-dream-600"></div>
          <span className="ml-3 text-sm font-medium text-tertiary">
            I need extra rest to stay healthy
          </span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">Typical sleep hours</label>
        <div className="flex items-center space-x-3">
          <input
            type="range"
            min="4"
            max="10"
            step="0.5"
            value={typicalSleepHours}
            onChange={(e) => setTypicalSleepHours(Number(e.target.value))}
            className="flex-1 h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer"
          />
          <span className="w-16 text-right text-primary font-medium">
            {typicalSleepHours} hrs
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-tertiary mb-3">Sleep quality</label>
        <div className="grid grid-cols-4 gap-2">
          {['poor', 'fair', 'good', 'excellent'].map((option) => (
            <button
              key={option}
              onClick={() => setSleepQuality(option)}
              className={`px-2 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                sleepQuality === option
                  ? 'bg-dream-600 text-white'
                  : 'bg-surface-2 text-secondary hover:bg-surface-3'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-tertiary mb-3">Current stress level</label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: 'low', label: 'Low' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'high', label: 'High' },
            { value: 'very_high', label: 'Very High' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setStressLevel(option.value)}
              className={`px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                stressLevel === option.value
                  ? 'bg-dream-600 text-white'
                  : 'bg-surface-2 text-secondary hover:bg-surface-3'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <StepNavigation onBack={onBack} onNext={onNext} />
    </div>
  );
}
