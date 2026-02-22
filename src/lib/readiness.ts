/**
 * Readiness Score Calculation
 *
 * Calculates a daily readiness score (0-100) based on multiple factors:
 * - Sleep quality and duration
 * - Training stress balance (TSB)
 * - Recent workout difficulty
 * - Soreness levels
 * - Life stress
 * - Recovery patterns
 */

export interface ReadinessFactors {
  // Sleep (35% total weight)
  sleepQuality?: number;      // 1-5 scale from assessment
  sleepHours?: number;        // Hours slept
  targetSleepHours?: number;  // User's target (default 7.5)

  // Training (25% weight)
  tsb?: number;               // Training Stress Balance from CTL/ATL
  yesterdayRpe?: number;      // Yesterday's workout RPE (1-10)
  restDaysBefore?: number;    // Days since last workout

  // Physical state (25% weight)
  soreness?: number;          // 1-5 scale
  legsFeel?: number;          // 1-5 scale from assessment
  illness?: number;           // 1-5 scale
  hrv?: number;               // HRV value (e.g. rMSSD or SDNN from Intervals.icu)
  restingHR?: number;         // Resting heart rate from Intervals.icu
  hrvBaseline?: number;       // Rolling average HRV for comparison

  // Life factors (15% weight)
  stress?: number;            // 1-5 scale
  mood?: number;              // 1-5 scale
  hasLifeStressors?: boolean; // Travel, work stress, etc.
}

export interface ReadinessResult {
  score: number | null;       // 0-100, null when no data
  confidence: number;         // 0 = no data, 0.3 = stale, 0.5 = limited, 1.0 = good
  category: 'excellent' | 'good' | 'moderate' | 'low' | 'rest' | 'unknown';
  color: string;
  label: string;
  limitingFactor: string | null;
  recommendation: string;
  message?: string;           // explanation when confidence is low
  breakdown: {
    sleep: number;
    training: number;
    physical: number;
    life: number;
  };
}

/**
 * Calculate readiness score from factors
 */
export function calculateReadiness(factors: ReadinessFactors): ReadinessResult {
  const breakdown = {
    sleep: 0,
    training: 0,
    physical: 0,
    life: 0,
  };

  let limitingFactor: string | null = null;
  let lowestCategoryScore = 100;

  // Calculate confidence based on how many data points are real vs defaulted
  const dataPointsPresent = [
    factors.sleepQuality !== undefined,
    factors.sleepHours !== undefined,
    factors.tsb !== undefined,
    factors.yesterdayRpe !== undefined,
    factors.soreness !== undefined,
    factors.legsFeel !== undefined,
    factors.stress !== undefined,
    factors.mood !== undefined,
    factors.hrv !== undefined,
  ].filter(Boolean).length;
  const confidence = Math.min(1.0, dataPointsPresent / 4); // 4+ data points = full confidence

  // ===== SLEEP (35% weight) =====
  const targetSleep = factors.targetSleepHours || 7.5;

  // Sleep quality score (0-50)
  const sleepQualityScore = factors.sleepQuality
    ? ((factors.sleepQuality - 1) / 4) * 50
    : 25; // Default to middle if unknown

  // Sleep duration score (0-50)
  let sleepDurationScore = 25; // Default
  if (factors.sleepHours !== undefined) {
    const sleepRatio = factors.sleepHours / targetSleep;
    if (sleepRatio >= 1) {
      sleepDurationScore = 50;
    } else if (sleepRatio >= 0.85) {
      sleepDurationScore = 40;
    } else if (sleepRatio >= 0.7) {
      sleepDurationScore = 25;
    } else {
      sleepDurationScore = 10;
    }
  }

  breakdown.sleep = sleepQualityScore + sleepDurationScore;
  if (breakdown.sleep < lowestCategoryScore) {
    lowestCategoryScore = breakdown.sleep;
    if (breakdown.sleep < 50) {
      limitingFactor = 'Sleep';
    }
  }

  // ===== TRAINING (25% weight) =====
  let trainingScore = 50; // Default

  // TSB contribution (0-60)
  if (factors.tsb !== undefined) {
    if (factors.tsb > 20) {
      trainingScore = 80; // Very fresh
    } else if (factors.tsb > 5) {
      trainingScore = 70; // Fresh, good to go
    } else if (factors.tsb > -10) {
      trainingScore = 55; // Normal training load
    } else if (factors.tsb > -25) {
      trainingScore = 35; // Accumulated fatigue
    } else {
      trainingScore = 15; // Overreached
    }
  }

  // Yesterday's workout adjustment (-20 to +10)
  if (factors.yesterdayRpe !== undefined) {
    if (factors.yesterdayRpe >= 9) {
      trainingScore -= 15; // Very hard workout
    } else if (factors.yesterdayRpe >= 7) {
      trainingScore -= 5;
    } else if (factors.yesterdayRpe <= 3) {
      trainingScore += 5; // Easy day helps
    }
  }

  // Rest days bonus
  if (factors.restDaysBefore !== undefined && factors.restDaysBefore >= 1) {
    trainingScore += Math.min(15, factors.restDaysBefore * 5);
  }

  breakdown.training = Math.max(0, Math.min(100, trainingScore));
  if (breakdown.training < lowestCategoryScore) {
    lowestCategoryScore = breakdown.training;
    if (breakdown.training < 50 && !limitingFactor) {
      limitingFactor = 'Training fatigue';
    }
  }

  // ===== PHYSICAL STATE (25% weight) =====
  let physicalScore = 70; // Default to pretty good

  // Soreness impact
  if (factors.soreness !== undefined) {
    physicalScore -= (factors.soreness - 1) * 10; // 1=no impact, 5=-40
  }

  // Legs feel impact
  if (factors.legsFeel !== undefined) {
    const legsImpact = (factors.legsFeel - 3) * 10; // 1=-20, 3=0, 5=+20
    physicalScore += legsImpact;
  }

  // Illness impact (significant)
  if (factors.illness !== undefined && factors.illness > 1) {
    physicalScore -= (factors.illness - 1) * 15;
  }

  // HRV impact (when available from Intervals.icu)
  // Compare today's HRV against the user's baseline to detect recovery state
  if (factors.hrv !== undefined && factors.hrv > 0) {
    if (factors.hrvBaseline !== undefined && factors.hrvBaseline > 0) {
      // Compare against personal baseline
      const hrvRatio = factors.hrv / factors.hrvBaseline;
      if (hrvRatio >= 1.1) {
        physicalScore += 10;  // Well above baseline — great recovery
      } else if (hrvRatio >= 0.95) {
        physicalScore += 5;   // At or slightly above baseline — normal
      } else if (hrvRatio >= 0.8) {
        physicalScore -= 5;   // Below baseline — some fatigue
      } else {
        physicalScore -= 15;  // Significantly below baseline — stressed/fatigued
      }
    } else {
      // No baseline available — use absolute HRV heuristics (rMSSD typical ranges)
      // These are conservative; having any HRV data is mildly informative
      if (factors.hrv >= 80) {
        physicalScore += 5;
      } else if (factors.hrv <= 30) {
        physicalScore -= 5;
      }
      // Otherwise no adjustment — can't interpret without baseline
    }
  }

  // Resting HR impact (elevated resting HR signals fatigue/illness)
  if (factors.restingHR !== undefined && factors.restingHR > 0) {
    // Elevated resting HR is a red flag; low is a good sign
    // Most runners: 40-60 range is normal. We use conservative thresholds.
    if (factors.restingHR >= 75) {
      physicalScore -= 10;  // Notably elevated
    } else if (factors.restingHR >= 65) {
      physicalScore -= 5;   // Somewhat elevated
    }
    // Normal/low resting HR doesn't add a bonus — it's the expected state
  }

  breakdown.physical = Math.max(0, Math.min(100, physicalScore));
  if (breakdown.physical < lowestCategoryScore) {
    lowestCategoryScore = breakdown.physical;
    if (breakdown.physical < 50 && !limitingFactor) {
      limitingFactor = factors.illness && factors.illness > 2 ? 'Health' : 'Physical recovery';
    }
  }

  // ===== LIFE FACTORS (15% weight) =====
  let lifeScore = 70; // Default

  // Stress impact
  if (factors.stress !== undefined) {
    lifeScore -= (factors.stress - 1) * 8; // 1=no impact, 5=-32
  }

  // Mood contribution
  if (factors.mood !== undefined) {
    lifeScore += (factors.mood - 3) * 5; // 1=-10, 3=0, 5=+10
  }

  // Life stressors
  if (factors.hasLifeStressors) {
    lifeScore -= 15;
  }

  breakdown.life = Math.max(0, Math.min(100, lifeScore));
  if (breakdown.life < lowestCategoryScore) {
    lowestCategoryScore = breakdown.life;
    if (breakdown.life < 50 && !limitingFactor) {
      limitingFactor = 'Life stress';
    }
  }

  // ===== WEIGHTED FINAL SCORE =====
  const finalScore = Math.round(
    breakdown.sleep * 0.35 +
    breakdown.training * 0.25 +
    breakdown.physical * 0.25 +
    breakdown.life * 0.15
  );

  // ===== CATEGORIZE =====
  let category: ReadinessResult['category'];
  let color: string;
  let label: string;
  let recommendation: string;

  if (finalScore >= 80) {
    category = 'excellent';
    color = 'text-green-400';
    label = 'Ready to Perform';
    recommendation = 'Great day for a hard workout or race!';
  } else if (finalScore >= 65) {
    category = 'good';
    color = 'text-emerald-400';
    label = 'Good to Go';
    recommendation = 'You can handle your planned workout today.';
  } else if (finalScore >= 50) {
    category = 'moderate';
    color = 'text-amber-400';
    label = 'Proceed with Caution';
    recommendation = limitingFactor
      ? `${limitingFactor} is limiting you. Consider an easier effort.`
      : 'Listen to your body. Scale back if needed.';
  } else if (finalScore >= 35) {
    category = 'low';
    color = 'text-orange-400';
    label = 'Recovery Recommended';
    recommendation = limitingFactor
      ? `Focus on recovering ${limitingFactor.toLowerCase()}. Easy run or rest.`
      : 'Take it easy today. Your body needs recovery.';
  } else {
    category = 'rest';
    color = 'text-red-400';
    label = 'Rest Day';
    recommendation = 'Skip the run today. Focus on sleep, nutrition, and recovery.';
  }

  return {
    score: finalScore,
    confidence,
    category,
    color,
    label,
    limitingFactor,
    recommendation,
    message: confidence < 0.5 ? 'Limited data — log an assessment for a more accurate score' : undefined,
    breakdown,
  };
}

/**
 * Get default readiness when no data is available
 */
export function getDefaultReadiness(): ReadinessResult {
  return {
    score: null,
    confidence: 0,
    category: 'unknown',
    color: 'text-textTertiary',
    label: 'Unknown',
    limitingFactor: null,
    recommendation: 'Log a workout and assessment to see your readiness.',
    message: 'Log a workout and assessment to see your readiness',
    breakdown: {
      sleep: 0,
      training: 0,
      physical: 0,
      life: 0,
    },
  };
}
