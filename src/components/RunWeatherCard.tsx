'use client';

import { useState, useMemo } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, CloudLightning, CloudFog, Droplets, Wind, ChevronDown } from 'lucide-react';
import type { ForecastData, WeatherCondition } from '@/lib/weather';

function getConditionIcon(condition: WeatherCondition) {
  switch (condition) {
    case 'clear': return Sun;
    case 'cloudy': return Cloud;
    case 'rain': case 'drizzle': return CloudRain;
    case 'snow': return CloudSnow;
    case 'thunderstorm': return CloudLightning;
    case 'fog': return CloudFog;
    default: return Cloud;
  }
}

interface RunTimeOption {
  label: string;
  hourIndex: number; // index into hourly array
}

interface RunWeatherCardProps {
  forecast: ForecastData;
  currentTemp: number;
  currentFeelsLike: number;
  currentCondition: WeatherCondition;
  currentHumidity: number;
  currentWindSpeed: number;
  timezone: string;
}

export function RunWeatherCard({
  forecast,
  currentTemp,
  currentFeelsLike,
  currentCondition,
  currentHumidity,
  currentWindSpeed,
  timezone,
}: RunWeatherCardProps) {
  // Figure out current local hour
  const nowDate = new Date();
  const localHourStr = nowDate.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });
  const currentHour = parseInt(localHourStr, 10);

  // Find the hourly index that matches the current hour
  const currentHourIndex = useMemo(() => {
    return forecast.hourly.findIndex(h => {
      const hDate = new Date(h.time);
      const hHour = parseInt(hDate.toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      }), 10);
      return hHour === currentHour;
    });
  }, [forecast.hourly, timezone, currentHour]);

  // Build running time options
  const runTimeOptions = useMemo(() => {
    const options: RunTimeOption[] = [{ label: 'Now', hourIndex: -1 }]; // -1 = use current weather
    const now = new Date();

    for (let offset = 1; offset <= 3; offset++) {
      const idx = currentHourIndex + offset;
      if (idx < forecast.hourly.length) {
        options.push({ label: `+${offset}h`, hourIndex: idx });
      }
    }

    // Next 6 AM — today if before 6am, otherwise tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const next6amDate = currentHour < 6 ? now : tomorrow;
    const next6amIdx = forecast.hourly.findIndex(h => {
      const hDate = new Date(h.time);
      const hHour = parseInt(hDate.toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      }), 10);
      return hHour === 6 && hDate.getDate() === next6amDate.getDate();
    });
    if (next6amIdx >= 0 && !options.some(o => o.hourIndex === next6amIdx)) {
      const isToday6am = next6amDate.getDate() === now.getDate();
      options.push({ label: isToday6am ? '6 AM' : '6 AM tmrw', hourIndex: next6amIdx });
    }

    // Next 6 PM — today if before 6pm, otherwise tomorrow
    const next6pmDate = currentHour < 18 ? now : tomorrow;
    const next6pmIdx = forecast.hourly.findIndex(h => {
      const hDate = new Date(h.time);
      const hHour = parseInt(hDate.toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      }), 10);
      return hHour === 18 && hDate.getDate() === next6pmDate.getDate();
    });
    if (next6pmIdx >= 0 && !options.some(o => o.hourIndex === next6pmIdx)) {
      const isToday6pm = next6pmDate.getDate() === now.getDate();
      options.push({ label: isToday6pm ? '6 PM' : '6 PM tmrw', hourIndex: next6pmIdx });
    }

    return options;
  }, [currentHourIndex, currentHour, forecast.hourly, timezone]);

  const [selectedOption, setSelectedOption] = useState(0); // index into runTimeOptions
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Get weather for selected run time
  const selected = runTimeOptions[selectedOption];
  const isNow = selected.hourIndex === -1;
  const selectedWeather = isNow
    ? { temperature: currentTemp, feelsLike: currentFeelsLike, condition: currentCondition, humidity: currentHumidity, windSpeed: currentWindSpeed }
    : forecast.hourly[selected.hourIndex];

  const ConditionIcon = getConditionIcon(selectedWeather.condition);

  // Next 3 hours from current time
  const next3Hours = useMemo(() => {
    const hours = [];
    for (let i = 1; i <= 3; i++) {
      const idx = currentHourIndex + i;
      if (idx >= 0 && idx < forecast.hourly.length) {
        const h = forecast.hourly[idx];
        const hDate = new Date(h.time);
        const timeLabel = hDate.toLocaleTimeString('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          hour12: true,
        });
        hours.push({ ...h, timeLabel });
      }
    }
    return hours;
  }, [currentHourIndex, forecast.hourly, timezone]);

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 shadow-sm">
      {/* Header row: label + run time selector */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ConditionIcon className="w-4 h-4 text-accentBlue" />
          <span className="text-xs font-medium text-textTertiary uppercase tracking-wide">Running Weather</span>
        </div>

        {/* Run time dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1 text-xs font-medium text-dream-400 hover:text-dream-300 transition-colors px-2 py-1 rounded-md hover:bg-surface-2"
          >
            {selected.label}
            <ChevronDown className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-surface-1 border border-borderPrimary rounded-lg shadow-xl py-1 min-w-[120px]">
                {runTimeOptions.map((opt, i) => (
                  <button
                    key={opt.label}
                    onClick={() => { setSelectedOption(i); setDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      i === selectedOption
                        ? 'text-dream-400 bg-dream-500/10'
                        : 'text-textSecondary hover:text-textPrimary hover:bg-surface-2'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Main temp display */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-textPrimary">{Math.round(selectedWeather.temperature)}&deg;</span>
        <span className="text-sm text-textSecondary capitalize">{selectedWeather.condition}</span>
      </div>

      {/* Feels like + details */}
      <div className="flex items-center gap-3 mt-1.5 text-xs text-textTertiary">
        <span>Feels {Math.round(selectedWeather.feelsLike)}&deg;</span>
        <span className="flex items-center gap-0.5">
          <Droplets className="w-3 h-3" />
          {selectedWeather.humidity}%
        </span>
        <span className="flex items-center gap-0.5">
          <Wind className="w-3 h-3" />
          {selectedWeather.windSpeed} mph
        </span>
      </div>

      {/* Next 3 hours mini-timeline */}
      {next3Hours.length > 0 && (
        <div className="mt-3 pt-3 border-t border-borderPrimary/50">
          <div className="grid grid-cols-3 gap-2">
            {next3Hours.map((h) => {
              const HIcon = getConditionIcon(h.condition);
              return (
                <div key={h.time} className="text-center">
                  <p className="text-[10px] text-textTertiary mb-0.5">{h.timeLabel}</p>
                  <HIcon className="w-3.5 h-3.5 text-textSecondary mx-auto mb-0.5" />
                  <p className="text-xs font-medium text-textPrimary">{h.temperature}&deg;</p>
                  <p className="text-[10px] text-textTertiary">FL {h.feelsLike}&deg;</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hi/Lo */}
      <div className="mt-2 flex items-center gap-2 text-[10px] text-textTertiary">
        <span>H: {forecast.high}&deg;</span>
        <span>L: {forecast.low}&deg;</span>
      </div>
    </div>
  );
}
