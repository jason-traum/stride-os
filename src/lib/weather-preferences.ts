'use server';

import { db } from '@/lib/db';
import { workouts } from '@/lib/schema';
import { eq, and, isNotNull } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';

export interface WeatherPreferenceAnalysis {
  optimalConditions: {
    temperature: { min: number; max: number; ideal: number };
    humidity: { min: number; max: number; ideal: number };
    apparentTemp: { min: number; max: number; ideal: number };
  };
  performanceByConditions: {
    condition: string;
    avgPaceAdjustment: number; // % faster/slower than baseline
    avgHRIncrease: number; // bpm increase from baseline
    sampleSize: number;
    performance: 'excellent' | 'good' | 'average' | 'poor';
  }[];
  insights: {
    type: 'preference' | 'warning' | 'tip';
    message: string;
    confidence: 'high' | 'medium' | 'low';
  }[];
  weatherImpact: {
    temperature: {
      range: string;
      impact: number; // seconds per mile impact
      workouts: number;
    }[];
    humidity: {
      range: string;
      impact: number;
      workouts: number;
    }[];
  };
  bestWorkouts: {
    date: string;
    temp: number;
    humidity: number;
    paceVsBaseline: number; // % difference
    workoutType: string;
  }[];
  worstWorkouts: {
    date: string;
    temp: number;
    humidity: number;
    paceVsBaseline: number;
    workoutType: string;
  }[];
}

export async function analyzeWeatherPreferences(): Promise<WeatherPreferenceAnalysis> {
  try {
    const profileId = await getActiveProfileId();
    if (!profileId) {
      return getEmptyAnalysis();
    }

    // Get all workouts with weather data
    const weatherWorkouts = await db
      .select()
      .from(workouts)
      .where(
        and(
          eq(workouts.profileId, profileId),
          isNotNull(workouts.weatherTempF),
          isNotNull(workouts.avgPaceSeconds)
        )
      );

    if (weatherWorkouts.length < 5) {
      return {
        ...getEmptyAnalysis(),
        insights: [{
          type: 'tip',
          message: `Need ${5 - weatherWorkouts.length} more workouts with weather data for personalized analysis.`,
          confidence: 'high'
        }]
      };
    }

    // Calculate baseline pace for each workout type
    const baselinesByType = calculateBaselines(weatherWorkouts);

    // Analyze performance by temperature ranges
    const tempAnalysis = analyzeTemperatureImpact(weatherWorkouts, baselinesByType);
    const humidityAnalysis = analyzeHumidityImpact(weatherWorkouts, baselinesByType);

    // Find optimal conditions
    const optimal = findOptimalConditions(weatherWorkouts, baselinesByType);

    // Categorize performance by conditions
    const performanceCategories = categorizePerformance(weatherWorkouts, baselinesByType);

    // Find best and worst weather workouts
    const { best, worst } = findExtremeWorkouts(weatherWorkouts, baselinesByType);

    // Generate insights
    const insights = generateInsights(
      weatherWorkouts,
      optimal,
      tempAnalysis,
      humidityAnalysis
    );

    return {
      optimalConditions: optimal,
      performanceByConditions: performanceCategories,
      insights,
      weatherImpact: {
        temperature: tempAnalysis,
        humidity: humidityAnalysis
      },
      bestWorkouts: best,
      worstWorkouts: worst
    };
  } catch (error) {
    console.error('Error analyzing weather preferences:', error);
    return getEmptyAnalysis();
  }
}

function getEmptyAnalysis(): WeatherPreferenceAnalysis {
  return {
    optimalConditions: {
      temperature: { min: 45, max: 65, ideal: 55 },
      humidity: { min: 30, max: 60, ideal: 45 },
      apparentTemp: { min: 45, max: 65, ideal: 55 }
    },
    performanceByConditions: [],
    insights: [{
      type: 'tip',
      message: 'Log more runs with weather data to discover your optimal conditions.',
      confidence: 'high'
    }],
    weatherImpact: {
      temperature: [],
      humidity: []
    },
    bestWorkouts: [],
    worstWorkouts: []
  };
}

function calculateBaselines(workouts: any[]) {
  const baselines: Record<string, number> = {};

  // Group by workout type
  const byType = workouts.reduce((acc, w) => {
    const type = w.workoutType || 'run';
    if (!acc[type]) acc[type] = [];
    acc[type].push(w);
    return acc;
  }, {} as Record<string, any[]>);

  // Calculate median pace for each type in "good" conditions (50-70°F)
  Object.entries(byType).forEach(([type, typeWorkouts]) => {
    const goodConditions = typeWorkouts.filter(w =>
      w.weatherTempF >= 50 && w.weatherTempF <= 70 &&
      w.avgPaceSeconds > 0
    );

    if (goodConditions.length > 0) {
      const paces = goodConditions
        .map(w => w.avgPaceSeconds)
        .sort((a, b) => a - b);
      baselines[type] = paces[Math.floor(paces.length / 2)];
    }
  });

  return baselines;
}

function analyzeTemperatureImpact(workouts: any[], baselines: Record<string, number>) {
  const ranges = [
    { range: '<32°F', min: -100, max: 32 },
    { range: '32-45°F', min: 32, max: 45 },
    { range: '45-55°F', min: 45, max: 55 },
    { range: '55-65°F', min: 55, max: 65 },
    { range: '65-75°F', min: 65, max: 75 },
    { range: '75-85°F', min: 75, max: 85 },
    { range: '>85°F', min: 85, max: 200 }
  ];

  return ranges.map(({ range, min, max }) => {
    const rangeWorkouts = workouts.filter(w =>
      w.weatherTempF >= min && w.weatherTempF < max &&
      baselines[w.workoutType || 'run']
    );

    if (rangeWorkouts.length === 0) {
      return { range, impact: 0, workouts: 0 };
    }

    const impacts = rangeWorkouts.map(w => {
      const baseline = baselines[w.workoutType || 'run'];
      return w.avgPaceSeconds - baseline;
    });

    const avgImpact = impacts.reduce((sum, i) => sum + i, 0) / impacts.length;

    return {
      range,
      impact: Math.round(avgImpact),
      workouts: rangeWorkouts.length
    };
  }).filter(r => r.workouts > 0);
}

function analyzeHumidityImpact(workouts: any[], baselines: Record<string, number>) {
  const ranges = [
    { range: '<30%', min: 0, max: 30 },
    { range: '30-50%', min: 30, max: 50 },
    { range: '50-70%', min: 50, max: 70 },
    { range: '70-85%', min: 70, max: 85 },
    { range: '>85%', min: 85, max: 100 }
  ];

  return ranges.map(({ range, min, max }) => {
    const rangeWorkouts = workouts.filter(w =>
      w.weatherHumidityPct !== null &&
      w.weatherHumidityPct >= min &&
      w.weatherHumidityPct < max &&
      baselines[w.workoutType || 'run']
    );

    if (rangeWorkouts.length === 0) {
      return { range, impact: 0, workouts: 0 };
    }

    const impacts = rangeWorkouts.map(w => {
      const baseline = baselines[w.workoutType || 'run'];
      return w.avgPaceSeconds - baseline;
    });

    const avgImpact = impacts.reduce((sum, i) => sum + i, 0) / impacts.length;

    return {
      range,
      impact: Math.round(avgImpact),
      workouts: rangeWorkouts.length
    };
  }).filter(r => r.workouts > 0);
}

function findOptimalConditions(workouts: any[], baselines: Record<string, number>) {
  // Find workouts where pace was better than baseline
  const goodWorkouts = workouts.filter(w => {
    const baseline = baselines[w.workoutType || 'run'];
    return baseline && w.avgPaceSeconds < baseline * 1.05; // Within 5% of baseline or better
  });

  if (goodWorkouts.length === 0) {
    return {
      temperature: { min: 45, max: 65, ideal: 55 },
      humidity: { min: 30, max: 60, ideal: 45 },
      apparentTemp: { min: 45, max: 65, ideal: 55 }
    };
  }

  // Calculate ranges and averages
  const temps = goodWorkouts.map(w => w.weatherTempF).sort((a, b) => a - b);
  const humidities = goodWorkouts
    .filter(w => w.weatherHumidityPct !== null)
    .map(w => w.weatherHumidityPct)
    .sort((a, b) => a - b);

  const calculateApparent = (temp: number, humidity: number) => {
    if (temp < 80) return temp;
    // Simplified heat index
    return temp + (humidity - 50) * 0.5;
  };

  const apparentTemps = goodWorkouts
    .filter(w => w.weatherHumidityPct !== null)
    .map(w => calculateApparent(w.weatherTempF, w.weatherHumidityPct))
    .sort((a, b) => a - b);

  return {
    temperature: {
      min: Math.round(temps[Math.floor(temps.length * 0.1)]),
      max: Math.round(temps[Math.floor(temps.length * 0.9)]),
      ideal: Math.round(temps[Math.floor(temps.length / 2)])
    },
    humidity: humidities.length > 0 ? {
      min: Math.round(humidities[Math.floor(humidities.length * 0.1)]),
      max: Math.round(humidities[Math.floor(humidities.length * 0.9)]),
      ideal: Math.round(humidities[Math.floor(humidities.length / 2)])
    } : { min: 30, max: 60, ideal: 45 },
    apparentTemp: apparentTemps.length > 0 ? {
      min: Math.round(apparentTemps[Math.floor(apparentTemps.length * 0.1)]),
      max: Math.round(apparentTemps[Math.floor(apparentTemps.length * 0.9)]),
      ideal: Math.round(apparentTemps[Math.floor(apparentTemps.length / 2)])
    } : { min: 45, max: 65, ideal: 55 }
  };
}

function categorizePerformance(workouts: any[], baselines: Record<string, number>) {
  const categories = [
    { condition: 'Cold (<45°F)', filter: (w: any) => w.weatherTempF < 45 },
    { condition: 'Cool (45-60°F)', filter: (w: any) => w.weatherTempF >= 45 && w.weatherTempF < 60 },
    { condition: 'Perfect (60-70°F)', filter: (w: any) => w.weatherTempF >= 60 && w.weatherTempF < 70 },
    { condition: 'Warm (70-80°F)', filter: (w: any) => w.weatherTempF >= 70 && w.weatherTempF < 80 },
    { condition: 'Hot (>80°F)', filter: (w: any) => w.weatherTempF >= 80 },
    { condition: 'Dry (<40% humidity)', filter: (w: any) => w.weatherHumidityPct !== null && w.weatherHumidityPct < 40 },
    { condition: 'Humid (>70%)', filter: (w: any) => w.weatherHumidityPct !== null && w.weatherHumidityPct > 70 }
  ];

  return categories.map(({ condition, filter }) => {
    const categoryWorkouts = workouts.filter(w =>
      filter(w) && baselines[w.workoutType || 'run']
    );

    if (categoryWorkouts.length === 0) {
      return null;
    }

    const adjustments = categoryWorkouts.map(w => {
      const baseline = baselines[w.workoutType || 'run'];
      return ((w.avgPaceSeconds - baseline) / baseline) * 100;
    });

    const avgAdjustment = adjustments.reduce((sum, a) => sum + a, 0) / adjustments.length;

    const hrIncreases = categoryWorkouts
      .filter(w => w.avgHr)
      .map(w => {
        // Rough estimate - assumes baseline HR around 150
        const expectedHR = 150;
        return w.avgHr - expectedHR;
      });

    const avgHRIncrease = hrIncreases.length > 0
      ? hrIncreases.reduce((sum, h) => sum + h, 0) / hrIncreases.length
      : 0;

    // Categorize performance
    let performance: 'excellent' | 'good' | 'average' | 'poor';
    if (avgAdjustment < -2) performance = 'excellent';
    else if (avgAdjustment < 2) performance = 'good';
    else if (avgAdjustment < 5) performance = 'average';
    else performance = 'poor';

    return {
      condition,
      avgPaceAdjustment: Math.round(avgAdjustment * 10) / 10,
      avgHRIncrease: Math.round(avgHRIncrease),
      sampleSize: categoryWorkouts.length,
      performance
    };
  }).filter(Boolean) as any[];
}

function findExtremeWorkouts(workouts: any[], baselines: Record<string, number>) {
  const workoutsWithAdjustment = workouts
    .filter(w => baselines[w.workoutType || 'run'])
    .map(w => {
      const baseline = baselines[w.workoutType || 'run'];
      const adjustment = ((w.avgPaceSeconds - baseline) / baseline) * 100;
      return { ...w, paceVsBaseline: adjustment };
    })
    .sort((a, b) => a.paceVsBaseline - b.paceVsBaseline);

  const best = workoutsWithAdjustment.slice(0, 3).map(w => ({
    date: w.date,
    temp: w.weatherTempF,
    humidity: w.weatherHumidityPct || 50,
    paceVsBaseline: Math.round(w.paceVsBaseline * 10) / 10,
    workoutType: w.workoutType || 'run'
  }));

  const worst = workoutsWithAdjustment.slice(-3).reverse().map(w => ({
    date: w.date,
    temp: w.weatherTempF,
    humidity: w.weatherHumidityPct || 50,
    paceVsBaseline: Math.round(w.paceVsBaseline * 10) / 10,
    workoutType: w.workoutType || 'run'
  }));

  return { best, worst };
}

function generateInsights(
  workouts: any[],
  optimal: any,
  tempAnalysis: any[],
  humidityAnalysis: any[]
): any[] {
  const insights: any[] = [];

  // Temperature preference
  if (optimal.temperature.ideal < 50) {
    insights.push({
      type: 'preference',
      message: `You perform best in cool conditions around ${optimal.temperature.ideal}°F. You\'re a cold weather runner!`,
      confidence: 'high'
    });
  } else if (optimal.temperature.ideal > 70) {
    insights.push({
      type: 'preference',
      message: `You handle heat well! Your best performances are around ${optimal.temperature.ideal}°F.`,
      confidence: 'high'
    });
  }

  // Temperature impact
  const hotImpact = tempAnalysis.find(t => t.range === '>85°F');
  if (hotImpact && hotImpact.impact > 30) {
    insights.push({
      type: 'warning',
      message: `Hot weather (>85°F) slows your pace by ${hotImpact.impact} seconds/mile. Consider early morning runs in summer.`,
      confidence: 'high'
    });
  }

  const coldImpact = tempAnalysis.find(t => t.range === '<32°F');
  if (coldImpact && coldImpact.impact > 20) {
    insights.push({
      type: 'warning',
      message: `Freezing conditions impact your pace by ${coldImpact.impact} seconds/mile. Warm up thoroughly!`,
      confidence: 'high'
    });
  }

  // Humidity insights
  const highHumidity = humidityAnalysis.find(h => h.range === '>85%');
  if (highHumidity && highHumidity.workouts > 3) {
    insights.push({
      type: 'tip',
      message: `High humidity (>85%) affects your performance. Adjust pace expectations by ${Math.round(highHumidity.impact / 60)}%.`,
      confidence: 'medium'
    });
  }

  // Consistency insight
  const recentWorkouts = workouts.slice(-20);
  const weatherVariety = new Set(
    recentWorkouts.map(w => Math.floor(w.weatherTempF / 10))
  ).size;

  if (weatherVariety < 3) {
    insights.push({
      type: 'tip',
      message: 'Training in varied weather conditions can improve your adaptability for race day.',
      confidence: 'medium'
    });
  }

  return insights;
}