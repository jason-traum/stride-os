'use client';

import { useState, useTransition, useEffect, useCallback, useRef, useMemo } from 'react';
import { createWorkout } from '@/actions/workouts';
import { getShoes } from '@/actions/shoes';
import { getSettings } from '@/actions/settings';
import { fetchCurrentWeather, fetchHistoricalWeather, searchLocation, getLastWeatherError, getFallbackWeather, type WeatherData, type GeocodingResult, type WeatherError } from '@/lib/weather';
import { calculateConditionsSeverity } from '@/lib/conditions';
import { workoutTypes, activityTypes } from '@/lib/schema';
import { getTodayString, getWorkoutTypeLabel, getActivityTypeLabel, cn, formatPace, isCrossTraining, activityHasDistance, getCrossTrainIntensityLabel } from '@/lib/utils';
import { AssessmentModal } from '@/components/AssessmentModal';
import { Cloud, Thermometer, Droplets, Wind, MapPin, Clock, Search, RefreshCw, Bike, Waves, Dumbbell, Footprints, PersonStanding } from 'lucide-react';
import { useDemoMode } from '@/components/DemoModeProvider';
import { getDemoShoes, addDemoWorkout } from '@/lib/demo-mode';
import { haptic } from '@/lib/haptic';
import { useProfile } from '@/lib/profile-context';
import type { Shoe } from '@/lib/schema';

function getCurrentTimeString(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

// Icons for each activity type
function ActivityTypeIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case 'bike': return <Bike className={className} />;
    case 'swim': return <Waves className={className} />;
    case 'strength': return <Dumbbell className={className} />;
    case 'walk_hike': return <Footprints className={className} />;
    case 'yoga': return <PersonStanding className={className} />;
    default: return null;
  }
}

export default function LogRunPage() {
  const { isDemo, settings: demoSettings } = useDemoMode();
  const { activeProfile } = useProfile();
  const [isPending, startTransition] = useTransition();
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [createdWorkoutId, setCreatedWorkoutId] = useState<number | null>(null);
  const [demoWorkoutSaved, setDemoWorkoutSaved] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<WeatherError | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const isSubmittingRef = useRef(false); // Prevent double submission

  // Home location from settings
  const [homeLocation, setHomeLocation] = useState<{ lat: number; lon: number; name: string } | null>(null);

  // Form state
  const [activityType, setActivityType] = useState('run');
  const [date, setDate] = useState(getTodayString());
  const [time, setTime] = useState(getCurrentTimeString());
  const [distance, setDistance] = useState('5');
  const [distanceSlider, setDistanceSlider] = useState(5);
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('45');
  const [seconds, setSeconds] = useState('0');
  const [durationSlider, setDurationSlider] = useState(45);
  const [workoutType, setWorkoutType] = useState('easy');
  const [crossTrainIntensity, setCrossTrainIntensity] = useState('moderate');
  const [routeName, setRouteName] = useState('');
  const [shoeId, setShoeId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Derived state
  const isXTrain = isCrossTraining(activityType);
  const showDistance = activityHasDistance(activityType);

  // When switching activity type, auto-set workout type
  const handleActivityTypeChange = (type: string) => {
    setActivityType(type);
    if (type === 'run') {
      setWorkoutType('easy');
    } else {
      setWorkoutType('cross_train');
    }
  };

  // Slider sync helpers
  const handleDistanceSlider = (val: number) => {
    setDistanceSlider(val);
    setDistance(val.toFixed(1));
  };

  const handleDistanceInput = (val: string) => {
    setDistance(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 1 && num <= 20) {
      setDistanceSlider(num);
    }
  };

  const handleDurationSlider = (totalMin: number) => {
    setDurationSlider(totalMin);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    setHours(String(h));
    setMinutes(String(m));
    setSeconds('0');
  };

  const handleDurationInputSync = () => {
    const totalMin = (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);
    if (totalMin >= 10 && totalMin <= 180) {
      setDurationSlider(totalMin);
    }
  };

  // Slider fill percentage for the gradient track
  const distancePct = ((distanceSlider - 1) / (20 - 1)) * 100;
  const durationPct = ((durationSlider - 10) / (180 - 10)) * 100;

  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Location override state
  const [useCustomLocation, setUseCustomLocation] = useState(false);
  const [customLat, setCustomLat] = useState<number | null>(null);
  const [customLon, setCustomLon] = useState<number | null>(null);
  const [customLocationName, setCustomLocationName] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState<GeocodingResult[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  // Get active location (custom or home)
  const activeLocation = useMemo(
    () => (
      useCustomLocation && customLat != null && customLon != null
        ? { lat: customLat, lon: customLon, name: customLocationName }
        : homeLocation
    ),
    [useCustomLocation, customLat, customLon, customLocationName, homeLocation]
  );

  // Fetch weather based on date, time, and location
  const fetchWeatherForRun = useCallback(async () => {
    if (!activeLocation) return;

    setIsLoadingWeather(true);
    setWeatherError(null);
    const today = getTodayString();
    const now = getCurrentTimeString();

    let weatherData: WeatherData | null = null;

    // If it's current date and time is close to now, use current weather
    if (date === today && Math.abs(parseInt(time.split(':')[0]) - parseInt(now.split(':')[0])) <= 1) {
      weatherData = await fetchCurrentWeather(activeLocation.lat, activeLocation.lon);
    } else {
      // Fetch historical/specific time weather
      weatherData = await fetchHistoricalWeather(activeLocation.lat, activeLocation.lon, date, time);
    }

    // Check for errors and provide fallback
    const error = getLastWeatherError();
    if (!weatherData && error) {
      setWeatherError(error);
      // Use fallback weather so the form can still be submitted
      setWeather(getFallbackWeather());
    } else {
      setWeather(weatherData);
    }

    setIsLoadingWeather(false);
  }, [activeLocation, date, time]);

  useEffect(() => {
    if (isDemo) {
      // Demo mode: Load from localStorage
      const demoShoes = getDemoShoes();
      // Convert DemoShoe to Shoe type (matching expected shape)
      setShoes(demoShoes.map(s => ({
        id: s.id,
        name: s.name,
        brand: s.brand,
        model: s.model,
        category: 'daily_trainer' as const,
        intendedUse: '[]',
        totalMiles: s.totalMiles,
        isRetired: s.isRetired,
        purchaseDate: null,
        notes: null,
        createdAt: new Date().toISOString(),
      })) as Shoe[]);

      // Use demo settings for location
      if (demoSettings?.latitude && demoSettings?.longitude) {
        setHomeLocation({
          lat: demoSettings.latitude,
          lon: demoSettings.longitude,
          name: demoSettings.cityName || 'Home'
        });
      }
    } else {
      // Normal mode: Load from server
      const profileId = activeProfile?.id;
      getShoes(false, profileId).then(setShoes);

      getSettings(profileId).then(async (settings) => {
        if (settings?.latitude && settings?.longitude) {
          setHomeLocation({
            lat: settings.latitude,
            lon: settings.longitude,
            name: settings.cityName || 'Home'
          });
        }
      });
    }
  }, [isDemo, demoSettings, activeProfile?.id]);

  // Fetch weather when location, date, or time changes
  useEffect(() => {
    if (activeLocation) {
      fetchWeatherForRun();
    }
  }, [activeLocation, date, time, fetchWeatherForRun]);

  const handleLocationSearch = async () => {
    if (!locationSearch.trim()) return;
    setIsSearchingLocation(true);
    const results = await searchLocation(locationSearch);
    setLocationResults(results);
    setIsSearchingLocation(false);
  };

  const handleSelectLocation = (result: GeocodingResult) => {
    const displayName = result.admin1
      ? `${result.name}, ${result.admin1}`
      : `${result.name}, ${result.country}`;
    setCustomLat(result.latitude);
    setCustomLon(result.longitude);
    setCustomLocationName(displayName);
    setUseCustomLocation(true);
    setLocationResults([]);
    setLocationSearch('');
  };

  const handleUseHomeLocation = () => {
    setUseCustomLocation(false);
    setCustomLat(null);
    setCustomLon(null);
    setCustomLocationName('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent double submission
    if (isSubmittingRef.current || isPending) {
      return;
    }

    const distanceMiles = showDistance ? (parseFloat(distance) || 0) : 0;
    const totalMinutes =
      (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0) + (parseInt(seconds) || 0) / 60;
    const durationMinutes = totalMinutes > 0 ? Math.round(totalMinutes) : 0;

    // Validate inputs
    const errors: string[] = [];

    if (isXTrain) {
      // Cross-training: duration is required
      if (durationMinutes === 0) {
        errors.push('Please enter a duration');
      }
    } else {
      // Running: at least one of distance or duration should be provided
      if (distanceMiles === 0 && durationMinutes === 0) {
        errors.push('Please enter at least distance or duration');
      }
    }

    // Distance validation (0.1 - 100 miles)
    if (distanceMiles > 0 && (distanceMiles < 0.1 || distanceMiles > 100)) {
      errors.push('Distance should be between 0.1 and 100 miles');
    }

    // Duration validation (1 minute - 10 hours)
    if (durationMinutes > 0 && (durationMinutes < 1 || durationMinutes > 600)) {
      errors.push('Duration should be between 1 minute and 10 hours');
    }

    // Pace validation if both distance and duration provided (runs only)
    if (!isXTrain && distanceMiles > 0 && durationMinutes > 0) {
      const paceMinPerMile = durationMinutes / distanceMiles;
      if (paceMinPerMile < 2) {
        errors.push('Pace seems too fast (under 2:00/mile). Please check your inputs.');
      } else if (paceMinPerMile > 30) {
        errors.push('Pace seems too slow (over 30:00/mile). Please check your inputs.');
      }
    }

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    // Clear validation errors and proceed
    setValidationErrors([]);
    isSubmittingRef.current = true;

    // Calculate average pace in seconds per mile
    const totalSeconds = (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
    const avgPaceSeconds = distanceMiles > 0 && totalSeconds > 0 ? Math.round(totalSeconds / distanceMiles) : 0;

    // Calculate weather severity if we have weather data
    const severity = weather ? calculateConditionsSeverity(weather) : null;

    if (isDemo) {
      // Demo mode: Save to localStorage
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _newWorkout = addDemoWorkout({
        date,
        distanceMiles,
        durationMinutes,
        avgPaceSeconds,
        workoutType,
        notes: notes || undefined,
        shoeId: shoeId ? Number(shoeId) : undefined,
      });

      haptic('success');
      setDemoWorkoutSaved(true);
      isSubmittingRef.current = false;
    } else {
      // Normal mode: Save to server
      startTransition(async () => {
        try {
          const workout = await createWorkout({
            date,
            distanceMiles: distanceMiles || undefined,
            durationMinutes: durationMinutes || undefined,
            workoutType,
            activityType,
            crossTrainIntensity: isXTrain ? crossTrainIntensity : undefined,
            routeName: routeName || undefined,
            shoeId: shoeId ? Number(shoeId) : undefined,
            notes: notes || undefined,
            // Weather data
            weatherTempF: weather?.temperature,
            weatherFeelsLikeF: weather?.feelsLike,
            weatherHumidityPct: weather?.humidity,
            weatherWindMph: weather?.windSpeed,
            weatherConditions: weather?.condition,
            weatherSeverityScore: severity?.severityScore,
            // Profile
            profileId: activeProfile?.id,
          });

          haptic('success');
          setCreatedWorkoutId(workout.id);
        } finally {
          isSubmittingRef.current = false;
        }
      });
    }
  };

  const calculatedPace = () => {
    if (isXTrain) return null;
    const dist = parseFloat(distance);
    const totalSeconds =
      (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
    if (!dist || !totalSeconds) return null;
    const paceSeconds = totalSeconds / dist;
    return `${formatPace(paceSeconds)} /mi`;
  };

  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-primary mb-6">
        {isXTrain ? 'Log Activity' : 'Log a Run'}
      </h1>

      {/* Activity Type Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-secondary mb-2">Activity Type</label>
        <div className="flex flex-wrap gap-2">
          {activityTypes.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => handleActivityTypeChange(type)}
              className={cn(
                'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors inline-flex items-center gap-1.5',
                activityType === type
                  ? 'bg-dream-600 text-white'
                  : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
              )}
            >
              {type !== 'run' && type !== 'other' && <ActivityTypeIcon type={type} className="w-3.5 h-3.5" />}
              {getActivityTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Weather Banner */}
      <div className="bg-surface-1 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-dream-600" />
            <span className="text-sm font-medium text-primary">
              Weather for {activeLocation?.name || 'your location'}
            </span>
          </div>
          {isLoadingWeather && (
            <RefreshCw className="w-4 h-4 text-dream-500 animate-spin" />
          )}
        </div>
        {weatherError && (
          <div className="mb-2 p-2 bg-surface-1 border border-default rounded-lg">
            <p className="text-sm text-secondary">{weatherError.message}</p>
            {weatherError.canRetry && (
              <button
                type="button"
                onClick={fetchWeatherForRun}
                className="text-xs text-dream-600 hover:text-secondary underline mt-1"
              >
                Try again
              </button>
            )}
          </div>
        )}
        {weather ? (
          <>
            <div className="flex items-center gap-6 text-sm text-secondary">
              <span className="flex items-center gap-1">
                <Thermometer className="w-4 h-4" />
                {weather.temperature}°F (feels {weather.feelsLike}°F)
              </span>
              <span className="flex items-center gap-1">
                <Droplets className="w-4 h-4" />
                {weather.humidity}%
              </span>
              <span className="flex items-center gap-1">
                <Wind className="w-4 h-4" />
                {weather.windSpeed} mph
              </span>
            </div>
            <p className="text-xs text-dream-600 mt-2">
              {weatherError ? 'Using default weather conditions' : 'Weather will be automatically recorded with this workout'}
            </p>
          </>
        ) : activeLocation ? (
          <p className="text-sm text-dream-700">Loading weather data...</p>
        ) : (
          <p className="text-sm text-dream-700">Set a location in Settings to see weather</p>
        )}
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4 mb-6">
          <p className="text-sm font-medium text-red-800 mb-2">Please fix the following:</p>
          <ul className="list-disc list-inside space-y-1">
            {validationErrors.map((error, index) => (
              <li key={index} className="text-sm text-red-300">{error}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              Start Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
            />
          </div>
        </div>

        {/* Location Override — show for outdoor activities */}
        {(activityType === 'run' || activityType === 'bike' || activityType === 'walk_hike') && (
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              <MapPin className="w-3.5 h-3.5 inline mr-1" />
              Location
            </label>

            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={handleUseHomeLocation}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
                  !useCustomLocation
                    ? 'bg-dream-600 text-white'
                    : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                )}
              >
                {homeLocation?.name || 'Home'}
              </button>
              <button
                type="button"
                onClick={() => setUseCustomLocation(true)}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
                  useCustomLocation
                    ? 'bg-dream-600 text-white'
                    : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                )}
              >
                {useCustomLocation && customLocationName ? customLocationName : 'Other location'}
              </button>
            </div>

            {useCustomLocation && (
              <div className="mt-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={locationSearch}
                    onChange={(e) => setLocationSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleLocationSearch())}
                    placeholder="Search city or zip..."
                    className="flex-1 px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleLocationSearch}
                    disabled={isSearchingLocation}
                    className="px-3 py-2 bg-bgTertiary text-textSecondary rounded-xl hover:bg-bgInteractive-hover transition-colors"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                </div>

                {locationResults.length > 0 && (
                  <div className="mt-2 border border-default rounded-lg divide-y divide-border-subtle bg-surface-1 shadow-sm">
                    {locationResults.map((result, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSelectLocation(result)}
                        className="w-full px-3 py-2 text-left hover:bg-surface-1 transition-colors text-sm"
                      >
                        <span className="font-medium text-primary">{result.name}</span>
                        <span className="text-textTertiary ml-1">
                          {result.admin1 ? `${result.admin1}, ` : ''}{result.country}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Distance — shown for run, bike, swim, walk/hike */}
        {showDistance && (
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <label className="text-sm font-medium text-secondary">
                Distance {isXTrain ? '(optional)' : ''}
              </label>
              <div className="flex items-baseline gap-1">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="100"
                  value={distance}
                  onChange={(e) => handleDistanceInput(e.target.value)}
                  className="w-16 px-2 py-1 text-right text-lg font-semibold text-primary bg-surface-1 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="text-sm text-secondary">mi</span>
              </div>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="0.1"
              value={distanceSlider}
              onChange={(e) => handleDistanceSlider(parseFloat(e.target.value))}
              className="range-slider w-full"
              style={{
                background: `linear-gradient(to right, #7c6cf0 0%, #7c6cf0 ${distancePct}%, var(--surface-2) ${distancePct}%, var(--surface-2) 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-tertiary mt-1">
              <span>1 mi</span>
              <span>10 mi</span>
              <span>20 mi</span>
            </div>
          </div>
        )}

        {/* Duration */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <label className="text-sm font-medium text-secondary">Duration</label>
            <div className="flex items-baseline gap-1.5">
              <input
                type="number"
                value={hours}
                onChange={(e) => { setHours(e.target.value); }}
                onBlur={handleDurationInputSync}
                placeholder="0"
                min="0"
                max="3"
                className="w-10 px-1.5 py-1 text-center text-lg font-semibold text-primary bg-surface-1 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-sm text-secondary">h</span>
              <input
                type="number"
                value={minutes}
                onChange={(e) => { setMinutes(e.target.value); }}
                onBlur={handleDurationInputSync}
                placeholder="0"
                min="0"
                max="59"
                className="w-12 px-1.5 py-1 text-center text-lg font-semibold text-primary bg-surface-1 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-sm text-secondary">m</span>
              <input
                type="number"
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                placeholder="0"
                min="0"
                max="59"
                className="w-12 px-1.5 py-1 text-center text-lg font-semibold text-primary bg-surface-1 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="text-sm text-secondary">s</span>
            </div>
          </div>
          <input
            type="range"
            min="10"
            max="180"
            step="1"
            value={durationSlider}
            onChange={(e) => handleDurationSlider(parseInt(e.target.value))}
            className="range-slider w-full"
            style={{
              background: `linear-gradient(to right, #7c6cf0 0%, #7c6cf0 ${durationPct}%, var(--surface-2) ${durationPct}%, var(--surface-2) 100%)`
            }}
          />
          <div className="flex justify-between text-xs text-tertiary mt-1">
            <span>10m</span>
            <span>1h</span>
            <span>2h</span>
            <span>3h</span>
          </div>
          {calculatedPace() && (
            <p className="text-sm text-dream-600 mt-2 font-medium">
              Pace: {calculatedPace()}
            </p>
          )}
        </div>

        {/* Workout Type (for runs) */}
        {!isXTrain && (
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Workout Type</label>
            <div className="flex flex-wrap gap-2">
              {workoutTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setWorkoutType(type)}
                  className={cn(
                    'px-3 py-1.5 rounded-xl text-sm font-medium transition-colors',
                    workoutType === type
                      ? 'bg-dream-600 text-white'
                      : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                  )}
                >
                  {getWorkoutTypeLabel(type)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Intensity (for cross-training) */}
        {isXTrain && (
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">Intensity</label>
            <div className="flex flex-wrap gap-2">
              {(['easy', 'moderate', 'hard'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setCrossTrainIntensity(level)}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                    crossTrainIntensity === level
                      ? level === 'easy' ? 'bg-sky-600 text-white'
                        : level === 'moderate' ? 'bg-amber-600 text-white'
                        : 'bg-red-600 text-white'
                      : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                  )}
                >
                  {getCrossTrainIntensityLabel(level)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Route Name (for outdoor activities) */}
        {(activityType === 'run' || activityType === 'bike' || activityType === 'walk_hike') && (
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Route Name (optional)
            </label>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="e.g., Neighborhood loop, Park trail"
              className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
            />
          </div>
        )}

        {/* Shoe Selection (for running only) */}
        {!isXTrain && (
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">Shoe (optional)</label>
            <select
              value={shoeId}
              onChange={(e) => setShoeId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
            >
              <option value="">No shoe selected</option>
              {shoes.map((shoe) => (
                <option key={shoe.id} value={shoe.id}>
                  {shoe.name} ({shoe.totalMiles.toFixed(0)} mi)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={isXTrain ? 'How was the session?' : 'How did it go? Any observations?'}
            rows={3}
            className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500 resize-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            'w-full py-3 px-4 rounded-xl font-medium transition-colors',
            isPending
              ? 'bg-surface-3 text-textTertiary cursor-not-allowed'
              : 'bg-accentTeal text-white hover:bg-accentTeal-hover shadow-sm'
          )}
        >
          {isPending ? 'Saving...' : isXTrain ? `Log ${getActivityTypeLabel(activityType)}` : 'Log Run'}
        </button>
      </form>

      {/* Assessment Modal (non-demo mode, runs only) */}
      {createdWorkoutId && !isDemo && !isXTrain && (
        <AssessmentModal
          workoutId={createdWorkoutId}
          onClose={() => setCreatedWorkoutId(null)}
          workoutDistance={distance ? parseFloat(distance) : undefined}
          workoutType={workoutType}
        />
      )}

      {/* Success Modal for cross-training or demo */}
      {((createdWorkoutId && isXTrain) || demoWorkoutSaved) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface-1 rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="w-16 h-16 bg-green-950 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-primary mb-2">
              {isXTrain ? `${getActivityTypeLabel(activityType)} Logged!` : 'Workout Logged!'}
            </h2>
            <p className="text-textSecondary mb-4">Your activity has been saved to your history.</p>
            <div className="flex gap-3">
              <a
                href="/today"
                className="btn-primary flex-1 py-2.5 rounded-xl"
              >
                Go to Today
              </a>
              <button
                onClick={() => {
                  setDemoWorkoutSaved(false);
                  setCreatedWorkoutId(null);
                  // Reset form to smart defaults
                  setActivityType('run');
                  setDistance('5');
                  setDistanceSlider(5);
                  setHours('0');
                  setMinutes('45');
                  setSeconds('0');
                  setDurationSlider(45);
                  setWorkoutType('easy');
                  setCrossTrainIntensity('moderate');
                  setRouteName('');
                  setNotes('');
                  setShoeId('');
                }}
                className="flex-1 border border-strong text-secondary py-2.5 rounded-xl font-medium hover:bg-bgTertiary transition-colors"
              >
                Log Another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
