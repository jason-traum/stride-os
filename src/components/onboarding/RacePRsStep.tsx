import { StepHeader } from './StepHeader';
import { StepNavigation } from './StepNavigation';
import { Trophy } from 'lucide-react';

interface RacePRsStepProps {
  hasMarathonPR: boolean;
  setHasMarathonPR: (v: boolean) => void;
  marathonPRHours: number;
  setMarathonPRHours: (v: number) => void;
  marathonPRMinutes: number;
  setMarathonPRMinutes: (v: number) => void;
  marathonPRSeconds: number;
  setMarathonPRSeconds: (v: number) => void;
  hasHalfMarathonPR: boolean;
  setHasHalfMarathonPR: (v: boolean) => void;
  halfMarathonPRHours: number;
  setHalfMarathonPRHours: (v: number) => void;
  halfMarathonPRMinutes: number;
  setHalfMarathonPRMinutes: (v: number) => void;
  halfMarathonPRSeconds: number;
  setHalfMarathonPRSeconds: (v: number) => void;
  hasTenKPR: boolean;
  setHasTenKPR: (v: boolean) => void;
  tenKPRMinutes: number;
  setTenKPRMinutes: (v: number) => void;
  tenKPRSeconds: number;
  setTenKPRSeconds: (v: number) => void;
  hasFiveKPR: boolean;
  setHasFiveKPR: (v: boolean) => void;
  fiveKPRMinutes: number;
  setFiveKPRMinutes: (v: number) => void;
  fiveKPRSeconds: number;
  setFiveKPRSeconds: (v: number) => void;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
}

export function RacePRsStep({
  hasMarathonPR,
  setHasMarathonPR,
  marathonPRHours,
  setMarathonPRHours,
  marathonPRMinutes,
  setMarathonPRMinutes,
  marathonPRSeconds,
  setMarathonPRSeconds,
  hasHalfMarathonPR,
  setHasHalfMarathonPR,
  halfMarathonPRHours,
  setHalfMarathonPRHours,
  halfMarathonPRMinutes,
  setHalfMarathonPRMinutes,
  halfMarathonPRSeconds,
  setHalfMarathonPRSeconds,
  hasTenKPR,
  setHasTenKPR,
  tenKPRMinutes,
  setTenKPRMinutes,
  tenKPRSeconds,
  setTenKPRSeconds,
  hasFiveKPR,
  setHasFiveKPR,
  fiveKPRMinutes,
  setFiveKPRMinutes,
  fiveKPRSeconds,
  setFiveKPRSeconds,
  onBack,
  onSubmit,
  loading,
}: RacePRsStepProps) {
  return (
    <div className="space-y-6">
      <StepHeader
        icon={Trophy}
        title="Race PRs (Optional)"
        subtitle="Helps calibrate training paces"
      />

      {/* Marathon PR */}
      <div className="bg-surface-2 rounded-lg p-4">
        <div className="flex items-center mb-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={hasMarathonPR}
              onChange={(e) => setHasMarathonPR(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-surface-2 peer-focus:ring-2 peer-focus:ring-dream-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-1 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-dream-600"></div>
            <span className="ml-3 text-sm font-medium text-tertiary">Marathon</span>
          </label>
        </div>
        {hasMarathonPR && (
          <div className="flex items-center space-x-2">
            <input
              type="number"
              min="0"
              max="10"
              value={marathonPRHours}
              onChange={(e) => setMarathonPRHours(Number(e.target.value))}
              className="w-16 px-2 py-2 bg-surface-2 border border-default rounded text-primary text-center"
            />
            <span className="text-tertiary">:</span>
            <input
              type="number"
              min="0"
              max="59"
              value={marathonPRMinutes}
              onChange={(e) => setMarathonPRMinutes(Math.min(59, Number(e.target.value)))}
              className="w-16 px-2 py-2 bg-surface-2 border border-default rounded text-primary text-center"
            />
            <span className="text-tertiary">:</span>
            <input
              type="number"
              min="0"
              max="59"
              value={marathonPRSeconds}
              onChange={(e) => setMarathonPRSeconds(Math.min(59, Number(e.target.value)))}
              className="w-16 px-2 py-2 bg-surface-2 border border-default rounded text-primary text-center"
            />
          </div>
        )}
      </div>

      {/* Half Marathon PR */}
      <div className="bg-surface-2 rounded-lg p-4">
        <div className="flex items-center mb-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={hasHalfMarathonPR}
              onChange={(e) => setHasHalfMarathonPR(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-surface-2 peer-focus:ring-2 peer-focus:ring-dream-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-1 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-dream-600"></div>
            <span className="ml-3 text-sm font-medium text-tertiary">Half Marathon</span>
          </label>
        </div>
        {hasHalfMarathonPR && (
          <div className="flex items-center space-x-2">
            <input
              type="number"
              min="0"
              max="5"
              value={halfMarathonPRHours}
              onChange={(e) => setHalfMarathonPRHours(Number(e.target.value))}
              className="w-16 px-2 py-2 bg-surface-2 border border-default rounded text-primary text-center"
            />
            <span className="text-tertiary">:</span>
            <input
              type="number"
              min="0"
              max="59"
              value={halfMarathonPRMinutes}
              onChange={(e) => setHalfMarathonPRMinutes(Math.min(59, Number(e.target.value)))}
              className="w-16 px-2 py-2 bg-surface-2 border border-default rounded text-primary text-center"
            />
            <span className="text-tertiary">:</span>
            <input
              type="number"
              min="0"
              max="59"
              value={halfMarathonPRSeconds}
              onChange={(e) => setHalfMarathonPRSeconds(Math.min(59, Number(e.target.value)))}
              className="w-16 px-2 py-2 bg-surface-2 border border-default rounded text-primary text-center"
            />
          </div>
        )}
      </div>

      {/* 10K PR */}
      <div className="bg-surface-2 rounded-lg p-4">
        <div className="flex items-center mb-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={hasTenKPR}
              onChange={(e) => setHasTenKPR(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-surface-2 peer-focus:ring-2 peer-focus:ring-dream-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-1 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-dream-600"></div>
            <span className="ml-3 text-sm font-medium text-tertiary">10K</span>
          </label>
        </div>
        {hasTenKPR && (
          <div className="flex items-center space-x-2">
            <input
              type="number"
              min="0"
              max="120"
              value={tenKPRMinutes}
              onChange={(e) => setTenKPRMinutes(Number(e.target.value))}
              className="w-16 px-2 py-2 bg-surface-2 border border-default rounded text-primary text-center"
            />
            <span className="text-tertiary">:</span>
            <input
              type="number"
              min="0"
              max="59"
              value={tenKPRSeconds}
              onChange={(e) => setTenKPRSeconds(Math.min(59, Number(e.target.value)))}
              className="w-16 px-2 py-2 bg-surface-2 border border-default rounded text-primary text-center"
            />
          </div>
        )}
      </div>

      {/* 5K PR */}
      <div className="bg-surface-2 rounded-lg p-4">
        <div className="flex items-center mb-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={hasFiveKPR}
              onChange={(e) => setHasFiveKPR(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-surface-2 peer-focus:ring-2 peer-focus:ring-dream-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-1 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-dream-600"></div>
            <span className="ml-3 text-sm font-medium text-tertiary">5K</span>
          </label>
        </div>
        {hasFiveKPR && (
          <div className="flex items-center space-x-2">
            <input
              type="number"
              min="0"
              max="60"
              value={fiveKPRMinutes}
              onChange={(e) => setFiveKPRMinutes(Number(e.target.value))}
              className="w-16 px-2 py-2 bg-surface-2 border border-default rounded text-primary text-center"
            />
            <span className="text-tertiary">:</span>
            <input
              type="number"
              min="0"
              max="59"
              value={fiveKPRSeconds}
              onChange={(e) => setFiveKPRSeconds(Math.min(59, Number(e.target.value)))}
              className="w-16 px-2 py-2 bg-surface-2 border border-default rounded text-primary text-center"
            />
          </div>
        )}
      </div>

      <StepNavigation
        onBack={onBack}
        onNext={onSubmit}
        nextLabel="Complete Setup"
        nextColor="green"
        showCheck={true}
        loading={loading}
        loadingLabel="Setting up..."
      />
    </div>
  );
}
