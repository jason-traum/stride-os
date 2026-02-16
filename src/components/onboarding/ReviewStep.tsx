import { StepHeader } from './StepHeader';
import { CheckCircle2, Edit2, ChevronRight, ChevronLeft } from 'lucide-react';
import { getDistanceLabel, formatTime } from '@/lib/training/types';

interface ReviewStepProps {
  // Basic info
  name: string;
  currentWeeklyMileage: number;
  runsPerWeekCurrent: number;
  currentLongRunMax: number;
  // Training prefs
  peakWeeklyMileageTarget: number;
  preferredLongRunDay: string;
  requiredRestDays: string[];
  planAggressiveness: string;
  // Recent race
  hasRecentRace: boolean;
  raceDistance: string;
  raceTimeHours: number;
  raceTimeMinutes: number;
  raceTimeSeconds: number;
  // Goal race
  goalRaceName: string;
  goalRaceDistance: string;
  goalRaceDate: string;
  hasTargetTime: boolean;
  targetTimeHours: number;
  targetTimeMinutes: number;
  targetTimeSeconds: number;
  weeksUntilRace: number;
  // Navigation
  goToStep: (step: number) => void;
  onContinueDeepProfile: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export function ReviewStep({
  name,
  currentWeeklyMileage,
  runsPerWeekCurrent,
  currentLongRunMax,
  peakWeeklyMileageTarget,
  preferredLongRunDay,
  requiredRestDays,
  planAggressiveness,
  hasRecentRace,
  raceDistance,
  raceTimeHours,
  raceTimeMinutes,
  raceTimeSeconds,
  goalRaceName,
  goalRaceDistance,
  goalRaceDate,
  hasTargetTime,
  targetTimeHours,
  targetTimeMinutes,
  targetTimeSeconds,
  weeksUntilRace,
  goToStep,
  onContinueDeepProfile,
  onSubmit,
  loading,
}: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <StepHeader
        icon={CheckCircle2}
        iconColor="text-green-500"
        title="Review Your Setup"
        subtitle="Make sure everything looks right"
      />

      <div className="space-y-4">
        {/* Basic Info */}
        <div className="bg-surface-2 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-tertiary">Basic Info</h3>
            <button onClick={() => goToStep(1)} className="text-dream-400 hover:text-tertiary text-sm flex items-center gap-1">
              <Edit2 className="w-3 h-3" />Edit
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-textTertiary">Name:</span><span className="text-primary ml-2">{name}</span></div>
            <div><span className="text-textTertiary">Weekly miles:</span><span className="text-primary ml-2">{currentWeeklyMileage}</span></div>
            <div><span className="text-textTertiary">Runs/week:</span><span className="text-primary ml-2">{runsPerWeekCurrent}</span></div>
            <div><span className="text-textTertiary">Long run:</span><span className="text-primary ml-2">{currentLongRunMax} mi</span></div>
          </div>
        </div>

        {/* Training Preferences */}
        <div className="bg-surface-2 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-tertiary">Training Preferences</h3>
            <button onClick={() => goToStep(2)} className="text-dream-400 hover:text-tertiary text-sm flex items-center gap-1">
              <Edit2 className="w-3 h-3" />Edit
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="text-textTertiary">Peak mileage:</span><span className="text-primary ml-2">{peakWeeklyMileageTarget} mi</span></div>
            <div><span className="text-textTertiary">Long run day:</span><span className="text-primary ml-2 capitalize">{preferredLongRunDay}</span></div>
            <div><span className="text-textTertiary">Rest days:</span><span className="text-primary ml-2 capitalize">{requiredRestDays.length > 0 ? requiredRestDays.map(d => d.slice(0, 3)).join(', ') : 'None'}</span></div>
            <div><span className="text-textTertiary">Approach:</span><span className="text-primary ml-2 capitalize">{planAggressiveness}</span></div>
          </div>
        </div>

        {/* Recent Race */}
        <div className="bg-surface-2 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-tertiary">Recent Race</h3>
            <button onClick={() => goToStep(3)} className="text-dream-400 hover:text-tertiary text-sm flex items-center gap-1">
              <Edit2 className="w-3 h-3" />Edit
            </button>
          </div>
          {hasRecentRace ? (
            <div className="text-sm">
              <span className="text-primary">{getDistanceLabel(raceDistance)}</span>
              <span className="text-tertiary mx-2">in</span>
              <span className="text-primary">{formatTime(raceTimeHours * 3600 + raceTimeMinutes * 60 + raceTimeSeconds)}</span>
            </div>
          ) : (
            <p className="text-sm text-dream-400">No race provided - paces will be estimated</p>
          )}
        </div>

        {/* Goal Race */}
        <div className="bg-surface-2 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-tertiary">Goal Race</h3>
            <button onClick={() => goToStep(4)} className="text-dream-400 hover:text-tertiary text-sm flex items-center gap-1">
              <Edit2 className="w-3 h-3" />Edit
            </button>
          </div>
          <div className="text-sm space-y-1">
            <div><span className="text-primary font-medium">{goalRaceName}</span></div>
            <div>
              <span className="text-tertiary">{getDistanceLabel(goalRaceDistance)}</span>
              <span className="text-textTertiary mx-2">on</span>
              <span className="text-tertiary">{new Date(goalRaceDate).toLocaleDateString()}</span>
            </div>
            {hasTargetTime && (
              <div>
                <span className="text-textTertiary">Target:</span>
                <span className="text-green-400 ml-2">{formatTime(targetTimeHours * 3600 + targetTimeMinutes * 60 + targetTimeSeconds)}</span>
              </div>
            )}
            <div className="text-dream-400">{weeksUntilRace} weeks to train</div>
          </div>
        </div>
      </div>

      {/* Deep profile prompt */}
      <div className="bg-dream-500/10 border border-dream-500/30 rounded-lg p-4">
        <p className="text-dream-300 text-sm mb-2">
          <strong>Want smarter training?</strong> Complete 5 more optional sections to help us personalize your workouts even more.
        </p>
        <p className="text-tertiary text-xs">
          This helps us understand your comfort with different workout types, injury history, and schedule constraints.
        </p>
      </div>

      {/* Button area */}
      <div className="flex flex-col space-y-3">
        <button onClick={onContinueDeepProfile}
          className="w-full flex items-center justify-center space-x-2 bg-dream-600 hover:bg-dream-700 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-sm">
          <span>Continue with Deep Profile</span>
          <ChevronRight className="w-5 h-5" />
        </button>
        <div className="flex space-x-3">
          <button onClick={() => goToStep(4)}
            className="flex-1 flex items-center justify-center space-x-2 bg-surface-2 hover:bg-surface-3 text-primary font-medium py-3 px-4 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" /><span>Back</span>
          </button>
          <button onClick={onSubmit} disabled={loading}
            className="flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 disabled:bg-surface-2 text-white font-medium py-3 px-4 rounded-lg transition-colors">
            {loading ? <span>Setting up...</span> : <><span>Start Training</span><ChevronRight className="w-5 h-5" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
