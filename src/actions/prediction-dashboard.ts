'use server';

import { db, workouts, workoutFitnessSignals } from '@/lib/db';
import { eq, desc, gte, and } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import { getComprehensiveRacePredictions, type MultiSignalPrediction } from './race-predictor';
import { getFitnessTrendData } from './fitness';
import { getVdotHistory, type VdotHistoryEntry } from './vdot-history';

export interface WorkoutSignalPoint {
  date: string;
  workoutId: number;
  workoutType: string;
  distanceMiles: number;
  durationMinutes: number;
  effectiveVo2max: number | null;
  efficiencyFactor: number | null;
  hrReservePct: number | null;
  weatherAdjustedPace: number | null;
  elevationAdjustedPace: number | null;
  isSteadyState: boolean;
  avgHr: number | null;
  avgPaceSeconds: number | null;
  stravaName: string | null;
}

export interface PredictionDashboardData {
  prediction: MultiSignalPrediction;
  signalTimeline: WorkoutSignalPoint[];
  vdotHistory: VdotHistoryEntry[];
  trainingVolume: {
    avgWeeklyMiles4Weeks: number;
    longestRecentRunMiles: number;
    totalWorkouts180d: number;
    workoutsWithHr: number;
  };
  fitnessState: {
    ctl: number;
    atl: number;
    tsb: number;
  };
}

/**
 * Get all data needed for the predictions dashboard.
 * Combines multi-signal predictions with per-workout signal timeline for charting.
 */
export async function getPredictionDashboardData(
  profileId?: number
): Promise<PredictionDashboardData | null> {
  try {
    const pid = profileId ?? await getActiveProfileId();
    if (!pid) return null;

    // Parallel: get predictions + signal timeline + fitness + vdot history
    const [prediction, signalRows, fitnessTrend, vdotHistory] = await Promise.all([
      getComprehensiveRacePredictions(pid),
      // Get all fitness signals with joined workout data (last 180 days)
      db.query.workoutFitnessSignals.findMany({
        where: eq(workoutFitnessSignals.profileId, pid),
        with: {
          workout: true,
        },
        orderBy: [desc(workoutFitnessSignals.workoutId)],
      }),
      getFitnessTrendData(90, pid),
      getVdotHistory({ limit: 100, profileId: pid }),
    ]);

    if (!prediction) return null;

    // Build the signal timeline from joined data
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 180);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    type SignalRow = typeof signalRows[number];
    const signalTimeline: WorkoutSignalPoint[] = signalRows
      .filter((s: SignalRow) => s.workout && s.workout.date >= cutoffStr)
      .map((s: SignalRow) => ({
        date: s.workout.date,
        workoutId: s.workoutId,
        workoutType: s.workout.workoutType || 'easy',
        distanceMiles: s.workout.distanceMiles || 0,
        durationMinutes: s.workout.durationMinutes || 0,
        effectiveVo2max: s.effectiveVo2max,
        efficiencyFactor: s.efficiencyFactor,
        hrReservePct: s.hrReservePct,
        weatherAdjustedPace: s.weatherAdjustedPace,
        elevationAdjustedPace: s.elevationAdjustedPace,
        isSteadyState: !!s.isSteadyState,
        avgHr: s.workout.avgHr || s.workout.avgHeartRate || null,
        avgPaceSeconds: s.workout.avgPaceSeconds || null,
        stravaName: s.workout.stravaName || null,
      }))
      .sort((a: WorkoutSignalPoint, b: WorkoutSignalPoint) => a.date.localeCompare(b.date));

    // Compute training volume stats
    const fourWeeksAgo = new Date();
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
    const fourWeekStr = fourWeeksAgo.toISOString().split('T')[0];

    const recentForVolume = signalTimeline.filter(s => s.date >= fourWeekStr);
    const totalMiles = recentForVolume.reduce((s, w) => s + w.distanceMiles, 0);
    const longestRun = Math.max(0, ...recentForVolume.map(w => w.distanceMiles));

    return {
      prediction,
      signalTimeline,
      vdotHistory: vdotHistory.sort((a, b) => a.date.localeCompare(b.date)),
      trainingVolume: {
        avgWeeklyMiles4Weeks: Math.round(totalMiles / 4 * 10) / 10,
        longestRecentRunMiles: Math.round(longestRun * 10) / 10,
        totalWorkouts180d: signalTimeline.length,
        workoutsWithHr: signalTimeline.filter(s => s.avgHr != null).length,
      },
      fitnessState: {
        ctl: fitnessTrend.currentCtl,
        atl: fitnessTrend.currentAtl,
        tsb: fitnessTrend.currentTsb,
      },
    };
  } catch (error) {
    console.error('[getPredictionDashboardData] Error:', error);
    return null;
  }
}
