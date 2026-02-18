import { Trophy } from 'lucide-react';
import { RACE_DISTANCES } from '@/lib/training/types';
import { StepHeader } from './StepHeader';
import { StepNavigation } from './StepNavigation';

interface RecentRaceStepProps {
  hasRecentRace: boolean;
  setHasRecentRace: (v: boolean) => void;
  raceDistance: string;
  setRaceDistance: (v: string) => void;
  raceTimeHours: number;
  setRaceTimeHours: (v: number) => void;
  raceTimeMinutes: number;
  setRaceTimeMinutes: (v: number) => void;
  raceTimeSeconds: number;
  setRaceTimeSeconds: (v: number) => void;
  raceDate: string;
  setRaceDate: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function RecentRaceStep({
  hasRecentRace,
  setHasRecentRace,
  raceDistance,
  setRaceDistance,
  raceTimeHours,
  setRaceTimeHours,
  raceTimeMinutes,
  setRaceTimeMinutes,
  raceTimeSeconds,
  setRaceTimeSeconds,
  raceDate,
  setRaceDate,
  onBack,
  onNext,
}: RecentRaceStepProps) {
  return (
    <div className="space-y-6">
      <StepHeader
        icon={Trophy}
        iconColor="text-green-500"
        title="Recent Race Result"
        subtitle="Highly recommended for accurate pace zones"
      />

      <div className="flex items-center">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={hasRecentRace}
            onChange={(e) => setHasRecentRace(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-surface-2 peer-focus:ring-2 peer-focus:ring-green-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-1 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
          <span className="ml-3 text-sm font-medium text-tertiary">
            I have a recent race to share
          </span>
        </label>
      </div>

      {!hasRecentRace && (
        <div className="bg-dream-500/10 border border-dream-500/30 rounded-lg p-4">
          <p className="text-tertiary text-sm">
            Without a recent race, we&apos;ll estimate your paces based on your
            mileage. Adding a race result gives much more accurate training
            zones.
          </p>
        </div>
      )}

      {hasRecentRace && (
        <div className="space-y-4 animate-in slide-in-from-top-2">
          <div>
            <label className="block text-sm font-medium text-tertiary mb-2">
              Race Distance
            </label>
            <select
              value={raceDistance}
              onChange={(e) => setRaceDistance(e.target.value)}
              className="w-full px-4 py-3 bg-surface-2 border border-default rounded-lg text-primary focus:ring-2 focus:ring-dream-500 focus:border-transparent"
            >
              {Object.entries(RACE_DISTANCES).map(([key, dist]) => (
                <option key={key} value={key}>
                  {dist.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-tertiary mb-2">
              Finish Time
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                max="23"
                value={raceTimeHours}
                onChange={(e) => setRaceTimeHours(Number(e.target.value))}
                className="w-20 px-3 py-3 bg-surface-2 border border-default rounded-lg text-primary text-center focus:ring-2 focus:ring-dream-500 focus:border-transparent"
                placeholder="hr"
              />
              <span className="text-tertiary text-xl">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={raceTimeMinutes}
                onChange={(e) =>
                  setRaceTimeMinutes(Math.min(59, Number(e.target.value)))
                }
                className="w-20 px-3 py-3 bg-surface-2 border border-default rounded-lg text-primary text-center focus:ring-2 focus:ring-dream-500 focus:border-transparent"
                placeholder="min"
              />
              <span className="text-tertiary text-xl">:</span>
              <input
                type="number"
                min="0"
                max="59"
                value={raceTimeSeconds}
                onChange={(e) =>
                  setRaceTimeSeconds(Math.min(59, Number(e.target.value)))
                }
                className="w-20 px-3 py-3 bg-surface-2 border border-default rounded-lg text-primary text-center focus:ring-2 focus:ring-dream-500 focus:border-transparent"
                placeholder="sec"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-tertiary mb-2">
              Race Date
            </label>
            <input
              type="date"
              value={raceDate}
              onChange={(e) => setRaceDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 bg-surface-2 border border-default rounded-lg text-primary focus:ring-2 focus:ring-dream-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      <StepNavigation onBack={onBack} onNext={onNext} nextColor="green" />
    </div>
  );
}
