'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  getSettings,
  createOrUpdateSettings,
  updateLocation,
  updateAcclimatization,
  updateDefaultPace,
  updateTemperaturePreferenceScale,
  updateDefaultRunTime,
  updateCoachSettings,
} from '@/actions/settings';
import { searchLocation } from '@/lib/weather';
import { calculateAcclimatizationScore } from '@/lib/conditions';
import { daysOfWeek, coachPersonas, type CoachPersona } from '@/lib/schema';
import { getAllPersonas } from '@/lib/coach-personas';
import { cn } from '@/lib/utils';
import { MapPin, Thermometer, Timer, Shirt, Clock, Database, Trash2, Download, Smartphone, Calendar, User, RefreshCcw, Sparkles, Link as LinkIcon } from 'lucide-react';
import { loadSampleData, clearDemoData } from '@/actions/demo-data';
import { resetAllTrainingPlans } from '@/actions/training-plan';
import { VDOTGauge } from '@/components/VDOTGauge';
import { usePWA } from '@/components/PWAProvider';
import { ConfirmModal } from '@/components/ConfirmModal';
import { StravaConnect } from '@/components/StravaConnect';
import { IntervalsConnect } from '@/components/IntervalsConnect';

export default function SettingsPage() {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState('');
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
    getSettings().then((settings) => {
      if (settings) {
        setName(settings.name || '');
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
      }
    });
  }, []);

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
        preferredLongRunDay: preferredLongRunDay || undefined,
        preferredWorkoutDays,
        weeklyVolumeTargetMiles: weeklyVolumeTarget ? parseInt(weeklyVolumeTarget) : undefined,
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
      <h1 className="text-2xl font-display font-semibold text-stone-900 mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Profile */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
            <h2 className="font-semibold text-stone-900 mb-4">Profile</h2>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            {/* Training Preferences */}
            <div className="mt-6 pt-6 border-t border-stone-100 space-y-6">
              <h3 className="font-medium text-stone-900">Training Preferences</h3>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
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
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      )}
                    >
                      {dayLabels[day]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
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
                          ? 'bg-orange-500 text-white'
                          : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                      )}
                    >
                      {dayLabels[day]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">
                  Weekly Volume Target (miles)
                </label>
                <input
                  type="number"
                  value={weeklyVolumeTarget}
                  onChange={(e) => setWeeklyVolumeTarget(e.target.value)}
                  placeholder="e.g., 30"
                  className="w-full max-w-xs px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 mt-6 pt-6 border-t border-stone-100">
              <button
                type="submit"
                disabled={isPending}
                className={cn(
                  'px-6 py-2 rounded-xl font-medium transition-colors',
                  isPending
                    ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                )}
              >
                {isPending ? 'Saving...' : 'Save Profile'}
              </button>
              {saved && <span className="text-green-600 text-sm font-medium">Saved!</span>}
            </div>
          </div>
        </form>

        {/* Coach Personalization */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-stone-900">Your Coach</h2>
            </div>
            {coachSaved && (
              <span className="text-xs text-green-600 font-medium">Saved!</span>
            )}
          </div>
          <p className="text-sm text-stone-500 mb-4">
            Personalize your AI running coach&apos;s name and color theme.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Coach Name
              </label>
              <input
                type="text"
                value={coachName}
                onChange={(e) => setCoachName(e.target.value)}
                placeholder="Coach"
                className="w-full max-w-xs px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <p className="text-xs text-stone-500 mt-1">
                e.g., Coach, Luna, Marcus, or any name you prefer
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
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
                    className="w-16 h-16 rounded-xl cursor-pointer border-2 border-stone-200 hover:border-stone-300 transition-colors"
                    style={{ padding: '2px' }}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-stone-600">Click to pick any color</p>
                  <p className="text-xs text-stone-400 mt-1">Current: {coachColor}</p>
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
                        ? 'border-stone-800 ring-2 ring-offset-1 ring-stone-400 scale-110'
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
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Coaching Style
              </label>
              <p className="text-xs text-stone-500 mb-3">
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
                        : 'border-stone-200 hover:border-stone-300'
                    )}
                  >
                    <div className={cn(
                      'w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0',
                      coachPersona === persona.name
                        ? 'border-purple-500 bg-purple-500'
                        : 'border-stone-300'
                    )}>
                      {coachPersona === persona.name && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-white rounded-full" />
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-stone-900">{persona.label}</div>
                      <div className="text-xs text-stone-500">{persona.description}</div>
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
              className="px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              Save Coach Settings
            </button>
          </div>
        </div>

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
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-stone-900">Location</h2>
          </div>

          {cityName ? (
            <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="text-sm font-medium text-green-800">Location Set</p>
              </div>
              <p className="font-medium text-stone-900 mt-1">{cityName}</p>
              {latitude && longitude && (
                <p className="text-xs text-stone-500 mt-0.5">
                  {latitude.toFixed(4)}, {longitude.toFixed(4)}
                </p>
              )}
            </div>
          ) : (
            <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-sm text-yellow-800">No location set. Search for your city below.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Change location
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
                placeholder="Enter city name or zip code..."
                className="flex-1 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleLocationSearch}
                disabled={isSearching}
                className="px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Search and click a result to update your location
            </p>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-3 border border-stone-200 rounded-lg divide-y divide-stone-100 bg-white shadow-sm">
              <p className="px-3 py-2 text-xs font-medium text-stone-500 bg-stone-50 rounded-t-lg">
                Click to select:
              </p>
              {searchResults.map((result, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectLocation(result)}
                  className="w-full px-3 py-3 text-left hover:bg-amber-50 transition-colors"
                >
                  <p className="font-medium text-stone-900">{result.name}</p>
                  <p className="text-sm text-stone-500">
                    {result.admin1 ? `${result.admin1}, ` : ''}{result.country}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Default Target Pace */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-stone-900">Default Target Pace</h2>
          </div>
          <p className="text-sm text-stone-500 mb-4">
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
              className="w-20 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-center"
            />
            <span className="text-stone-700">:</span>
            <input
              type="number"
              value={defaultPaceSeconds}
              onChange={(e) => setDefaultPaceSeconds(e.target.value)}
              placeholder="00"
              min="0"
              max="59"
              className="w-20 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-center"
            />
            <span className="text-stone-500 text-sm">/mile</span>
            <button
              type="button"
              onClick={handleDefaultPaceUpdate}
              disabled={isPending}
              className="ml-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors text-sm font-medium"
            >
              Save
            </button>
          </div>
        </div>

        {/* Default Run Time */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-600" />
              <h2 className="font-semibold text-stone-900">Typical Run Time</h2>
            </div>
            {runTimeSaved && (
              <span className="text-xs text-green-600 font-medium">Saved</span>
            )}
          </div>
          <p className="text-sm text-stone-500 mb-4">
            When do you usually run? This helps show weather for the right time of day.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Default run time
              </label>
              <div className="flex items-center gap-3">
                <select
                  value={defaultRunTimeHour}
                  onChange={(e) => handleDefaultRunTimeUpdate(parseInt(e.target.value), defaultRunTimeMinute)}
                  className="px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
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
                <span className="text-stone-500">:</span>
                <select
                  value={defaultRunTimeMinute}
                  onChange={(e) => handleDefaultRunTimeUpdate(defaultRunTimeHour, parseInt(e.target.value))}
                  className="px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                >
                  <option value={0}>00</option>
                  <option value={15}>15</option>
                  <option value={30}>30</option>
                  <option value={45}>45</option>
                </select>
              </div>
              <p className="text-xs text-stone-500 mt-2">
                Currently set to: {formatTimeDisplay(defaultRunTimeHour, defaultRunTimeMinute)}
              </p>
            </div>

            {/* Quick presets */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
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
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
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
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Thermometer className="w-5 h-5 text-orange-500" />
            <h2 className="font-semibold text-stone-900">Heat Acclimatization</h2>
          </div>
          <p className="text-sm text-stone-500 mb-4">
            Help us adjust pace recommendations based on how acclimatized you are to heat.
          </p>

          <div className="mb-4 p-3 bg-orange-50 rounded-lg">
            <p className="text-sm text-stone-600">Your current score:</p>
            <p className="text-2xl font-bold text-orange-600">{acclimatizationScore}/100</p>
            <p className="text-xs text-stone-500 mt-1">
              {acclimatizationScore >= 70
                ? 'Well acclimatized - reduced pace adjustments'
                : acclimatizationScore >= 40
                ? 'Moderately acclimatized - standard adjustments'
                : 'Not well acclimatized - increased pace adjustments'}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
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
                        ? 'bg-orange-500 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
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
                        ? 'bg-orange-500 text-white'
                        : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
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
                  deliberateHeatTraining ? 'bg-orange-500' : 'bg-stone-200'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    deliberateHeatTraining ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
              <span className="text-sm text-stone-700">Have you been deliberately heat training?</span>
            </div>

            <button
              type="button"
              onClick={handleAcclimatizationUpdate}
              disabled={isPending}
              className="px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors text-sm font-medium"
            >
              Calculate & Save Score
            </button>
          </div>
        </div>

        {/* Temperature Preference (for outfit recommendations) */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shirt className="w-5 h-5 text-purple-600" />
              <h2 className="font-semibold text-stone-900">Temperature Preference</h2>
            </div>
            {tempPrefSaved && (
              <span className="text-xs text-green-600 font-medium">Saved</span>
            )}
          </div>
          <p className="text-sm text-stone-500 mb-6">
            How do you typically feel during runs? This adjusts outfit recommendations.
          </p>

          {/* 9-point slider */}
          <div className="space-y-4">
            <div className="flex justify-between text-sm text-stone-600">
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
              className="w-full h-2 bg-gradient-to-r from-amber-400 via-stone-300 to-orange-400 rounded-lg appearance-none cursor-pointer
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
            <p className="text-center text-sm text-stone-600">
              {temperaturePreferenceScale <= 3 && 'You prefer warmer gear - dress up a layer'}
              {temperaturePreferenceScale >= 4 && temperaturePreferenceScale <= 6 && 'Standard recommendations'}
              {temperaturePreferenceScale >= 7 && 'You prefer lighter gear - dress down a layer'}
            </p>
          </div>
        </div>

        {/* Strava Integration */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <LinkIcon className="w-5 h-5 text-orange-600" />
            <h2 className="font-semibold text-stone-900">External Integrations</h2>
          </div>
          <p className="text-sm text-stone-500 mb-4">
            Connect external services to automatically sync your workouts.
          </p>
          <StravaConnect />
          <IntervalsConnect />
        </div>

        {/* Demo Data */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-stone-600" />
            <h2 className="font-semibold text-stone-900">Demo Data</h2>
          </div>
          <p className="text-sm text-stone-500 mb-4">
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
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors disabled:opacity-50"
            >
              <Database className="w-4 h-4" />
              {demoDataLoading ? 'Loading...' : 'Load Sample Data'}
            </button>
            <button
              onClick={() => setShowClearDemoConfirm(true)}
              disabled={demoDataLoading}
              className="flex items-center gap-2 px-4 py-2 border border-stone-300 text-stone-700 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors disabled:opacity-50"
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
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-orange-600" />
            <h2 className="font-semibold text-stone-900">Training Plan</h2>
          </div>
          <p className="text-sm text-stone-500 mb-4">
            Reset your training plan to start fresh. This deletes all planned workouts but keeps your completed workout history intact.
          </p>
          <button
            onClick={() => setShowResetPlanConfirm(true)}
            disabled={planResetLoading}
            className="flex items-center gap-2 px-4 py-2 border border-orange-300 text-orange-700 bg-orange-50 rounded-xl text-sm font-medium hover:bg-orange-100 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            {planResetLoading ? 'Resetting...' : 'Reset Training Plans'}
          </button>
          {planResetMessage && (
            <p className="mt-3 text-sm text-green-600">{planResetMessage}</p>
          )}
        </div>

        {/* Training Profile / Re-run Setup */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-purple-600" />
            <h2 className="font-semibold text-stone-900">Training Profile</h2>
          </div>
          <p className="text-sm text-stone-500 mb-4">
            Update your running profile, goals, and preferences. This data is used to generate your training plans.
          </p>
          <div className="flex gap-3">
            <a
              href="/onboarding"
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
              Re-run Setup Wizard
            </a>
          </div>
          <p className="mt-3 text-xs text-stone-400">
            This will take you through the initial setup questionnaire again to update your profile.
          </p>
        </div>

        {/* App */}
        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-5 h-5 text-indigo-600" />
            <h2 className="font-semibold text-stone-900">App</h2>
          </div>

          {isInstalled ? (
            <div className="p-3 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm font-medium text-green-800">
                Dreamy is installed on your device
              </p>
              <p className="text-xs text-green-700 mt-1">
                You are using the standalone app experience
              </p>
            </div>
          ) : isInstallable ? (
            <div className="space-y-3">
              <p className="text-sm text-stone-500">
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
              <p className="text-sm text-stone-500">
                You can install Dreamy as an app on your device:
              </p>
              <ul className="text-sm text-stone-600 space-y-2">
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
