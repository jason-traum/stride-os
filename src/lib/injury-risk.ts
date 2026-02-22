'use server';

import { db } from '@/lib/db';
import { workouts, profiles, type Workout } from '@/lib/schema';
import { eq, desc, gte, and } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import { parseLocalDate } from '@/lib/utils';

export interface InjuryRiskAssessment {
  riskScore: number | null; // 0-100, higher = more risk, null when no data
  riskLevel: 'low' | 'moderate' | 'high' | 'critical' | 'unknown';
  confidence: number;       // 0 = no data, 0.5 = limited, 1.0 = good data
  factors: {
    factor: string;
    impact: 'positive' | 'negative' | 'neutral';
    score: number;
    description: string;
  }[];
  warnings: string[];
  recommendations: string[];
  message?: string;         // explanation when confidence is low
  historicalInjuries?: {
    type: string;
    date?: string;
    notes?: string;
  }[];
}

interface RiskFactor {
  name: string;
  weight: number;
  value: number;
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

/**
 * Assess injury risk based on training patterns and profile data
 */
export async function getInjuryRiskAssessment(): Promise<InjuryRiskAssessment> {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) {
      return getEmptyAssessment();
    }

    // Get profile data
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId));

    if (!profile) {
      return getEmptyAssessment();
    }

    // Get recent workouts (90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentWorkouts = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          gte(workouts.date, ninetyDaysAgo.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(workouts.date));

    // Check for no recent workouts (within 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
    const last30DaysWorkouts = recentWorkouts.filter(w => w.date >= thirtyDaysAgoStr);

    if (last30DaysWorkouts.length === 0) {
      return {
        riskScore: null,
        riskLevel: 'unknown',
        confidence: 0,
        factors: [],
        warnings: [],
        recommendations: ['Start with easy runs and gradually build mileage when returning to training.'],
        message: 'No workouts in the last 30 days — log some runs to assess injury risk',
      };
    }

    // Calculate risk factors
    const factors: RiskFactor[] = [];

    // 1. Mileage increase rate
    const mileageIncreaseFactor = calculateMileageIncrease(recentWorkouts);
    factors.push(mileageIncreaseFactor);

    // 2. Training load (acute vs chronic)
    const trainingLoadFactor = await calculateTrainingLoadRisk(recentWorkouts);
    factors.push(trainingLoadFactor);

    // 3. Recovery between hard efforts
    const recoveryFactor = calculateRecoveryRisk(recentWorkouts);
    factors.push(recoveryFactor);

    // 4. Consecutive days running
    const consecutiveDaysFactor = calculateConsecutiveDaysRisk(recentWorkouts);
    factors.push(consecutiveDaysFactor);

    // 5. Speed work frequency
    const speedWorkFactor = calculateSpeedWorkRisk(recentWorkouts);
    factors.push(speedWorkFactor);

    // 6. Age-related risk
    const ageFactor = calculateAgeRisk(profile.age);
    factors.push(ageFactor);

    // 7. Previous injury history
    const injuryHistoryFactor = calculateInjuryHistoryRisk(profile.injury_history);
    factors.push(injuryHistoryFactor);

    // 8. Running experience
    const experienceFactor = calculateExperienceRisk(profile.runningYears, recentWorkouts);
    factors.push(experienceFactor);

    // Calculate overall risk score
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore = factors.reduce((sum, f) => {
      const adjustedScore = f.impact === 'positive' ? (100 - f.value) : f.value;
      return sum + (adjustedScore * f.weight);
    }, 0);
    const riskScore = Math.round(weightedScore / totalWeight);

    // Determine risk level
    let riskLevel: InjuryRiskAssessment['riskLevel'];
    if (riskScore >= 75) riskLevel = 'critical';
    else if (riskScore >= 50) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'moderate';
    else riskLevel = 'low';

    // Generate warnings and recommendations
    const { warnings, recommendations } = generateAdvice(factors, riskLevel, profile);

    // Parse injury history if available
    const historicalInjuries = profile.injury_history
      ? parseInjuryHistory(profile.injury_history)
      : [];

    // Confidence: based on how many workouts we have in the last 90 days
    const confidence = recentWorkouts.length >= 20 ? 1.0
      : recentWorkouts.length >= 7 ? 0.7
      : 0.4;

    return {
      riskScore,
      riskLevel,
      confidence,
      factors: factors.map(f => ({
        factor: f.name,
        impact: f.impact,
        score: f.value,
        description: f.description,
      })),
      warnings,
      recommendations,
      message: confidence < 0.7 ? 'Limited training data — assessment may not be fully accurate' : undefined,
      historicalInjuries,
    };

  } catch (error) {
    console.error('Error assessing injury risk:', error);
    return getEmptyAssessment();
  }
}

function getEmptyAssessment(): InjuryRiskAssessment {
  return {
    riskScore: null,
    riskLevel: 'unknown',
    confidence: 0,
    factors: [],
    warnings: [],
    recommendations: [],
    message: 'No recent training data — log some workouts to assess injury risk',
  };
}

function calculateMileageIncrease(recentWorkouts: Workout[]): RiskFactor {
  if (recentWorkouts.length < 14) {
    return {
      name: 'Weekly Mileage Increase',
      weight: 1.5,
      value: 0,
      impact: 'neutral',
      description: 'Not enough data to assess mileage trends',
    };
  }

  // Calculate weekly mileages
  const weeklyMileages = new Map<string, number>();
  recentWorkouts.forEach(w => {
    const weekKey = getWeekKey(parseLocalDate(w.date));
    weeklyMileages.set(weekKey, (weeklyMileages.get(weekKey) || 0) + (w.distanceMiles || 0));
  });

  const sortedWeeks = Array.from(weeklyMileages.entries())
    .sort((a, b) => a[0].localeCompare(b[0]));

  if (sortedWeeks.length < 2) {
    return {
      name: 'Weekly Mileage Increase',
      weight: 1.5,
      value: 0,
      impact: 'neutral',
      description: 'Not enough weekly data',
    };
  }

  // Calculate week-over-week increases
  const increases: number[] = [];
  for (let i = 1; i < sortedWeeks.length; i++) {
    const prevMiles = sortedWeeks[i - 1][1];
    const currMiles = sortedWeeks[i][1];
    if (prevMiles > 0) {
      const increase = ((currMiles - prevMiles) / prevMiles) * 100;
      increases.push(increase);
    }
  }

  const maxIncrease = Math.max(...increases);
  const avgIncrease = increases.reduce((a, b) => a + b, 0) / increases.length;

  let value = 0;
  let description = '';

  if (maxIncrease > 30) {
    value = 90;
    description = `Dangerous ${Math.round(maxIncrease)}% weekly increase detected`;
  } else if (maxIncrease > 20) {
    value = 70;
    description = `High ${Math.round(maxIncrease)}% weekly increase - caution advised`;
  } else if (avgIncrease > 10) {
    value = 50;
    description = `Average ${Math.round(avgIncrease)}% weekly increase - moderate risk`;
  } else if (avgIncrease < 0) {
    value = 10;
    description = 'Decreasing mileage - low risk';
  } else {
    value = 20;
    description = `Safe ${Math.round(avgIncrease)}% average weekly increase`;
  }

  return {
    name: 'Weekly Mileage Increase',
    weight: 1.5,
    value,
    impact: 'negative',
    description,
  };
}

async function calculateTrainingLoadRisk(recentWorkouts: Workout[]): Promise<RiskFactor> {
  if (recentWorkouts.length < 7) {
    return {
      name: 'Training Load Balance',
      weight: 1.3,
      value: 0,
      impact: 'neutral',
      description: 'Not enough data for load analysis',
    };
  }

  // Simple TSS estimation based on duration and perceived effort
  const estimateTSS = (workout: Workout) => {
    const duration = workout.durationMinutes || 0;
    const intensity = workout.workoutType === 'interval' ? 0.9
      : workout.workoutType === 'tempo' ? 0.85
      : workout.workoutType === 'threshold' ? 0.87
      : 0.7; // easy/recovery

    return duration * intensity;
  };

  // Calculate 7-day and 28-day loads
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const twentyEightDaysAgo = new Date();
  twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);

  const acuteWorkouts = recentWorkouts.filter(w => parseLocalDate(w.date) >= sevenDaysAgo);
  const chronicWorkouts = recentWorkouts.filter(w => parseLocalDate(w.date) >= twentyEightDaysAgo);

  const acuteLoad = acuteWorkouts.reduce((sum, w) => sum + estimateTSS(w), 0) / 7;
  const chronicLoad = chronicWorkouts.reduce((sum, w) => sum + estimateTSS(w), 0) / 28;

  const ratio = chronicLoad > 0 ? acuteLoad / chronicLoad : 0;

  let value = 0;
  let description = '';

  if (ratio > 1.5) {
    value = 85;
    description = `Very high acute:chronic ratio (${ratio.toFixed(2)}) - major injury risk`;
  } else if (ratio > 1.3) {
    value = 65;
    description = `High acute:chronic ratio (${ratio.toFixed(2)}) - increased risk`;
  } else if (ratio > 0.8 && ratio < 1.3) {
    value = 20;
    description = `Good acute:chronic ratio (${ratio.toFixed(2)}) - optimal zone`;
  } else if (ratio < 0.8) {
    value = 30;
    description = `Low acute:chronic ratio (${ratio.toFixed(2)}) - undertraining`;
  }

  return {
    name: 'Training Load Balance',
    weight: 1.3,
    value,
    impact: 'negative',
    description,
  };
}

function calculateRecoveryRisk(recentWorkouts: Workout[]): RiskFactor {
  const hardWorkouts = recentWorkouts.filter(w =>
    w.workoutType === 'interval' ||
    w.workoutType === 'tempo' ||
    w.workoutType === 'threshold' ||
    w.workoutType === 'race'
  );

  if (hardWorkouts.length < 2) {
    return {
      name: 'Recovery Between Hard Efforts',
      weight: 1.2,
      value: 0,
      impact: 'neutral',
      description: 'Not enough hard workouts to assess',
    };
  }

  // Check for back-to-back hard days
  let backToBackCount = 0;
  for (let i = 1; i < hardWorkouts.length; i++) {
    const date1 = parseLocalDate(hardWorkouts[i - 1].date);
    const date2 = parseLocalDate(hardWorkouts[i].date);
    const daysDiff = (date1.getTime() - date2.getTime()) / (24 * 60 * 60 * 1000);

    if (Math.abs(daysDiff) <= 1) {
      backToBackCount++;
    }
  }

  let value = 0;
  let description = '';

  if (backToBackCount >= 3) {
    value = 80;
    description = `${backToBackCount} back-to-back hard sessions - poor recovery`;
  } else if (backToBackCount >= 1) {
    value = 50;
    description = `${backToBackCount} back-to-back hard sessions - moderate risk`;
  } else {
    value = 10;
    description = 'Good recovery spacing between hard efforts';
  }

  return {
    name: 'Recovery Between Hard Efforts',
    weight: 1.2,
    value,
    impact: 'negative',
    description,
  };
}

function calculateConsecutiveDaysRisk(recentWorkouts: Workout[]): RiskFactor {
  if (recentWorkouts.length === 0) {
    return {
      name: 'Consecutive Running Days',
      weight: 1.0,
      value: 0,
      impact: 'neutral',
      description: 'No workout data',
    };
  }

  // Find longest streak of consecutive days
  const dates = Array.from(new Set(recentWorkouts.map(w => w.date))).sort();
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const date1 = parseLocalDate(dates[i - 1]);
    const date2 = parseLocalDate(dates[i]);
    const daysDiff = (date2.getTime() - date1.getTime()) / (24 * 60 * 60 * 1000);

    if (daysDiff === 1) {
      currentStreak++;
      maxStreak = Math.max(maxStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  let value = 0;
  let description = '';

  if (maxStreak >= 14) {
    value = 70;
    description = `${maxStreak} consecutive days running - need rest days`;
  } else if (maxStreak >= 10) {
    value = 50;
    description = `${maxStreak} consecutive days - consider more rest`;
  } else if (maxStreak >= 7) {
    value = 30;
    description = `${maxStreak} consecutive days - monitor fatigue`;
  } else {
    value = 10;
    description = 'Good rest day frequency';
  }

  return {
    name: 'Consecutive Running Days',
    weight: 1.0,
    value,
    impact: 'negative',
    description,
  };
}

function calculateSpeedWorkRisk(recentWorkouts: Workout[]): RiskFactor {
  const speedWorkouts = recentWorkouts.filter(w =>
    w.workoutType === 'interval' || w.workoutType === 'tempo'
  );

  const totalWorkouts = recentWorkouts.length;
  const speedPercentage = totalWorkouts > 0
    ? (speedWorkouts.length / totalWorkouts) * 100
    : 0;

  let value = 0;
  let description = '';

  if (speedPercentage > 30) {
    value = 70;
    description = `${Math.round(speedPercentage)}% speed work - too much intensity`;
  } else if (speedPercentage > 20) {
    value = 40;
    description = `${Math.round(speedPercentage)}% speed work - moderate amount`;
  } else if (speedPercentage < 5) {
    value = 20;
    description = 'Low speed work - consider adding quality sessions';
  } else {
    value = 15;
    description = `${Math.round(speedPercentage)}% speed work - appropriate balance`;
  }

  return {
    name: 'Speed Work Frequency',
    weight: 0.8,
    value,
    impact: 'negative',
    description,
  };
}

function calculateAgeRisk(age?: number): RiskFactor {
  if (!age) {
    return {
      name: 'Age-Related Risk',
      weight: 0.5,
      value: 0,
      impact: 'neutral',
      description: 'Age not provided',
    };
  }

  let value = 0;
  let description = '';

  if (age >= 50) {
    value = 40;
    description = `Age ${age} - increased injury risk, prioritize recovery`;
  } else if (age >= 40) {
    value = 25;
    description = `Age ${age} - moderate age-related risk`;
  } else if (age < 20) {
    value = 30;
    description = `Age ${age} - young runner, monitor growth-related issues`;
  } else {
    value = 10;
    description = `Age ${age} - low age-related risk`;
  }

  return {
    name: 'Age-Related Risk',
    weight: 0.5,
    value,
    impact: 'negative',
    description,
  };
}

function calculateInjuryHistoryRisk(injuryHistory?: string): RiskFactor {
  if (!injuryHistory) {
    return {
      name: 'Injury History',
      weight: 1.0,
      value: 0,
      impact: 'positive',
      description: 'No previous injuries reported',
    };
  }

  const recentInjuryMentions = injuryHistory.toLowerCase().includes('recent') ||
    injuryHistory.toLowerCase().includes('last year') ||
    injuryHistory.toLowerCase().includes('months ago');

  const chronicMentions = injuryHistory.toLowerCase().includes('chronic') ||
    injuryHistory.toLowerCase().includes('recurring') ||
    injuryHistory.toLowerCase().includes('ongoing');

  let value = 0;
  let description = '';

  if (chronicMentions) {
    value = 70;
    description = 'Chronic/recurring injury history - high risk';
  } else if (recentInjuryMentions) {
    value = 50;
    description = 'Recent injury history - moderate risk';
  } else {
    value = 25;
    description = 'Past injury history - monitor carefully';
  }

  return {
    name: 'Injury History',
    weight: 1.0,
    value,
    impact: 'negative',
    description,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function calculateExperienceRisk(runningYears?: number, workouts?: any[]): RiskFactor {
  const years = runningYears || 0;
  const hasConsistentTraining = workouts && workouts.length > 20;

  let value = 0;
  let description = '';

  if (years < 1) {
    value = 60;
    description = 'New runner (<1 year) - higher injury risk';
  } else if (years < 2) {
    value = 40;
    description = 'Relatively new runner - building durability';
  } else if (years >= 5 && hasConsistentTraining) {
    value = 10;
    description = `Experienced runner (${years}+ years) - lower risk`;
  } else {
    value = 20;
    description = `${years} years experience - moderate risk`;
  }

  return {
    name: 'Running Experience',
    weight: 0.7,
    value,
    impact: value < 30 ? 'positive' : 'negative',
    description,
  };
}

function getWeekKey(date: Date): string {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  return startOfWeek.toISOString().split('T')[0];
}

function parseInjuryHistory(history: string): InjuryRiskAssessment['historicalInjuries'] {
  // Simple parsing - could be enhanced
  const injuries: InjuryRiskAssessment['historicalInjuries'] = [];

  const commonInjuries = [
    'plantar fasciitis',
    'runner\'s knee',
    'IT band',
    'shin splints',
    'achilles',
    'hamstring',
    'calf strain',
    'stress fracture',
  ];

  commonInjuries.forEach(injury => {
    if (history.toLowerCase().includes(injury)) {
      injuries.push({
        type: injury.charAt(0).toUpperCase() + injury.slice(1),
        notes: 'Mentioned in injury history',
      });
    }
  });

  return injuries;
}

function generateAdvice(
  factors: RiskFactor[],
  riskLevel: InjuryRiskAssessment['riskLevel'],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any
): { warnings: string[]; recommendations: string[] } {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // High-risk warnings
  const highRiskFactors = factors.filter(f => f.value >= 70 && f.impact === 'negative');
  highRiskFactors.forEach(factor => {
    if (factor.name === 'Weekly Mileage Increase') {
      warnings.push('Dangerous mileage increase detected - high injury risk!');
    } else if (factor.name === 'Training Load Balance') {
      warnings.push('Training load spike detected - reduce intensity immediately');
    } else if (factor.name === 'Recovery Between Hard Efforts') {
      warnings.push('Insufficient recovery between hard workouts');
    }
  });

  // General warnings based on risk level
  if (riskLevel === 'critical') {
    warnings.push('Critical injury risk - consider taking rest days immediately');
  } else if (riskLevel === 'high') {
    warnings.push('High injury risk - modify training to reduce load');
  }

  // Recommendations based on factors
  factors.forEach(factor => {
    if (factor.name === 'Weekly Mileage Increase' && factor.value > 50) {
      recommendations.push('Follow the 10% rule - increase weekly mileage by no more than 10%');
      recommendations.push('Consider a recovery week with 50% normal mileage');
    } else if (factor.name === 'Training Load Balance' && factor.value > 50) {
      recommendations.push('Reduce training intensity for the next week');
      recommendations.push('Focus on easy runs and recovery');
    } else if (factor.name === 'Recovery Between Hard Efforts' && factor.value > 40) {
      recommendations.push('Space hard workouts by at least 48 hours');
      recommendations.push('Add easy recovery runs between quality sessions');
    } else if (factor.name === 'Consecutive Running Days' && factor.value > 50) {
      recommendations.push('Take at least 1-2 rest days per week');
      recommendations.push('Consider cross-training on non-running days');
    }
  });

  // Age-specific recommendations
  if (profile.age && profile.age >= 40) {
    recommendations.push('Prioritize dynamic warm-ups before running');
    recommendations.push('Consider adding strength training 2x per week');
  }

  // General injury prevention
  if (recommendations.length < 3) {
    recommendations.push('Listen to your body - rest if feeling unusual pain');
    recommendations.push('Maintain consistent running form, especially when tired');
    recommendations.push('Stay hydrated and fuel properly for your runs');
  }

  return { warnings, recommendations };
}