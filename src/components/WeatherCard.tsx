'use client';

import { Cloud, Sun, CloudRain, CloudSnow, CloudFog, Zap, Wind, Droplets, Thermometer } from 'lucide-react';
import type { WeatherData } from '@/lib/weather';
import type { ConditionsSeverity } from '@/lib/conditions';
import { getSeverityColor, getSeverityLabel } from '@/lib/conditions';
import { cn } from '@/lib/utils';

interface WeatherCardProps {
  weather: WeatherData;
  severity: ConditionsSeverity;
  compact?: boolean;
  runWindowLabel?: string | null;  // "Right Now", "This Morning", "This Evening"
  runWindowTime?: string | null;   // "6:00 AM", "6:00 PM", etc.
  isLiveWeather?: boolean;         // True if showing current conditions
}

export function WeatherCard({ weather, severity, compact, runWindowLabel, runWindowTime, isLiveWeather = true }: WeatherCardProps) {
  const WeatherIcon = getWeatherIcon(weather.condition);

  if (compact) {
    return (
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <WeatherIcon className="w-5 h-5 text-slate-600" />
          <span className="text-lg font-semibold text-slate-900">{weather.temperature}°</span>
        </div>
        <div className={cn('px-2 py-1 rounded text-xs font-medium', getSeverityColor(severity.severityScore))}>
          {getSeverityLabel(severity.severityScore)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      {/* Run Window Header */}
      {runWindowLabel && (
        <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-100">
          <span className={cn(
            'text-sm font-medium',
            isLiveWeather ? 'text-green-600' : 'text-blue-600'
          )}>
            {isLiveWeather ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                {runWindowLabel}
              </span>
            ) : (
              <>Forecast for {runWindowLabel}</>
            )}
          </span>
          {runWindowTime && (
            <span className="text-xs text-slate-500">{runWindowTime}</span>
          )}
        </div>
      )}

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <WeatherIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-3xl font-bold text-slate-900">{weather.temperature}°F</p>
            <p className="text-sm text-slate-500">{weather.conditionText}</p>
          </div>
        </div>

        <div className={cn('px-3 py-1 rounded-full text-sm font-medium', getSeverityColor(severity.severityScore))}>
          {getSeverityLabel(severity.severityScore)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-slate-400" />
          <div>
            <p className="text-xs text-slate-500">Feels Like</p>
            <p className="text-sm font-medium text-slate-900">{weather.feelsLike}°F</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-slate-400" />
          <div>
            <p className="text-xs text-slate-500">Humidity</p>
            <p className="text-sm font-medium text-slate-900">{weather.humidity}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Wind className="w-4 h-4 text-slate-400" />
          <div>
            <p className="text-xs text-slate-500">Wind</p>
            <p className="text-sm font-medium text-slate-900">{weather.windSpeed} mph</p>
          </div>
        </div>
      </div>

      {severity.description && (
        <p className="text-sm text-slate-600">{severity.description}</p>
      )}

      {severity.heatIndex && severity.heatIndex > weather.temperature && (
        <p className="text-xs text-orange-600 mt-2">
          Heat Index: {severity.heatIndex}°F
        </p>
      )}
    </div>
  );
}

function getWeatherIcon(condition: string) {
  switch (condition) {
    case 'clear':
      return Sun;
    case 'cloudy':
      return Cloud;
    case 'rain':
    case 'drizzle':
      return CloudRain;
    case 'snow':
      return CloudSnow;
    case 'fog':
      return CloudFog;
    case 'thunderstorm':
      return Zap;
    default:
      return Cloud;
  }
}

interface SeverityBannerProps {
  severity: ConditionsSeverity;
}

export function SeverityBanner({ severity }: SeverityBannerProps) {
  if (severity.severityScore < 60) return null;

  return (
    <div className={cn(
      'rounded-lg p-4 mb-4',
      severity.severityScore >= 80 ? 'bg-red-100' : 'bg-orange-100'
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          severity.severityScore >= 80 ? 'bg-red-200' : 'bg-orange-200'
        )}>
          <Thermometer className={cn(
            'w-4 h-4',
            severity.severityScore >= 80 ? 'text-red-700' : 'text-orange-700'
          )} />
        </div>
        <div>
          <p className={cn(
            'font-semibold',
            severity.severityScore >= 80 ? 'text-red-800' : 'text-orange-800'
          )}>
            {severity.severityScore >= 80 ? 'Extreme Conditions' : 'Challenging Conditions'}
          </p>
          <p className={cn(
            'text-sm',
            severity.severityScore >= 80 ? 'text-red-700' : 'text-orange-700'
          )}>
            {severity.description}
          </p>
        </div>
      </div>
    </div>
  );
}
