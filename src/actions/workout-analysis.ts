'use server';

import { db, workouts } from '@/lib/db';
import { desc, gte, eq, and, ne } from 'drizzle-orm';
import type { Workout, UserSettings } from '@/lib/schema';
import { parseLocalDate } from '@/lib/utils';
import { getFitnessTrendData } from './fitness';

export interface EffortFactor {
  icon: string;
  label: string;
  detail: string;
  impact: 'high' | 'medium' | 'low';
  sentiment: 'negative' | 'positive' | 'neutral';
}

export interface WorkoutAnalysis {
  factors: EffortFactor[];
  positiveFactors: EffortFactor[];
  summary: string | null;
  rpe: number | null;
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
  } | null,
  reflection?: {
    rpe?: number | null;
    energyLevel?: string | null;
    painReport?: string | null;
  } | null
): Promise<WorkoutAnalysis> {
  const factors: EffortFactor[] = [];
  const positiveFactors: EffortFactor[] = [];

  // Determine RPE from assessment or reflection
  const rpe = assessment?.rpe ?? reflection?.rpe ?? null;

  // Get recent workouts for context (last 30 days for pace comparison, 10 for load)
  const cutoff = new Date(parseLocalDate(workout.date));
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const profileConditions = workout.profileId
    ? and(gte(workouts.date, cutoffStr), eq(workouts.profileId, workout.profileId), ne(workouts.id, workout.id))
    : and(gte(workouts.date, cutoffStr), ne(workouts.id, workout.id));

  const recentWorkouts = await db
    .select()
    .from(workouts)
    .where(profileConditions)
    .orderBy(desc(workouts.date))
    .limit(50);

  // 1. Weather impact
  if (workout.weatherTempF != null) {
    if (workout.weatherTempF > 80) {
      const severity = workout.weatherTempF > 90 ? 'high' : 'medium';
      factors.push({
        icon: '🌡️',
        label: 'Heat stress',
        detail: `${workout.weatherTempF}°F${workout.weatherHumidityPct ? ` / ${workout.weatherHumidityPct}% humidity` : ''} — heat significantly increases perceived effort`,
        impact: severity,
        sentiment: 'negative',
      });
    } else if (workout.weatherTempF > 70 && workout.weatherHumidityPct && workout.weatherHumidityPct > 70) {
      factors.push({
        icon: '💧',
        label: 'Humid conditions',
        detail: `${workout.weatherTempF}°F with ${workout.weatherHumidityPct}% humidity — impairs cooling and increases HR`,
        impact: 'medium',
        sentiment: 'negative',
      });
    } else if (workout.weatherTempF < 25) {
      factors.push({
        icon: '🥶',
        label: 'Cold conditions',
        detail: `${workout.weatherTempF}°F — cold affects breathing and muscle performance`,
        impact: 'low',
        sentiment: 'negative',
      });
    } else if (workout.weatherTempF >= 45 && workout.weatherTempF <= 60 && (!workout.weatherHumidityPct || workout.weatherHumidityPct < 70)) {
      positiveFactors.push({
        icon: '🌤️',
        label: 'Ideal running weather',
        detail: `${workout.weatherTempF}°F${workout.weatherHumidityPct ? ` / ${workout.weatherHumidityPct}% humidity` : ''} — optimal conditions for performance`,
        impact: 'medium',
        sentiment: 'positive',
      });
    }
  }

  if (workout.weatherWindMph && workout.weatherWindMph > 15) {
    factors.push({
      icon: '💨',
      label: 'Strong wind',
      detail: `${workout.weatherWindMph} mph winds — adds resistance and mental fatigue`,
      impact: workout.weatherWindMph > 25 ? 'high' : 'medium',
      sentiment: 'negative',
    });
  }

  // 2. Sleep
  if (assessment?.sleepQuality != null && assessment.sleepQuality < 5) {
    factors.push({
      icon: '😴',
      label: 'Poor sleep',
      detail: `Sleep quality ${assessment.sleepQuality}/10 — impairs recovery and energy`,
      impact: assessment.sleepQuality <= 3 ? 'high' : 'medium',
      sentiment: 'negative',
    });
  } else if (assessment?.sleepQuality != null && assessment.sleepQuality >= 8) {
    positiveFactors.push({
      icon: '😴',
      label: 'Great sleep',
      detail: `Sleep quality ${assessment.sleepQuality}/10 — well-rested for performance`,
      impact: 'medium',
      sentiment: 'positive',
    });
  }
  if (assessment?.sleepHours != null && assessment.sleepHours < 6) {
    factors.push({
      icon: '⏰',
      label: 'Sleep deficit',
      detail: `Only ${assessment.sleepHours}h sleep — less than 6h impairs performance`,
      impact: 'high',
      sentiment: 'negative',
    });
  } else if (assessment?.sleepHours != null && assessment.sleepHours >= 8) {
    positiveFactors.push({
      icon: '⏰',
      label: 'Well-rested',
      detail: `${assessment.sleepHours}h sleep — optimal recovery`,
      impact: 'low',
      sentiment: 'positive',
    });
  }

  // 3. Life stress
  if (assessment?.stress != null && assessment.stress > 7) {
    factors.push({
      icon: '😤',
      label: 'High stress',
      detail: `Stress level ${assessment.stress}/10 — elevated cortisol increases perceived effort`,
      impact: 'medium',
      sentiment: 'negative',
    });
  }

  // 4. Soreness / fatigue
  if (assessment?.soreness != null && assessment.soreness > 6) {
    factors.push({
      icon: '🦵',
      label: 'Muscle soreness',
      detail: `Soreness ${assessment.soreness}/10 — residual fatigue from recent training`,
      impact: assessment.soreness >= 8 ? 'high' : 'medium',
      sentiment: 'negative',
    });
  }

  // 5. Fueling / hydration
  if (assessment?.fueling != null && assessment.fueling < 5) {
    factors.push({
      icon: '🍽️',
      label: 'Under-fueled',
      detail: `Fueling ${assessment.fueling}/10 — inadequate nutrition affects energy`,
      impact: 'medium',
      sentiment: 'negative',
    });
  }
  if (assessment?.hydration != null && assessment.hydration < 5) {
    factors.push({
      icon: '🚰',
      label: 'Dehydrated',
      detail: `Hydration ${assessment.hydration}/10 — poor hydration impacts performance`,
      impact: 'medium',
      sentiment: 'negative',
    });
  }

  // 5b. Reflection energy/pain signals
  if (reflection?.energyLevel === 'exhausted') {
    factors.push({
      icon: '🪫',
      label: 'Felt exhausted',
      detail: 'Reported exhaustion — body may need extra recovery time',
      impact: 'high',
      sentiment: 'negative',
    });
  } else if (reflection?.energyLevel === 'tired') {
    factors.push({
      icon: '🪫',
      label: 'Felt tired',
      detail: 'Reported low energy — accumulated fatigue taking a toll',
      impact: 'medium',
      sentiment: 'negative',
    });
  } else if (reflection?.energyLevel === 'fresh') {
    positiveFactors.push({
      icon: '⚡',
      label: 'Felt fresh',
      detail: 'Reported fresh energy — body well-recovered',
      impact: 'medium',
      sentiment: 'positive',
    });
  }

  if (reflection?.painReport === 'something_concerning') {
    factors.push({
      icon: '🩹',
      label: 'Pain reported',
      detail: 'Flagged something concerning — worth monitoring closely',
      impact: 'high',
      sentiment: 'negative',
    });
  }

  // 6. Recent training load (accumulated fatigue)
  const workoutDate = parseLocalDate(workout.date);
  const last7DaysWorkouts = recentWorkouts.filter((w: Workout) => {
    const wDate = parseLocalDate(w.date);
    const daysBefore = (workoutDate.getTime() - wDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysBefore >= 0 && daysBefore <= 7;
  });
  const last7DaysMileage = last7DaysWorkouts.reduce((sum: number, w: Workout) => sum + (w.distanceMiles || 0), 0);

  if (last7DaysMileage > 40) {
    factors.push({
      icon: '📈',
      label: 'High recent volume',
      detail: `${Math.round(last7DaysMileage)} miles in the prior 7 days — accumulated fatigue`,
      impact: last7DaysMileage > 50 ? 'high' : 'medium',
      sentiment: 'negative',
    });
  }

  // Check if ran yesterday (back-to-back)
  const yesterday = new Date(workoutDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const yesterdayWorkout = recentWorkouts.find((w: Workout) => w.date === yesterdayStr);
  if (yesterdayWorkout && yesterdayWorkout.distanceMiles && yesterdayWorkout.distanceMiles > 5) {
    const wasHard = yesterdayWorkout.workoutType && ['tempo', 'interval', 'threshold', 'long', 'race'].includes(yesterdayWorkout.workoutType);
    if (wasHard) {
      factors.push({
        icon: '🔥',
        label: 'Hard run yesterday',
        detail: `${Math.round(yesterdayWorkout.distanceMiles)}mi ${yesterdayWorkout.workoutType} the day before — legs still recovering`,
        impact: 'high',
        sentiment: 'negative',
      });
    }
  }

  // Check for rest day before (positive)
  const twoDaysAgo = new Date(workoutDate);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];
  const hadRestYesterday = !yesterdayWorkout;
  const hadRestTwoDaysAgo = !recentWorkouts.find((w: Workout) => w.date === twoDaysAgoStr);
  if (hadRestYesterday && hadRestTwoDaysAgo) {
    positiveFactors.push({
      icon: '🧘',
      label: 'Well-rested (2 days off)',
      detail: 'Two rest days before this run — fresh legs',
      impact: 'medium',
      sentiment: 'positive',
    });
  } else if (hadRestYesterday) {
    positiveFactors.push({
      icon: '🧘',
      label: 'Rest day before',
      detail: 'Day off yesterday — legs had time to recover',
      impact: 'low',
      sentiment: 'positive',
    });
  }

  // 7. Pace faster than expected
  if (workout.avgPaceSeconds && settings?.easyPaceSeconds && workout.workoutType === 'easy') {
    if (workout.avgPaceSeconds < settings.easyPaceSeconds * 0.92) {
      factors.push({
        icon: '🏃',
        label: 'Faster than easy pace',
        detail: `Ran faster than prescribed easy pace — increases perceived effort on recovery days`,
        impact: 'medium',
        sentiment: 'negative',
      });
    }
  }

  // 7b. Pace vs personal average for this workout type
  if (workout.avgPaceSeconds && workout.distanceMiles && workout.distanceMiles >= 2) {
    const sameTypeWorkouts = recentWorkouts.filter(
      (w: Workout) => w.workoutType === workout.workoutType && w.avgPaceSeconds && w.distanceMiles && w.distanceMiles >= 2
    );
    if (sameTypeWorkouts.length >= 3) {
      const avgPace = sameTypeWorkouts.reduce((sum: number, w: Workout) => sum + (w.avgPaceSeconds || 0), 0) / sameTypeWorkouts.length;
      const paceRatio = workout.avgPaceSeconds / avgPace;
      if (paceRatio < 0.95) {
        // Faster than usual
        const secsFaster = Math.round(avgPace - workout.avgPaceSeconds);
        factors.push({
          icon: '🏃',
          label: 'Faster than your average',
          detail: `~${secsFaster}s/mi faster than your recent ${workout.workoutType} average — ambitious effort`,
          impact: secsFaster > 20 ? 'high' : 'medium',
          sentiment: 'negative',
        });
      } else if (paceRatio > 1.05) {
        // Slower than usual — could be positive (disciplined) or negative (struggling)
        const secsSlower = Math.round(workout.avgPaceSeconds - avgPace);
        if (workout.workoutType === 'easy' || workout.workoutType === 'recovery') {
          positiveFactors.push({
            icon: '🎯',
            label: 'Disciplined pacing',
            detail: `~${secsSlower}s/mi slower than recent average — keeping it truly easy`,
            impact: 'low',
            sentiment: 'positive',
          });
        }
      }
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
        sentiment: 'negative',
      });
    }
  }

  // 9. Fitness form (TSB)
  let tsbValue: number | null = null;
  try {
    const fitness = await getFitnessTrendData(14, workout.profileId ?? undefined, workoutDate);
    tsbValue = fitness.currentTsb;
    if (fitness.currentTsb < -15) {
      factors.push({
        icon: '🔋',
        label: 'Fatigued (negative form)',
        detail: `TSB was ${Math.round(fitness.currentTsb)} — deep fatigue from training block`,
        impact: fitness.currentTsb < -25 ? 'high' : 'medium',
        sentiment: 'negative',
      });
    } else if (fitness.currentTsb > 5 && fitness.currentTsb < 25) {
      positiveFactors.push({
        icon: '🔋',
        label: 'Fresh form',
        detail: `TSB was +${Math.round(fitness.currentTsb)} — well-rested and primed`,
        impact: 'medium',
        sentiment: 'positive',
      });
    }
  } catch {
    // Fitness data unavailable
  }

  // 10. Time of day
  if (workout.startTimeLocal) {
    const [hours] = workout.startTimeLocal.split(':').map(Number);
    if (hours < 6) {
      factors.push({
        icon: '🌙',
        label: 'Very early run',
        detail: `Started at ${workout.startTimeLocal} — body temp and muscle flexibility lowest pre-dawn`,
        impact: 'low',
        sentiment: 'negative',
      });
    } else if (hours >= 11 && hours <= 14 && workout.weatherTempF != null && workout.weatherTempF > 70) {
      factors.push({
        icon: '☀️',
        label: 'Midday heat',
        detail: `Ran at ${workout.startTimeLocal} in ${workout.weatherTempF}°F — peak sun exposure amplifies heat stress`,
        impact: 'medium',
        sentiment: 'negative',
      });
    } else if (hours >= 21) {
      factors.push({
        icon: '🌙',
        label: 'Late night run',
        detail: `Started at ${workout.startTimeLocal} — accumulated daily fatigue affects performance`,
        impact: 'low',
        sentiment: 'negative',
      });
    }
  }

  // Build summary
  let summary: string | null = null;
  const allNegative = factors.length;
  const allPositive = positiveFactors.length;

  if (allNegative > 0) {
    const highImpact = factors.filter(f => f.impact === 'high');
    if (highImpact.length > 0) {
      summary = `Key factors: ${highImpact.map(f => f.label.toLowerCase()).join(', ')}`;
    } else {
      summary = `Contributing factors: ${factors.slice(0, 3).map(f => f.label.toLowerCase()).join(', ')}`;
    }
  } else if (allPositive > 0) {
    summary = `In your favor: ${positiveFactors.slice(0, 3).map(f => f.label.toLowerCase()).join(', ')}`;
  }

  return { factors, positiveFactors, summary, rpe };
}
