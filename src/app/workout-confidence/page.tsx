// Force dynamic rendering for real-time data
export const dynamic = 'force-dynamic';

import { getTodayReadinessWithFactors } from '@/actions/readiness';
import { getTodaysWorkout } from '@/actions/training-plan';
import { getWeatherConditions } from '@/actions/weather';
import { getRecentWorkouts } from '@/actions/workouts';
import { getFitnessTrendData } from '@/actions/fitness';
import { calculateWorkoutConfidence, calculateSimilarWorkoutSuccess } from '@/lib/workout-confidence';
import { Gauge, CheckCircle2, AlertTriangle, Info, TrendingUp, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default async function WorkoutConfidencePage() {
  // Get all the data we need
  const [readinessData, plannedWorkout, weather, recentWorkouts, fitnessData] = await Promise.all([
    getTodayReadinessWithFactors(),
    getTodaysWorkout(),
    getWeatherConditions(),
    getRecentWorkouts(30), // Last 30 days
    getFitnessTrendData(7), // Last week for TSB
  ]);

  // Handle missing data gracefully
  if (!plannedWorkout) {
    return (
      <div className="min-h-screen bg-bgTertiary p-4">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-primary mb-8">Workout Confidence</h1>
          <div className="bg-surface-1 rounded-xl border border-default p-8 text-center">
            <Info className="w-12 h-12 text-tertiary mx-auto mb-3" />
            <p className="text-textTertiary mb-2">No workout planned for today</p>
            <Link
              href="/plan"
              className="text-dream-600 hover:text-dream-700 font-medium"
            >
              View your training plan →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate similar workout success rate
  const similarSuccess = calculateSimilarWorkoutSuccess(
    plannedWorkout.workoutType,
    recentWorkouts.map(w => ({
      workoutType: w.workoutType,
      completed: true, // If it exists, it was completed
      verdict: w.assessment?.verdict,
    }))
  );

  // Find days since last hard workout
  const hardWorkouts = recentWorkouts.filter(w =>
    ['tempo', 'threshold', 'interval', 'race'].includes(w.workoutType)
  );
  const lastHardWorkout = hardWorkouts[0];
  const daysSinceLastHard = lastHardWorkout
    ? Math.floor((new Date().getTime() - new Date(lastHardWorkout.date).getTime()) / (1000 * 60 * 60 * 24))
    : 7;

  // Count consecutive training days
  let consecutiveDays = 0;
  const today = new Date();
  for (let i = 1; i <= 7; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toISOString().split('T')[0];
    if (recentWorkouts.some(w => w.date === dateStr)) {
      consecutiveDays++;
    } else {
      break;
    }
  }

  // Calculate weekly mileage percent
  const last7Days = recentWorkouts.filter(w => {
    const daysAgo = (new Date().getTime() - new Date(w.date).getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo <= 7;
  });
  const thisWeekMiles = last7Days.reduce((sum, w) => sum + (w.distanceMiles || 0), 0);
  const avgWeeklyMiles = recentWorkouts.reduce((sum, w) => sum + (w.distanceMiles || 0), 0) / 4;
  const weeklyMileagePercent = avgWeeklyMiles > 0 ? thisWeekMiles / avgWeeklyMiles : 1;

  // Calculate confidence
  const confidence = calculateWorkoutConfidence(
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: plannedWorkout.workoutType as any,
      plannedDistanceMiles: plannedWorkout.targetDistanceMiles || undefined,
      plannedDurationMinutes: plannedWorkout.targetDurationMinutes || undefined,
      isKeyWorkout: plannedWorkout.isKeyWorkout || false,
    },
    {
      readinessScore: readinessData.result.score,
      tsb: fitnessData?.currentTsb,
      sleepQuality: readinessData.factors.sleepQuality,
      soreness: readinessData.factors.soreness,
      similarWorkoutSuccess: similarSuccess,
      daysSinceLastHard,
      consecutiveTrainingDays: consecutiveDays,
      weeklyMileagePercent,
      weatherSeverity: weather?.severity,
      timeOfDayMatch: true, // Would need to check user's typical run time
    }
  );

  // Get color scheme based on confidence
  const getConfidenceColor = (category: string) => {
    switch (category) {
      case 'high': return 'text-green-600';
      case 'good': return 'text-emerald-600';
      case 'moderate': return 'text-amber-600';
      case 'low': return 'text-red-600';
      default: return 'text-textSecondary';
    }
  };

  const getConfidenceBg = (category: string) => {
    switch (category) {
      case 'high': return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
      case 'good': return 'bg-emerald-50 border-emerald-200';
      case 'moderate': return 'bg-amber-50 border-amber-200';
      case 'low': return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
      default: return 'bg-bgTertiary border-default';
    }
  };

  return (
    <div className="min-h-screen bg-bgTertiary">
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Workout Confidence</h1>
          <p className="text-textSecondary">
            How likely are you to successfully complete today&apos;s workout?
          </p>
        </div>

        {/* Today's Workout */}
        <div className="bg-surface-1 rounded-xl border border-default p-5 mb-6">
          <h2 className="font-semibold text-primary mb-3">Today&apos;s Plan</h2>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold text-primary">{plannedWorkout.name}</h3>
              <p className="text-textSecondary mt-1">{plannedWorkout.description}</p>
              {plannedWorkout.targetDistanceMiles && (
                <p className="text-sm text-textTertiary mt-2">
                  {plannedWorkout.targetDistanceMiles} miles
                  {plannedWorkout.targetPaceSecondsPerMile && (
                    <> @ {Math.floor(plannedWorkout.targetPaceSecondsPerMile / 60)}:{(plannedWorkout.targetPaceSecondsPerMile % 60).toString().padStart(2, '0')}/mi</>
                  )}
                </p>
              )}
            </div>
            <Link
              href="/plan"
              className="text-sm text-dream-600 hover:text-dream-700"
            >
              View Plan →
            </Link>
          </div>
        </div>

        {/* Confidence Score */}
        <div className={cn('rounded-xl border p-6 mb-6', getConfidenceBg(confidence.category))}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                <Gauge className={cn('w-5 h-5', getConfidenceColor(confidence.category))} />
                Confidence Score
              </h2>
              <p className="text-sm text-textSecondary mt-1">Based on your current state and recent history</p>
            </div>
            <div className="text-right">
              <div className={cn('text-5xl font-bold', getConfidenceColor(confidence.category))}>
                {confidence.score}%
              </div>
              <p className={cn('text-sm font-medium', getConfidenceColor(confidence.category))}>
                {confidence.category}
              </p>
            </div>
          </div>

          <p className="text-secondary font-medium">{confidence.recommendation}</p>
        </div>

        {/* Factors Breakdown */}
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          {/* Positive Factors */}
          {confidence.factors.positive.length > 0 && (
            <div className="bg-surface-1 rounded-xl border border-default p-5">
              <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Working For You
              </h3>
              <ul className="space-y-2">
                {confidence.factors.positive.map((factor, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-secondary">{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Negative Factors */}
          {confidence.factors.negative.length > 0 && (
            <div className="bg-surface-1 rounded-xl border border-default p-5">
              <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Challenges Today
              </h3>
              <ul className="space-y-2">
                {confidence.factors.negative.map((factor, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <TrendingDown className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <span className="text-secondary">{factor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Suggestions & Adjustments */}
        {(confidence.factors.suggestions.length > 0 || confidence.adjustments) && (
          <div className="bg-surface-1 rounded-xl border border-default p-5">
            <h3 className="font-semibold text-primary mb-3">Recommendations</h3>

            {confidence.factors.suggestions.length > 0 && (
              <ul className="space-y-2 mb-4">
                {confidence.factors.suggestions.map((suggestion, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span className="text-secondary">{suggestion}</span>
                  </li>
                ))}
              </ul>
            )}

            {confidence.adjustments && (
              <div className="bg-surface-1 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium text-textTertiary uppercase tracking-wide mb-2">
                  Consider These Adjustments
                </p>
                {confidence.adjustments.pace && (
                  <p className="text-sm text-secondary">
                    <span className="font-medium">Pace:</span> {confidence.adjustments.pace}
                  </p>
                )}
                {confidence.adjustments.distance && (
                  <p className="text-sm text-secondary">
                    <span className="font-medium">Distance:</span> {confidence.adjustments.distance}
                  </p>
                )}
                {confidence.adjustments.intensity && (
                  <p className="text-sm text-secondary">
                    <span className="font-medium">Intensity:</span> {confidence.adjustments.intensity}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Context Card */}
        <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5">
          <h3 className="font-semibold text-primary mb-2">How This Works</h3>
          <p className="text-sm text-secondary mb-3">
            Your confidence score combines multiple factors including readiness, training load (TSB),
            recent workout success, recovery time, and environmental conditions.
          </p>
          <p className="text-sm text-secondary">
            A score above 65% suggests good conditions for your planned workout.
            Below 50% indicates you should consider modifications.
          </p>
        </div>
      </div>
    </div>
  );
}