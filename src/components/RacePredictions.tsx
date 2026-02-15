'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, ChevronDown, ChevronUp, Info, Target, TrendingUp, Calendar, Sparkles } from 'lucide-react';
import { RACE_DISTANCES, formatTime, formatPace } from '@/lib/training';

interface VDOTHistoryPoint {
  date: string;
  vdot: number;
  source: 'race' | 'estimated' | 'fitness_test';
  raceName?: string;
}

interface RacePredictionsProps {
  vdot: number;
  vdotConfidence?: 'high' | 'medium' | 'low'; // Based on data quality
  recentRaceCount?: number;
  lastRaceDate?: string;
  vdotHistory?: VDOTHistoryPoint[]; // For timeline view
  targetRace?: {
    name: string;
    date: string;
    distance: string;
    targetTime?: number;
  };
}

// Calculate race time from VDOT (simplified formula)
function predictRaceTime(vdot: number, distanceMeters: number): number {
  // Velocity at VO2max in meters per minute
  const velocityFromVDOT = (vdot: number, percentVO2max: number): number => {
    const vo2 = vdot * percentVO2max;
    const a = 0.000104;
    const b = 0.182258;
    const c = -4.60 - vo2;
    const discriminant = b * b - 4 * a * c;
    return (-b + Math.sqrt(discriminant)) / (2 * a);
  };

  // Estimate initial time
  const estimatedVelocity = velocityFromVDOT(vdot, 0.80);
  let timeSeconds = (distanceMeters / estimatedVelocity) * 60;

  // Refine with iterations
  for (let i = 0; i < 10; i++) {
    const velocity = distanceMeters / (timeSeconds / 60);
    const timeMinutes = timeSeconds / 60;
    const percentVO2max = 0.8 + 0.1894393 * Math.exp(-0.012778 * timeMinutes) +
                          0.2989558 * Math.exp(-0.1932605 * timeMinutes);
    const vo2 = -4.60 + 0.182258 * velocity + 0.000104 * velocity * velocity;
    const calculatedVDOT = vo2 / percentVO2max;

    if (Math.abs(calculatedVDOT - vdot) < 0.1) break;

    const ratio = vdot / calculatedVDOT;
    timeSeconds = timeSeconds / ratio;
  }

  return Math.round(timeSeconds);
}

// Calculate confidence interval based on VDOT uncertainty
function getConfidenceInterval(
  predictedTime: number,
  confidence: 'high' | 'medium' | 'low'
): { min: number; max: number } {
  // Confidence affects the range:
  // High: ±2% (recent race, good data)
  // Medium: ±4% (older race or estimated)
  // Low: ±7% (very old or no race data)
  const percentages = {
    high: 0.02,
    medium: 0.04,
    low: 0.07,
  };

  const percent = percentages[confidence];
  return {
    min: Math.round(predictedTime * (1 - percent)),
    max: Math.round(predictedTime * (1 + percent)),
  };
}

// Get confidence label and color
function getConfidenceInfo(confidence: 'high' | 'medium' | 'low'): {
  label: string;
  color: string;
  bgColor: string;
  description: string;
} {
  switch (confidence) {
    case 'high':
      return {
        label: 'High Confidence',
        color: 'text-green-600',
        bgColor: 'bg-green-50 dark:bg-green-950',
        description: 'Based on recent race performance',
      };
    case 'medium':
      return {
        label: 'Medium Confidence',
        color: 'text-teal-600',
        bgColor: 'bg-surface-1',
        description: 'Based on older data or estimated fitness',
      };
    case 'low':
      return {
        label: 'Low Confidence',
        color: 'text-textTertiary',
        bgColor: 'bg-bgTertiary',
        description: 'Limited data - predictions may vary significantly',
      };
  }
}

export function RacePredictions({
  vdot,
  vdotConfidence = 'medium',
  recentRaceCount = 0,
  lastRaceDate,
  vdotHistory = [],
  targetRace,
}: RacePredictionsProps) {
  const [expanded, setExpanded] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  // Calculate predictions for all distances
  const predictions = useMemo(() => {
    return Object.entries(RACE_DISTANCES).map(([key, distance]) => {
      const time = predictRaceTime(vdot, distance.meters);
      const interval = getConfidenceInterval(time, vdotConfidence);
      const pace = Math.round(time / distance.miles);

      return {
        key,
        label: distance.label,
        miles: distance.miles,
        predictedTime: time,
        minTime: interval.min,
        maxTime: interval.max,
        pace,
      };
    });
  }, [vdot, vdotConfidence]);

  const confidenceInfo = getConfidenceInfo(vdotConfidence);

  // Key distances to always show
  const keyDistances = ['5K', '10K', 'half_marathon', 'marathon'];
  const visiblePredictions = expanded
    ? predictions
    : predictions.filter(p => keyDistances.includes(p.key));

  // Calculate days since last race
  const daysSinceRace = lastRaceDate
    ? Math.floor((Date.now() - new Date(lastRaceDate).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-teal-500" />
          <h3 className="font-semibold text-primary">Race Predictions</h3>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-1.5 hover:bg-surface-interactive-hover rounded-full transition-colors"
        >
          <Info className="w-4 h-4 text-tertiary" />
        </button>
      </div>

      {/* Confidence Badge */}
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg mb-4', confidenceInfo.bgColor)}>
        <Target className={cn('w-4 h-4', confidenceInfo.color)} />
        <div>
          <span className={cn('text-sm font-medium', confidenceInfo.color)}>
            {confidenceInfo.label}
          </span>
          <span className="text-xs text-textTertiary ml-2">
            {confidenceInfo.description}
          </span>
        </div>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="mb-4 p-3 bg-surface-1 rounded-lg text-sm text-textSecondary">
          <p className="mb-2">
            Predictions are based on your VDOT of <strong>{vdot.toFixed(1)}</strong> using
            Jack Daniels&apos; formulas. The confidence range shows likely finish times.
          </p>
          <div className="text-xs space-y-1">
            <p>
              <strong>To improve accuracy:</strong>
            </p>
            <ul className="list-disc list-inside ml-2">
              <li>Race more frequently (current: {recentRaceCount} recent races)</li>
              <li>Log race results within 3 months</li>
              {daysSinceRace && daysSinceRace > 90 && (
                <li className="text-teal-600">Last race was {daysSinceRace} days ago</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* VDOT Display */}
      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-borderSecondary">
        <div>
          <div className="text-3xl font-bold text-primary">{vdot.toFixed(1)}</div>
          <div className="text-xs text-textTertiary">Current VDOT</div>
        </div>
        <div className="h-10 w-px bg-borderSecondary" />
        <div className="flex-1 text-sm text-textSecondary">
          {daysSinceRace !== null ? (
            <span>
              Last race: {daysSinceRace === 0 ? 'Today' : `${daysSinceRace} days ago`}
            </span>
          ) : (
            <span className="text-tertiary">No recent races logged</span>
          )}
        </div>
      </div>

      {/* Predictions Table */}
      <div className="space-y-2">
        {visiblePredictions.map((pred) => (
          <div
            key={pred.key}
            className="flex items-center justify-between py-2 border-b border-borderSecondary last:border-0"
          >
            <div className="flex items-center gap-3">
              <div className="w-24 font-medium text-primary">{pred.label}</div>
              <div className="text-xs text-tertiary">{pred.miles} mi</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-primary">{formatTime(pred.predictedTime)}</div>
              <div className="text-xs text-tertiary">
                {formatTime(pred.minTime)} – {formatTime(pred.maxTime)}
              </div>
            </div>
            <div className="w-20 text-right">
              <div className="text-sm text-textSecondary">{formatPace(pred.pace)}/mi</div>
            </div>
          </div>
        ))}
      </div>

      {/* Expand/Collapse */}
      {predictions.length > keyDistances.length && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center gap-1 w-full mt-3 py-2 text-sm text-teal-600 hover:text-teal-700 dark:text-teal-300 font-medium"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show All Distances
            </>
          )}
        </button>
      )}

      {/* Improvement Tips */}
      <div className="mt-4 pt-4 border-t border-borderSecondary">
        <p className="text-xs text-textTertiary">
          <strong>Tip:</strong> Race more often at shorter distances to calibrate your VDOT.
          A 5K race every 4-6 weeks provides excellent fitness feedback.
        </p>
      </div>
    </div>
  );
}

// ==================== Fitness Timeline Component (Issue 16) ====================

interface FitnessTimelineProps {
  vdotHistory: VDOTHistoryPoint[];
  currentVdot: number;
  targetRace?: {
    name: string;
    date: string;
    distance: string;
    targetTime?: number;
  };
}

export function FitnessTimeline({ vdotHistory, currentVdot, targetRace }: FitnessTimelineProps) {
  if (vdotHistory.length === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-teal-500" />
          <h3 className="font-semibold text-primary">Fitness Timeline</h3>
        </div>
        <div className="text-center py-8 text-textTertiary">
          <p>No fitness history yet.</p>
          <p className="text-sm mt-2">Log race results or complete fitness tests to track your progress.</p>
        </div>
      </div>
    );
  }

  // Calculate trend
  const sortedHistory = [...vdotHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const firstVdot = sortedHistory[0].vdot;
  const lastVdot = sortedHistory[sortedHistory.length - 1].vdot;
  const vdotChange = lastVdot - firstVdot;
  const daysBetween = Math.floor(
    (new Date(sortedHistory[sortedHistory.length - 1].date).getTime() - new Date(sortedHistory[0].date).getTime()) /
    (1000 * 60 * 60 * 24)
  );

  // Project future VDOT if target race exists
  const projectFutureVdot = () => {
    if (!targetRace || vdotHistory.length < 2) return null;

    const daysToRace = Math.floor(
      (new Date(targetRace.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    if (daysToRace <= 0 || daysBetween <= 0) return null;

    // Project based on current trend (with diminishing returns)
    const weeklyImprovement = (vdotChange / daysBetween) * 7;
    const weeksToRace = daysToRace / 7;

    // Apply diminishing returns: improvement slows as you get fitter
    const projectedImprovement = weeklyImprovement * weeksToRace * Math.max(0.3, 1 - (currentVdot - 40) / 30);

    return currentVdot + projectedImprovement;
  };

  const projectedVdot = projectFutureVdot();

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-teal-500" />
          <h3 className="font-semibold text-primary">Fitness Timeline</h3>
        </div>
        {daysBetween > 0 && (
          <span className={cn(
            'text-xs font-medium px-2 py-1 rounded-full',
            vdotChange > 0 ? 'bg-green-100 text-green-700 dark:text-green-300' :
            vdotChange < 0 ? 'bg-red-100 text-red-700 dark:text-red-300' :
            'bg-bgTertiary text-textSecondary'
          )}>
            {vdotChange > 0 ? '+' : ''}{vdotChange.toFixed(1)} VDOT over {Math.round(daysBetween / 7)} weeks
          </span>
        )}
      </div>

      {/* Timeline visualization */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-borderSecondary" />

        {/* Timeline points */}
        <div className="space-y-4">
          {sortedHistory.map((point, index) => (
            <div key={index} className="relative pl-10">
              {/* Point marker */}
              <div className={cn(
                'absolute left-2 w-5 h-5 rounded-full flex items-center justify-center',
                point.source === 'race' ? 'bg-purple-500' :
                point.source === 'fitness_test' ? 'bg-blue-50 dark:bg-blue-9500' :
                'bg-textTertiary'
              )}>
                {point.source === 'race' && <Trophy className="w-3 h-3 text-white" />}
                {point.source === 'fitness_test' && <Target className="w-3 h-3 text-white" />}
              </div>

              {/* Content */}
              <div className="bg-bgTertiary rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-primary">
                      VDOT {point.vdot.toFixed(1)}
                    </div>
                    {point.raceName && (
                      <div className="text-sm text-textSecondary">{point.raceName}</div>
                    )}
                  </div>
                  <div className="text-sm text-textTertiary">
                    {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                {index > 0 && (
                  <div className={cn(
                    'text-xs mt-1',
                    point.vdot > sortedHistory[index - 1].vdot ? 'text-green-600' : 'text-red-600'
                  )}>
                    {point.vdot > sortedHistory[index - 1].vdot ? '+' : ''}
                    {(point.vdot - sortedHistory[index - 1].vdot).toFixed(1)} from previous
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Future projection */}
          {projectedVdot && targetRace && (
            <div className="relative pl-10 opacity-70">
              <div className="absolute left-2 w-5 h-5 rounded-full bg-surface-2 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-teal-600" />
              </div>
              <div className="bg-surface-1 rounded-lg p-3 border border-dashed border-default">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-teal-700 dark:text-teal-300">
                      Projected: VDOT {projectedVdot.toFixed(1)}
                    </div>
                    <div className="text-sm text-teal-600">{targetRace.name}</div>
                  </div>
                  <div className="text-sm text-teal-500">
                    {new Date(targetRace.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== Prediction Explanation Engine (Issue 16) ====================

interface PredictionExplanationProps {
  vdot: number;
  targetDistance: string;
  predictedTime: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  recentWorkouts?: {
    avgWeeklyMiles: number;
    longRunMax: number;
    qualitySessionsPerWeek: number;
  };
  targetRace?: {
    name: string;
    date: string;
    targetTime?: number;
  };
}

export function PredictionExplanation({
  vdot,
  targetDistance,
  predictedTime,
  confidenceLevel,
  recentWorkouts,
  targetRace,
}: PredictionExplanationProps) {
  const distanceInfo = RACE_DISTANCES[targetDistance];

  if (!distanceInfo) {
    return null;
  }

  // Calculate pace from predicted time
  const predictedPace = Math.round(predictedTime / distanceInfo.miles);

  // Generate explanation factors
  const factors: Array<{
    factor: string;
    impact: 'positive' | 'neutral' | 'negative';
    detail: string;
  }> = [];

  // VDOT-based factor
  factors.push({
    factor: 'Current Fitness (VDOT)',
    impact: 'neutral',
    detail: `Your VDOT of ${vdot.toFixed(1)} translates to a ${formatPace(predictedPace)}/mi pace for ${distanceInfo.label}`,
  });

  // Confidence factor
  if (confidenceLevel === 'high') {
    factors.push({
      factor: 'Prediction Confidence',
      impact: 'positive',
      detail: 'Based on recent race results - high accuracy expected',
    });
  } else if (confidenceLevel === 'low') {
    factors.push({
      factor: 'Prediction Confidence',
      impact: 'negative',
      detail: 'Limited race data - actual times may vary by 5-10%',
    });
  }

  // Training factors (if available)
  if (recentWorkouts) {
    // Volume factor
    const recommendedVolume = distanceInfo.miles * 3; // Rule of thumb: 3x race distance weekly
    if (recentWorkouts.avgWeeklyMiles >= recommendedVolume) {
      factors.push({
        factor: 'Training Volume',
        impact: 'positive',
        detail: `${recentWorkouts.avgWeeklyMiles.toFixed(0)} mi/week is excellent for ${distanceInfo.label}`,
      });
    } else if (recentWorkouts.avgWeeklyMiles < recommendedVolume * 0.6) {
      factors.push({
        factor: 'Training Volume',
        impact: 'negative',
        detail: `${recentWorkouts.avgWeeklyMiles.toFixed(0)} mi/week may limit ${distanceInfo.label} performance`,
      });
    }

    // Long run factor
    const recommendedLongRun = distanceInfo.miles * 0.6; // 60% of race distance
    if (distanceInfo.miles > 10 && recentWorkouts.longRunMax >= recommendedLongRun) {
      factors.push({
        factor: 'Long Run Endurance',
        impact: 'positive',
        detail: `${recentWorkouts.longRunMax.toFixed(0)} mi long runs provide good endurance base`,
      });
    } else if (distanceInfo.miles > 10 && recentWorkouts.longRunMax < recommendedLongRun * 0.7) {
      factors.push({
        factor: 'Long Run Endurance',
        impact: 'negative',
        detail: `Consider building long runs to ${Math.round(recommendedLongRun)} mi for ${distanceInfo.label}`,
      });
    }
  }

  // Gap to target (if set)
  let gapToTarget = 0;
  if (targetRace?.targetTime) {
    gapToTarget = predictedTime - targetRace.targetTime;
    if (gapToTarget > 0) {
      factors.push({
        factor: 'Gap to Goal',
        impact: 'negative',
        detail: `${formatTime(Math.abs(gapToTarget))} slower than your goal time`,
      });
    } else {
      factors.push({
        factor: 'Goal Achievability',
        impact: 'positive',
        detail: `${formatTime(Math.abs(gapToTarget))} cushion to your goal time`,
      });
    }
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Info className="w-5 h-5 text-teal-500" />
        <h3 className="font-semibold text-primary">Prediction Breakdown</h3>
      </div>

      {/* Summary */}
      <div className="bg-surface-1 rounded-lg p-4 mb-4">
        <div className="text-center">
          <div className="text-sm text-textSecondary mb-1">{distanceInfo.label} Prediction</div>
          <div className="text-3xl font-bold text-primary">{formatTime(predictedTime)}</div>
          <div className="text-sm text-textSecondary">{formatPace(predictedPace)}/mi average</div>
        </div>
      </div>

      {/* Factors */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-textSecondary">Key Factors</h4>
        {factors.map((f, i) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-bgTertiary rounded-lg">
            <div className={cn(
              'w-2 h-2 rounded-full mt-1.5',
              f.impact === 'positive' ? 'bg-green-50 dark:bg-green-9500' :
              f.impact === 'negative' ? 'bg-red-50 dark:bg-red-9500' :
              'bg-textTertiary'
            )} />
            <div>
              <div className="font-medium text-primary">{f.factor}</div>
              <div className="text-sm text-textSecondary">{f.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* How to improve */}
      <div className="mt-4 pt-4 border-t border-borderSecondary">
        <h4 className="text-sm font-medium text-textSecondary mb-2">How to Improve This Prediction</h4>
        <ul className="text-sm text-textSecondary space-y-1">
          <li>• Consistent training builds fitness (VDOT) over time</li>
          <li>• Race a shorter distance to validate your VDOT</li>
          {distanceInfo.miles >= 13.1 && (
            <li>• Build weekly mileage to 40-50+ miles for marathon fitness</li>
          )}
          {distanceInfo.miles < 13.1 && (
            <li>• Add speed work (intervals, tempo runs) for shorter race speed</li>
          )}
        </ul>
      </div>
    </div>
  );
}
