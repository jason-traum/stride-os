'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getSettings } from '@/actions/settings';
import { fetchCurrentWeather, type WeatherData } from '@/lib/weather';
import {
  calculateConditionsSeverity,
  calculatePaceAdjustment,
  parsePaceToSeconds,
  getSeverityColor,
  getSeverityLabel,
  type ConditionsSeverity,
} from '@/lib/conditions';
import { type WorkoutType } from '@/lib/schema';
import { cn } from '@/lib/utils';
import {
  Timer,
  ArrowRight,
  AlertTriangle,
  Thermometer,
  Droplets,
  Wind,
  MapPin,
  Settings,
  RefreshCw,
} from 'lucide-react';

const workoutTypeLabels: Record<WorkoutType, string> = {
  easy: 'Easy',
  steady: 'Steady',
  tempo: 'Tempo',
  interval: 'Intervals',
  long: 'Long Run',
  race: 'Race',
  recovery: 'Recovery',
  cross_train: 'Cross Train',
  other: 'Other',
};

export default function PaceCalculatorPage() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [severity, setSeverity] = useState<ConditionsSeverity | null>(null);
  const [hasLocation, setHasLocation] = useState<boolean | null>(null);
  const [acclimatizationScore, setAcclimatizationScore] = useState(50);
  const [isLoading, setIsLoading] = useState(true);

  // Manual weather overrides
  const [useManualWeather, setUseManualWeather] = useState(false);
  const [manualTemp, setManualTemp] = useState('75');
  const [manualHumidity, setManualHumidity] = useState('50');
  const [manualWind, setManualWind] = useState('5');

  // Pace inputs
  const [paceInput, setPaceInput] = useState('');
  const [workoutType, setWorkoutType] = useState<WorkoutType>('easy');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const settings = await getSettings();

    if (settings) {
      setAcclimatizationScore(settings.heatAcclimatizationScore ?? 50);

      if (settings.defaultTargetPaceSeconds) {
        const minutes = Math.floor(settings.defaultTargetPaceSeconds / 60);
        const seconds = settings.defaultTargetPaceSeconds % 60;
        setPaceInput(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }

      if (settings.latitude && settings.longitude) {
        setHasLocation(true);
        const weatherData = await fetchCurrentWeather(settings.latitude, settings.longitude);
        if (weatherData) {
          setWeather(weatherData);
          setSeverity(calculateConditionsSeverity(weatherData));
        }
      } else {
        setHasLocation(false);
      }
    } else {
      setHasLocation(false);
    }
    setIsLoading(false);
  };

  const handleManualWeatherChange = useCallback(() => {
    const temp = parseInt(manualTemp) || 75;
    const humidity = parseInt(manualHumidity) || 50;
    const wind = parseInt(manualWind) || 5;

    const manualWeather: WeatherData = {
      temperature: temp,
      feelsLike: temp,
      humidity,
      windSpeed: wind,
      weatherCode: 0,
      condition: 'clear',
      conditionText: 'Manual input',
    };

    setWeather(manualWeather);
    setSeverity(calculateConditionsSeverity(manualWeather));
  }, [manualTemp, manualHumidity, manualWind]);

  useEffect(() => {
    if (useManualWeather) {
      handleManualWeatherChange();
    }
  }, [useManualWeather, handleManualWeatherChange]);

  const paceSeconds = parsePaceToSeconds(paceInput);
  const adjustment = paceSeconds && severity
    ? calculatePaceAdjustment(paceSeconds, severity, workoutType, acclimatizationScore)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Pace Calculator</h1>
        <p className="text-textSecondary mt-1">Calculate your adjusted pace based on conditions</p>
      </div>

      {isLoading ? (
        <div className="bg-surface-1 rounded-xl border border-default p-8 text-center shadow-sm">
          <RefreshCw className="w-6 h-6 text-tertiary mx-auto animate-spin" />
          <p className="text-textTertiary mt-2">Loading weather data...</p>
        </div>
      ) : !hasLocation && !useManualWeather ? (
        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-dream-900/30 rounded-full flex items-center justify-center">
              <MapPin className="w-5 h-5 text-dream-600" />
            </div>
            <div>
              <h2 className="font-semibold text-primary">Location Required</h2>
              <p className="text-sm text-textTertiary">Set your location or use manual conditions</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link
              href="/settings"
              className="btn-primary inline-flex items-center gap-2 text-sm"
            >
              <Settings className="w-4 h-4" />
              Go to Settings
            </Link>
            <button
              onClick={() => setUseManualWeather(true)}
              className="btn-secondary text-sm"
            >
              Enter conditions manually
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Current Conditions */}
          <div className="bg-surface-1 rounded-xl border border-default p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-primary">Current Conditions</h2>
              <button
                onClick={async () => {
                  if (useManualWeather) {
                    // Switching to live weather - refresh data
                    setUseManualWeather(false);
                    await loadData();
                  } else {
                    setUseManualWeather(true);
                  }
                }}
                className="text-sm text-dream-600 hover:text-dream-700 font-medium"
              >
                {useManualWeather ? 'Use live weather' : 'Enter manually'}
              </button>
            </div>

            {useManualWeather ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-textTertiary mb-1">
                    Temperature (°F)
                  </label>
                  <div className="flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-tertiary" />
                    <input
                      type="number"
                      value={manualTemp}
                      onChange={(e) => setManualTemp(e.target.value)}
                      className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-textTertiary mb-1">
                    Humidity (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-tertiary" />
                    <input
                      type="number"
                      value={manualHumidity}
                      onChange={(e) => setManualHumidity(e.target.value)}
                      min="0"
                      max="100"
                      className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-textTertiary mb-1">
                    Wind (mph)
                  </label>
                  <div className="flex items-center gap-2">
                    <Wind className="w-4 h-4 text-tertiary" />
                    <input
                      type="number"
                      value={manualWind}
                      onChange={(e) => setManualWind(e.target.value)}
                      min="0"
                      className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500"
                    />
                  </div>
                </div>
              </div>
            ) : weather && severity ? (
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-textTertiary mb-1">Temperature</p>
                  <p className="text-xl font-bold text-primary">{weather.temperature}°F</p>
                </div>
                <div>
                  <p className="text-xs text-textTertiary mb-1">Feels Like</p>
                  <p className="text-xl font-bold text-primary">{weather.feelsLike}°F</p>
                </div>
                <div>
                  <p className="text-xs text-textTertiary mb-1">Humidity</p>
                  <p className="text-xl font-bold text-primary">{weather.humidity}%</p>
                </div>
                <div>
                  <p className="text-xs text-textTertiary mb-1">Wind</p>
                  <p className="text-xl font-bold text-primary">{weather.windSpeed} mph</p>
                </div>
              </div>
            ) : (
              <p className="text-textTertiary">Unable to load weather data</p>
            )}

            {severity && (
              <div className="mt-4 pt-4 border-t border-subtle">
                <div className="flex items-center gap-3">
                  <span className={cn('px-3 py-1 rounded-full text-sm font-medium', getSeverityColor(severity.severityScore))}>
                    {getSeverityLabel(severity.severityScore)}
                  </span>
                  <span className="text-textSecondary text-sm">
                    Severity: {severity.severityScore}/100
                  </span>
                  {severity.heatIndex && severity.heatIndex > (weather?.temperature || 0) && (
                    <span className="text-rose-600 text-sm">
                      Heat Index: {severity.heatIndex}°F
                    </span>
                  )}
                </div>
                <p className="text-sm text-textSecondary mt-2">{severity.description}</p>
              </div>
            )}
          </div>

          {/* Pace Calculator */}
          <div className="bg-surface-1 rounded-xl border border-default p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Timer className="w-5 h-5 text-dream-600" />
              <h2 className="font-semibold text-primary">Calculate Adjusted Pace</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">
                    Target Pace (min:sec per mile)
                  </label>
                  <input
                    type="text"
                    value={paceInput}
                    onChange={(e) => setPaceInput(e.target.value)}
                    placeholder="7:00"
                    className="w-full px-4 py-3 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500 text-xl font-medium text-center"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-secondary mb-2">
                    Workout Type
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['easy', 'long', 'steady', 'tempo', 'interval', 'race'] as WorkoutType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => setWorkoutType(type)}
                        className={cn(
                          'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          workoutType === type
                            ? 'bg-dream-600 text-white'
                            : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover hover:text-textPrimary'
                        )}
                      >
                        {workoutTypeLabels[type]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-bgTertiary rounded-lg">
                  <p className="text-xs text-textTertiary mb-1">Your Heat Acclimatization</p>
                  <p className="font-medium text-primary">
                    {acclimatizationScore}/100
                    <span className="text-textTertiary font-normal ml-2">
                      ({acclimatizationScore >= 70 ? 'Well acclimatized' : acclimatizationScore >= 40 ? 'Moderate' : 'Low'})
                    </span>
                  </p>
                  <Link href="/settings" className="link-primary text-xs">
                    Update in Settings
                  </Link>
                </div>
              </div>

              {/* Result */}
              <div className="flex flex-col justify-center">
                {adjustment ? (
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-6 mb-4">
                      <div>
                        <p className="text-xs text-textTertiary mb-1">Target</p>
                        <p className="text-3xl font-bold text-tertiary">{adjustment.originalPace}</p>
                      </div>
                      <ArrowRight className="w-8 h-8 text-tertiary" />
                      <div>
                        <p className="text-xs text-textTertiary mb-1">Adjusted</p>
                        <p className="text-4xl font-bold text-dream-600">{adjustment.adjustedPace}</p>
                      </div>
                    </div>

                    {adjustment.adjustmentSeconds > 0 && (
                      <p className="text-textSecondary mb-4">
                        <span className="font-medium">+{adjustment.adjustmentSeconds} sec/mile</span>
                        <br />
                        <span className="text-sm">{adjustment.reason}</span>
                      </p>
                    )}

                    <div className="bg-surface-1 rounded-lg p-4 text-left">
                      <p className="text-sm text-secondary">{adjustment.recommendation}</p>
                    </div>

                    {adjustment.warnings.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {adjustment.warnings.map((warning, i) => (
                          <div key={i} className="flex items-start gap-2 text-rose-600 text-left">
                            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <p className="text-sm">{warning}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-textTertiary">
                    <Timer className="w-12 h-12 mx-auto text-tertiary mb-3" />
                    <p>Enter your target pace to see the adjusted pace</p>
                    <p className="text-sm mt-1">Format: 7:00 for 7 min/mile</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-bgTertiary rounded-xl p-5">
            <h3 className="font-semibold text-primary mb-3">How it works</h3>
            <div className="space-y-2 text-sm text-textSecondary">
              <p>
                <strong>Heat stress</strong> is the primary factor. High heat index (temperature + humidity)
                significantly impacts performance.
              </p>
              <p>
                <strong>Workout type</strong> affects adjustment magnitude. Easy runs get full adjustment;
                tempo runs get ~70%; intervals get ~50%.
              </p>
              <p>
                <strong>Acclimatization</strong> matters. Well-acclimatized runners need less pace adjustment
                in the same conditions.
              </p>
              <p className="text-textTertiary italic">
                These are guidelines based on exercise physiology research. Always listen to your body.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
