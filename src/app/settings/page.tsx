'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import {
  getSettings,
  createOrUpdateSettings,
  updateLocation,
  updateAcclimatization,
  updateDefaultPace,
  updateTemperaturePreferenceScale,
  updateDefaultRunTime,
  updateCoachSettings,
  updateAISettings,
  updateAPIKeys,
} from '@/actions/settings';
import { useProfile } from '@/lib/profile-context';
import { searchLocation } from '@/lib/weather';
import { calculateAcclimatizationScore } from '@/lib/conditions';
import { daysOfWeek, coachPersonas, aiProviders, claudeModels, openaiModels, type CoachPersona, type AIProvider, type ClaudeModel, type OpenAIModel } from '@/lib/schema';
import { getAllPersonas } from '@/lib/coach-personas';
import { getModelDisplayName, getModelDescription } from '@/lib/ai';
import { cn } from '@/lib/utils';
import { MapPin, Thermometer, Timer, Shirt, Clock, Database, Trash2, Download, Smartphone, Calendar, User, RefreshCcw, RefreshCw, Sparkles, Link as LinkIcon, Brain, ExternalLink } from 'lucide-react';
import { loadSampleData, clearDemoData } from '@/actions/demo-data';
import { resetAllTrainingPlans } from '@/actions/training-plan';
import { VDOTGauge } from '@/components/VDOTGauge';
import { usePWA } from '@/components/PWAProvider';
import { ConfirmModal } from '@/components/ConfirmModal';
import { IntervalsConnect } from '@/components/IntervalsConnect';

export default function SettingsPage() {
  const { activeProfile } = useProfile();
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState<string>('');
  const [preferredLongRunDay, setPreferredLongRunDay] = useState<string>('');
  const [preferredWorkoutDays, setPreferredWorkoutDays] = useState<string[]>([]);
  const [weeklyVolumeTarget, setWeeklyVolumeTarget] = useState<string>('');

  // Location state
  const [cityName, setCityName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    admin1?: string;
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Heat acclimatization state
  const [acclimatizationScore, setAcclimatizationScore] = useState(50);
  const [warmRuns, setWarmRuns] = useState<'0' | '1-2' | '3-5' | '6+'>('1-2');
  const [heatLimited, setHeatLimited] = useState<'rarely' | 'sometimes' | 'often' | 'always'>('sometimes');
  const [deliberateHeatTraining, setDeliberateHeatTraining] = useState(false);

  // Default pace state
  const [defaultPaceMinutes, setDefaultPaceMinutes] = useState('');
  const [defaultPaceSeconds, setDefaultPaceSeconds] = useState('');

  // Temperature preference state (1-9 scale)
  const [temperaturePreferenceScale, setTemperaturePreferenceScale] = useState(5);
  const [tempPrefSaved, setTempPrefSaved] = useState(false);

  // Default run times state
  const [defaultRunTimeHour, setDefaultRunTimeHour] = useState(7);
  const [defaultRunTimeMinute, setDefaultRunTimeMinute] = useState(0);
  const [runTimeSaved, setRunTimeSaved] = useState(false);

  // Demo data state
  const [demoDataLoading, setDemoDataLoading] = useState(false);
  const [demoDataMessage, setDemoDataMessage] = useState('');

  // Training plan reset state
  const [planResetLoading, setPlanResetLoading] = useState(false);
  const [planResetMessage, setPlanResetMessage] = useState('');

  // Confirmation modal state
  const [showClearDemoConfirm, setShowClearDemoConfirm] = useState(false);
  const [showResetPlanConfirm, setShowResetPlanConfirm] = useState(false);

  // Coach personalization state
  const [coachName, setCoachName] = useState('Coach');
  const [coachColor, setCoachColor] = useState('blue');
  const [coachPersona, setCoachPersona] = useState<CoachPersona>('encouraging');
  const [coachSaved, setCoachSaved] = useState(false);
  const personas = getAllPersonas();

  // AI Provider state
  const [aiProvider, setAiProvider] = useState<AIProvider>('claude');
  const [claudeModel, setClaudeModel] = useState<ClaudeModel>('claude-sonnet-4-20250514');
  const [openaiModel, setOpenaiModel] = useState<OpenAIModel>('gpt-5.2');
  const [aiSaved, setAiSaved] = useState(false);

  // API Keys state
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [apiKeysSaved, setApiKeysSaved] = useState(false);

  // PWA state
  const { isInstallable, isInstalled, installApp } = usePWA();

  // VDOT and pace zones state
  const [vdot, setVdot] = useState<number | null>(null);
  const [easyPaceSeconds, setEasyPaceSeconds] = useState<number | null>(null);
  const [tempoPaceSeconds, setTempoPaceSeconds] = useState<number | null>(null);
  const [thresholdPaceSeconds, setThresholdPaceSeconds] = useState<number | null>(null);
  const [intervalPaceSeconds, setIntervalPaceSeconds] = useState<number | null>(null);
  const [marathonPaceSeconds, setMarathonPaceSeconds] = useState<number | null>(null);
  const [halfMarathonPaceSeconds, setHalfMarathonPaceSeconds] = useState<number | null>(null);

  useEffect(() => {
    const profileId = activeProfile?.id;
    getSettings(profileId).then((settings) => {
      if (settings) {
        setName(settings.name || '');
        setAge(settings.age?.toString() || '');
        setPreferredLongRunDay(settings.preferredLongRunDay || '');
        setPreferredWorkoutDays(JSON.parse(settings.preferredWorkoutDays || '[]'));
        setWeeklyVolumeTarget(settings.weeklyVolumeTargetMiles?.toString() || '');
        setCityName(settings.cityName || '');
        setLatitude(settings.latitude ?? null);
        setLongitude(settings.longitude ?? null);
        setAcclimatizationScore(settings.heatAcclimatizationScore ?? 50);
        if (settings.defaultTargetPaceSeconds) {
          setDefaultPaceMinutes(Math.floor(settings.defaultTargetPaceSeconds / 60).toString());
          setDefaultPaceSeconds((settings.defaultTargetPaceSeconds % 60).toString().padStart(2, '0'));
        }
        if (settings.temperaturePreferenceScale) {
          setTemperaturePreferenceScale(settings.temperaturePreferenceScale);
        }
        if (settings.defaultRunTimeHour !== null && settings.defaultRunTimeHour !== undefined) {
          setDefaultRunTimeHour(settings.defaultRunTimeHour);
        }
        if (settings.defaultRunTimeMinute !== null && settings.defaultRunTimeMinute !== undefined) {
          setDefaultRunTimeMinute(settings.defaultRunTimeMinute);
        }
        // Load VDOT and pace zones
        setVdot(settings.vdot ?? null);
        setEasyPaceSeconds(settings.easyPaceSeconds ?? null);
        setTempoPaceSeconds(settings.tempoPaceSeconds ?? null);
        setThresholdPaceSeconds(settings.thresholdPaceSeconds ?? null);
        setIntervalPaceSeconds(settings.intervalPaceSeconds ?? null);
        setMarathonPaceSeconds(settings.marathonPaceSeconds ?? null);
        setHalfMarathonPaceSeconds(settings.halfMarathonPaceSeconds ?? null);
        // Load coach personalization
        setCoachName(settings.coachName || 'Coach');
        setCoachColor(settings.coachColor || 'blue');
        setCoachPersona((settings.coachPersona as CoachPersona) || 'encouraging');
        // Load AI provider settings
        setAiProvider((settings.aiProvider as AIProvider) || 'claude');
        setClaudeModel((settings.claudeModel as ClaudeModel) || 'claude-sonnet-4-20250514');
        setOpenaiModel((settings.openaiModel as OpenAIModel) || 'gpt-5.2');
        // Load API keys (masked for security) - DISABLED
        // setAnthropicApiKey(settings.anthropicApiKey ? '••••••••' : '');
        // setOpenaiApiKey(settings.openaiApiKey ? '••••••••' : '');
      }
    });
  }, [activeProfile?.id]);

  const toggleWorkoutDay = (day: string) => {
    if (preferredWorkoutDays.includes(day)) {
      setPreferredWorkoutDays(preferredWorkoutDays.filter((d) => d !== day));
    } else {
      setPreferredWorkoutDays([...preferredWorkoutDays, day]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(false);

    startTransition(async () => {
      await createOrUpdateSettings({
        name,
        age: age ? parseInt(age) : undefined,
        preferredLongRunDay: preferredLongRunDay || undefined,
        preferredWorkoutDays,
        weeklyVolumeTargetMiles: weeklyVolumeTarget ? parseInt(weeklyVolumeTarget) : undefined,
        profileId: activeProfile?.id,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  };

  const handleLocationSearch = async () => {
    if (!locationSearch.trim()) return;
    setIsSearching(true);
    const results = await searchLocation(locationSearch);
    setSearchResults(results);
    setIsSearching(false);
  };

  const handleSelectLocation = (result: typeof searchResults[0]) => {
    startTransition(async () => {
      const displayName = result.admin1
        ? `${result.name}, ${result.admin1}`
        : `${result.name}, ${result.country}`;

      await updateLocation({
        latitude: result.latitude,
        longitude: result.longitude,
        cityName: displayName,
      });

      setCityName(displayName);
      setLatitude(result.latitude);
      setLongitude(result.longitude);
      setSearchResults([]);
      setLocationSearch('');
    });
  };

  const handleAcclimatizationUpdate = () => {
    const score = calculateAcclimatizationScore({
      warmRunsLastTwoWeeks: warmRuns,
      heatLimited,
      deliberateHeatTraining,
    });

    startTransition(async () => {
      await updateAcclimatization(score);
      setAcclimatizationScore(score);
    });
  };

  const handleDefaultPaceUpdate = () => {
    const minutes = parseInt(defaultPaceMinutes) || 0;
    const seconds = parseInt(defaultPaceSeconds) || 0;
    const totalSeconds = minutes * 60 + seconds;

    if (totalSeconds > 0) {
      startTransition(async () => {
        await updateDefaultPace(totalSeconds);
      });
    }
  };

  const handleTemperaturePreferenceScaleUpdate = (scale: number) => {
    startTransition(async () => {
      await updateTemperaturePreferenceScale(scale);
      setTempPrefSaved(true);
      setTimeout(() => setTempPrefSaved(false), 2000);
    });
  };

  const handleDefaultRunTimeUpdate = (hour: number, minute: number) => {
    setDefaultRunTimeHour(hour);
    setDefaultRunTimeMinute(minute);
    startTransition(async () => {
      await updateDefaultRunTime(hour, minute);
      setRunTimeSaved(true);
      setTimeout(() => setRunTimeSaved(false), 2000);
    });
  };

  const formatTimeDisplay = (hour: number, minute: number): string => {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
  };

  const dayLabels: Record<string, string> = {
    monday: 'Mon',
    tuesday: 'Tue',
    wednesday: 'Wed',
    thursday: 'Thu',
    friday: 'Fri',
    saturday: 'Sat',
    sunday: 'Sun',
  };

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-primary mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Profile */}
        <form onSubmit={handleSubmit}>
          <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
            <h2 className="font-semibold text-primary mb-4">Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-1">Your Age</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g., 35"
                  min="10"
                  max="100"
                  className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <p className="text-xs text-textTertiary mt-1">Used for fitness age comparison</p>
              </div>
            </div>

            {/* Training Preferences */}
            <div className="mt-6 pt-6 border-t border-subtle space-y-6">
              <h3 className="font-medium text-primary">Training Preferences</h3>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Preferred Long Run Day
                </label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        setPreferredLongRunDay(preferredLongRunDay === day ? '' : day)
                      }
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
                        preferredLongRunDay === day
                          ? 'bg-green-600 text-white'
                          : 'bg-stone-100 text-secondary hover:bg-stone-200'
                      )}
                    >
                      {dayLabels[day]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Preferred Workout Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWorkoutDay(day)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
                        preferredWorkoutDays.includes(day)
                          ? 'bg-rose-400 text-white'
                          : 'bg-stone-100 text-secondary hover:bg-stone-200'
                      )}
                    >
                      {dayLabels[day]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary mb-1">
                  Weekly Volume Target (miles)
                </label>
                <input
                  type="number"
                  value={weeklyVolumeTarget}
                  onChange={(e) => setWeeklyVolumeTarget(e.target.value)}
                  placeholder="e.g., 30"
                  className="w-full max-w-xs px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 mt-6 pt-6 border-t border-subtle">
              <button
                type="submit"
                disabled={isPending}
                className={cn(
                  'px-6 py-2 rounded-xl font-medium transition-colors',
                  isPending
                    ? 'bg-stone-300 dark:bg-surface-3 text-textTertiary cursor-not-allowed'
                    : 'bg-accentTeal text-white hover:bg-accentTeal-hover shadow-sm hover:shadow-md'
                )}
              >
                {isPending ? 'Saving...' : 'Save Profile'}
              </button>
              {saved && <span className="text-green-600 text-sm font-medium">Saved!</span>}
            </div>
          </div>
        </form>

        {/* Coach Personalization */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-primary">Your Coach</h2>
            </div>
            {coachSaved && (
              <span className="text-xs text-green-600 font-medium">Saved!</span>
            )}
          </div>
          <p className="text-sm text-textTertiary mb-4">
            Personalize your AI running coach&apos;s name and color theme.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Coach Name
              </label>
              <input
                type="text"
                value={coachName}
                onChange={(e) => setCoachName(e.target.value)}
                placeholder="Coach"
                className="w-full max-w-xs px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="text-xs text-textTertiary mt-1">
                e.g., Coach, Luna, Marcus, or any name you prefer
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Accent Color
              </label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <input
                    type="color"
                    value={coachColor.startsWith('#') ? coachColor : '#3b82f6'}
                    onChange={(e) => {
                      setCoachColor(e.target.value);
                    }}
                    className="w-16 h-16 rounded-xl cursor-pointer border-2 border-default hover:border-strong transition-colors"
                    style={{ padding: '2px' }}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-textSecondary">Click to pick any color</p>
                  <p className="text-xs text-tertiary mt-1">Current: {coachColor}</p>
                </div>
              </div>
              {/* Quick presets */}
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  { value: '#3b82f6', label: 'Blue' },
                  { value: '#22c55e', label: 'Green' },
                  { value: '#a855f7', label: 'Purple' },
                  { value: '#f97316', label: 'Orange' },
                  { value: '#ef4444', label: 'Red' },
                  { value: '#14b8a6', label: 'Teal' },
                  { value: '#ec4899', label: 'Pink' },
                  { value: '#eab308', label: 'Gold' },
                ].map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setCoachColor(color.value)}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all border-2',
                      coachColor === color.value
                        ? 'border-strong ring-2 ring-offset-1 ring-stone-400 scale-110'
                        : 'border-transparent hover:scale-105'
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            {/* Coach Persona / Communication Style */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Coaching Style
              </label>
              <p className="text-xs text-textTertiary mb-3">
                How should your coach communicate with you?
              </p>
              <div className="grid gap-2">
                {personas.map((persona) => (
                  <button
                    key={persona.name}
                    type="button"
                    onClick={() => setCoachPersona(persona.name)}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all',
                      coachPersona === persona.name
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-default hover:border-strong'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0',
                      coachPersona === persona.name
                        ? 'border-purple-500 bg-purple-500'
                        : 'border-strong'
                    )}>
                      {coachPersona === persona.name && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-surface-1 rounded-full" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-primary">{persona.label}</div>
                      <div className="text-xs text-textTertiary">{persona.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                startTransition(async () => {
                  await updateCoachSettings(coachName, coachColor, coachPersona);
                  setCoachSaved(true);
                  setTimeout(() => setCoachSaved(false), 2000);
                });
              }}
              disabled={isPending}
              className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all text-sm font-semibold shadow-sm hover:shadow-md"
            >
              Save Coach Settings
            </button>
          </div>
        </div>

        {/* AI Provider Settings */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-indigo-500" />
            <h2 className="font-semibold text-primary">AI Provider</h2>
          </div>
          <p className="text-sm text-textSecondary mb-4">
            Choose which AI powers your coach. Different models have different strengths.
          </p>

          <div className="space-y-4">
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">Provider</label>
              <div className="flex gap-2">
                {aiProviders.map((provider) => (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => setAiProvider(provider)}
                    className={cn(
                      'flex-1 py-2 px-4 rounded-lg border-2 text-sm font-medium transition-all',
                      aiProvider === provider
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : 'border-default hover:border-strong text-textSecondary'
                    )}
                  >
                    {provider === 'claude' ? 'Claude (Anthropic)' : 'OpenAI'}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Selection */}
            {aiProvider === 'claude' && (
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">Claude Model</label>
                <div className="space-y-2">
                  {claudeModels.map((model) => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => setClaudeModel(model)}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all',
                        claudeModel === model
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-default hover:border-strong'
                      )}
                    >
                      <div className={cn(
                        'w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0',
                        claudeModel === model
                          ? 'border-indigo-500 bg-indigo-500'
                          : 'border-strong'
                      )}>
                        {claudeModel === model && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-surface-1 rounded-full" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-primary">{getModelDisplayName('claude', model)}</div>
                        <div className="text-xs text-textTertiary">{getModelDescription('claude', model)}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {aiProvider === 'openai' && (
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">OpenAI Model</label>
                <div className="space-y-2">
                  {openaiModels.map((model) => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => setOpenaiModel(model)}
                      className={cn(
                        'w-full flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all',
                        openaiModel === model
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-default hover:border-strong'
                      )}
                    >
                      <div className={cn(
                        'w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0',
                        openaiModel === model
                          ? 'border-indigo-500 bg-indigo-500'
                          : 'border-strong'
                      )}>
                        {openaiModel === model && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 bg-surface-1 rounded-full" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-primary">{getModelDisplayName('openai', model)}</div>
                        <div className="text-xs text-textTertiary">{getModelDescription('openai', model)}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-textTertiary mt-2">
                  Requires OPENAI_API_KEY environment variable to be set.
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  startTransition(async () => {
                    await updateAISettings(aiProvider, claudeModel, openaiModel);
                    setAiSaved(true);
                    setTimeout(() => setAiSaved(false), 2000);
                  });
                }}
                disabled={isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                Save AI Settings
              </button>
              {aiSaved && (
                <span className="text-sm text-green-600 font-medium">Saved!</span>
              )}
            </div>
          </div>
        </div>

        {/* API Keys - TEMPORARILY DISABLED UNTIL DATABASE MIGRATION */}
        {false && (
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-primary">API Keys</h2>
          </div>
          <p className="text-sm text-textSecondary mb-4">
            Add your API keys to enable AI features. Keys are stored securely.
          </p>

          <div className="space-y-4">
            {/* Anthropic API Key */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Anthropic API Key {aiProvider === 'claude' && <span className="text-indigo-600">(Active)</span>}
              </label>
              <div className="relative">
                <input
                  type={showApiKeys ? 'text' : 'password'}
                  value={anthropicApiKey}
                  onChange={(e) => setAnthropicApiKey(e.target.value)}
                  placeholder="sk-ant-api03-..."
                  className="w-full px-3 py-2 pr-10 border border-default rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKeys(!showApiKeys)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiary hover:text-textSecondary"
                >
                  {showApiKeys ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <p className="text-xs text-textTertiary mt-1">
                Get your key from <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">console.anthropic.com</a>
              </p>
            </div>

            {/* OpenAI API Key */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                OpenAI API Key {aiProvider === 'openai' && <span className="text-indigo-600">(Active)</span>}
              </label>
              <div className="relative">
                <input
                  type={showApiKeys ? 'text' : 'password'}
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 pr-10 border border-default rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKeys(!showApiKeys)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-tertiary hover:text-textSecondary"
                >
                  {showApiKeys ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <p className="text-xs text-textTertiary mt-1">
                Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">platform.openai.com</a>
              </p>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  // Only save if the values have actually changed (not just the masked values)
                  if (anthropicApiKey !== '••••••••' || openaiApiKey !== '••••••••') {
                    startTransition(async () => {
                      await updateAPIKeys(
                        anthropicApiKey === '••••••••' ? '' : anthropicApiKey,
                        openaiApiKey === '••••••••' ? '' : openaiApiKey
                      );
                      setApiKeysSaved(true);
                      setTimeout(() => setApiKeysSaved(false), 2000);
                    });
                  }
                }}
                disabled={isPending || (anthropicApiKey === '••••••••' && openaiApiKey === '••••••••')}
                className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                Save API Keys
              </button>
              {apiKeysSaved && (
                <span className="text-sm text-green-600 font-medium">Saved!</span>
              )}
            </div>
          </div>
        </div>
        )}

        {/* VDOT & Pace Zones */}
        <VDOTGauge
          vdot={vdot}
          easyPaceSeconds={easyPaceSeconds}
          tempoPaceSeconds={tempoPaceSeconds}
          thresholdPaceSeconds={thresholdPaceSeconds}
          intervalPaceSeconds={intervalPaceSeconds}
          marathonPaceSeconds={marathonPaceSeconds}
          halfMarathonPaceSeconds={halfMarathonPaceSeconds}
        />

        {/* Location */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-teal-600" />
            <h2 className="font-semibold text-primary">Location</h2>
          </div>

          {cityName ? (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-50 dark:bg-green-9500 rounded-full"></div>
                <p className="text-sm font-medium text-green-800">Location Set</p>
              </div>
              <p className="font-medium text-primary mt-1">{cityName}</p>
              {latitude && longitude && (
                <p className="text-xs text-textTertiary mt-0.5">
                  {latitude.toFixed(4)}, {longitude.toFixed(4)}
                </p>
              )}
            </div>
          ) : (
            <div className="mb-4 p-3 bg-surface-1 rounded-lg border border-default">
              <p className="text-sm text-primary">No location set. Search for your city below.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Change location
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
                placeholder="Enter city name or zip code..."
                className="flex-1 px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              <button
                type="button"
                onClick={handleLocationSearch}
                disabled={isSearching}
                className="btn-primary rounded-xl"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
            <p className="text-xs text-textTertiary mt-1">
              Search and click a result to update your location
            </p>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-3 border border-default rounded-lg divide-y divide-border-subtle bg-surface-1 shadow-sm">
              <p className="px-3 py-2 text-xs font-medium text-textTertiary bg-bgTertiary rounded-t-lg">
                Click to select:
              </p>
              {searchResults.map((result, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectLocation(result)}
                  className="w-full px-3 py-3 text-left hover:bg-surface-1 transition-colors"
                >
                  <p className="font-medium text-primary">{result.name}</p>
                  <p className="text-sm text-textTertiary">
                    {result.admin1 ? `${result.admin1}, ` : ''}{result.country}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Default Target Pace */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-5 h-5 text-teal-600" />
            <h2 className="font-semibold text-primary">Default Target Pace</h2>
          </div>
          <p className="text-sm text-textTertiary mb-4">
            Set your default easy run pace for the pace calculator.
          </p>

          <div className="flex items-center gap-2">
            <input
              type="number"
              value={defaultPaceMinutes}
              onChange={(e) => setDefaultPaceMinutes(e.target.value)}
              placeholder="8"
              min="4"
              max="20"
              className="w-20 px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center"
            />
            <span className="text-secondary">:</span>
            <input
              type="number"
              value={defaultPaceSeconds}
              onChange={(e) => setDefaultPaceSeconds(e.target.value)}
              placeholder="00"
              min="0"
              max="59"
              className="w-20 px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-center"
            />
            <span className="text-textTertiary text-sm">/mile</span>
            <button
              type="button"
              onClick={handleDefaultPaceUpdate}
              disabled={isPending}
              className="btn-primary ml-2 text-sm rounded-xl"
            >
              Save
            </button>
          </div>
        </div>

        {/* Default Run Time */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-primary">Typical Run Time</h2>
            </div>
            {runTimeSaved && (
              <span className="text-xs text-green-600 font-medium">Saved</span>
            )}
          </div>
          <p className="text-sm text-textTertiary mb-4">
            When do you usually run? This helps show weather for the right time of day.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Default run time
              </label>
              <div className="flex items-center gap-3">
                <select
                  value={defaultRunTimeHour}
                  onChange={(e) => handleDefaultRunTimeUpdate(parseInt(e.target.value), defaultRunTimeMinute)}
                  className="px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  {Array.from({ length: 24 }, (_, i) => {
                    const period = i >= 12 ? 'PM' : 'AM';
                    const displayHour = i % 12 || 12;
                    return (
                      <option key={i} value={i}>
                        {displayHour}:00 {period}
                      </option>
                    );
                  })}
                </select>
                <span className="text-textTertiary">:</span>
                <select
                  value={defaultRunTimeMinute}
                  onChange={(e) => handleDefaultRunTimeUpdate(defaultRunTimeHour, parseInt(e.target.value))}
                  className="px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                >
                  <option value={0}>00</option>
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={45}>45</option>
                </select>
              </div>
              <p className="text-xs text-textTertiary mt-2">
                Currently set to: {formatTimeDisplay(defaultRunTimeHour, defaultRunTimeMinute)}
              </p>
            </div>

            {/* Quick presets */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Quick presets
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Early AM', hour: 5, minute: 30 },
                  { label: 'Morning', hour: 7, minute: 0 },
                  { label: 'Lunch', hour: 12, minute: 0 },
                  { label: 'After Work', hour: 18, minute: 0 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleDefaultRunTimeUpdate(preset.hour, preset.minute)}
                    className={cn(
                      'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
                      defaultRunTimeHour === preset.hour && defaultRunTimeMinute === preset.minute
                        ? 'bg-green-600 text-white'
                        : 'bg-stone-100 text-secondary hover:bg-stone-200'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Heat Acclimatization */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Thermometer className="w-5 h-5 text-rose-500" />
            <h2 className="font-semibold text-primary">Heat Acclimatization</h2>
          </div>
          <p className="text-sm text-textTertiary mb-4">
            Help us adjust pace recommendations based on how acclimatized you are to heat.
          </p>

          <div className="mb-4 p-3 bg-rose-50 rounded-lg">
            <p className="text-sm text-textSecondary">Your current score:</p>
            <p className="text-2xl font-bold text-rose-600">{acclimatizationScore}/100</p>
            <p className="text-xs text-textTertiary mt-1">
              {acclimatizationScore >= 70
                ? 'Well acclimatized - reduced pace adjustments'
                : acclimatizationScore >= 40
                ? 'Moderately acclimatized - standard adjustments'
                : 'Not well acclimatized - increased pace adjustments'}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Runs in warm conditions (&gt;75°F) in the last 2 weeks?
              </label>
              <div className="flex flex-wrap gap-2">
                {(['0', '1-2', '3-5', '6+'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setWarmRuns(opt)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                      warmRuns === opt
                        ? 'bg-rose-400 text-white'
                        : 'bg-stone-100 text-secondary hover:bg-stone-200'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                How often do you feel heat-limited on runs?
              </label>
              <div className="flex flex-wrap gap-2">
                {(['rarely', 'sometimes', 'often', 'always'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setHeatLimited(opt)}
                    className={cn(
                      'px-4 py-2 rounded-xl text-sm font-medium transition-colors capitalize',
                      heatLimited === opt
                        ? 'bg-rose-400 text-white'
                        : 'bg-stone-100 text-secondary hover:bg-stone-200'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDeliberateHeatTraining(!deliberateHeatTraining)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  deliberateHeatTraining ? 'bg-rose-400' : 'bg-stone-200'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    deliberateHeatTraining ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
              <span className="text-sm text-secondary">Have you been deliberately heat training?</span>
            </div>

            <button
              type="button"
              onClick={handleAcclimatizationUpdate}
              disabled={isPending}
              className="px-4 py-2 bg-rose-400 text-white rounded-xl hover:bg-rose-500 transition-colors text-sm font-medium"
            >
              Calculate & Save Score
            </button>
          </div>
        </div>

        {/* Temperature Preference (for outfit recommendations) */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shirt className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-primary">Temperature Preference</h2>
            </div>
            {tempPrefSaved && (
              <span className="text-xs text-green-600 font-medium">Saved</span>
            )}
          </div>
          <p className="text-sm text-textTertiary mb-6">
            How do you typically feel during runs? This adjusts outfit recommendations.
          </p>

          {/* 9-point slider */}
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-textSecondary">
              <span>I run cold</span>
              <span>Neutral</span>
              <span>I run hot</span>
            </div>
            <input
              type="range"
              min="1"
              max="9"
              step="1"
              value={temperaturePreferenceScale}
              onChange={(e) => setTemperaturePreferenceScale(parseInt(e.target.value))}
              onMouseUp={() => handleTemperaturePreferenceScaleUpdate(temperaturePreferenceScale)}
              onTouchEnd={() => handleTemperaturePreferenceScaleUpdate(temperaturePreferenceScale)}
              className="w-full h-2 bg-gradient-to-r from-teal-400 via-stone-300 to-rose-300 rounded-lg appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2
                [&::-webkit-slider-thumb]:border-purple-600 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
                [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-purple-600
                [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
            />
            <div className="flex justify-between">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <div
                  key={n}
                  className={cn(
                    'w-2 h-2 rounded-full',
                    temperaturePreferenceScale === n ? 'bg-purple-600' : 'bg-stone-300'
                  )}
                />
              ))}
            </div>
            <p className="text-center text-sm text-textSecondary">
              {temperaturePreferenceScale <= 3 && 'You prefer warmer gear - dress up a layer'}
              {temperaturePreferenceScale >= 4 && temperaturePreferenceScale <= 6 && 'Standard recommendations'}
              {temperaturePreferenceScale >= 7 && 'You prefer lighter gear - dress down a layer'}
            </p>
          </div>
        </div>

        {/* Strava Integration */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <LinkIcon className="w-5 h-5 text-rose-600" />
            <h2 className="font-semibold text-primary">External Integrations</h2>
          </div>
          <p className="text-sm text-textTertiary mb-4">
            Connect external services to automatically sync your workouts.
          </p>

          {/* Strava Integration Card */}
          <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FC4C02] rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116zm-8.293-6.56l-2.536 5.024L2.026 11.384H.001L4.558 20.1l2.535-5.015 2.534 5.015 4.558-8.716h-2.026l-2.533 5.024-2.532-5.024z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-primary">Strava</h3>
                  <p className="text-sm text-textSecondary">Sync activities from Strava</p>
                </div>
              </div>
              <a
                href="/strava-sync"
                className="px-4 py-2 bg-[#FC4C02] text-white rounded-lg hover:bg-[#E34402] transition-colors font-medium flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Manage Sync
              </a>
            </div>
          </div>

          <div className="mt-4">
            <IntervalsConnect />
          </div>
        </div>

        {/* Demo Data */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-textSecondary" />
            <h2 className="font-semibold text-primary">Demo Data</h2>
          </div>
          <p className="text-sm text-textTertiary mb-4">
            Load sample workout data to see what the app looks like with activity history.
          </p>
          <div className="flex gap-3">
            <button
              onClick={async () => {
                setDemoDataLoading(true);
                setDemoDataMessage('');
                try {
                  const result = await loadSampleData();
                  setDemoDataMessage(`Loaded ${result.workoutsCreated} sample workouts!`);
                } catch {
                  setDemoDataMessage('Error loading sample data');
                } finally {
                  setDemoDataLoading(false);
                }
              }}
              disabled={demoDataLoading}
              className="btn-primary flex items-center gap-2 text-sm rounded-xl disabled:opacity-50"
            >
              <Database className="w-4 h-4" />
              {demoDataLoading ? 'Loading...' : 'Load Sample Data'}
            </button>
            <button
              onClick={() => setShowClearDemoConfirm(true)}
              disabled={demoDataLoading}
              className="flex items-center gap-2 px-4 py-2 border border-strong text-secondary rounded-xl text-sm font-medium hover:bg-bgTertiary transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Clear Demo Data
            </button>
          </div>
          {demoDataMessage && (
            <p className="mt-3 text-sm text-green-600">{demoDataMessage}</p>
          )}
        </div>

        {/* Training Plan Reset */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-rose-600" />
            <h2 className="font-semibold text-primary">Training Plan</h2>
          </div>
          <p className="text-sm text-textTertiary mb-4">
            Reset your training plan to start fresh. This deletes all planned workouts but keeps your completed workout history intact.
          </p>
          <button
            onClick={() => setShowResetPlanConfirm(true)}
            disabled={planResetLoading}
            className="flex items-center gap-2 px-4 py-2 border border-rose-300 text-rose-700 bg-rose-50 rounded-xl text-sm font-medium hover:bg-rose-50 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {planResetLoading ? 'Resetting...' : 'Reset Training Plans'}
          </button>
          {planResetMessage && (
            <p className="mt-3 text-sm text-green-600">{planResetMessage}</p>
          )}
        </div>

        {/* Training Profile / Re-run Setup */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-purple-600" />
            <h2 className="font-semibold text-primary">Training Profile</h2>
          </div>
          <p className="text-sm text-textTertiary mb-4">
            Update your running profile, goals, and preferences. This data is used to generate your training plans.
          </p>
          <div className="flex gap-3">
            <a
              href="/onboarding"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-all shadow-sm hover:shadow-md"
            >
              <RefreshCcw className="w-4 h-4" />
              Re-run Setup Wizard
            </a>
          </div>
          <p className="mt-3 text-xs text-tertiary">
            This will take you through the initial setup questionnaire again to update your profile.
          </p>
        </div>

        {/* App */}
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-primary">App</h2>
          </div>

          {isInstalled ? (
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm font-medium text-green-800">
                Dreamy is installed on your device
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                You are using the standalone app experience
              </p>
            </div>
          ) : isInstallable ? (
            <div className="space-y-3">
              <p className="text-sm text-textTertiary">
                Install Dreamy on your device for quick access and a native app experience.
              </p>
              <button
                onClick={installApp}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Install Dreamy
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-textTertiary">
                You can install Dreamy as an app on your device:
              </p>
              <ul className="text-sm text-textSecondary space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-medium">iOS:</span>
                  <span>Tap Share, then Add to Home Screen</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium">Android:</span>
                  <span>Tap menu, then Install app or Add to Home screen</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-medium">Desktop:</span>
                  <span>Look for the install icon in the browser address bar</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Clear Demo Data Confirmation */}
      <ConfirmModal
        isOpen={showClearDemoConfirm}
        onClose={() => setShowClearDemoConfirm(false)}
        onConfirm={async () => {
          setShowClearDemoConfirm(false);
          setDemoDataLoading(true);
          setDemoDataMessage('');
          try {
            await clearDemoData();
            setDemoDataMessage('Demo data cleared!');
          } catch {
            setDemoDataMessage('Error clearing demo data');
          } finally {
            setDemoDataLoading(false);
          }
        }}
        title="Clear Demo Data?"
        message="This will delete all demo workouts. This action cannot be undone."
        confirmText="Clear Data"
        cancelText="Keep Data"
        variant="danger"
      />

      {/* Reset Training Plans Confirmation */}
      <ConfirmModal
        isOpen={showResetPlanConfirm}
        onClose={() => setShowResetPlanConfirm(false)}
        onConfirm={async () => {
          setShowResetPlanConfirm(false);
          setPlanResetLoading(true);
          setPlanResetMessage('');
          try {
            await resetAllTrainingPlans();
            setPlanResetMessage('Training plans reset successfully. Go to Races to create a new plan.');
          } catch {
            setPlanResetMessage('Error resetting training plans');
          } finally {
            setPlanResetLoading(false);
          }
        }}
        title="Reset Training Plans?"
        message="This will delete all training plans and planned workouts. Your completed workout history will be preserved."
        confirmText="Reset Plans"
        cancelText="Keep Plans"
        variant="warning"
      />
    </div>
  );
}
