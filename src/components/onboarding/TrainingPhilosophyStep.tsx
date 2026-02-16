import { Activity } from 'lucide-react';
import { StepHeader } from './StepHeader';
import { StepNavigation } from './StepNavigation';
import { EmojiScale } from './EmojiScale';
import { MultiSelectChips } from './MultiSelectChips';

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

interface TrainingPhilosophyStepProps {
  preferredQualityDays: string[];
  setPreferredQualityDays: (v: string[]) => void;
  comfortVO2max: number | null;
  setComfortVO2max: (v: number | null) => void;
  comfortTempo: number | null;
  setComfortTempo: (v: number | null) => void;
  comfortHills: number | null;
  setComfortHills: (v: number | null) => void;
  comfortLongRuns: number | null;
  setComfortLongRuns: (v: number | null) => void;
  comfortTrackWork: number | null;
  setComfortTrackWork: (v: number | null) => void;
  openToDoubles: boolean;
  setOpenToDoubles: (v: boolean) => void;
  trainBy: string;
  setTrainBy: (v: string) => void;
  trainingPhilosophy: string;
  setTrainingPhilosophy: (v: string) => void;
  downWeekFrequency: string;
  setDownWeekFrequency: (v: string) => void;
  longRunMaxStyle: string;
  setLongRunMaxStyle: (v: string) => void;
  fatigueManagementStyle: string;
  setFatigueManagementStyle: (v: string) => void;
  mlrPreference: boolean;
  setMlrPreference: (v: boolean) => void;
  progressiveLongRunsOk: boolean;
  setProgressiveLongRunsOk: (v: boolean) => void;
  onBack: () => void;
  onNext: () => void;
}

export function TrainingPhilosophyStep({
  preferredQualityDays,
  setPreferredQualityDays,
  comfortVO2max,
  setComfortVO2max,
  comfortTempo,
  setComfortTempo,
  comfortHills,
  setComfortHills,
  comfortLongRuns,
  setComfortLongRuns,
  comfortTrackWork,
  setComfortTrackWork,
  openToDoubles,
  setOpenToDoubles,
  trainBy,
  setTrainBy,
  trainingPhilosophy,
  setTrainingPhilosophy,
  downWeekFrequency,
  setDownWeekFrequency,
  longRunMaxStyle,
  setLongRunMaxStyle,
  fatigueManagementStyle,
  setFatigueManagementStyle,
  mlrPreference,
  setMlrPreference,
  progressiveLongRunsOk,
  setProgressiveLongRunsOk,
  onBack,
  onNext,
}: TrainingPhilosophyStepProps) {
  return (
    <div className="space-y-6">
      <StepHeader
        icon={Activity}
        title="Training Preferences"
        subtitle="What workouts do you enjoy?"
      />

      <MultiSelectChips
        options={DAYS_OF_WEEK}
        selected={preferredQualityDays}
        onChange={setPreferredQualityDays}
        label="Preferred quality workout days"
        description="When would you prefer hard workouts?"
        maxSelections={3}
      />

      <EmojiScale
        value={comfortVO2max}
        onChange={setComfortVO2max}
        label="Comfort with VO2max intervals"
        description="Fast repeats like 400s, 800s, mile repeats"
      />
      <EmojiScale
        value={comfortTempo}
        onChange={setComfortTempo}
        label="Comfort with tempo runs"
        description="Sustained hard effort for 20-40 minutes"
      />
      <EmojiScale
        value={comfortHills}
        onChange={setComfortHills}
        label="Comfort with hill workouts"
      />
      <EmojiScale
        value={comfortLongRuns}
        onChange={setComfortLongRuns}
        label="Comfort with long runs"
        description="Runs of 90+ minutes"
      />
      <EmojiScale
        value={comfortTrackWork}
        onChange={setComfortTrackWork}
        label="Comfort with track workouts"
        description="Structured intervals on a track"
      />

      <div className="flex items-center">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={openToDoubles}
            onChange={(e) => setOpenToDoubles(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-surface-2 peer-focus:ring-2 peer-focus:ring-dream-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-1 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-dream-600"></div>
          <span className="ml-3 text-sm font-medium text-tertiary">
            Open to running doubles (2 runs per day)
          </span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-tertiary mb-3">
          How do you prefer to train?
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'pace', label: 'By pace' },
            { value: 'heart_rate', label: 'By heart rate' },
            { value: 'feel', label: 'By feel/effort' },
            { value: 'mixed', label: 'Mixed approach' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setTrainBy(option.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                trainBy === option.value
                  ? 'bg-dream-600 text-white'
                  : 'bg-surface-2 text-secondary hover:bg-surface-3'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-default pt-6 mt-6">
        <h3 className="text-lg font-medium text-primary mb-4">
          Training Philosophy
        </h3>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-tertiary mb-2">
              Which training philosophy resonates with you?
            </label>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {[
                {
                  value: 'pfitzinger',
                  label: 'Pfitzinger Style',
                  desc: 'Structured plans with MLRs, scheduled down weeks, 2 quality + long run',
                },
                {
                  value: 'hansons',
                  label: 'Hansons Style',
                  desc: 'Cumulative fatigue, shorter long runs (16mi), higher volume, SOS days',
                },
                {
                  value: 'daniels',
                  label: 'Daniels Style',
                  desc: 'VDOT-based, specific paces for each workout type, science-driven',
                },
                {
                  value: 'lydiard',
                  label: 'Lydiard Style',
                  desc: 'Big aerobic base first, then add intensity. Miles make champions.',
                },
                {
                  value: 'polarized',
                  label: 'Polarized (80/20)',
                  desc: '80% very easy, 20% very hard. Avoid the grey zone.',
                },
                {
                  value: 'balanced',
                  label: 'Balanced Mix',
                  desc: 'Take best ideas from multiple approaches based on what works for me',
                },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTrainingPhilosophy(option.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                    trainingPhilosophy === option.value
                      ? 'bg-dream-600/20 border-dream-500 text-primary'
                      : 'bg-surface-2 border-default text-secondary hover:border-strong'
                  }`}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-tertiary">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-tertiary mb-2">
              Down week / recovery week frequency
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'every_3_weeks', label: 'Every 3 weeks' },
                { value: 'every_4_weeks', label: 'Every 4 weeks' },
                { value: 'as_needed', label: 'As needed (listen to body)' },
                { value: 'rarely', label: 'Rarely (push through)' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setDownWeekFrequency(option.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    downWeekFrequency === option.value
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
            <label className="block text-sm font-medium text-tertiary mb-2">
              Long run approach
            </label>
            <div className="space-y-2">
              {[
                {
                  value: 'traditional',
                  label: 'Traditional (20-22 mi max)',
                  desc: 'Full distance long runs, tapering volume for race',
                },
                {
                  value: 'hansons_style',
                  label: 'Hansons Style (16 mi max)',
                  desc: 'Shorter long runs but higher weekly volume',
                },
                {
                  value: 'progressive',
                  label: 'Progressive focus',
                  desc: 'Start easy, finish at goal pace',
                },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setLongRunMaxStyle(option.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                    longRunMaxStyle === option.value
                      ? 'bg-dream-600/20 border-dream-500 text-primary'
                      : 'bg-surface-2 border-default text-secondary hover:border-strong'
                  }`}
                >
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-tertiary">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-tertiary mb-2">
              When feeling fatigued, I prefer to...
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'back_off', label: 'Back off / rest' },
                { value: 'balanced', label: 'Depends on context' },
                { value: 'push_through', label: 'Push through' },
                { value: 'modify', label: 'Modify (easier version)' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setFatigueManagementStyle(option.value)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    fatigueManagementStyle === option.value
                      ? 'bg-dream-600 text-white'
                      : 'bg-surface-2 text-secondary hover:bg-surface-3'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={mlrPreference}
                  onChange={(e) => setMlrPreference(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-2 peer-focus:ring-2 peer-focus:ring-dream-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-1 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-dream-600"></div>
                <span className="ml-3 text-sm font-medium text-tertiary">
                  Include MLRs (medium-long runs, 11-15mi midweek)
                </span>
              </label>
            </div>
            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={progressiveLongRunsOk}
                  onChange={(e) => setProgressiveLongRunsOk(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-2 peer-focus:ring-2 peer-focus:ring-dream-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-1 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-dream-600"></div>
                <span className="ml-3 text-sm font-medium text-tertiary">
                  Include progressive/cut-down long runs
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <StepNavigation onBack={onBack} onNext={onNext} />
    </div>
  );
}
