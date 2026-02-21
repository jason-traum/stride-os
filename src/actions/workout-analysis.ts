'use server';

import { db, workouts } from '@/lib/db';
import { desc, gte, eq, and, ne } from 'drizzle-orm';
import type { Workout, UserSettings } from '@/lib/schema';
import { parseLocalDate } from '@/lib/utils';
import { getFitnessTrendData } from './fitness';

interface EffortFactor {
  icon: string;
  label: string;
  detail: string;
  impact: 'high' | 'medium' | 'low';
}

export interface WorkoutAnalysis {
  factors: EffortFactor[];
  summary: string | null;
}

/**
 * Analyze why a workout may have felt harder (or easier) than expected.
 * Cross-references weather, sleep, training load, pace, time of day, and recent history.
 */
export async function analyzeWorkoutEffort(
  workout: Workout,
  settings: UserSettings | null,
  assessment?: {
    rpe?: number | null;
    sleepQuality?: number | null;
    sleepHours?: number | null;
    stress?: number | null;
    soreness?: number | null;
    fueling?: number | null;
    hydration?: number | null;
    verdict?: string | null;
  } | null
): Promise<WorkoutAnalysis> {
  const factors: EffortFactor[] = [];

  // Get recent workouts for context (last 10 days)
  const cutoff = new Date(parseLocalDate(workout.date));
  cutoff.setDate(cutoff.getDate() - 10);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const profileConditions = workout.profileId
    ? and(gte(workouts.date, cutoffStr), eq(workouts.profileId, workout.profileId), ne(workouts.id, workout.id))
    : and(gte(workouts.date, cutoffStr), ne(workouts.id, workout.id));

  const recentWorkouts = await db
    .select()
    .from(workouts)
    .where(profileConditions)
    .orderBy(desc(workouts.date))
    .limit(20);

  // 1. Weather impact
  if (workout.weatherTempF != null) {
    if (workout.weatherTempF > 80) {
      const severity = workout.weatherTempF > 90 ? 'high' : 'medium';
      factors.push({
        icon: '🌡️',
        label: 'Heat stress',
        detail: `${workout.weatherTempF}°F${workout.weatherHumidityPct ? ` / ${workout.weatherHumidityPct}% humidity` : ''} — heat significantly increases perceived effort`,
        impact: severity,
      });
    } else if (workout.weatherTempF > 70 && workout.weatherHumidityPct && workout.weatherHumidityPct > 70) {
      factors.push({
        icon: '💧',
        label: 'Humid conditions',
        detail: `${workout.weatherTempF}°F with ${workout.weatherHumidityPct}% humidity — impairs cooling and increases HR`,
        impact: 'medium',
      });
    } else if (workout.weatherTempF < 25) {
      factors.push({
        icon: '🥶',
        label: 'Cold conditions',
        detail: `${workout.weatherTempF}°F — cold affects breathing and muscle performance`,
        impact: 'low',
      });
    }
  }

  if (workout.weatherWindMph && workout.weatherWindMph > 15) {
    factors.push({
      icon: '💨',
      label: 'Strong wind',
      detail: `${workout.weatherWindMph} mph winds — adds resistance and mental fatigue`,
      impact: workout.weatherWindMph > 25 ? 'high' : 'medium',
    });
  }

  // 2. Sleep
  if (assessment?.sleepQuality != null && assessment.sleepQuality < 5) {
    factors.push({
      icon: '😴',
      label: 'Poor sleep',
      detail: `Sleep quality ${assessment.sleepQuality}/10 — impairs recovery and energy`,
      impact: assessment.sleepQuality <= 3 ? 'high' : 'medium',
    });
  }
  if (assessment?.sleepHours != null && assessment.sleepHours < 6) {
    factors.push({
      icon: '⏰',
      label: 'Sleep deficit',
      detail: `Only ${assessment.sleepHours}h sleep — less than 6h impairs performance`,
      impact: 'high',
    });
  }

  // 3. Life stress
  if (assessment?.stress != null && assessment.stress > 7) {
    factors.push({
      icon: '😤',
      label: 'High stress',
      detail: `Stress level ${assessment.stress}/10 — elevated cortisol increases perceived effort`,
      impact: 'medium',
    });
  }

  // 4. Soreness / fatigue
  if (assessment?.soreness != null && assessment.soreness > 6) {
    factors.push({
      icon: '🦵',
      label: 'Muscle soreness',
      detail: `Soreness ${assessment.soreness}/10 — residual fatigue from recent training`,
      impact: assessment.soreness >= 8 ? 'high' : 'medium',
    });
  }

  // 5. Fueling / hydration
  if (assessment?.fueling != null && assessment.fueling < 5) {
    factors.push({
      icon: '🍽️',
      label: 'Under-fueled',
      detail: `Fueling ${assessment.fueling}/10 — inadequate nutrition affects energy`,
      impact: 'medium',
    });
  }
  if (assessment?.hydration != null && assessment.hydration < 5) {
    factors.push({
      icon: '🚰',
      label: 'Dehydrated',
      detail: `Hydration ${assessment.hydration}/10 — poor hydration impacts performance`,
      impact: 'medium',
    });
  }

  // 6. Recent training load (accumulated fatigue)
  const last7DaysMileage = recentWorkouts
    .filter((w: Workout) => {
      const wDate = parseLocalDate(w.date);
      const daysBefore = (parseLocalDate(workout.date).getTime() - wDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysBefore >= 0 && daysBefore <= 7;
    })
    .reduce((sum: number, w: Workout) => sum + (w.distanceMiles || 0), 0);

  if (last7DaysMileage > 40) {
    factors.push({
      icon: '📈',
      label: 'High recent volume',
      detail: `${Math.round(last7DaysMileage)} miles in the prior 7 days — accumulated fatigue`,
      impact: last7DaysMileage > 50 ? 'high' : 'medium',
    });
  }

  // Check if ran yesterday (back-to-back)
  const yesterday = new Date(parseLocalDate(workout.date));
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const yesterdayWorkout = recentWorkouts.find((w: Workout) => w.date === yesterdayStr);
  if (yesterdayWorkout && yesterdayWorkout.distanceMiles && yesterdayWorkout.distanceMiles > 5) {
    const wasHard = yesterdayWorkout.workoutType && ['tempo', 'interval', 'threshold', 'long', 'race'].includes(yesterdayWorkout.workoutType);
    if (wasHard) {
      factors.push({
        icon: '⚡',
        label: 'Hard run yesterday',
        detail: `${Math.round(yesterdayWorkout.distanceMiles)}mi ${yesterdayWorkout.workoutType} the day before — legs still recovering`,
        impact: 'high',
      });
    }
  }

  // 7. Pace faster than expected
  if (workout.avgPaceSeconds && settings?.easyPaceSeconds && workout.workoutType === 'easy') {
    if (workout.avgPaceSeconds < settings.easyPaceSeconds * 0.92) {
      factors.push({
        icon: '🏃',
        label: 'Faster than easy pace',
        detail: `Ran faster than prescribed easy pace — increases perceived effort on recovery days`,
        impact: 'medium',
      });
    }
  }

  // 8. Elevation
  const elevation = workout.elevationGainFeet || workout.elevationGainFt;
  if (elevation && workout.distanceMiles && workout.distanceMiles > 0) {
    const ftPerMile = elevation / workout.distanceMiles;
    if (ftPerMile > 100) {
      factors.push({
        icon: '⛰️',
        label: 'Hilly course',
        detail: `${Math.round(elevation)}ft gain (${Math.round(ftPerMile)}ft/mi) — hills add ~${Math.round(ftPerMile * 0.033)}s/mi equivalent effort`,
        impact: ftPerMile > 200 ? 'high' : 'medium',
      });
    }
  }

  // 9. Fitness form (TSB)
  try {
    const fitness = await getFitnessTrendData(14, workout.profileId ?? undefined, parseLocalDate(workout.date));
    if (fitness.currentTsb < -15) {
      factors.push({
        icon: '🔋',
        label: 'Fatigued (negative form)',
        detail: `TSB was ${Math.round(fitness.currentTsb)} — deep fatigue from training block`,
        impact: fitness.currentTsb < -25 ? 'high' : 'medium',
      });
    }
  } catch {
    // Fitness data unavailable
  }

  // Build summary
  let summary: string | null = null;
  if (factors.length > 0) {
    const highImpact = factors.filter(f => f.impact === 'high');
    if (highImpact.length > 0) {
      summary = `Key factors: ${highImpact.map(f => f.label.toLowerCase()).join(', ')}`;
    } else {
      summary = `Contributing factors: ${factors.slice(0, 3).map(f => f.label.toLowerCase()).join(', ')}`;
    }
  }

  return { factors, summary };
}
