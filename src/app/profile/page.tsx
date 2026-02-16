'use client';

import { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import { getSettings, updateProfileFields } from '@/actions/settings';
import { updateProfile, regenerateAuraColors } from '@/actions/profiles';
import { useProfile } from '@/lib/profile-context';
import { searchLocation } from '@/lib/weather';
import { VDOTGauge } from '@/components/VDOTGauge';
import { cn } from '@/lib/utils';
import {
  User, Activity, Target, Gauge, Trophy, Dumbbell, Heart,
  Calendar, MapPin, ChevronDown, ChevronRight, CheckCircle2,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Circle, _Thermometer, Palette, RefreshCw,
} from 'lucide-react';
import {
  daysOfWeek,
  runnerPersonas,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  planAggressivenessOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  trainByOptions,
  surfacePreferenceOptions,
  groupVsSoloOptions,
  sleepQualityOptions,
  stressLevelOptions,
  preferredRunTimeOptions,
  commonInjuryOptions,
  timeSincePeakFitnessOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  trainingPhilosophyOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  downWeekFrequencyOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  longRunMaxStyleOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fatigueManagementStyleOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  workoutVarietyPrefOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  workoutComplexityOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  coachingDetailLevelOptions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  speedworkExperienceOptions,
  type UserSettings,
} from '@/lib/schema';
import {
  trainingPhilosophyDescriptions,
  planAggressivenessDescriptions,
  longRunMaxStyleDescriptions,
  fatigueManagementDescriptions,
  downWeekFrequencyDescriptions,
  trainByDescriptions,
  workoutVarietyDescriptions,
  speedworkExperienceDescriptions,
  workoutComplexityDescriptions,
  coachingDetailLevelDescriptions,
  type OptionDescription,
} from '@/lib/profile-descriptions';

// ─── Helpers ────────────────────────────────────────────────────────────────

const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};

const PERSONA_LABELS: Record<string, string> = {
  newer_runner: 'Newer Runner', busy_runner: 'Busy Runner',
  self_coached: 'Self-Coached', coach_guided: 'Coach-Guided',
  type_a_planner: 'Type-A Planner', data_optimizer: 'Data Optimizer',
  other: 'Other',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _PHILOSOPHY_LABELS: Record<string, string> = {
  pfitzinger: 'Pfitzinger', hansons: 'Hansons', daniels: 'Daniels',
  lydiard: 'Lydiard', polarized: 'Polarized', balanced: 'Balanced', not_sure: 'Not Sure',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _DOWN_WEEK_LABELS: Record<string, string> = {
  every_3_weeks: 'Every 3 weeks', every_4_weeks: 'Every 4 weeks',
  as_needed: 'As needed', rarely: 'Rarely', not_sure: 'Not Sure',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _LONG_RUN_STYLE_LABELS: Record<string, string> = {
  traditional: 'Traditional', hansons_style: 'Hansons-style (shorter)', progressive: 'Progressive', not_sure: 'Not Sure',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _FATIGUE_LABELS: Record<string, string> = {
  back_off: 'Back off', balanced: 'Balanced', push_through: 'Push through', modify: 'Modify workouts', not_sure: 'Not Sure',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _VARIETY_LABELS: Record<string, string> = {
  same: 'Stick to staples', moderate: 'Some variety', lots: 'Lots of variety', not_sure: 'Not Sure',
};

const TIME_SINCE_PEAK_LABELS: Record<string, string> = {
  current: 'At/near peak now', '3_months': '~3 months ago',
  '6_months': '~6 months ago', '1_year': '~1 year ago', '2_plus_years': '2+ years ago',
};

const INJURY_LABELS: Record<string, string> = {
  shin_splints: 'Shin splints', it_band: 'IT band', plantar_fasciitis: 'Plantar fasciitis',
  achilles: 'Achilles', knee: 'Knee', hip: 'Hip', none: 'None',
};

const SLEEP_QUALITY_LABELS: Record<string, string> = {
  poor: 'Poor', fair: 'Fair', good: 'Good', excellent: 'Excellent',
};

const STRESS_LABELS: Record<string, string> = {
  low: 'Low', moderate: 'Moderate', high: 'High', very_high: 'Very High',
};

const RUN_TIME_LABELS: Record<string, string> = {
  early_morning: 'Early AM', morning: 'Morning', midday: 'Midday',
  evening: 'Evening', flexible: 'Flexible',
};

const SURFACE_LABELS: Record<string, string> = {
  road: 'Road', trail: 'Trail', track: 'Track', mixed: 'Mixed',
};

const GROUP_LABELS: Record<string, string> = {
  solo: 'Solo', group: 'Group', either: 'Either',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _TRAIN_BY_LABELS: Record<string, string> = {
  pace: 'Pace', heart_rate: 'Heart Rate', feel: 'Feel', mixed: 'Mixed',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _AGGRESSIVENESS_LABELS: Record<string, string> = {
  conservative: 'Conservative', moderate: 'Moderate', aggressive: 'Aggressive', not_sure: 'Not Sure',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _TRAIN_BY_LABELS_FULL: Record<string, string> = {
  pace: 'Pace', heart_rate: 'Heart Rate', feel: 'Feel / RPE', mixed: 'Mixed', not_sure: 'Not Sure',
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _SPEEDWORK_LABELS: Record<string, string> = {
  none: 'None', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', not_sure: 'Not Sure',
};

function formatPRTime(seconds: number | null): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parsePRTime(value: string): number | null {
  if (!value.trim()) return null;
  const parts = value.split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return null;
}

// ─── Section definitions ────────────────────────────────────────────────────

interface SectionDef {
  id: string;
  title: string;
  icon: React.ElementType;
  fields: (keyof UserSettings)[];
}

const SECTIONS: SectionDef[] = [
  { id: 'basics', title: 'Basics', icon: User, fields: ['name', 'age', 'runnerPersona'] },
  { id: 'training-state', title: 'Training State', icon: Activity, fields: ['currentWeeklyMileage', 'runsPerWeekCurrent', 'currentLongRunMax'] },
  { id: 'goals', title: 'Goals & Approach', icon: Target, fields: ['peakWeeklyMileageTarget', 'qualitySessionsPerWeek', 'planAggressiveness', 'preferredLongRunDay', 'requiredRestDays', 'trainingPhilosophies', 'downWeekFrequency', 'longRunMaxStyle', 'fatigueManagementStyle', 'workoutVarietyPref'] },
  { id: 'pace', title: 'Pace Zones', icon: Gauge, fields: ['vdot'] },
  { id: 'prs', title: 'Race PRs', icon: Trophy, fields: ['marathonPR', 'halfMarathonPR', 'tenKPR', 'fiveKPR'] },
  { id: 'background', title: 'Athletic Background', icon: Dumbbell, fields: ['yearsRunning', 'athleticBackground', 'highestWeeklyMileageEver', 'timeSincePeakFitness', 'speedworkExperience'] },
  { id: 'preferences', title: 'Workout Preferences', icon: Activity, fields: ['preferredQualityDays', 'comfortVO2max', 'comfortTempo', 'comfortHills', 'comfortLongRuns', 'comfortTrackWork', 'openToDoubles', 'mlrPreference', 'progressiveLongRunsOk', 'trainBy', 'workoutComplexity', 'coachingDetailLevel'] },
  { id: 'injury', title: 'Injury & Recovery', icon: Heart, fields: ['commonInjuries', 'currentInjuries', 'needsExtraRest', 'typicalSleepHours', 'sleepQuality', 'stressLevel'] },
  { id: 'schedule', title: 'Schedule', icon: Calendar, fields: ['preferredRunTime', 'defaultRunTimeHour', 'weekdayAvailabilityMinutes', 'weekendAvailabilityMinutes', 'surfacePreference', 'groupVsSolo'] },
  { id: 'environment', title: 'Environment', icon: MapPin, fields: ['cityName', 'heatAcclimatizationScore', 'heatSensitivity', 'coldSensitivity', 'temperaturePreferenceScale'] },
];

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { activeProfile } = useProfile();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_isPending, startTransition] = useTransition();

  // Location search state
  const [locationSearch, setLocationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    name: string; latitude: number; longitude: number; country: string; admin1?: string;
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load settings
  useEffect(() => {
    getSettings(activeProfile?.id).then((s) => {
      if (s) {
        setSettings(s);
        // Open incomplete sections by default
        const incomplete = new Set<string>();
        SECTIONS.forEach((section) => {
          const completion = getSectionCompletion(section, s);
          if (completion < 100) incomplete.add(section.id);
        });
        // If all complete, open basics by default
        if (incomplete.size === 0) incomplete.add('basics');
        setOpenSections(incomplete);
      }
    });
  }, [activeProfile?.id]);

  // Debounced save
  const saveFields = useCallback((fields: Partial<UserSettings>) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSaving(true);
      startTransition(async () => {
        await updateProfileFields(fields, activeProfile?.id);
        setSaving(false);
        setLastSaved(new Date().toLocaleTimeString());
        setTimeout(() => setLastSaved(null), 2000);
      });
    }, 500);
  }, [activeProfile?.id, startTransition]);

  // Update a field locally + trigger save
  const updateField = useCallback(<K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings(prev => {
      if (!prev) return prev;
      const updated = { ...prev, [key]: value };
      saveFields({ [key]: value } as Partial<UserSettings>);
      return updated;
    });
  }, [saveFields]);

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (!settings) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-surface-2 rounded w-48" />
        <div className="h-4 bg-surface-2 rounded w-64" />
        {[1, 2, 3].map(i => <div key={i} className="h-20 bg-surface-2 rounded-xl" />)}
      </div>
    );
  }

  const overallCompletion = getOverallCompletion(settings);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-semibold text-primary">Runner Profile</h1>
          <p className="text-sm text-textTertiary mt-1">
            {saving ? 'Saving...' : lastSaved ? `Saved` : 'Changes auto-save'}
          </p>
        </div>
      </div>

      {/* Overall completion bar */}
      <div className="bg-surface-1 rounded-xl border border-default p-4 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-primary">Profile Completion</span>
          <span className="text-sm font-bold text-accentTeal">{overallCompletion}%</span>
        </div>
        <div className="w-full bg-surface-2 border border-default rounded-full h-2.5">
          <div
            className="bg-accentTeal h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${overallCompletion}%` }}
          />
        </div>
      </div>

      {/* Aura Color */}
      <AuraColorSection profileId={activeProfile?.id} />

      {/* Sections */}
      <div className="space-y-3">
        {SECTIONS.map((section) => {
          const isOpen = openSections.has(section.id);
          const completion = getSectionCompletion(section, settings);
          const Icon = section.icon;

          return (
            <div key={section.id} className="bg-surface-1 rounded-xl border border-default shadow-sm overflow-hidden">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-surface-2/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-accentTeal" />
                  <span className="font-semibold text-primary">{section.title}</span>
                  {completion === 100 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : (
                    <span className="text-xs text-tertiary bg-surface-2 border border-default px-2 py-0.5 rounded-full">
                      {completion}%
                    </span>
                  )}
                </div>
                {isOpen ? (
                  <ChevronDown className="w-5 h-5 text-textTertiary" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-textTertiary" />
                )}
              </button>

              {/* Section content */}
              {isOpen && (
                <div className="px-4 pb-4 pt-0 border-t border-subtle">
                  <div className="pt-4">
                    {renderSection(section.id, settings, updateField, {
                      locationSearch, setLocationSearch, searchResults,
                      setSearchResults, isSearching, setIsSearching,
                      startTransition, activeProfile,
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Section completion helpers ─────────────────────────────────────────────

function getSectionCompletion(section: SectionDef, s: UserSettings): number {
  if (section.id === 'pace') return s.vdot ? 100 : 0;
  let filled = 0;
  const total = section.fields.length;
  section.fields.forEach((f) => {
    const val = (s as Record<string, unknown>)[f];
    if (val !== null && val !== undefined && val !== '' && val !== '[]') filled++;
  });
  return total === 0 ? 100 : Math.round((filled / total) * 100);
}

function getOverallCompletion(s: UserSettings): number {
  let filled = 0;
  let total = 0;
  SECTIONS.forEach((section) => {
    section.fields.forEach((f) => {
      total++;
      const val = (s as Record<string, unknown>)[f];
      if (val !== null && val !== undefined && val !== '' && val !== '[]') filled++;
    });
  });
  return total === 0 ? 100 : Math.round((filled / total) * 100);
}

// ─── Reusable input components ──────────────────────────────────────────────

function ChipSelector<T extends string>({
  label, options, value, onChange, labels,
}: {
  label: string; options: readonly T[]; value: T | null | undefined;
  onChange: (v: T) => void; labels?: Record<string, string>;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-secondary mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border',
              value === opt
                ? 'bg-accentTeal text-white border-accentTeal'
                : 'bg-surface-2 text-secondary border-default hover:border-strong hover:text-primary'
            )}
          >
            {labels?.[opt] ?? opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiChipSelector<T extends string>({
  label, options, value, onChange, labels,
}: {
  label: string; options: readonly T[]; value: T[];
  onChange: (v: T[]) => void; labels?: Record<string, string>;
}) {
  const toggle = (opt: T) => {
    if (value.includes(opt)) onChange(value.filter(v => v !== opt));
    else onChange([...value, opt]);
  };
  return (
    <div>
      <label className="block text-sm font-medium text-secondary mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border',
              value.includes(opt)
                ? 'bg-accentTeal text-white border-accentTeal'
                : 'bg-surface-2 text-secondary border-default hover:border-strong hover:text-primary'
            )}
          >
            {labels?.[opt] ?? opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function SliderInput({
  label, value, onChange, min, max, step = 1, suffix = '', description,
}: {
  label: string; value: number | null | undefined; onChange: (v: number) => void;
  min: number; max: number; step?: number; suffix?: string; description?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-sm font-medium text-secondary">{label}</label>
        <span className="text-sm font-bold text-primary">
          {value ?? '—'}{value != null ? suffix : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value ?? min}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-surface-2 border border-default rounded-lg appearance-none cursor-pointer accent-accentTeal
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accentTeal [&::-webkit-slider-thumb]:cursor-pointer
          [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
          [&::-moz-range-thumb]:bg-accentTeal [&::-moz-range-thumb]:cursor-pointer"
      />
      {description && <p className="text-xs text-textTertiary mt-1">{description}</p>}
    </div>
  );
}

function ComfortScale({
  label, value, onChange,
}: {
  label: string; value: number | null | undefined; onChange: (v: number) => void;
}) {
  const labels = ['1', '2', '3', '4', '5'];
  const levels = ['Uncomfortable', 'Cautious', 'Neutral', 'Comfortable', 'Love it'];
  return (
    <div>
      <label className="text-sm font-medium text-secondary mb-2 block">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg transition-all text-center border',
              value === n
                ? 'bg-accentTeal/20 border-accentTeal ring-1 ring-accentTeal/30'
                : 'bg-surface-2 border-default hover:border-strong'
            )}
          >
            <span className="text-lg font-bold">{labels[n - 1]}</span>
            <span className="text-[10px] text-textTertiary leading-tight">{levels[n - 1]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ToggleSwitch({
  label, value, onChange, description,
}: {
  label: string; value: boolean | null | undefined; onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-sm font-medium text-secondary">{label}</span>
        {description && <p className="text-xs text-textTertiary">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={cn(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors border',
          value ? 'bg-accentTeal border-accentTeal' : 'bg-surface-2 border-strong'
        )}
      >
        <span className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          value ? 'translate-x-6' : 'translate-x-1'
        )} />
      </button>
    </div>
  );
}

function DescriptiveChipSelector<T extends string>({
  label, descriptions, value, onChange,
}: {
  label: string; descriptions: OptionDescription[]; value: T | null | undefined;
  onChange: (v: T) => void;
}) {
  const selected = descriptions.find(d => d.value === value);
  return (
    <div>
      <label className="block text-sm font-medium text-secondary mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {descriptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value as T)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border',
              value === opt.value
                ? 'bg-accentTeal text-white border-accentTeal'
                : 'bg-surface-2 text-secondary border-default hover:border-strong hover:text-primary'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {selected && (
        <div className="mt-2 px-3 py-2 rounded-lg bg-accentTeal/10 border border-accentTeal/20">
          <p className="text-xs text-secondary">{selected.shortDesc}</p>
          {selected.longDesc && (
            <p className="text-xs text-tertiary mt-1">{selected.longDesc}</p>
          )}
        </div>
      )}
    </div>
  );
}

function DescriptiveMultiChipSelector<T extends string>({
  label, descriptions, value, onChange,
}: {
  label: string; descriptions: OptionDescription[]; value: T[];
  onChange: (v: T[]) => void;
}) {
  const toggle = (opt: T) => {
    if (opt === 'not_sure' as T) {
      onChange(value.includes(opt) ? [] : [opt]);
    } else {
      const withoutNotSure = value.filter(v => v !== ('not_sure' as T));
      if (withoutNotSure.includes(opt)) {
        onChange(withoutNotSure.filter(v => v !== opt));
      } else {
        onChange([...withoutNotSure, opt]);
      }
    }
  };

  const selectedDescs = descriptions.filter(d => value.includes(d.value as T));

  return (
    <div>
      <label className="block text-sm font-medium text-secondary mb-1">{label}</label>
      <p className="text-xs text-tertiary mb-2">Select one or more</p>
      <div className="flex flex-wrap gap-2">
        {descriptions.map((opt) => {
          const isSelected = value.includes(opt.value as T);
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggle(opt.value as T)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors border',
                isSelected
                  ? 'bg-accentTeal text-white border-accentTeal'
                  : 'bg-surface-2 text-secondary border-default hover:border-strong hover:text-primary'
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {selectedDescs.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {selectedDescs.map(d => (
            <div key={d.value} className="px-3 py-2 rounded-lg bg-accentTeal/10 border border-accentTeal/20">
              <p className="text-xs font-medium text-accentTeal">{d.label}</p>
              <p className="text-xs text-secondary">{d.shortDesc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Section Renderers ──────────────────────────────────────────────────────

interface SectionContext {
  locationSearch: string;
  setLocationSearch: (v: string) => void;
  searchResults: Array<{ name: string; latitude: number; longitude: number; country: string; admin1?: string }>;
  setSearchResults: (v: Array<{ name: string; latitude: number; longitude: number; country: string; admin1?: string }>) => void;
  isSearching: boolean;
  setIsSearching: (v: boolean) => void;
  startTransition: (fn: () => void) => void;
  activeProfile: { id: number } | null | undefined;
}

function renderSection(
  sectionId: string,
  s: UserSettings,
  update: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void,
  ctx: SectionContext,
) {
  switch (sectionId) {
    case 'basics': return <BasicsSection s={s} update={update} />;
    case 'training-state': return <TrainingStateSection s={s} update={update} />;
    case 'goals': return <GoalsSection s={s} update={update} />;
    case 'pace': return <PaceSection s={s} />;
    case 'prs': return <PRsSection s={s} update={update} />;
    case 'background': return <BackgroundSection s={s} update={update} />;
    case 'preferences': return <PreferencesSection s={s} update={update} />;
    case 'injury': return <InjurySection s={s} update={update} />;
    case 'schedule': return <ScheduleSection s={s} update={update} />;
    case 'environment': return <EnvironmentSection s={s} update={update} ctx={ctx} />;
    default: return null;
  }
}

// ─── Individual Sections ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BasicsSection({ s, update }: { s: UserSettings; update: (k: keyof UserSettings, v: any) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">Name</label>
        <input
          type="text"
          value={s.name || ''}
          onChange={(e) => update('name', e.target.value)}
          placeholder="Your name"
          className="w-full px-3 py-2 bg-surface-1 text-primary border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">Age</label>
        <input
          type="number"
          value={s.age ?? ''}
          onChange={(e) => update('age', e.target.value ? parseInt(e.target.value) : null)}
          placeholder="e.g., 35"
          min={10} max={100}
          className="w-full max-w-[120px] px-3 py-2 bg-surface-1 text-primary border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
        />
      </div>
      <ChipSelector
        label="Runner Type"
        options={runnerPersonas}
        value={s.runnerPersona}
        onChange={(v) => update('runnerPersona', v)}
        labels={PERSONA_LABELS}
      />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TrainingStateSection({ s, update }: { s: UserSettings; update: (k: keyof UserSettings, v: any) => void }) {
  return (
    <div className="space-y-4">
      <SliderInput
        label="Current Weekly Mileage"
        value={s.currentWeeklyMileage}
        onChange={(v) => update('currentWeeklyMileage', v)}
        min={0} max={120} suffix=" mi"
      />
      <SliderInput
        label="Runs Per Week"
        value={s.runsPerWeekCurrent}
        onChange={(v) => update('runsPerWeekCurrent', v)}
        min={1} max={14}
      />
      <SliderInput
        label="Current Long Run Max"
        value={s.currentLongRunMax}
        onChange={(v) => update('currentLongRunMax', v)}
        min={3} max={30} suffix=" mi"
      />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function GoalsSection({ s, update }: { s: UserSettings; update: (k: keyof UserSettings, v: any) => void }) {
  const restDays: string[] = s.requiredRestDays ? JSON.parse(s.requiredRestDays) : [];

  // Multi-select training philosophies: read from trainingPhilosophies (JSON array),
  // fall back to old trainingPhilosophy (single value)
  const philosophies: string[] = s.trainingPhilosophies
    ? JSON.parse(s.trainingPhilosophies)
    : s.trainingPhilosophy ? [s.trainingPhilosophy] : [];

  return (
    <div className="space-y-5">
      <SliderInput
        label="Peak Weekly Mileage Target"
        value={s.peakWeeklyMileageTarget}
        onChange={(v) => update('peakWeeklyMileageTarget', v)}
        min={10} max={150} suffix=" mi"
      />
      <SliderInput
        label="Quality Sessions Per Week"
        value={s.qualitySessionsPerWeek}
        onChange={(v) => update('qualitySessionsPerWeek', v)}
        min={0} max={4}
      />
      <DescriptiveChipSelector
        label="Plan Aggressiveness"
        descriptions={planAggressivenessDescriptions}
        value={s.planAggressiveness}
        onChange={(v) => update('planAggressiveness', v)}
      />
      <ChipSelector
        label="Preferred Long Run Day"
        options={daysOfWeek}
        value={s.preferredLongRunDay}
        onChange={(v) => update('preferredLongRunDay', v)}
        labels={DAY_LABELS}
      />
      <MultiChipSelector
        label="Rest Days"
        options={daysOfWeek}
        value={restDays as typeof daysOfWeek[number][]}
        onChange={(v) => update('requiredRestDays', JSON.stringify(v))}
        labels={DAY_LABELS}
      />
      <DescriptiveMultiChipSelector
        label="Training Philosophy"
        descriptions={trainingPhilosophyDescriptions}
        value={philosophies}
        onChange={(v) => update('trainingPhilosophies', JSON.stringify(v))}
      />
      <DescriptiveChipSelector
        label="Down Week Frequency"
        descriptions={downWeekFrequencyDescriptions}
        value={s.downWeekFrequency}
        onChange={(v) => update('downWeekFrequency', v)}
      />
      <DescriptiveChipSelector
        label="Long Run Style"
        descriptions={longRunMaxStyleDescriptions}
        value={s.longRunMaxStyle}
        onChange={(v) => update('longRunMaxStyle', v)}
      />
      <DescriptiveChipSelector
        label="Fatigue Management"
        descriptions={fatigueManagementDescriptions}
        value={s.fatigueManagementStyle}
        onChange={(v) => update('fatigueManagementStyle', v)}
      />
      <DescriptiveChipSelector
        label="Workout Variety"
        descriptions={workoutVarietyDescriptions}
        value={s.workoutVarietyPref}
        onChange={(v) => update('workoutVarietyPref', v)}
      />
    </div>
  );
}

function PaceSection({ s }: { s: UserSettings }) {
  return (
    <div>
      <VDOTGauge
        vdot={s.vdot ?? null}
        easyPaceSeconds={s.easyPaceSeconds ?? null}
        tempoPaceSeconds={s.tempoPaceSeconds ?? null}
        thresholdPaceSeconds={s.thresholdPaceSeconds ?? null}
        intervalPaceSeconds={s.intervalPaceSeconds ?? null}
        marathonPaceSeconds={s.marathonPaceSeconds ?? null}
        halfMarathonPaceSeconds={s.halfMarathonPaceSeconds ?? null}
      />
      <p className="text-xs text-textTertiary mt-3">
        VDOT and pace zones are calculated from your race results. Log a race result via Coach to update.
      </p>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PRsSection({ s, update }: { s: UserSettings; update: (k: keyof UserSettings, v: any) => void }) {
  const PRInput = ({ label, field }: { label: string; field: keyof UserSettings }) => {
    const val = (s as Record<string, unknown>)[field] as number | null;
    const [text, setText] = useState(formatPRTime(val));

    useEffect(() => {
      setText(formatPRTime(val));
    }, [val]);

    return (
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">{label}</label>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const seconds = parsePRTime(text);
            update(field, seconds);
          }}
          placeholder={field === 'marathonPR' || field === 'halfMarathonPR' ? 'H:MM:SS' : 'MM:SS'}
          className="w-full max-w-[160px] px-3 py-2 bg-surface-1 text-primary border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500 font-mono"
        />
      </div>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      <PRInput label="Marathon" field="marathonPR" />
      <PRInput label="Half Marathon" field="halfMarathonPR" />
      <PRInput label="10K" field="tenKPR" />
      <PRInput label="5K" field="fiveKPR" />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BackgroundSection({ s, update }: { s: UserSettings; update: (k: keyof UserSettings, v: any) => void }) {
  return (
    <div className="space-y-4">
      <SliderInput
        label="Years Running"
        value={s.yearsRunning}
        onChange={(v) => update('yearsRunning', v)}
        min={0} max={40} step={0.5}
      />
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">Athletic Background</label>
        <input
          type="text"
          value={s.athleticBackground || ''}
          onChange={(e) => update('athleticBackground', e.target.value)}
          placeholder="e.g., Former soccer player, did track in college"
          className="w-full px-3 py-2 bg-surface-1 text-primary border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
        />
      </div>
      <SliderInput
        label="Highest Weekly Mileage Ever"
        value={s.highestWeeklyMileageEver}
        onChange={(v) => update('highestWeeklyMileageEver', v)}
        min={0} max={150} suffix=" mi"
      />
      <ChipSelector
        label="Time Since Peak Fitness"
        options={timeSincePeakFitnessOptions}
        value={s.timeSincePeakFitness}
        onChange={(v) => update('timeSincePeakFitness', v)}
        labels={TIME_SINCE_PEAK_LABELS}
      />
      <DescriptiveChipSelector
        label="Speed Work Experience"
        descriptions={speedworkExperienceDescriptions}
        value={s.speedworkExperience}
        onChange={(v) => update('speedworkExperience', v)}
      />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PreferencesSection({ s, update }: { s: UserSettings; update: (k: keyof UserSettings, v: any) => void }) {
  const qualityDays: string[] = s.preferredQualityDays ? JSON.parse(s.preferredQualityDays) : [];

  return (
    <div className="space-y-5">
      <MultiChipSelector
        label="Preferred Quality Days"
        options={daysOfWeek}
        value={qualityDays as typeof daysOfWeek[number][]}
        onChange={(v) => update('preferredQualityDays', JSON.stringify(v))}
        labels={DAY_LABELS}
      />
      <div className="space-y-3">
        <p className="text-sm font-medium text-secondary">Comfort Levels</p>
        <ComfortScale label="VO2max / Intervals" value={s.comfortVO2max} onChange={(v) => update('comfortVO2max', v)} />
        <ComfortScale label="Tempo" value={s.comfortTempo} onChange={(v) => update('comfortTempo', v)} />
        <ComfortScale label="Hills" value={s.comfortHills} onChange={(v) => update('comfortHills', v)} />
        <ComfortScale label="Long Runs" value={s.comfortLongRuns} onChange={(v) => update('comfortLongRuns', v)} />
        <ComfortScale label="Track Work" value={s.comfortTrackWork} onChange={(v) => update('comfortTrackWork', v)} />
      </div>
      <ToggleSwitch
        label="Open to Doubles"
        value={s.openToDoubles}
        onChange={(v) => update('openToDoubles', v)}
        description="Willing to run twice in a day when appropriate"
      />
      <ToggleSwitch
        label="Mid-Long Runs"
        value={s.mlrPreference}
        onChange={(v) => update('mlrPreference', v)}
        description="Mid-long runs on a weekday (a Pfitzinger staple)"
      />
      <ToggleSwitch
        label="Progressive Long Runs"
        value={s.progressiveLongRunsOk}
        onChange={(v) => update('progressiveLongRunsOk', v)}
        description="Long runs that finish at marathon pace or faster"
      />
      <DescriptiveChipSelector
        label="Train By"
        descriptions={trainByDescriptions}
        value={s.trainBy}
        onChange={(v) => update('trainBy', v)}
      />
      <DescriptiveChipSelector
        label="Workout Complexity"
        descriptions={workoutComplexityDescriptions}
        value={s.workoutComplexity}
        onChange={(v) => update('workoutComplexity', v)}
      />
      <DescriptiveChipSelector
        label="Coaching Detail Level"
        descriptions={coachingDetailLevelDescriptions}
        value={s.coachingDetailLevel}
        onChange={(v) => update('coachingDetailLevel', v)}
      />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function InjurySection({ s, update }: { s: UserSettings; update: (k: keyof UserSettings, v: any) => void }) {
  const injuries: string[] = s.commonInjuries ? JSON.parse(s.commonInjuries) : [];

  return (
    <div className="space-y-4">
      <MultiChipSelector
        label="Common Injuries"
        options={commonInjuryOptions}
        value={injuries as typeof commonInjuryOptions[number][]}
        onChange={(v) => update('commonInjuries', JSON.stringify(v))}
        labels={INJURY_LABELS}
      />
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">Current Injuries / Niggles</label>
        <textarea
          value={s.currentInjuries || ''}
          onChange={(e) => update('currentInjuries', e.target.value)}
          placeholder="Describe any current aches, pains, or areas to watch..."
          rows={2}
          className="w-full px-3 py-2 bg-surface-1 text-primary border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500 resize-none"
        />
      </div>
      <ToggleSwitch
        label="Needs Extra Rest"
        value={s.needsExtraRest}
        onChange={(v) => update('needsExtraRest', v)}
        description="Tend to need more recovery between hard efforts"
      />
      <SliderInput
        label="Typical Sleep"
        value={s.typicalSleepHours}
        onChange={(v) => update('typicalSleepHours', v)}
        min={4} max={10} step={0.5} suffix=" hrs"
      />
      <ChipSelector
        label="Sleep Quality"
        options={sleepQualityOptions}
        value={s.sleepQuality}
        onChange={(v) => update('sleepQuality', v)}
        labels={SLEEP_QUALITY_LABELS}
      />
      <ChipSelector
        label="Stress Level"
        options={stressLevelOptions}
        value={s.stressLevel}
        onChange={(v) => update('stressLevel', v)}
        labels={STRESS_LABELS}
      />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ScheduleSection({ s, update }: { s: UserSettings; update: (k: keyof UserSettings, v: any) => void }) {
  const formatTime = (h: number, m: number) => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  return (
    <div className="space-y-4">
      <ChipSelector
        label="Preferred Run Time"
        options={preferredRunTimeOptions}
        value={s.preferredRunTime}
        onChange={(v) => update('preferredRunTime', v)}
        labels={RUN_TIME_LABELS}
      />
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-secondary">Typical Run Time</label>
          <span className="text-sm font-bold text-primary">
            {formatTime(s.defaultRunTimeHour ?? 7, s.defaultRunTimeMinute ?? 0)}
          </span>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-textTertiary">Hour</label>
            <input
              type="range" min={0} max={23}
              value={s.defaultRunTimeHour ?? 7}
              onChange={(e) => update('defaultRunTimeHour', Number(e.target.value))}
              className="w-full h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-accentTeal
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accentTeal [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>
          <div className="w-24">
            <label className="text-xs text-textTertiary">Minute</label>
            <input
              type="range" min={0} max={55} step={5}
              value={s.defaultRunTimeMinute ?? 0}
              onChange={(e) => update('defaultRunTimeMinute', Number(e.target.value))}
              className="w-full h-2 bg-surface-2 rounded-lg appearance-none cursor-pointer accent-accentTeal
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accentTeal [&::-webkit-slider-thumb]:cursor-pointer"
            />
          </div>
        </div>
        <p className="text-xs text-textTertiary mt-1">Used for weather forecasts and outfit recommendations</p>
      </div>
      <SliderInput
        label="Weekday Availability"
        value={s.weekdayAvailabilityMinutes}
        onChange={(v) => update('weekdayAvailabilityMinutes', v)}
        min={20} max={180} step={5} suffix=" min"
      />
      <SliderInput
        label="Weekend Availability"
        value={s.weekendAvailabilityMinutes}
        onChange={(v) => update('weekendAvailabilityMinutes', v)}
        min={30} max={300} step={10} suffix=" min"
      />
      <ChipSelector
        label="Surface Preference"
        options={surfacePreferenceOptions}
        value={s.surfacePreference}
        onChange={(v) => update('surfacePreference', v)}
        labels={SURFACE_LABELS}
      />
      <ChipSelector
        label="Group vs Solo"
        options={groupVsSoloOptions}
        value={s.groupVsSolo}
        onChange={(v) => update('groupVsSolo', v)}
        labels={GROUP_LABELS}
      />
    </div>
  );
}

function AuraColorSection({ profileId }: { profileId?: number }) {
  const { activeProfile, refreshProfiles } = useProfile();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [startColor, setStartColor] = useState(activeProfile?.auraColorStart || '');
  const [endColor, setEndColor] = useState(activeProfile?.auraColorEnd || '');

  useEffect(() => {
    setStartColor(activeProfile?.auraColorStart || '');
    setEndColor(activeProfile?.auraColorEnd || '');
  }, [activeProfile?.auraColorStart, activeProfile?.auraColorEnd]);

  const hasAura = !!(startColor && endColor);

  const handleRegenerate = async () => {
    if (!profileId) return;
    setIsRegenerating(true);
    const aura = await regenerateAuraColors(profileId);
    if (aura) {
      setStartColor(aura.start);
      setEndColor(aura.end);
      refreshProfiles();
    }
    setIsRegenerating(false);
  };

  const handleColorChange = async (which: 'start' | 'end', value: string) => {
    if (!profileId) return;
    if (which === 'start') setStartColor(value);
    else setEndColor(value);

    await updateProfile(profileId, {
      ...(which === 'start' ? { auraColorStart: value } : { auraColorEnd: value }),
    });
    refreshProfiles();
  };

  return (
    <div className="bg-surface-1 rounded-xl border border-default p-4 mb-3 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <Palette className="w-5 h-5 text-accentTeal" />
        <span className="font-semibold text-primary">Your Aura</span>
      </div>

      {/* Aura preview */}
      <div className="flex items-center gap-4 mb-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center shadow-md"
          style={hasAura
            ? { background: `linear-gradient(135deg, ${startColor}, ${endColor})` }
            : { backgroundColor: activeProfile?.avatarColor || '#3b82f6' }
          }
        >
          <User className="w-7 h-7 text-white" />
        </div>
        <div className="flex-1">
          {hasAura ? (
            <p className="text-sm text-secondary">Your personal gradient, generated from your runner profile.</p>
          ) : (
            <p className="text-sm text-tertiary">No aura yet. Generate one from your profile data or pick custom colors.</p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-accentTeal/10 text-accentTeal border border-accentTeal/30 hover:bg-accentTeal/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', isRegenerating && 'animate-spin')} />
          {isRegenerating ? 'Generating...' : hasAura ? 'Regenerate' : 'Generate Aura'}
        </button>

        {/* Color pickers */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-tertiary">Start</label>
          <input
            type="color"
            value={startColor || '#3b82f6'}
            onChange={(e) => handleColorChange('start', e.target.value)}
            className="w-8 h-8 rounded-lg border border-default cursor-pointer bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-tertiary">End</label>
          <input
            type="color"
            value={endColor || '#8b5cf6'}
            onChange={(e) => handleColorChange('end', e.target.value)}
            className="w-8 h-8 rounded-lg border border-default cursor-pointer bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
          />
        </div>

        {/* View aura page link - temporarily hidden */}
      </div>
    </div>
  );
}

function EnvironmentSection({ s, update, ctx }: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  s: UserSettings; update: (k: keyof UserSettings, v: any) => void; ctx: SectionContext;
}) {
  const handleLocationSearch = async () => {
    if (!ctx.locationSearch.trim()) return;
    ctx.setIsSearching(true);
    const results = await searchLocation(ctx.locationSearch);
    ctx.setSearchResults(results);
    ctx.setIsSearching(false);
  };

  const handleSelectLocation = (result: typeof ctx.searchResults[0]) => {
    ctx.startTransition(async () => {
      const displayName = result.admin1
        ? `${result.name}, ${result.admin1}`
        : `${result.name}, ${result.country}`;
      await updateProfileFields({
        latitude: result.latitude,
        longitude: result.longitude,
        cityName: displayName,
      }, ctx.activeProfile?.id);
      // Update local state
      update('cityName', displayName);
      update('latitude', result.latitude);
      update('longitude', result.longitude);
      ctx.setSearchResults([]);
      ctx.setLocationSearch('');
    });
  };

  return (
    <div className="space-y-4">
      {/* Current location */}
      {s.cityName ? (
        <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">Location: {s.cityName}</p>
        </div>
      ) : (
        <div className="p-3 bg-surface-2 rounded-lg">
          <p className="text-sm text-textSecondary">No location set</p>
        </div>
      )}

      {/* Location search */}
      <div>
        <label className="block text-sm font-medium text-secondary mb-2">Change Location</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={ctx.locationSearch}
            onChange={(e) => ctx.setLocationSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
            placeholder="Search city..."
            className="flex-1 px-3 py-2 bg-surface-1 text-primary border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
          />
          <button
            type="button"
            onClick={handleLocationSearch}
            disabled={ctx.isSearching}
            className="btn-primary rounded-xl text-sm"
          >
            {ctx.isSearching ? '...' : 'Search'}
          </button>
        </div>
      </div>

      {ctx.searchResults.length > 0 && (
        <div className="border border-default rounded-lg divide-y divide-border-subtle">
          {ctx.searchResults.map((result, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelectLocation(result)}
              className="w-full px-3 py-2 text-left hover:bg-bgTertiary transition-colors text-sm"
            >
              <span className="font-medium text-primary">{result.name}</span>
              <span className="text-textTertiary ml-1">
                {result.admin1 ? `${result.admin1}, ` : ''}{result.country}
              </span>
            </button>
          ))}
        </div>
      )}

      <SliderInput
        label="Heat Acclimatization"
        value={s.heatAcclimatizationScore}
        onChange={(v) => update('heatAcclimatizationScore', v)}
        min={0} max={100} suffix="%"
        description="0 = not acclimatized, 100 = fully acclimatized to heat"
      />
      <SliderInput
        label="Heat Sensitivity"
        value={s.heatSensitivity}
        onChange={(v) => update('heatSensitivity', v)}
        min={1} max={5}
        description="1 = heat doesn't bother me, 5 = very sensitive"
      />
      <SliderInput
        label="Cold Sensitivity"
        value={s.coldSensitivity}
        onChange={(v) => update('coldSensitivity', v)}
        min={1} max={5}
        description="1 = cold doesn't bother me, 5 = very sensitive"
      />
      <SliderInput
        label="Temperature Preference"
        value={s.temperaturePreferenceScale}
        onChange={(v) => update('temperaturePreferenceScale', v)}
        min={1} max={9}
        description="1 = run cold (dress warmer), 5 = neutral, 9 = run hot (dress lighter)"
      />
    </div>
  );
}
