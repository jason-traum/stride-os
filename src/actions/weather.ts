'use server';

import { getSettings } from '@/actions/settings';
import { fetchCurrentWeather } from '@/lib/weather';
import { calculateConditionsSeverity } from '@/lib/conditions';
import { createProfileAction } from '@/lib/action-utils';

export const getWeatherConditions = createProfileAction(
  async (profileId: number) => {
    const settings = await getSettings(profileId);

    if (!settings?.latitude || !settings?.longitude) {
      return null;
    }

    const weather = await fetchCurrentWeather(settings.latitude, settings.longitude);
    if (!weather) return null;

    const severity = calculateConditionsSeverity(weather);

    return {
      temperature: weather.temperature,
      feelsLike: weather.feelsLike,
      conditions: weather.conditionText,
      windSpeed: weather.windSpeed,
      humidity: weather.humidity,
      severity: severity.severityScore,
    };
  },
  'getWeatherConditions'
);
