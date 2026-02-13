'use server';

import { db } from '@/lib/db';
import { workouts, weatherData } from '@/lib/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';

export interface HeatAdaptationData {
  currentScore: number; // 0-100
  trend: 'improving' | 'maintaining' | 'declining' | 'insufficient_data';
  recentHeatExposure: {
    count: number;
    avgTemp: number;
    avgHumidity: number;
    totalMinutes: number;
  };
  adaptationHistory: {
    date: string;
    temp: number;
    humidity: number;
    apparentTemp: number;
    duration: number;
    avgPace: number;
    paceAdjustment: number; // % slower than cool weather pace
  }[];
  recommendations: string[];
  heatIndex: {
    current: number;
    optimal: number;
    safeMax: number;
  };
}

/**
 * Calculate heat adaptation score and provide recommendations
 */
export async function getHeatAdaptationAnalysis(): Promise<HeatAdaptationData> {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) {
      return getEmptyData();
    }

    // Get workouts from last 30 days with weather data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentWorkouts = await db
      .select({
        workout: workouts,
        weather: weatherData,
      })
      .from(workouts)
      .leftJoin(
        weatherData,
        and(
          eq(weatherData.profileId, workouts.profileId),
          eq(weatherData.date, workouts.date)
        )
      )
      .where(
        and(
          eq(workouts.profileId, profileId),
          gte(workouts.date, thirtyDaysAgo.toISOString().split('T')[0])
        )
      )
      .orderBy(desc(workouts.date));

    if (recentWorkouts.length === 0) {
      return getEmptyData();
    }

    // Filter workouts with heat exposure (>70°F or >21°C)
    const heatWorkouts = recentWorkouts.filter(({ weather }) =>
      weather && weather.temperature && weather.temperature > 70
    );

    if (heatWorkouts.length === 0) {
      return {
        currentScore: 0,
        trend: 'insufficient_data',
        recentHeatExposure: {
          count: 0,
          avgTemp: 0,
          avgHumidity: 0,
          totalMinutes: 0,
        },
        adaptationHistory: [],
        recommendations: [
          'No heat training detected in the last 30 days.',
          'If you have a warm weather race coming up, start gradual heat exposure.',
          'Begin with shorter, easier runs in warmer conditions.',
        ],
        heatIndex: {
          current: 0,
          optimal: 75,
          safeMax: 90,
        },
      };
    }

    // Calculate adaptation score based on frequency and recency
    const adaptationScore = calculateAdaptationScore(heatWorkouts);

    // Calculate recent heat exposure stats
    const recentExposure = calculateRecentExposure(heatWorkouts);

    // Build adaptation history
    const adaptationHistory = heatWorkouts.slice(0, 10).map(({ workout, weather }) => {
      const apparentTemp = calculateApparentTemp(
        weather!.temperature!,
        weather!.humidity || 50
      );

      // Find cool weather pace for comparison
      const coolWeatherPace = findCoolWeatherPace(recentWorkouts, workout.workoutType);
      const paceAdjustment = coolWeatherPace
        ? ((workout.avgPaceSeconds! - coolWeatherPace) / coolWeatherPace) * 100
        : 0;

      return {
        date: workout.date,
        temp: weather!.temperature!,
        humidity: weather!.humidity || 50,
        apparentTemp,
        duration: workout.durationMinutes || 0,
        avgPace: workout.avgPaceSeconds || 0,
        paceAdjustment,
      };
    });

    // Determine trend
    const trend = calculateTrend(heatWorkouts);

    // Generate recommendations
    const recommendations = generateRecommendations(
      adaptationScore,
      recentExposure,
      trend,
      adaptationHistory
    );

    // Calculate heat index values
    const currentTemp = heatWorkouts[0]?.weather?.temperature || 75;
    const heatIndex = {
      current: calculateApparentTemp(currentTemp, 60),
      optimal: 75, // Ideal training temp
      safeMax: 90, // Caution above this
    };

    return {
      currentScore: adaptationScore,
      trend,
      recentHeatExposure: recentExposure,
      adaptationHistory,
      recommendations,
      heatIndex,
    };

  } catch (error) {
    console.error('Error analyzing heat adaptation:', error);
    return getEmptyData();
  }
}

function getEmptyData(): HeatAdaptationData {
  return {
    currentScore: 0,
    trend: 'insufficient_data',
    recentHeatExposure: {
      count: 0,
      avgTemp: 0,
      avgHumidity: 0,
      totalMinutes: 0,
    },
    adaptationHistory: [],
    recommendations: ['Log workouts with weather data to track heat adaptation.'],
    heatIndex: {
      current: 0,
      optimal: 75,
      safeMax: 90,
    },
  };
}

function calculateAdaptationScore(heatWorkouts: any[]): number {
  if (heatWorkouts.length === 0) return 0;

  // Factors for score:
  // 1. Frequency (workouts per week)
  // 2. Recency (weighted by how recent)
  // 3. Duration (total heat exposure time)
  // 4. Intensity (temperature levels)

  const now = Date.now();
  let score = 0;
  let totalWeight = 0;

  heatWorkouts.forEach(({ workout, weather }, index) => {
    const daysSince = (now - new Date(workout.date).getTime()) / (24 * 60 * 60 * 1000);
    const recencyWeight = Math.exp(-daysSince / 14); // Half-life of 2 weeks

    const temp = weather!.temperature!;
    const tempScore = Math.min(100, (temp - 70) * 2); // 0 at 70°F, 100 at 120°F

    const durationScore = Math.min(100, workout.durationMinutes! / 60 * 100); // 100% at 60+ min

    const workoutScore = (tempScore * 0.5 + durationScore * 0.5) * recencyWeight;

    score += workoutScore;
    totalWeight += recencyWeight;
  });

  // Normalize and add frequency bonus
  const baseScore = totalWeight > 0 ? score / totalWeight : 0;
  const frequencyBonus = Math.min(20, heatWorkouts.length * 2); // Up to 20 points for frequency

  return Math.min(100, Math.round(baseScore + frequencyBonus));
}

function calculateRecentExposure(heatWorkouts: any[]) {
  if (heatWorkouts.length === 0) {
    return {
      count: 0,
      avgTemp: 0,
      avgHumidity: 0,
      totalMinutes: 0,
    };
  }

  const last14Days = heatWorkouts.filter(({ workout }) => {
    const daysSince = (Date.now() - new Date(workout.date).getTime()) / (24 * 60 * 60 * 1000);
    return daysSince <= 14;
  });

  const totalTemp = last14Days.reduce((sum, { weather }) => sum + weather!.temperature!, 0);
  const totalHumidity = last14Days.reduce((sum, { weather }) => sum + (weather!.humidity || 50), 0);
  const totalMinutes = last14Days.reduce((sum, { workout }) => sum + (workout.durationMinutes || 0), 0);

  return {
    count: last14Days.length,
    avgTemp: Math.round(totalTemp / last14Days.length),
    avgHumidity: Math.round(totalHumidity / last14Days.length),
    totalMinutes: Math.round(totalMinutes),
  };
}

function calculateApparentTemp(temp: number, humidity: number): number {
  // Simplified heat index calculation
  if (temp < 80) return temp;

  const HI = -42.379 + 2.04901523 * temp + 10.14333127 * humidity
    - 0.22475541 * temp * humidity - 0.00683783 * temp * temp
    - 0.05481717 * humidity * humidity + 0.00122874 * temp * temp * humidity
    + 0.00085282 * temp * humidity * humidity - 0.00000199 * temp * temp * humidity * humidity;

  return Math.round(HI);
}

function findCoolWeatherPace(allWorkouts: any[], workoutType?: string): number | null {
  const coolWorkouts = allWorkouts.filter(({ workout, weather }) =>
    workout.avgPaceSeconds &&
    workout.workoutType === workoutType &&
    weather?.temperature &&
    weather.temperature < 65
  );

  if (coolWorkouts.length === 0) return null;

  const totalPace = coolWorkouts.reduce((sum, { workout }) => sum + workout.avgPaceSeconds!, 0);
  return totalPace / coolWorkouts.length;
}

function calculateTrend(heatWorkouts: any[]): HeatAdaptationData['trend'] {
  if (heatWorkouts.length < 3) return 'insufficient_data';

  // Compare recent vs older heat performance
  const recent = heatWorkouts.slice(0, Math.ceil(heatWorkouts.length / 2));
  const older = heatWorkouts.slice(Math.ceil(heatWorkouts.length / 2));

  const recentAvgAdjustment = recent
    .filter(({ workout }) => workout.avgPaceSeconds)
    .map(({ workout, weather }) => {
      const apparentTemp = calculateApparentTemp(weather!.temperature!, weather!.humidity || 50);
      // Rough pace adjustment calculation (simplified)
      return workout.avgPaceSeconds! / apparentTemp;
    })
    .reduce((a, b, _, arr) => a + b / arr.length, 0);

  const olderAvgAdjustment = older
    .filter(({ workout }) => workout.avgPaceSeconds)
    .map(({ workout, weather }) => {
      const apparentTemp = calculateApparentTemp(weather!.temperature!, weather!.humidity || 50);
      return workout.avgPaceSeconds! / apparentTemp;
    })
    .reduce((a, b, _, arr) => a + b / arr.length, 0);

  const improvement = ((olderAvgAdjustment - recentAvgAdjustment) / olderAvgAdjustment) * 100;

  if (improvement > 5) return 'improving';
  if (improvement < -5) return 'declining';
  return 'maintaining';
}

function generateRecommendations(
  score: number,
  exposure: any,
  trend: string,
  history: any[]
): string[] {
  const recommendations: string[] = [];

  // Score-based recommendations
  if (score < 30) {
    recommendations.push('Start with 20-30 minute easy runs in mild heat (70-75°F).');
    recommendations.push('Gradually increase duration before increasing temperature exposure.');
  } else if (score < 60) {
    recommendations.push('Continue building heat tolerance with 2-3 heat runs per week.');
    recommendations.push('Try one tempo or threshold workout in warm conditions.');
  } else {
    recommendations.push('Well adapted! Maintain with 1-2 heat sessions per week.');
    recommendations.push('Practice race-day hydration strategies during long runs.');
  }

  // Trend-based recommendations
  if (trend === 'declining') {
    recommendations.push('Heat adaptation declining - increase frequency of warm weather runs.');
  } else if (trend === 'improving') {
    recommendations.push('Great progress! Your body is adapting well to heat stress.');
  }

  // Exposure-based recommendations
  if (exposure.count > 0 && exposure.avgTemp > 85) {
    recommendations.push('Running in high heat - ensure proper hydration before, during, and after.');
    recommendations.push('Consider running early morning or late evening when possible.');
  }

  // Pace adjustment insights
  if (history.length > 0) {
    const avgAdjustment = history.reduce((sum, h) => sum + h.paceAdjustment, 0) / history.length;
    if (avgAdjustment > 10) {
      recommendations.push(`You're running ${Math.round(avgAdjustment)}% slower in heat - this is normal! Adjust expectations.`);
    }
  }

  return recommendations.slice(0, 4);
}