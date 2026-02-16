import { StepHeader } from './StepHeader';
import { StepNavigation } from './StepNavigation';
import { TimeSlider } from './TimeSlider';
import { Clock } from 'lucide-react';

interface ScheduleLifestyleStepProps {
  preferredRunTime: string;
  setPreferredRunTime: (v: string) => void;
  weekdayAvailabilityMinutes: number;
  setWeekdayAvailabilityMinutes: (v: number) => void;
  weekendAvailabilityMinutes: number;
  setWeekendAvailabilityMinutes: (v: number) => void;
  heatSensitivity: number;
  setHeatSensitivity: (v: number) => void;
  coldSensitivity: number;
  setColdSensitivity: (v: number) => void;
  surfacePreference: string;
  setSurfacePreference: (v: string) => void;
  groupVsSolo: string;
  setGroupVsSolo: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function ScheduleLifestyleStep({
  preferredRunTime,
  setPreferredRunTime,
  weekdayAvailabilityMinutes,
  setWeekdayAvailabilityMinutes,
  weekendAvailabilityMinutes,
  setWeekendAvailabilityMinutes,
  heatSensitivity,
  setHeatSensitivity,
  coldSensitivity,
  setColdSensitivity,
  surfacePreference,
  setSurfacePreference,
  groupVsSolo,
  setGroupVsSolo,
  onBack,
  onNext,
}: ScheduleLifestyleStepProps) {
  return (
    <div className="space-y-6">
      <StepHeader icon={Clock} title="Schedule & Lifestyle" subtitle="When and where do you run?" />

      <div>
        <label className="block text-sm font-medium text-tertiary mb-3">Best time to run</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'early_morning', label: 'Early AM' },
            { value: 'morning', label: 'Morning' },
            { value: 'midday', label: 'Midday' },
            { value: 'evening', label: 'Evening' },
            { value: 'flexible', label: 'Flexible' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setPreferredRunTime(option.value)}
              className={`px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                preferredRunTime === option.value
                  ? 'bg-dream-600 text-white'
                  : 'bg-surface-2 text-secondary hover:bg-surface-3'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <TimeSlider
        value={weekdayAvailabilityMinutes}
        onChange={setWeekdayAvailabilityMinutes}
        label="Weekday time available for running"
        min={30}
        max={120}
        step={15}
      />

      <TimeSlider
        value={weekendAvailabilityMinutes}
        onChange={setWeekendAvailabilityMinutes}
        label="Weekend time available for running"
        min={60}
        max={180}
        step={15}
      />

      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">
          Heat sensitivity (1 = comfortable, 5 = hate it)
        </label>
        <div className="flex items-center space-x-3">
          <span className="text-lg font-medium">Heat</span>
          <input
            type="range"
            min="1"
            max="5"
            value={heatSensitivity}
            onChange={(e) => setHeatSensitivity(Number(e.target.value))}
            className="flex-1 h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer"
          />
          <span className="w-8 text-center text-primary font-medium">{heatSensitivity}</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">
          Cold sensitivity (1 = comfortable, 5 = hate it)
        </label>
        <div className="flex items-center space-x-3">
          <span className="text-lg font-medium">Cold</span>
          <input
            type="range"
            min="1"
            max="5"
            value={coldSensitivity}
            onChange={(e) => setColdSensitivity(Number(e.target.value))}
            className="flex-1 h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer"
          />
          <span className="w-8 text-center text-primary font-medium">{coldSensitivity}</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-tertiary mb-3">Surface preference</label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: 'road', label: 'Road' },
            { value: 'trail', label: 'Trail' },
            { value: 'track', label: 'Track' },
            { value: 'mixed', label: 'Mixed' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setSurfacePreference(option.value)}
              className={`px-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                surfacePreference === option.value
                  ? 'bg-dream-600 text-white'
                  : 'bg-surface-2 text-secondary hover:bg-surface-3'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-tertiary mb-3">Group vs solo preference</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'solo', label: 'Solo' },
            { value: 'group', label: 'Group' },
            { value: 'either', label: 'Either' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setGroupVsSolo(option.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                groupVsSolo === option.value
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
