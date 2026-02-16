import StepHeader from './StepHeader';
import StepNavigation from './StepNavigation';
import { Target, Calendar } from 'lucide-react';
import { RACE_DISTANCES } from '@/lib/training/types';

interface GoalRaceStepProps {
  goalRaceName: string;
  setGoalRaceName: (v: string) => void;
  goalRaceDistance: string;
  setGoalRaceDistance: (v: string) => void;
  goalRaceDate: string;
  setGoalRaceDate: (v: string) => void;
  hasTargetTime: boolean;
  setHasTargetTime: (v: boolean) => void;
  targetTimeHours: number;
  setTargetTimeHours: (v: number) => void;
  targetTimeMinutes: number;
  setTargetTimeMinutes: (v: number) => void;
  targetTimeSeconds: number;
  setTargetTimeSeconds: (v: number) => void;
  weeksUntilRace: number;
  onBack: () => void;
  onNext: () => void;
  canProceed: boolean;
}

export default function GoalRaceStep({
  goalRaceName,
  setGoalRaceName,
  goalRaceDistance,
  setGoalRaceDistance,
  goalRaceDate,
  setGoalRaceDate,
  hasTargetTime,
  setHasTargetTime,
  targetTimeHours,
  setTargetTimeHours,
  targetTimeMinutes,
  setTargetTimeMinutes,
  targetTimeSeconds,
  setTargetTimeSeconds,
  weeksUntilRace,
  onBack,
  onNext,
  canProceed,
}: GoalRaceStepProps) {
  return (
    <div className="space-y-6">
      <StepHeader
        icon={Target}
        iconColor="text-green-500"
        title="Your Goal Race"
        subtitle="We'll build your training plan around this"
      />

      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">Race Name<span className="text-red-400 ml-1">*</span></label>
        <input
          type="text"
          value={goalRaceName}
          onChange={(e) => setGoalRaceName(e.target.value)}
          required
          aria-required="true"
          aria-invalid={goalRaceName.trim() === '' ? 'true' : undefined}
          className="w-full px-4 py-3 bg-surface-2 border border-default rounded-lg text-primary placeholder-text-disabled focus:ring-2 focus:ring-dream-500 focus:border-transparent"
          placeholder="e.g., NYC Half Marathon"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">Race Distance<span className="text-red-400 ml-1">*</span></label>
        <select
          value={goalRaceDistance}
          onChange={(e) => setGoalRaceDistance(e.target.value)}
          required
          aria-required="true"
          className="w-full px-4 py-3 bg-surface-2 border border-default rounded-lg text-primary focus:ring-2 focus:ring-dream-500 focus:border-transparent"
        >
          {Object.entries(RACE_DISTANCES).map(([key, dist]) => (
            <option key={key} value={key}>{dist.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-tertiary mb-2">
          <Calendar className="w-4 h-4 inline mr-1" />Race Date<span className="text-red-400 ml-1">*</span>
        </label>
        <input
          type="date"
          value={goalRaceDate}
          onChange={(e) => setGoalRaceDate(e.target.value)}
          required
          aria-required="true"
          aria-invalid={goalRaceDate === '' ? 'true' : undefined}
          min={new Date().toISOString().split('T')[0]}
          className="w-full px-4 py-3 bg-surface-2 border border-default rounded-lg text-primary focus:ring-2 focus:ring-dream-500 focus:border-transparent"
        />
        {goalRaceDate && weeksUntilRace > 0 && (
          <p className="text-xs text-tertiary mt-1">{weeksUntilRace} weeks until race day</p>
        )}
      </div>

      <div className="flex items-center">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={hasTargetTime}
            onChange={(e) => setHasTargetTime(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-surface-2 peer-focus:ring-2 peer-focus:ring-dream-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-1 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-dream-600"></div>
          <span className="ml-3 text-sm font-medium text-tertiary">I have a target finish time</span>
        </label>
      </div>

      {hasTargetTime && (
        <div className="animate-in slide-in-from-top-2">
          <label className="block text-sm font-medium text-tertiary mb-2">Target Time</label>
          <div className="flex items-center space-x-2">
            <input
              type="number"
              min="0"
              max="23"
              value={targetTimeHours}
              onChange={(e) => setTargetTimeHours(Number(e.target.value))}
              className="w-20 px-4 py-3 bg-surface-2 border border-default rounded-lg text-primary text-center focus:ring-2 focus:ring-dream-500 focus:border-transparent"
              placeholder="hr"
            />
            <span className="text-tertiary text-xl">:</span>
            <input
              type="number"
              min="0"
              max="59"
              value={targetTimeMinutes}
              onChange={(e) => setTargetTimeMinutes(Math.min(59, Number(e.target.value)))}
              className="w-20 px-4 py-3 bg-surface-2 border border-default rounded-lg text-primary text-center focus:ring-2 focus:ring-dream-500 focus:border-transparent"
              placeholder="min"
            />
            <span className="text-tertiary text-xl">:</span>
            <input
              type="number"
              min="0"
              max="59"
              value={targetTimeSeconds}
              onChange={(e) => setTargetTimeSeconds(Math.min(59, Number(e.target.value)))}
              className="w-20 px-4 py-3 bg-surface-2 border border-default rounded-lg text-primary text-center focus:ring-2 focus:ring-dream-500 focus:border-transparent"
              placeholder="sec"
            />
          </div>
        </div>
      )}

      <StepNavigation
        onBack={onBack}
        onNext={onNext}
        nextLabel="Review"
        nextColor="green"
        nextDisabled={!canProceed}
      />
    </div>
  );
}
