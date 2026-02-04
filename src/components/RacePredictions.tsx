'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, ChevronDown, ChevronUp, Info, Target } from 'lucide-react';
import { RACE_DISTANCES, formatTime, formatPace } from '@/lib/training';

interface RacePredictionsProps {
  vdot: number;
  vdotConfidence?: 'high' | 'medium' | 'low'; // Based on data quality
  recentRaceCount?: number;
  lastRaceDate?: string;
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
        bgColor: 'bg-green-50',
        description: 'Based on recent race performance',
      };
    case 'medium':
      return {
        label: 'Medium Confidence',
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        description: 'Based on older data or estimated fitness',
      };
    case 'low':
      return {
        label: 'Low Confidence',
        color: 'text-stone-500',
        bgColor: 'bg-stone-50',
        description: 'Limited data - predictions may vary significantly',
      };
  }
}

export function RacePredictions({
  vdot,
  vdotConfidence = 'medium',
  recentRaceCount = 0,
  lastRaceDate,
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
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-stone-900">Race Predictions</h3>
        </div>
        <button
          onClick={() => setShowInfo(!showInfo)}
          className="p-1.5 hover:bg-stone-100 rounded-full transition-colors"
        >
          <Info className="w-4 h-4 text-stone-400" />
        </button>
      </div>

      {/* Confidence Badge */}
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-lg mb-4', confidenceInfo.bgColor)}>
        <Target className={cn('w-4 h-4', confidenceInfo.color)} />
        <div>
          <span className={cn('text-sm font-medium', confidenceInfo.color)}>
            {confidenceInfo.label}
          </span>
          <span className="text-xs text-stone-500 ml-2">
            {confidenceInfo.description}
          </span>
        </div>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="mb-4 p-3 bg-amber-50 rounded-lg text-sm text-stone-600">
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
                <li className="text-amber-600">Last race was {daysSinceRace} days ago</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* VDOT Display */}
      <div className="flex items-center gap-4 mb-4 pb-4 border-b border-stone-100">
        <div>
          <div className="text-3xl font-bold text-stone-900">{vdot.toFixed(1)}</div>
          <div className="text-xs text-stone-500">Current VDOT</div>
        </div>
        <div className="h-10 w-px bg-stone-200" />
        <div className="flex-1 text-sm text-stone-600">
          {daysSinceRace !== null ? (
            <span>
              Last race: {daysSinceRace === 0 ? 'Today' : `${daysSinceRace} days ago`}
            </span>
          ) : (
            <span className="text-stone-400">No recent races logged</span>
          )}
        </div>
      </div>

      {/* Predictions Table */}
      <div className="space-y-2">
        {visiblePredictions.map((pred) => (
          <div
            key={pred.key}
            className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0"
          >
            <div className="flex items-center gap-3">
              <div className="w-24 font-medium text-stone-900">{pred.label}</div>
              <div className="text-xs text-stone-400">{pred.miles} mi</div>
            </div>
            <div className="text-right">
              <div className="font-bold text-stone-900">{formatTime(pred.predictedTime)}</div>
              <div className="text-xs text-stone-400">
                {formatTime(pred.minTime)} – {formatTime(pred.maxTime)}
              </div>
            </div>
            <div className="w-20 text-right">
              <div className="text-sm text-stone-600">{formatPace(pred.pace)}/mi</div>
            </div>
          </div>
        ))}
      </div>

      {/* Expand/Collapse */}
      {predictions.length > keyDistances.length && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center gap-1 w-full mt-3 py-2 text-sm text-amber-600 hover:text-amber-700 font-medium"
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
      <div className="mt-4 pt-4 border-t border-stone-100">
        <p className="text-xs text-stone-500">
          <strong>Tip:</strong> Race more often at shorter distances to calibrate your VDOT.
          A 5K race every 4-6 weeks provides excellent fitness feedback.
        </p>
      </div>
    </div>
  );
}
