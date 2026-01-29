'use client';

import { useState, useTransition, useEffect, useCallback, useRef } from 'react';
import { createWorkout } from '@/actions/workouts';
import { getShoes } from '@/actions/shoes';
import { getSettings } from '@/actions/settings';
import { fetchCurrentWeather, fetchHistoricalWeather, searchLocation, type WeatherData, type GeocodingResult } from '@/lib/weather';
import { calculateConditionsSeverity } from '@/lib/conditions';
import { workoutTypes } from '@/lib/schema';
import { getTodayString, getWorkoutTypeLabel, cn } from '@/lib/utils';
import { AssessmentModal } from '@/components/AssessmentModal';
import { Cloud, Thermometer, Droplets, Wind, MapPin, Clock, Search, RefreshCw } from 'lucide-react';
import type { Shoe } from '@/lib/schema';

function getCurrentTimeString(): string {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}

export default function LogRunPage() {
  const [isPending, startTransition] = useTransition();
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [createdWorkoutId, setCreatedWorkoutId] = useState<number | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(false);
  const isSubmittingRef = useRef(false); // Prevent double submission

  // Home location from settings
  const [homeLocation, setHomeLocation] = useState<{ lat: number; lon: number; name: string } | null>(null);

  // Form state
  const [date, setDate] = useState(getTodayString());
  const [time, setTime] = useState(getCurrentTimeString());
  const [distance, setDistance] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [workoutType, setWorkoutType] = useState('easy');
  const [routeName, setRouteName] = useState('');
  const [shoeId, setShoeId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  // Location override state
  const [useCustomLocation, setUseCustomLocation] = useState(false);
  const [customLat, setCustomLat] = useState<number | null>(null);
  const [customLon, setCustomLon] = useState<number | null>(null);
  const [customLocationName, setCustomLocationName] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  const [locationResults, setLocationResults] = useState<GeocodingResult[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  // Get active location (custom or home)
  const activeLocation = useCustomLocation && customLat && customLon
    ? { lat: customLat, lon: customLon, name: customLocationName }
    : homeLocation;

  // Fetch weather based on date, time, and location
  const fetchWeatherForRun = useCallback(async () => {
    if (!activeLocation) return;

    setIsLoadingWeather(true);
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

    setWeather(weatherData);
    setIsLoadingWeather(false);
  }, [activeLocation, date, time]);

  useEffect(() => {
    // Load shoes
    getShoes().then(setShoes);

    // Load settings for home location
    getSettings().then(async (settings) => {
      if (settings?.latitude && settings?.longitude) {
        setHomeLocation({
          lat: settings.latitude,
          lon: settings.longitude,
          name: settings.cityName || 'Home'
        });
      }
    });
  }, []);

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
    isSubmittingRef.current = true;

    const distanceMiles = parseFloat(distance) || undefined;
    const totalMinutes =
      (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0) + (parseInt(seconds) || 0) / 60;
    const durationMinutes = totalMinutes > 0 ? Math.round(totalMinutes) : undefined;

    // Calculate weather severity if we have weather data
    const severity = weather ? calculateConditionsSeverity(weather) : null;

    startTransition(async () => {
      try {
        const workout = await createWorkout({
          date,
          distanceMiles,
          durationMinutes,
          workoutType,
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
        });

        setCreatedWorkoutId(workout.id);
      } finally {
        isSubmittingRef.current = false;
      }
    });
  };

  const calculatedPace = () => {
    const dist = parseFloat(distance);
    const totalSeconds =
      (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
    if (!dist || !totalSeconds) return null;
    const paceSeconds = totalSeconds / dist;
    const paceMin = Math.floor(paceSeconds / 60);
    const paceSec = Math.round(paceSeconds % 60);
    return `${paceMin}:${paceSec.toString().padStart(2, '0')} /mi`;
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Log a Run</h1>

      {/* Weather Banner */}
      <div className="bg-blue-50 rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">
              Weather for {activeLocation?.name || 'your location'}
            </span>
          </div>
          {isLoadingWeather && (
            <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
          )}
        </div>
        {weather ? (
          <>
            <div className="flex items-center gap-6 text-sm text-blue-800">
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
            <p className="text-xs text-blue-600 mt-2">
              Weather will be automatically recorded with this workout
            </p>
          </>
        ) : activeLocation ? (
          <p className="text-sm text-blue-700">Loading weather data...</p>
        ) : (
          <p className="text-sm text-blue-700">Set a location in Settings to see weather</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              <Clock className="w-3.5 h-3.5 inline mr-1" />
              Start Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Location Override */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            <MapPin className="w-3.5 h-3.5 inline mr-1" />
            Run Location
          </label>

          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={handleUseHomeLocation}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                !useCustomLocation
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              )}
            >
              {homeLocation?.name || 'Home'}
            </button>
            <button
              type="button"
              onClick={() => setUseCustomLocation(true)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                useCustomLocation
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
                <button
                  type="button"
                  onClick={handleLocationSearch}
                  disabled={isSearchingLocation}
                  className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>

              {locationResults.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white shadow-sm">
                  {locationResults.map((result, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleSelectLocation(result)}
                      className="w-full px-3 py-2 text-left hover:bg-blue-50 transition-colors text-sm"
                    >
                      <span className="font-medium text-slate-900">{result.name}</span>
                      <span className="text-slate-500 ml-1">
                        {result.admin1 ? `${result.admin1}, ` : ''}{result.country}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Distance */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Distance (miles)</label>
          <input
            type="number"
            step="0.01"
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
            placeholder="0.00"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Duration</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="number"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                min="0"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 mt-1 block">hours</span>
            </div>
            <div className="flex-1">
              <input
                type="number"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="0"
                min="0"
                max="59"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 mt-1 block">min</span>
            </div>
            <div className="flex-1">
              <input
                type="number"
                value={seconds}
                onChange={(e) => setSeconds(e.target.value)}
                placeholder="0"
                min="0"
                max="59"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="text-xs text-slate-500 mt-1 block">sec</span>
            </div>
          </div>
          {calculatedPace() && (
            <p className="text-sm text-blue-600 mt-2">
              Pace: {calculatedPace()}
            </p>
          )}
        </div>

        {/* Workout Type */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Workout Type</label>
          <div className="flex flex-wrap gap-2">
            {workoutTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setWorkoutType(type)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  workoutType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                )}
              >
                {getWorkoutTypeLabel(type)}
              </button>
            ))}
          </div>
        </div>

        {/* Route Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Route Name (optional)
          </label>
          <input
            type="text"
            value={routeName}
            onChange={(e) => setRouteName(e.target.value)}
            placeholder="e.g., Neighborhood loop, Park trail"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Shoe Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Shoe (optional)</label>
          <select
            value={shoeId}
            onChange={(e) => setShoeId(e.target.value ? Number(e.target.value) : '')}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">No shoe selected</option>
            {shoes.map((shoe) => (
              <option key={shoe.id} value={shoe.id}>
                {shoe.name} ({shoe.totalMiles.toFixed(0)} mi)
              </option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it go? Any observations?"
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            'w-full py-3 px-4 rounded-lg font-medium transition-colors',
            isPending
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          {isPending ? 'Saving...' : 'Log Run'}
        </button>
      </form>

      {/* Assessment Modal */}
      {createdWorkoutId && (
        <AssessmentModal
          workoutId={createdWorkoutId}
          onClose={() => setCreatedWorkoutId(null)}
        />
      )}
    </div>
  );
}
