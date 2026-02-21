/**
 * Fitness Trend Calculations (CTL/ATL/TSB)
 *
 * Based on the Training Stress Balance model:
 * - CTL (Chronic Training Load): 42-day exponentially weighted average - represents fitness
 * - ATL (Acute Training Load): 7-day exponentially weighted average - represents fatigue
 * - TSB (Training Stress Balance): CTL - ATL - represents form/freshness
 *
 * When TSB is positive: you're fresh but possibly losing fitness
 * When TSB is negative: you're fatigued but building fitness
 * Optimal race readiness: small positive TSB with high CTL
 */

// Intensity factors for workout types (multiplier for duration)
export const INTENSITY_FACTORS: Record<string, number> = {
  recovery: 0.5,
  easy: 0.6,
  long: 0.65,      // Longer duration compensates for lower intensity
  steady: 0.75,
  tempo: 0.85,
  interval: 1.0,
  race: 1.1,       // Race effort is highest
  cross_train: 0.4,
  other: 0.6,
};

// Decay constants for exponential moving average
const CTL_DECAY = 1 - Math.exp(-1 / 42); // 42-day time constant
const ATL_DECAY = 1 - Math.exp(-1 / 7);   // 7-day time constant

export interface DailyLoad {
  date: string;
  load: number;
}

export interface FitnessMetrics {
  date: string;
  ctl: number;
  atl: number;
  tsb: number;
  dailyLoad: number;
}

/**
 * Calculate training load for a single workout
 * Uses TRIMP-like formula: duration × intensity
 * If heart rate data available in future, can use: duration × (avgHR - restHR) / (maxHR - restHR)
 */
export function calculateWorkoutLoad(
  durationMinutes: number,
  workoutType: string,
  distanceMiles?: number,
  avgPaceSeconds?: number,
  _intervalAdjustedTrimp?: number | null
): number {
  // Note: intervalAdjustedTrimp is no longer used for load calculation.
  // HR already discounts rest intervals naturally (lower HR = lower TRIMP),
  // so applying an additional rest-to-work discount double-penalizes intervals.
  // The interval stress data is still computed and stored for analytics.

  const intensity = INTENSITY_FACTORS[workoutType] || INTENSITY_FACTORS.other;

  // Base load is duration × intensity
  let load = durationMinutes * intensity;

  // Bonus for longer efforts (endurance adaptation)
  if (durationMinutes > 60) {
    load *= 1 + (durationMinutes - 60) * 0.005; // 0.5% bonus per minute over 60
  }

  // If pace data available, adjust based on effort
  // Faster pace = higher load multiplier for same duration
  if (avgPaceSeconds && distanceMiles && distanceMiles > 0) {
    // Compare to "easy" benchmark of 10:00/mile (600 seconds)
    const paceFactor = 600 / avgPaceSeconds;
    // Only apply if pace is meaningful (between 4:00 and 15:00/mile)
    if (avgPaceSeconds >= 240 && avgPaceSeconds <= 900) {
      load *= Math.pow(paceFactor, 0.5); // Square root to temper the effect
    }
  }

  return Math.round(load);
}

/**
 * Calculate CTL, ATL, TSB for a series of daily loads
 * Returns fitness metrics for each day
 */
export function calculateFitnessMetrics(dailyLoads: DailyLoad[]): FitnessMetrics[] {
  if (dailyLoads.length === 0) return [];

  // Sort by date
  const sorted = [...dailyLoads].sort((a, b) => a.date.localeCompare(b.date));

  const metrics: FitnessMetrics[] = [];
  let ctl = 0;
  let atl = 0;

  for (const day of sorted) {
    // Exponential moving average update
    ctl = ctl + CTL_DECAY * (day.load - ctl);
    atl = atl + ATL_DECAY * (day.load - atl);
    const tsb = ctl - atl;

    metrics.push({
      date: day.date,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round(tsb * 10) / 10,
      dailyLoad: day.load,
    });
  }

  return metrics;
}

/**
 * Fill gaps in daily load data with zeros
 * Important for accurate CTL/ATL calculation (rest days matter)
 */
export function fillDailyLoadGaps(
  workoutLoads: DailyLoad[],
  startDate: string,
  endDate: string
): DailyLoad[] {
  const loadMap = new Map<string, number>();

  // Add existing loads
  for (const load of workoutLoads) {
    const existing = loadMap.get(load.date) || 0;
    loadMap.set(load.date, existing + load.load);
  }

  // Fill all dates in range
  const result: DailyLoad[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    result.push({
      date: dateStr,
      load: loadMap.get(dateStr) || 0,
    });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

/**
 * Calculate optimal training load range based on recent CTL
 * Returns min/max for weekly load
 */
export function calculateOptimalLoadRange(currentCtl: number): { min: number; max: number } {
  // Optimal weekly load is roughly 7 × daily average
  // Allow 80-120% of current fitness level
  const weeklyTarget = currentCtl * 7;

  return {
    min: Math.round(weeklyTarget * 0.8),
    max: Math.round(weeklyTarget * 1.2),
  };
}

/**
 * Get fitness status label based on TSB
 */
export function getFitnessStatus(tsb: number): {
  status: 'fresh' | 'optimal' | 'tired' | 'overreached';
  label: string;
  color: string;
} {
  if (tsb > 20) {
    return { status: 'fresh', label: 'Well Rested', color: 'text-amber-600' };
  } else if (tsb > 5) {
    return { status: 'optimal', label: 'Race Ready', color: 'text-green-600' };
  } else if (tsb > -10) {
    return { status: 'optimal', label: 'Training', color: 'text-emerald-600' };
  } else if (tsb > -25) {
    return { status: 'tired', label: 'Fatigued', color: 'text-amber-600' };
  } else {
    return { status: 'overreached', label: 'Overreached', color: 'text-red-600' };
  }
}

/**
 * Calculate 7-day rolling load for comparison
 */
export function calculateRollingLoad(
  dailyLoads: DailyLoad[],
  days: number = 7
): number {
  const sorted = [...dailyLoads].sort((a, b) => b.date.localeCompare(a.date));
  return sorted.slice(0, days).reduce((sum, d) => sum + d.load, 0);
}

/**
 * Calculate CTL ramp rate (points per week)
 * Measures how fast fitness is being built, which correlates with injury risk
 *
 * Standard guidelines:
 * - < 5 pts/week: Conservative (safe for beginners, coming back from injury)
 * - 5-8 pts/week: Moderate (sustainable progression for most runners)
 * - 8-10 pts/week: Aggressive (experienced runners, may increase injury risk)
 * - > 10 pts/week: High risk (significant injury potential)
 */
export function calculateRampRate(metrics: FitnessMetrics[], weeks: number = 4): number | null {
  if (metrics.length < 7) return null; // Need at least a week of data

  // Get CTL from start and end of the period
  const endIdx = metrics.length - 1;
  const daysBack = weeks * 7;
  const startIdx = Math.max(0, endIdx - daysBack);

  // Not enough data for the requested period
  if (endIdx - startIdx < 7) return null;

  const startCtl = metrics[startIdx].ctl;
  const endCtl = metrics[endIdx].ctl;
  const actualWeeks = (endIdx - startIdx) / 7;

  // Calculate points per week
  const rampRate = (endCtl - startCtl) / actualWeeks;
  return Math.round(rampRate * 10) / 10;
}

export interface RampRateRisk {
  level: 'safe' | 'moderate' | 'elevated' | 'high';
  label: string;
  color: string;
  message: string;
  recommendation: string | null;
}

/**
 * Assess injury risk based on CTL ramp rate
 */
export function getRampRateRisk(rampRate: number | null): RampRateRisk {
  if (rampRate === null) {
    return {
      level: 'safe',
      label: 'Insufficient Data',
      color: 'text-tertiary',
      message: 'Not enough training history to calculate ramp rate',
      recommendation: null,
    };
  }

  // Negative ramp rate means detraining
  if (rampRate < 0) {
    return {
      level: 'safe',
      label: 'Decreasing',
      color: 'text-amber-600',
      message: `Fitness declining at ${Math.abs(rampRate).toFixed(1)} pts/week`,
      recommendation: rampRate < -5
        ? 'Consider increasing training volume gradually to maintain fitness'
        : null,
    };
  }

  if (rampRate < 5) {
    return {
      level: 'safe',
      label: 'Conservative',
      color: 'text-green-600',
      message: `Building at ${rampRate.toFixed(1)} pts/week`,
      recommendation: null,
    };
  }

  if (rampRate < 8) {
    return {
      level: 'moderate',
      label: 'Moderate',
      color: 'text-emerald-600',
      message: `Building at ${rampRate.toFixed(1)} pts/week`,
      recommendation: null,
    };
  }

  if (rampRate < 10) {
    return {
      level: 'elevated',
      label: 'Aggressive',
      color: 'text-amber-600',
      message: `Ramping at ${rampRate.toFixed(1)} pts/week`,
      recommendation: 'Consider adding an extra recovery day or reducing volume by 10%',
    };
  }

  return {
    level: 'high',
    label: 'High Risk',
    color: 'text-red-600',
    message: `Rapid ramp at ${rampRate.toFixed(1)} pts/week`,
    recommendation: 'High injury risk - schedule a recovery week soon and reduce intensity',
  };
}
