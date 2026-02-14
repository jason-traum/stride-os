// Conditions severity calculator and pace adjustment logic

import type { WeatherData } from './weather';
import type { WorkoutType } from './schema';

export interface ConditionsSeverity {
  severityScore: number; // 0-100
  heatIndex: number | null;
  windChill: number | null;
  primaryFactor: 'ideal' | 'heat_humidity' | 'heat' | 'cold' | 'wind' | 'rain';
  description: string;
  factors: {
    heat: number;
    humidity: number;
    wind: number;
    cold: number;
    precipitation: number;
  };
}

export interface PaceAdjustment {
  originalPace: string; // "7:00"
  adjustedPace: string; // "7:18"
  originalPaceSeconds: number;
  adjustedPaceSeconds: number;
  adjustmentSeconds: number;
  reason: string;
  recommendation: string;
  warnings: string[];
}

// Calculate heat index (simplified formula)
// More accurate than apparent temperature for running impact
function calculateHeatIndex(tempF: number, humidity: number): number {
  if (tempF < 80) {
    // Simple formula for lower temps
    return tempF + ((humidity - 50) / 10);
  }

  // Rothfusz regression
  const T = tempF;
  const R = humidity;

  let HI = -42.379 +
    2.04901523 * T +
    10.14333127 * R -
    0.22475541 * T * R -
    0.00683783 * T * T -
    0.05481717 * R * R +
    0.00122874 * T * T * R +
    0.00085282 * T * R * R -
    0.00000199 * T * T * R * R;

  // Adjustments
  if (R < 13 && T >= 80 && T <= 112) {
    HI -= ((13 - R) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17);
  } else if (R > 85 && T >= 80 && T <= 87) {
    HI += ((R - 85) / 10) * ((87 - T) / 5);
  }

  return Math.round(HI);
}

// Calculate wind chill
function calculateWindChill(tempF: number, windMph: number): number {
  if (tempF > 50 || windMph < 3) {
    return tempF;
  }

  const WC = 35.74 +
    0.6215 * tempF -
    35.75 * Math.pow(windMph, 0.16) +
    0.4275 * tempF * Math.pow(windMph, 0.16);

  return Math.round(WC);
}

export function calculateConditionsSeverity(weather: WeatherData): ConditionsSeverity {
  const { temperature, humidity, windSpeed, condition } = weather;

  let severityScore = 0;
  const factors = {
    heat: 0,
    humidity: 0,
    wind: 0,
    cold: 0,
    precipitation: 0,
  };

  let heatIndex: number | null = null;
  let windChill: number | null = null;
  let primaryFactor: ConditionsSeverity['primaryFactor'] = 'ideal';
  let description = '';

  // Heat stress calculation
  if (temperature >= 55) {
    heatIndex = calculateHeatIndex(temperature, humidity);

    if (heatIndex < 65) {
      factors.heat = 0;
    } else if (heatIndex < 75) {
      factors.heat = 5 + (heatIndex - 65);
    } else if (heatIndex < 85) {
      factors.heat = 15 + (heatIndex - 75) * 2.5;
    } else if (heatIndex < 95) {
      factors.heat = 40 + (heatIndex - 85) * 3;
    } else {
      factors.heat = 70 + (heatIndex - 95) * 2;
    }

    // Humidity penalty on top of heat index effect
    if (humidity > 70 && temperature > 75) {
      factors.humidity = (humidity - 70) * 0.5;
    }
  }

  // Cold stress calculation
  if (temperature < 55) {
    windChill = calculateWindChill(temperature, windSpeed);

    if (temperature < 40) {
      factors.cold = (40 - temperature) * 0.5;
    }
    if (windChill < 20) {
      factors.cold += (20 - windChill) * 0.8;
    }
  }

  // Wind impact
  if (windSpeed > 10) {
    // In heat, wind provides some cooling benefit
    if (temperature > 75) {
      factors.wind = Math.max(0, (windSpeed - 15) * 0.8); // Only penalize strong wind
      factors.heat = Math.max(0, factors.heat - windSpeed * 0.3); // Wind cooling benefit
    } else {
      // In cold/neutral, wind adds difficulty
      factors.wind = (windSpeed - 10) * 0.8;
    }
  }

  // Precipitation
  if (condition === 'rain' || condition === 'drizzle') {
    factors.precipitation = 5;
  } else if (condition === 'thunderstorm') {
    factors.precipitation = 15;
  } else if (condition === 'snow') {
    factors.precipitation = 10;
  }

  // Calculate total severity
  severityScore = Math.min(100, Math.round(
    factors.heat +
    factors.humidity +
    factors.wind +
    factors.cold +
    factors.precipitation
  ));

  // Determine primary factor and description
  const maxFactor = Math.max(factors.heat, factors.cold, factors.wind, factors.precipitation);

  // Check for ideal running conditions first (40-55°F with low humidity is optimal)
  const isIdealTemp = temperature >= 40 && temperature <= 60 && factors.heat < 10;

  if (isIdealTemp && factors.wind < 10 && factors.precipitation < 5) {
    primaryFactor = 'ideal';
    description = 'Ideal running conditions - great day for a PR!';
  } else if (severityScore < 15 && factors.heat < 10) {
    primaryFactor = 'ideal';
    description = 'Great conditions for running';
  } else if (factors.heat >= maxFactor && factors.humidity > 10) {
    primaryFactor = 'heat_humidity';
    description = `Warm and humid (HI: ${heatIndex}°F) - effort will feel harder`;
  } else if (factors.heat >= maxFactor) {
    primaryFactor = 'heat';
    description = `Hot conditions (HI: ${heatIndex}°F) - pace accordingly`;
  } else if (factors.cold >= maxFactor) {
    primaryFactor = 'cold';
    // Cold descriptions focus on comfort/safety, not performance penalty
    if (windChill && windChill <= 10) {
      description = `Very cold (feels like ${windChill}°F) - dress warmly, watch extremities`;
    } else if (windChill && windChill <= 25) {
      description = `Cold (feels like ${windChill}°F) - layer up, great for performance once warm`;
    } else if (temperature < 40) {
      description = 'Cool conditions - dress in layers, good running weather';
    } else {
      description = 'Cool conditions - comfortable for running';
    }
  } else if (factors.wind >= maxFactor) {
    primaryFactor = 'wind';
    description = `Windy (${windSpeed} mph) - expect more resistance on exposed sections`;
  } else if (factors.precipitation >= maxFactor) {
    primaryFactor = 'rain';
    description = 'Wet conditions - watch your footing';
  }

  return {
    severityScore,
    heatIndex,
    windChill,
    primaryFactor,
    description,
    factors,
  };
}

// Pace adjustment calculator
// KEY INSIGHT: Only HEAT slows you down physiologically. Cold doesn't affect pace the same way.
// Ideal running temps are 40-55°F. Heat causes blood to divert to skin for cooling.
export function calculatePaceAdjustment(
  targetPaceSeconds: number,
  severity: ConditionsSeverity,
  workoutType: WorkoutType,
  acclimatizationScore: number = 50
): PaceAdjustment {
  const { heatIndex, primaryFactor, factors } = severity;

  // Workout type multiplier (easy runs adjust fully, intervals less)
  const workoutMultiplier: Record<WorkoutType, number> = {
    easy: 1.0,
    recovery: 1.0,
    long: 1.0,
    steady: 0.85,
    tempo: 0.7,
    interval: 0.5,
    race: 0.5,
    cross_train: 0,
    other: 0.8,
  };

  // ONLY use heat-related factors for pace slowdown
  // Cold doesn't slow you down - in fact, cool temps are often optimal
  const heatSeverity = factors.heat + factors.humidity;

  // Base adjustment calculation (seconds per mile) - ONLY for heat
  let baseAdjustment = 0;

  if (heatSeverity <= 10) {
    baseAdjustment = 0;
  } else if (heatSeverity <= 25) {
    baseAdjustment = (heatSeverity - 10) * 0.4;
  } else if (heatSeverity <= 45) {
    baseAdjustment = 6 + (heatSeverity - 25) * 0.7;
  } else if (heatSeverity <= 65) {
    baseAdjustment = 20 + (heatSeverity - 45) * 1.0;
  } else {
    baseAdjustment = 40 + (heatSeverity - 65) * 0.8;
  }

  // Apply workout type multiplier
  baseAdjustment *= workoutMultiplier[workoutType] || 0.8;

  // Acclimatization modifier (only applies to heat)
  // Score 80+ reduces adjustment by 30%, score 20- increases by 20%
  if (baseAdjustment > 0) {
    if (acclimatizationScore >= 80) {
      baseAdjustment *= 0.7;
    } else if (acclimatizationScore >= 60) {
      baseAdjustment *= 0.85;
    } else if (acclimatizationScore <= 20) {
      baseAdjustment *= 1.2;
    } else if (acclimatizationScore <= 40) {
      baseAdjustment *= 1.1;
    }
  }

  const adjustmentSeconds = Math.round(baseAdjustment);
  const adjustedPaceSeconds = targetPaceSeconds + adjustmentSeconds;

  // Generate reason text
  let reason = '';
  if (adjustmentSeconds === 0) {
    if (primaryFactor === 'cold') {
      reason = 'Cool temps are ideal for running - no slowdown needed';
    } else if (primaryFactor === 'wind') {
      reason = 'Wind adds effort but not systematic slowdown';
    } else {
      reason = 'Good conditions - no adjustment needed';
    }
  } else if (primaryFactor === 'heat_humidity' || primaryFactor === 'heat') {
    reason = heatIndex
      ? `Heat index ${heatIndex}°F ${factors.humidity > 10 ? '+ humidity' : ''}`
      : `Elevated temperature affects pace`;
  }

  // Generate recommendation based on conditions
  let recommendation = '';
  if (primaryFactor === 'cold') {
    if (severity.windChill && severity.windChill <= 10) {
      recommendation = 'Dress warmly, cover extremities. Pace should be unaffected once warmed up.';
    } else if (severity.windChill && severity.windChill <= 25) {
      recommendation = 'Layer up. Cool temps are great for performance once warmed up.';
    } else {
      recommendation = 'Ideal conditions for running. Dress appropriately and enjoy!';
    }
  } else if (adjustmentSeconds === 0) {
    recommendation = 'Conditions are favorable. Run as planned.';
  } else if (adjustmentSeconds <= 10) {
    recommendation = 'Slightly warm - run by effort, not pace. Target your usual RPE.';
  } else if (adjustmentSeconds <= 25) {
    recommendation = `Run by effort (RPE ${workoutType === 'easy' ? '3-4' : '5-6'}). Accept slower paces.`;
  } else if (adjustmentSeconds <= 40) {
    recommendation = 'Hot conditions - consider reducing intensity. Focus on effort, not pace.';
  } else {
    recommendation = 'Very hot - consider an easier workout, shorter route, or indoor alternative.';
  }

  // Generate warnings
  const warnings: string[] = [];
  if (heatSeverity >= 50) {
    warnings.push('Consider early morning to avoid peak heat');
  }
  if (heatSeverity >= 70) {
    warnings.push('Conditions are borderline unsafe for hard efforts');
  }
  if (heatIndex && heatIndex >= 100) {
    warnings.push('Extreme heat - hydrate aggressively, consider shorter route');
  }
  if (severity.windChill && severity.windChill <= 10) {
    warnings.push('Risk of frostbite on exposed skin - cover extremities');
  }
  if (severity.windChill && severity.windChill <= 0) {
    warnings.push('Dangerous cold - consider treadmill or shorter outdoor exposure');
  }

  return {
    originalPace: formatPace(targetPaceSeconds),
    adjustedPace: formatPace(adjustedPaceSeconds),
    originalPaceSeconds: targetPaceSeconds,
    adjustedPaceSeconds,
    adjustmentSeconds,
    reason,
    recommendation,
    warnings,
  };
}

// Helper to format pace
function formatPace(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Parse pace string to seconds
export function parsePaceToSeconds(pace: string): number | null {
  const match = pace.match(/^(\d+):(\d{2})$/);
  if (!match) return null;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  if (seconds >= 60) return null;
  return minutes * 60 + seconds;
}

// Get severity color for UI
export function getSeverityColor(score: number): string {
  if (score < 20) return 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40';
  if (score < 40) return 'text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/40';
  if (score < 60) return 'text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/40';
  return 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/40';
}

export function getSeverityLabel(score: number): string {
  if (score < 20) return 'Ideal';
  if (score < 40) return 'Mild';
  if (score < 60) return 'Moderate';
  if (score < 80) return 'Challenging';
  return 'Extreme';
}

// Calculate heat acclimatization score from user inputs
export function calculateAcclimatizationScore(inputs: {
  warmRunsLastTwoWeeks: '0' | '1-2' | '3-5' | '6+';
  heatLimited: 'rarely' | 'sometimes' | 'often' | 'always';
  deliberateHeatTraining: boolean;
}): number {
  let score = 50; // Base score

  // Warm runs in last two weeks
  switch (inputs.warmRunsLastTwoWeeks) {
    case '0':
      score -= 20;
      break;
    case '1-2':
      score -= 5;
      break;
    case '3-5':
      score += 10;
      break;
    case '6+':
      score += 25;
      break;
  }

  // How often heat-limited
  switch (inputs.heatLimited) {
    case 'rarely':
      score += 15;
      break;
    case 'sometimes':
      score += 0;
      break;
    case 'often':
      score -= 10;
      break;
    case 'always':
      score -= 20;
      break;
  }

  // Deliberate heat training
  if (inputs.deliberateHeatTraining) {
    score += 15;
  }

  return Math.max(0, Math.min(100, score));
}
