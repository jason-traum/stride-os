'use server';

import { db } from '@/lib/db';
import { workouts, profiles } from '@/lib/schema';
import { eq, desc, gte, and } from 'drizzle-orm';

interface RacePrediction {
  distance: string;
  distanceMiles: number;
  predictedTime: number; // minutes
  confidenceLevel: 'high' | 'medium' | 'low';
  basedOn: {
    type: 'recent_race' | 'workout' | 'vo2max' | 'training_pace';
    description: string;
    date?: string;
  };
  pacePerMile: string;
  comparisonToGoal?: {
    goalTime: number;
    difference: number;
    achievable: boolean;
  };
}

interface RacePredictorResult {
  predictions: RacePrediction[];
  vo2max: number | null;
  recentRacePerformance: {
    distance: string;
    time: number;
    date: string;
  } | null;
  fitnessIndicators: {
    weeklyMileage: number;
    longRunDistance: number;
    speedWorkFrequency: number;
    consistency: number; // 0-100
  };
  recommendations: string[];
}

// Common race distances
const RACE_DISTANCES = [
  { name: '5K', miles: 3.10686 },
  { name: '10K', miles: 6.21371 },
  { name: 'Half Marathon', miles: 13.1094 },
  { name: 'Marathon', miles: 26.2188 },
];

// VDOT equivalency factors (from Jack Daniels)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _VDOT_FACTORS = {
  '5K': 0.98,
  '10K': 0.97,
  'Half Marathon': 0.94,
  'Marathon': 0.89,
};

export async function getRacePredictions(profileId: string): Promise<RacePredictorResult> {
  try {
    // Get profile data
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileId));

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Get recent workouts (last 90 days)
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

    // Find recent races or time trials
    const raceWorkouts = recentWorkouts.filter(w =>
      w.workoutType === 'race' ||
      w.workoutType === 'time_trial' ||
      (w.notes && w.notes.toLowerCase().includes('race')) ||
      (w.assessment && w.assessment.isPersonalRecord)
    );

    // Calculate fitness indicators
    const weeklyMileage = calculateAverageWeeklyMileage(recentWorkouts);
    const longRunDistance = Math.max(...recentWorkouts.map(w => w.distanceMiles || 0));
    const speedWorkouts = recentWorkouts.filter(w =>
      w.workoutType === 'interval' ||
      w.workoutType === 'tempo' ||
      w.workoutType === 'threshold'
    );
    const speedWorkFrequency = (speedWorkouts.length / 13) * 100; // per week over 13 weeks

    // Calculate consistency (% of weeks with 3+ runs)
    const consistency = calculateConsistency(recentWorkouts);

    // Get recent race performance
    const recentRacePerformance = raceWorkouts.length > 0 ? {
      distance: formatDistance(raceWorkouts[0].distanceMiles || 0),
      time: raceWorkouts[0].durationMinutes || 0,
      date: raceWorkouts[0].date,
    } : null;

    // Calculate VO2 max (use profile value or estimate from recent performance)
    let vo2max = profile.vo2Max;
    if (!vo2max && recentRacePerformance) {
      vo2max = estimateVO2Max(
        recentRacePerformance.time,
        getDistanceMiles(recentRacePerformance.distance)
      );
    }

    // Generate predictions
    const predictions: RacePrediction[] = [];

    for (const race of RACE_DISTANCES) {
      let prediction: RacePrediction | null = null;

      // Method 1: Recent race performance (highest confidence)
      if (recentRacePerformance) {
        const scaledTime = scaleRaceTime(
          recentRacePerformance.time,
          getDistanceMiles(recentRacePerformance.distance),
          race.miles
        );

        prediction = {
          distance: race.name,
          distanceMiles: race.miles,
          predictedTime: scaledTime,
          confidenceLevel: getConfidenceLevel(recentRacePerformance.date, weeklyMileage, race.miles),
          basedOn: {
            type: 'recent_race',
            description: `Based on ${recentRacePerformance.distance} race`,
            date: recentRacePerformance.date,
          },
          pacePerMile: formatPace(scaledTime * 60 / race.miles),
        };
      }
      // Method 2: VO2 max prediction
      else if (vo2max) {
        const predictedTime = predictTimeFromVO2Max(vo2max, race.miles);

        prediction = {
          distance: race.name,
          distanceMiles: race.miles,
          predictedTime: predictedTime,
          confidenceLevel: 'medium',
          basedOn: {
            type: 'vo2max',
            description: `Based on VO2 max of ${vo2max}`,
          },
          pacePerMile: formatPace(predictedTime * 60 / race.miles),
        };
      }
      // Method 3: Training pace analysis
      else if (recentWorkouts.length > 10) {
        const predictedTime = predictFromTrainingPaces(recentWorkouts, race.miles);

        if (predictedTime) {
          prediction = {
            distance: race.name,
            distanceMiles: race.miles,
            predictedTime: predictedTime,
            confidenceLevel: 'low',
            basedOn: {
              type: 'training_pace',
              description: 'Based on recent training paces',
            },
            pacePerMile: formatPace(predictedTime * 60 / race.miles),
          };
        }
      }

      // Add goal comparison if available
      if (prediction && profile.raceGoal && profile.raceDate) {
        const goalDistance = parseRaceDistance(profile.raceGoal);
        if (goalDistance && Math.abs(goalDistance - race.miles) < 0.1) {
          // Parse goal time if available in notes/description
          const goalTimeMinutes = parseGoalTime(profile.raceGoal);
          if (goalTimeMinutes) {
            prediction.comparisonToGoal = {
              goalTime: goalTimeMinutes,
              difference: prediction.predictedTime - goalTimeMinutes,
              achievable: prediction.predictedTime <= goalTimeMinutes * 1.02, // Within 2%
            };
          }
        }
      }

      if (prediction) {
        predictions.push(prediction);
      }
    }

    // Generate recommendations
    const recommendations = generateRecommendations(
      predictions,
      { weeklyMileage, longRunDistance, speedWorkFrequency, consistency },
      profile
    );

    return {
      predictions,
      vo2max,
      recentRacePerformance,
      fitnessIndicators: {
        weeklyMileage,
        longRunDistance,
        speedWorkFrequency,
        consistency,
      },
      recommendations,
    };

  } catch (error) {
    console.error('Error generating race predictions:', error);
    return {
      predictions: [],
      vo2max: null,
      recentRacePerformance: null,
      fitnessIndicators: {
        weeklyMileage: 0,
        longRunDistance: 0,
        speedWorkFrequency: 0,
        consistency: 0,
      },
      recommendations: ['Unable to generate predictions. Please log more workouts.'],
    };
  }
}

// Helper functions

function calculateAverageWeeklyMileage(workouts: typeof workouts[0][]): number {
  if (workouts.length === 0) return 0;

  const weeks = new Map<string, number>();
  workouts.forEach(w => {
    const weekKey = getWeekKey(new Date(w.date));
    weeks.set(weekKey, (weeks.get(weekKey) || 0) + (w.distanceMiles || 0));
  });

  const totalMileage = Array.from(weeks.values()).reduce((sum, miles) => sum + miles, 0);
  return Math.round(totalMileage / Math.max(weeks.size, 1));
}

function calculateConsistency(workouts: typeof workouts[0][]): number {
  const weeks = new Map<string, number>();
  workouts.forEach(w => {
    const weekKey = getWeekKey(new Date(w.date));
    weeks.set(weekKey, (weeks.get(weekKey) || 0) + 1);
  });

  const consistentWeeks = Array.from(weeks.values()).filter(count => count >= 3).length;
  return Math.round((consistentWeeks / Math.max(weeks.size, 1)) * 100);
}

function getWeekKey(date: Date): string {
  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  return startOfWeek.toISOString().split('T')[0];
}

function formatDistance(miles: number): string {
  for (const race of RACE_DISTANCES) {
    if (Math.abs(miles - race.miles) < 0.1) {
      return race.name;
    }
  }
  return `${miles.toFixed(1)} miles`;
}

function getDistanceMiles(distance: string): number {
  const race = RACE_DISTANCES.find(r => r.name === distance);
  return race ? race.miles : parseFloat(distance) || 0;
}

function scaleRaceTime(baseTime: number, baseDistance: number, targetDistance: number): number {
  // Use Riegel formula: T2 = T1 * (D2/D1)^1.06
  return baseTime * Math.pow(targetDistance / baseDistance, 1.06);
}

function estimateVO2Max(timeMinutes: number, distanceMiles: number): number {
  // Simplified VO2 max estimation based on race performance
  const velocity = (distanceMiles * 1609.34) / (timeMinutes * 60); // m/s
  const percentMax = 0.8 + 0.1894393 * Math.exp(-0.012778 * timeMinutes);
  const vo2 = -4.60 + 0.182258 * velocity * 60 + 0.000104 * Math.pow(velocity * 60, 2);
  return Math.round(vo2 / percentMax);
}

function predictTimeFromVO2Max(vo2max: number, distanceMiles: number): number {
  // Use VDOT tables to predict time
  const vdot = vo2max; // Simplified - normally would use conversion
  const velocity = (210 / vdot) * 1000 / 60; // m/min at VO2 max

  // Adjust for distance using % of VO2 max sustainable
  let percentVO2;
  if (distanceMiles <= 3.1) percentVO2 = 0.98;
  else if (distanceMiles <= 6.2) percentVO2 = 0.97;
  else if (distanceMiles <= 13.1) percentVO2 = 0.94;
  else percentVO2 = 0.89;

  const raceVelocity = velocity * percentVO2;
  return (distanceMiles * 1609.34) / raceVelocity;
}

function predictFromTrainingPaces(workouts: typeof workouts[0][], targetDistance: number): number | null {
  // Find tempo/threshold runs
  const qualityRuns = workouts.filter(w =>
    w.avgPaceSeconds &&
    w.distanceMiles &&
    w.distanceMiles >= 3 &&
    (w.workoutType === 'tempo' || w.workoutType === 'threshold' || w.avgPaceSeconds < 600)
  );

  if (qualityRuns.length < 3) return null;

  // Average pace from quality runs
  const avgPaceSeconds = qualityRuns.reduce((sum, w) => sum + (w.avgPaceSeconds || 0), 0) / qualityRuns.length;

  // Adjust based on target distance
  let adjustmentFactor = 1;
  if (targetDistance <= 3.1) adjustmentFactor = 0.95;
  else if (targetDistance <= 6.2) adjustmentFactor = 1.02;
  else if (targetDistance <= 13.1) adjustmentFactor = 1.08;
  else adjustmentFactor = 1.15;

  return (avgPaceSeconds * adjustmentFactor * targetDistance) / 60;
}

function getConfidenceLevel(raceDate: string, weeklyMileage: number, targetDistance: number): 'high' | 'medium' | 'low' {
  const daysSinceRace = (Date.now() - new Date(raceDate).getTime()) / (24 * 60 * 60 * 1000);

  // Recent race + appropriate mileage = high confidence
  if (daysSinceRace < 30 && weeklyMileage >= targetDistance * 2) return 'high';

  // Older race or lower mileage = medium confidence
  if (daysSinceRace < 60 && weeklyMileage >= targetDistance * 1.5) return 'medium';

  // Old race or insufficient mileage = low confidence
  return 'low';
}

function parseRaceDistance(raceGoal: string): number | null {
  const race = RACE_DISTANCES.find(r => raceGoal.includes(r.name));
  return race ? race.miles : null;
}

function parseGoalTime(raceGoal: string): number | null {
  // Try to parse time from goal string (e.g., "Sub-3 marathon", "4:00 marathon")
  const timeMatch = raceGoal.match(/(\d+):(\d+)/);
  if (timeMatch) {
    return parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2]);
  }

  const subMatch = raceGoal.match(/sub[- ]?(\d+)/i);
  if (subMatch) {
    return parseInt(subMatch[1]) * 60;
  }

  return null;
}

function generateRecommendations(
  predictions: RacePrediction[],
  indicators: RacePredictorResult['fitnessIndicators'],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any
): string[] {
  const recommendations: string[] = [];

  // Mileage recommendations
  if (profile.raceGoal) {
    const targetDistance = parseRaceDistance(profile.raceGoal);
    if (targetDistance) {
      if (targetDistance >= 26.2 && indicators.weeklyMileage < 40) {
        recommendations.push('Build weekly mileage to 40-50 miles for marathon success');
      } else if (targetDistance >= 13.1 && indicators.weeklyMileage < 25) {
        recommendations.push('Increase weekly mileage to 25-35 miles for half marathon training');
      }

      if (indicators.longRunDistance < targetDistance * 0.7) {
        recommendations.push(`Build long run to at least ${Math.round(targetDistance * 0.7)} miles`);
      }
    }
  }

  // Speed work recommendations
  if (indicators.speedWorkFrequency < 15) {
    recommendations.push('Add 1-2 speed/tempo workouts per week to improve race times');
  }

  // Consistency recommendations
  if (indicators.consistency < 70) {
    recommendations.push('Focus on consistency - aim for 4-5 runs per week');
  }

  // Prediction-based recommendations
  const hasHighConfidence = predictions.some(p => p.confidenceLevel === 'high');
  if (!hasHighConfidence) {
    recommendations.push('Race a shorter distance to establish current fitness baseline');
  }

  // Goal-based recommendations
  const goalPrediction = predictions.find(p => p.comparisonToGoal);
  if (goalPrediction?.comparisonToGoal) {
    if (goalPrediction.comparisonToGoal.achievable) {
      recommendations.push('Your goal time appears achievable - maintain current training');
    } else {
      const minutesOff = Math.round(goalPrediction.comparisonToGoal.difference);
      recommendations.push(`Need to improve by ${minutesOff} minutes - consider adding more quality work`);
    }
  }

  return recommendations.slice(0, 4); // Limit to 4 recommendations
}

function formatPace(paceSeconds: number): string {
  const minutes = Math.floor(paceSeconds / 60);
  const seconds = Math.round(paceSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}