'use server';

import { db, workouts, workoutFitnessSignals } from '@/lib/db';
import { eq, desc, gte, and } from 'drizzle-orm';
import { createProfileAction } from '@/lib/action-utils';
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
  isExcluded: boolean;
  autoExcluded: boolean;
  excludeReason: string | null;
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

export interface PredictionDashboardResult {
  data: PredictionDashboardData | null;
  error?: string;
}

/**
 * Get all data needed for the predictions dashboard.
 * Combines multi-signal predictions with per-workout signal timeline for charting.
 */
async function _getPredictionDashboardData(
  pid: number,
): Promise<PredictionDashboardResult> {
  try {

    // Run each query with individual error handling so one failure doesn't kill all
    let prediction: MultiSignalPrediction | null = null;
    let signalRows: Awaited<ReturnType<typeof db.query.workoutFitnessSignals.findMany>> = [];
    let fitnessTrend = { currentCtl: 0, currentAtl: 0, currentTsb: 0 };
    let vdotHistoryData: VdotHistoryEntry[] = [];

    const errors: string[] = [];

    const results = await Promise.allSettled([
      getComprehensiveRacePredictions(pid),
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

    if (results[0].status === 'fulfilled') {
      prediction = results[0].value;
    } else {
      errors.push(`Predictions: ${results[0].reason?.message || results[0].reason}`);
    }

    if (results[1].status === 'fulfilled') {
      signalRows = results[1].value;
    } else {
      errors.push(`Fitness signals: ${results[1].reason?.message || results[1].reason}`);
    }

    if (results[2].status === 'fulfilled') {
      fitnessTrend = results[2].value;
    } else {
      errors.push(`Fitness trend: ${results[2].reason?.message || results[2].reason}`);
    }

    if (results[3].status === 'fulfilled') {
      vdotHistoryData = results[3].value;
    } else {
      errors.push(`VDOT history: ${results[3].reason?.message || results[3].reason}`);
    }

    if (errors.length > 0) {
      console.error('[getPredictionDashboardData] Partial failures:', errors);
    }

    if (!prediction) {
      return { data: null, error: errors.length > 0 ? errors.join('; ') : 'No prediction data available' };
    }

    // Build the signal timeline from joined data (2 years for historical views)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 730);
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
        isExcluded: !!s.workout.excludeFromEstimates,
        autoExcluded: !!s.workout.autoExcluded,
        excludeReason: s.workout.excludeReason || null,
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
      data: {
        prediction,
        signalTimeline,
        vdotHistory: vdotHistoryData.sort((a, b) => a.date.localeCompare(b.date)),
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
      },
      error: errors.length > 0 ? errors.join('; ') : undefined,
    };
  } catch (error) {
    console.error('[getPredictionDashboardData] Error:', error instanceof Error ? error.message : error);
    console.error('[getPredictionDashboardData] Stack:', error instanceof Error ? error.stack : 'no stack');
    return { data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export const getPredictionDashboardData = createProfileAction(_getPredictionDashboardData, 'getPredictionDashboardData');
