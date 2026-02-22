// Weather service using Open-Meteo API (free, no API key required)

export interface WeatherData {
  temperature: number; // Fahrenheit
  feelsLike: number; // Apparent temperature
  humidity: number; // Percentage
  windSpeed: number; // mph
  weatherCode: number;
  condition: WeatherCondition;
  conditionText: string;
}

export interface ForecastData {
  high: number;
  low: number;
  hourly: Array<{
    time: string;
    temperature: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    condition: WeatherCondition;
  }>;
}

export type WeatherCondition = 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'thunderstorm';

// Cache for weather data (30 minute TTL)
interface CacheEntry {
  data: WeatherData;
  timestamp: number;
}

const weatherCache = new Map<string, CacheEntry>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Error tracking for user feedback
export interface WeatherError {
  type: 'network' | 'api' | 'unknown';
  message: string;
  canRetry: boolean;
}

let lastWeatherError: WeatherError | null = null;

export function getLastWeatherError(): WeatherError | null {
  return lastWeatherError;
}

export function clearWeatherError(): void {
  lastWeatherError = null;
}

// Fallback weather data for when API fails
export function getFallbackWeather(): WeatherData {
  return {
    temperature: 55,
    feelsLike: 55,
    humidity: 50,
    windSpeed: 5,
    weatherCode: 3,
    condition: 'cloudy',
    conditionText: 'Weather unavailable - using default conditions',
  };
}

function getCacheKey(lat: number, lon: number): string {
  // Round to 2 decimal places for cache key
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

// Map Open-Meteo weather codes to our conditions
function weatherCodeToCondition(code: number): { condition: WeatherCondition; text: string } {
  // WMO Weather interpretation codes
  // https://open-meteo.com/en/docs
  if (code === 0) return { condition: 'clear', text: 'Clear sky' };
  if (code <= 3) return { condition: 'cloudy', text: code === 1 ? 'Mainly clear' : code === 2 ? 'Partly cloudy' : 'Overcast' };
  if (code <= 49) return { condition: 'fog', text: 'Foggy' };
  if (code <= 59) return { condition: 'drizzle', text: 'Drizzle' };
  if (code <= 69) return { condition: 'rain', text: 'Rain' };
  if (code <= 79) return { condition: 'snow', text: 'Snow' };
  if (code <= 84) return { condition: 'rain', text: 'Rain showers' };
  if (code <= 86) return { condition: 'snow', text: 'Snow showers' };
  if (code <= 99) return { condition: 'thunderstorm', text: 'Thunderstorm' };
  return { condition: 'clear', text: 'Unknown' };
}

export async function fetchCurrentWeather(latitude: number, longitude: number): Promise<WeatherData | null> {
  const cacheKey = getCacheKey(latitude, longitude);
  const cached = weatherCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code');
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('wind_speed_unit', 'mph');

    const response = await fetch(url.toString(), {
      next: { revalidate: 1800 } // Cache for 30 minutes in Next.js
    });

    if (!response.ok) {
      console.error('Weather API error:', response.status);
      lastWeatherError = {
        type: 'api',
        message: `Weather service returned error (${response.status}). Using default conditions.`,
        canRetry: response.status >= 500,
      };
      return null;
    }

    // Clear any previous error on success
    lastWeatherError = null;

    const data = await response.json();
    const current = data.current;
    const { condition, text } = weatherCodeToCondition(current.weather_code);

    const weatherData: WeatherData = {
      temperature: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      humidity: Math.round(current.relative_humidity_2m),
      windSpeed: Math.round(current.wind_speed_10m),
      weatherCode: current.weather_code,
      condition,
      conditionText: text,
    };

    weatherCache.set(cacheKey, { data: weatherData, timestamp: Date.now() });
    return weatherData;
  } catch (error) {
    console.error('Failed to fetch weather:', error);
    lastWeatherError = {
      type: error instanceof TypeError ? 'network' : 'unknown',
      message: error instanceof TypeError
        ? 'Unable to connect to weather service. Check your internet connection.'
        : 'An unexpected error occurred fetching weather.',
      canRetry: true,
    };
    return null;
  }
}

export async function fetchForecast(latitude: number, longitude: number): Promise<ForecastData | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min');
    url.searchParams.set('hourly', 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code');
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('wind_speed_unit', 'mph');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '2');

    const response = await fetch(url.toString(), {
      next: { revalidate: 1800 }
    });

    if (!response.ok) return null;

    const data = await response.json();

    return {
      high: Math.round(data.daily.temperature_2m_max[0]),
      low: Math.round(data.daily.temperature_2m_min[0]),
      hourly: data.hourly.time.map((time: string, i: number) => ({
        time,
        temperature: Math.round(data.hourly.temperature_2m[i]),
        feelsLike: Math.round(data.hourly.apparent_temperature[i]),
        humidity: Math.round(data.hourly.relative_humidity_2m[i]),
        windSpeed: Math.round(data.hourly.wind_speed_10m[i]),
        condition: weatherCodeToCondition(data.hourly.weather_code[i]).condition,
      })),
    };
  } catch (error) {
    console.error('Failed to fetch forecast:', error);
    return null;
  }
}

// Fetch historical weather for a specific date and time
// Uses Open-Meteo Archive API for past dates, or hourly forecast for today
// When durationMinutes is provided, uses mid-race conditions instead of start
// (models temperature rising during longer races)
export async function fetchHistoricalWeather(
  latitude: number,
  longitude: number,
  date: string, // YYYY-MM-DD
  time: string, // HH:MM (24hr)
  durationMinutes?: number
): Promise<WeatherData | null> {
  try {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const startHour = parseInt(time.split(':')[0], 10);
    // For longer runs, use mid-race hour to capture warming conditions
    const midRaceOffsetHours = durationMinutes ? Math.floor(durationMinutes / 2 / 60) : 0;
    const hourIndex = Math.min(startHour + midRaceOffsetHours, 23);

    // If it's today, use the forecast API (archive doesn't have today)
    if (date === today) {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', latitude.toString());
      url.searchParams.set('longitude', longitude.toString());
      url.searchParams.set('hourly', 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code');
      url.searchParams.set('temperature_unit', 'fahrenheit');
      url.searchParams.set('wind_speed_unit', 'mph');
      url.searchParams.set('timezone', 'auto');
      url.searchParams.set('forecast_days', '1');

      const response = await fetch(url.toString());
      if (!response.ok) return null;

      const data = await response.json();
      const hourly = data.hourly;
      const { condition, text } = weatherCodeToCondition(hourly.weather_code[hourIndex]);

      return {
        temperature: Math.round(hourly.temperature_2m[hourIndex]),
        feelsLike: Math.round(hourly.apparent_temperature[hourIndex]),
        humidity: Math.round(hourly.relative_humidity_2m[hourIndex]),
        windSpeed: Math.round(hourly.wind_speed_10m[hourIndex]),
        weatherCode: hourly.weather_code[hourIndex],
        condition,
        conditionText: text,
      };
    }

    // For past dates, use the archive API
    const url = new URL('https://archive-api.open-meteo.com/v1/archive');
    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    url.searchParams.set('start_date', date);
    url.searchParams.set('end_date', date);
    url.searchParams.set('hourly', 'temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code');
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('wind_speed_unit', 'mph');
    url.searchParams.set('timezone', 'auto');

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error('Historical weather API error:', response.status);
      return null;
    }

    const data = await response.json();
    const hourly = data.hourly;

    if (!hourly || !hourly.temperature_2m || hourly.temperature_2m.length <= hourIndex) {
      return null;
    }

    const { condition, text } = weatherCodeToCondition(hourly.weather_code[hourIndex] || 0);

    return {
      temperature: Math.round(hourly.temperature_2m[hourIndex]),
      feelsLike: Math.round(hourly.apparent_temperature[hourIndex] || hourly.temperature_2m[hourIndex]),
      humidity: Math.round(hourly.relative_humidity_2m[hourIndex]),
      windSpeed: Math.round(hourly.wind_speed_10m[hourIndex]),
      weatherCode: hourly.weather_code[hourIndex] || 0,
      condition,
      conditionText: text,
    };
  } catch (error) {
    console.error('Failed to fetch historical weather:', error);
    return null;
  }
}

// Smart weather for run windows
// Uses the location's timezone to determine run windows:
// - Before 9am: Show morning conditions (current) + option for evening forecast
// - After 9am: Show evening forecast only
export interface RunWindowOption {
  label: string;        // "Morning", "Evening"
  time: string;         // "6:30 AM", "6:00 PM", etc.
  weather: WeatherData; // Weather for that window
  isCurrent: boolean;   // True if showing live conditions
}

export interface SmartWeatherResult {
  current: WeatherData;
  forecast: ForecastData | null;        // Full forecast (avoids a separate fetchForecast call)
  timezone: string;
  localHour: number;
  runWindow: RunWindowOption;           // Primary run window to show
  alternateWindow?: RunWindowOption;    // Optional alternate (e.g., evening when showing morning)
}

// Get timezone from coordinates using Open-Meteo
async function getTimezoneForLocation(latitude: number, longitude: number): Promise<string> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    url.searchParams.set('current', 'temperature_2m');
    url.searchParams.set('timezone', 'auto');

    const response = await fetch(url.toString());
    if (response.ok) {
      const data = await response.json();
      return data.timezone || 'America/New_York';
    }
  } catch (error) {
    console.error('Failed to get timezone:', error);
  }
  return 'America/New_York'; // Default fallback
}

// Get current hour in a specific timezone
function getLocalHour(timezone: string): number {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  });
  return parseInt(formatter.format(now), 10);
}

// Format time in a specific timezone
function formatLocalTime(timezone: string): string {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
  });
}

export async function fetchSmartWeather(
  latitude: number,
  longitude: number
): Promise<SmartWeatherResult | null> {
  const current = await fetchCurrentWeather(latitude, longitude);
  if (!current) return null;

  // Get the timezone for this location
  const timezone = await getTimezoneForLocation(latitude, longitude);
  const localHour = getLocalHour(timezone);

  // Fetch forecast for evening option
  const forecast = await fetchForecast(latitude, longitude);

  // Create evening forecast weather data
  const getEveningWeather = (): WeatherData => {
    if (forecast?.hourly) {
      const eveningHour = forecast.hourly.find(h => {
        const forecastTime = new Date(h.time);
        // Get hour in local timezone
        const hourStr = forecastTime.toLocaleTimeString('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          hour12: false,
        });
        return parseInt(hourStr, 10) === 18; // 6pm
      });

      if (eveningHour) {
        return {
          ...current,
          temperature: eveningHour.temperature,
          humidity: eveningHour.humidity,
          condition: eveningHour.condition,
          feelsLike: eveningHour.temperature, // Approximation
          conditionText: weatherCodeToCondition(0).text,
        };
      }
    }
    return current; // Fallback to current
  };

  // Before 9am: Show morning (current) with evening option
  if (localHour < 9) {
    return {
      current,
      forecast,
      timezone,
      localHour,
      runWindow: {
        label: 'Morning',
        time: formatLocalTime(timezone),
        weather: current,
        isCurrent: true,
      },
      alternateWindow: {
        label: 'Evening',
        time: '6:00 PM',
        weather: getEveningWeather(),
        isCurrent: false,
      },
    };
  }

  // 9am and after: Show evening only
  return {
    current,
    forecast,
    timezone,
    localHour,
    runWindow: {
      label: 'Evening',
      time: '6:00 PM',
      weather: getEveningWeather(),
      isCurrent: false,
    },
  };
}

// Geocoding API for city search
export interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string; // State/province
}

export async function searchLocation(query: string): Promise<GeocodingResult[]> {
  try {
    const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
    url.searchParams.set('name', query);
    url.searchParams.set('count', '5');
    url.searchParams.set('language', 'en');
    url.searchParams.set('format', 'json');

    const response = await fetch(url.toString());

    if (!response.ok) return [];

    const data = await response.json();

    if (!data.results) return [];

    return data.results.map((r: Record<string, unknown>) => ({
      name: r.name as string,
      latitude: r.latitude as number,
      longitude: r.longitude as number,
      country: r.country as string,
      admin1: r.admin1 as string | undefined,
    }));
  } catch (error) {
    console.error('Geocoding error:', error);
    return [];
  }
}
