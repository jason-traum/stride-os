import { StepHeader } from './StepHeader';
import { StepNavigation } from './StepNavigation';
import { MultiSelectChips } from './MultiSelectChips';
import { Dumbbell } from 'lucide-react';

interface AthleticBackgroundStepProps {
  yearsRunning: number;
  setYearsRunning: (v: number) => void;
  athleticBackground: string[];
  setAthleticBackground: (v: string[]) => void;
  highestWeeklyMileageEver: number;
  setHighestWeeklyMileageEver: (v: number) => void;
  weeksAtHighestMileage: number;
  setWeeksAtHighestMileage: (v: number) => void;
  timeSincePeakFitness: string;
  setTimeSincePeakFitness: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export function AthleticBackgroundStep({
  yearsRunning,
  setYearsRunning,
  athleticBackground,
  setAthleticBackground,
  highestWeeklyMileageEver,
  setHighestWeeklyMileageEver,
  weeksAtHighestMileage,
  setWeeksAtHighestMileage,
  timeSincePeakFitness,
  setTimeSincePeakFitness,
  onBack,
  onNext,
}: AthleticBackgroundStepProps) {
  return (
    <div className="space-y-6">
      <StepHeader
        icon={Dumbbell}
        title="Athletic Background"
        subtitle="Help us understand your running history"
      />

      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">Years running</label>
        <div className="flex items-center space-x-3">
          <input
            type="range"
            min="0"
            max="30"
            value={yearsRunning}
            onChange={(e) => setYearsRunning(Number(e.target.value))}
            className="flex-1 h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer"
          />
          <span className="w-16 text-right text-primary font-medium">{yearsRunning}+ yrs</span>
        </div>
      </div>

      <MultiSelectChips
        options={[
          { value: 'soccer', label: 'Soccer' },
          { value: 'lacrosse', label: 'Lacrosse' },
          { value: 'swimming', label: 'Swimming' },
          { value: 'cycling', label: 'Cycling' },
          { value: 'basketball', label: 'Basketball' },
          { value: 'track', label: 'Track & Field' },
          { value: 'none', label: 'None' },
        ]}
        selected={athleticBackground}
        onChange={setAthleticBackground}
        label="Athletic background before running"
        description="Select all that apply"
      />

      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">Highest weekly mileage ever</label>
        <div className="flex items-center space-x-3">
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            value={highestWeeklyMileageEver}
            onChange={(e) => setHighestWeeklyMileageEver(Number(e.target.value))}
            className="flex-1 h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer"
          />
          <span className="w-16 text-right text-primary font-medium">{highestWeeklyMileageEver} mi</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">How many weeks at that mileage?</label>
        <div className="flex items-center space-x-3">
          <input
            type="range"
            min="1"
            max="20"
            value={weeksAtHighestMileage}
            onChange={(e) => setWeeksAtHighestMileage(Number(e.target.value))}
            className="flex-1 h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer"
          />
          <span className="w-16 text-right text-primary font-medium">{weeksAtHighestMileage} wks</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-tertiary mb-3">Time since peak fitness</label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'current', label: 'Currently at peak' },
            { value: '3_months', label: '3 months ago' },
            { value: '6_months', label: '6 months ago' },
            { value: '1_year', label: '1 year ago' },
            { value: '2_plus_years', label: '2+ years ago' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setTimeSincePeakFitness(option.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeSincePeakFitness === option.value
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
