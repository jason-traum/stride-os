'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  getSettings,
  createOrUpdateSettings,
  updateLocation,
  updateAcclimatization,
  updateDefaultPace,
  updateTemperaturePreference,
} from '@/actions/settings';
import { searchLocation } from '@/lib/weather';
import { calculateAcclimatizationScore } from '@/lib/conditions';
import { daysOfWeek, temperaturePreferences, type TemperaturePreference } from '@/lib/schema';
import { cn } from '@/lib/utils';
import { MapPin, Thermometer, Timer, Shirt } from 'lucide-react';

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

  // Temperature preference state
  const [temperaturePreference, setTemperaturePreference] = useState<TemperaturePreference>('neutral');

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
        if (settings.temperaturePreference) {
          setTemperaturePreference(settings.temperaturePreference as TemperaturePreference);
        }
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

  const handleTemperaturePreferenceUpdate = (preference: TemperaturePreference) => {
    setTemperaturePreference(preference);
    startTransition(async () => {
      await updateTemperaturePreference(preference);
    });
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
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Settings</h1>

      <div className="space-y-6">
        {/* Profile */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 mb-4">Profile</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Training Preferences */}
            <div className="mt-6 pt-6 border-t border-slate-100 space-y-6">
              <h3 className="font-medium text-slate-900">Training Preferences</h3>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
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
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                        preferredLongRunDay === day
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      )}
                    >
                      {dayLabels[day]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Preferred Workout Days
                </label>
                <div className="flex flex-wrap gap-2">
                  {daysOfWeek.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWorkoutDay(day)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                        preferredWorkoutDays.includes(day)
                          ? 'bg-orange-500 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      )}
                    >
                      {dayLabels[day]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Weekly Volume Target (miles)
                </label>
                <input
                  type="number"
                  value={weeklyVolumeTarget}
                  onChange={(e) => setWeeklyVolumeTarget(e.target.value)}
                  placeholder="e.g., 30"
                  className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-4 mt-6 pt-6 border-t border-slate-100">
              <button
                type="submit"
                disabled={isPending}
                className={cn(
                  'px-6 py-2 rounded-lg font-medium transition-colors',
                  isPending
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                )}
              >
                {isPending ? 'Saving...' : 'Save Profile'}
              </button>
              {saved && <span className="text-green-600 text-sm font-medium">Saved!</span>}
            </div>
          </div>
        </form>

        {/* Location */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-slate-900">Location</h2>
          </div>

          {cityName ? (
            <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <p className="text-sm font-medium text-green-800">Location Set</p>
              </div>
              <p className="font-medium text-slate-900 mt-1">{cityName}</p>
              {latitude && longitude && (
                <p className="text-xs text-slate-500 mt-0.5">
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
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Change location
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
                placeholder="Enter city name or zip code..."
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={handleLocationSearch}
                disabled={isSearching}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Search and click a result to update your location
            </p>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-3 border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white shadow-sm">
              <p className="px-3 py-2 text-xs font-medium text-slate-500 bg-slate-50 rounded-t-lg">
                Click to select:
              </p>
              {searchResults.map((result, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectLocation(result)}
                  className="w-full px-3 py-3 text-left hover:bg-blue-50 transition-colors"
                >
                  <p className="font-medium text-slate-900">{result.name}</p>
                  <p className="text-sm text-slate-500">
                    {result.admin1 ? `${result.admin1}, ` : ''}{result.country}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Default Target Pace */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-slate-900">Default Target Pace</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
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
              className="w-20 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
            />
            <span className="text-slate-700">:</span>
            <input
              type="number"
              value={defaultPaceSeconds}
              onChange={(e) => setDefaultPaceSeconds(e.target.value)}
              placeholder="00"
              min="0"
              max="59"
              className="w-20 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-center"
            />
            <span className="text-slate-500 text-sm">/mile</span>
            <button
              type="button"
              onClick={handleDefaultPaceUpdate}
              disabled={isPending}
              className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              Save
            </button>
          </div>
        </div>

        {/* Heat Acclimatization */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Thermometer className="w-5 h-5 text-orange-500" />
            <h2 className="font-semibold text-slate-900">Heat Acclimatization</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Help us adjust pace recommendations based on how acclimatized you are to heat.
          </p>

          <div className="mb-4 p-3 bg-orange-50 rounded-lg">
            <p className="text-sm text-slate-600">Your current score:</p>
            <p className="text-2xl font-bold text-orange-600">{acclimatizationScore}/100</p>
            <p className="text-xs text-slate-500 mt-1">
              {acclimatizationScore >= 70
                ? 'Well acclimatized - reduced pace adjustments'
                : acclimatizationScore >= 40
                ? 'Moderately acclimatized - standard adjustments'
                : 'Not well acclimatized - increased pace adjustments'}
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Runs in warm conditions (&gt;75°F) in the last 2 weeks?
              </label>
              <div className="flex flex-wrap gap-2">
                {(['0', '1-2', '3-5', '6+'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setWarmRuns(opt)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      warmRuns === opt
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                How often do you feel heat-limited on runs?
              </label>
              <div className="flex flex-wrap gap-2">
                {(['rarely', 'sometimes', 'often', 'always'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setHeatLimited(opt)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize',
                      heatLimited === opt
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
                  deliberateHeatTraining ? 'bg-orange-500' : 'bg-slate-200'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    deliberateHeatTraining ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
              <span className="text-sm text-slate-700">Have you been deliberately heat training?</span>
            </div>

            <button
              type="button"
              onClick={handleAcclimatizationUpdate}
              disabled={isPending}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
            >
              Calculate & Save Score
            </button>
          </div>
        </div>

        {/* Temperature Preference (for outfit recommendations) */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Shirt className="w-5 h-5 text-purple-600" />
            <h2 className="font-semibold text-slate-900">Temperature Preference</h2>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            How do you typically feel during runs? This adjusts outfit recommendations.
          </p>

          <div className="flex flex-wrap gap-2">
            {temperaturePreferences.map((pref) => {
              const labels: Record<TemperaturePreference, { label: string; description: string }> = {
                runs_cold: { label: 'I run cold', description: 'You prefer warmer gear' },
                neutral: { label: 'Neutral', description: 'Standard recommendations' },
                runs_hot: { label: 'I run hot', description: 'You prefer lighter gear' },
              };
              return (
                <button
                  key={pref}
                  type="button"
                  onClick={() => handleTemperaturePreferenceUpdate(pref)}
                  className={cn(
                    'flex-1 min-w-[100px] px-4 py-3 rounded-lg font-medium transition-all text-left',
                    temperaturePreference === pref
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  <p className="font-medium">{labels[pref].label}</p>
                  <p className={cn(
                    'text-xs mt-0.5',
                    temperaturePreference === pref ? 'text-purple-200' : 'text-slate-500'
                  )}>
                    {labels[pref].description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
