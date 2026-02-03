'use client';

import { TrendingUp, Thermometer, Mountain, Zap, Heart } from 'lucide-react';
import { formatPace } from '@/lib/utils';

interface TrainingZoneAnalysisProps {
  // Workout data
  avgPaceSeconds: number | null;
  distanceMiles: number | null;
  durationMinutes: number | null;
  elevationGainFeet: number | null;
  avgHeartRate: number | null;
  workoutType: string;
  // Weather conditions
  weatherTempF: number | null;
  weatherHumidityPct: number | null;
  // User's pace zones (from settings)
  easyPaceSeconds: number | null;
  tempoPaceSeconds: number | null;
  thresholdPaceSeconds: number | null;
  intervalPaceSeconds: number | null;
  // Lap data for variability analysis
  laps?: { avgPaceSeconds: number; durationSeconds: number }[];
}

interface TrainingZone {
  name: string;
  shortName: string;
  color: string;
  bgColor: string;
  description: string;
  benefit: string;
}

const TRAINING_ZONES: Record<string, TrainingZone> = {
  recovery: {
    name: 'Recovery',
    shortName: 'Rec',
    color: 'text-gray-600',
    bgColor: 'bg-gray-200',
    description: 'Very easy effort, conversation pace',
    benefit: 'Active recovery, blood flow without stress',
  },
  easy: {
    name: 'Easy / Aerobic',
    shortName: 'Easy',
    color: 'text-blue-600',
    bgColor: 'bg-blue-400',
    description: 'Comfortable, could hold a conversation',
    benefit: 'Builds aerobic base, mitochondrial development',
  },
  moderate: {
    name: 'Moderate',
    shortName: 'Mod',
    color: 'text-green-600',
    bgColor: 'bg-green-400',
    description: 'Steady effort, harder to talk',
    benefit: 'Aerobic development, marathon-pace training',
  },
  tempo: {
    name: 'Tempo',
    shortName: 'Tempo',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-400',
    description: 'Comfortably hard, sustainable for 30-60min',
    benefit: 'Lactate clearance, mental toughness',
  },
  threshold: {
    name: 'Threshold',
    shortName: 'LT',
    color: 'text-orange-600',
    bgColor: 'bg-orange-400',
    description: 'Hard effort at lactate threshold',
    benefit: 'Raises lactate threshold, race-specific fitness',
  },
  vo2max: {
    name: 'VO2max',
    shortName: 'VO2',
    color: 'text-red-600',
    bgColor: 'bg-red-500',
    description: 'Very hard, max aerobic effort',
    benefit: 'Increases VO2max, running economy',
  },
};

/**
 * Estimate pace adjustment for conditions
 */
function estimatePaceAdjustment(
  tempF: number | null,
  humidityPct: number | null,
  elevationGainFt: number | null,
  distanceMiles: number | null
): { adjustmentSeconds: number; reasons: string[] } {
  let adjustment = 0;
  const reasons: string[] = [];

  // Heat adjustment: ~2-3 sec/mile per degree above 60°F
  if (tempF && tempF > 60) {
    const heatAdj = Math.round((tempF - 60) * 2.5);
    adjustment += heatAdj;
    if (heatAdj > 10) {
      reasons.push(`Heat (+${heatAdj}s/mi)`);
    }
  }

  // Humidity compounds heat effect
  if (tempF && tempF > 70 && humidityPct && humidityPct > 60) {
    const humidityAdj = Math.round((humidityPct - 60) * 0.3);
    adjustment += humidityAdj;
    if (humidityAdj > 5) {
      reasons.push(`Humidity (+${humidityAdj}s/mi)`);
    }
  }

  // Elevation: roughly 12-15 sec/mile per 100ft of gain per mile
  if (elevationGainFt && distanceMiles && distanceMiles > 0) {
    const gainPerMile = elevationGainFt / distanceMiles;
    if (gainPerMile > 30) {
      const elevAdj = Math.round(gainPerMile * 0.15);
      adjustment += elevAdj;
      reasons.push(`Hills (+${elevAdj}s/mi)`);
    }
  }

  return { adjustmentSeconds: adjustment, reasons };
}

/**
 * Determine training zone from pace
 */
function determineTrainingZone(
  paceSeconds: number,
  easyPace: number,
  tempoPace: number,
  thresholdPace: number,
  intervalPace: number
): string {
  // Define zone boundaries (pace in seconds, lower = faster)
  // Recovery: slower than easy + 30s
  // Easy: easy pace ± 15s
  // Moderate: between easy and tempo
  // Tempo: tempo pace ± 10s
  // Threshold: threshold pace ± 10s
  // VO2max: faster than threshold

  if (paceSeconds > easyPace + 30) return 'recovery';
  if (paceSeconds >= easyPace - 15) return 'easy';
  if (paceSeconds > tempoPace + 15) return 'moderate';
  if (paceSeconds >= tempoPace - 10) return 'tempo';
  if (paceSeconds >= thresholdPace - 10) return 'threshold';
  return 'vo2max';
}

/**
 * Analyze lap variability to detect intervals
 */
function analyzeLapVariability(
  laps: { avgPaceSeconds: number; durationSeconds: number }[]
): { isInterval: boolean; fastLaps: number; slowLaps: number; paceRange: number } {
  if (!laps || laps.length < 3) {
    return { isInterval: false, fastLaps: 0, slowLaps: 0, paceRange: 0 };
  }

  const paces = laps.map(l => l.avgPaceSeconds).filter(p => p > 0 && p < 1200); // Filter out invalid
  if (paces.length < 2) {
    return { isInterval: false, fastLaps: 0, slowLaps: 0, paceRange: 0 };
  }

  const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;
  const fastLaps = paces.filter(p => p < avgPace - 30).length;
  const slowLaps = paces.filter(p => p > avgPace + 30).length;
  const paceRange = Math.max(...paces) - Math.min(...paces);

  // It's an interval workout if there's significant pace variation
  const isInterval = fastLaps >= 2 && slowLaps >= 1 && paceRange > 60;

  return { isInterval, fastLaps, slowLaps, paceRange };
}

export function TrainingZoneAnalysis({
  avgPaceSeconds,
  distanceMiles,
  durationMinutes,
  elevationGainFeet,
  avgHeartRate,
  workoutType,
  weatherTempF,
  weatherHumidityPct,
  easyPaceSeconds,
  tempoPaceSeconds,
  thresholdPaceSeconds,
  intervalPaceSeconds,
  laps,
}: TrainingZoneAnalysisProps) {
  // Need pace data and at least easy pace to analyze
  if (!avgPaceSeconds || !easyPaceSeconds) {
    return null;
  }

  // Use defaults if some paces aren't set
  const easyPace = easyPaceSeconds;
  const tempoPace = tempoPaceSeconds || Math.round(easyPace * 0.78);
  const thresholdPace = thresholdPaceSeconds || Math.round(easyPace * 0.74);
  const intervalPace = intervalPaceSeconds || Math.round(easyPace * 0.67);

  // Calculate condition adjustments
  const { adjustmentSeconds, reasons } = estimatePaceAdjustment(
    weatherTempF,
    weatherHumidityPct,
    elevationGainFeet,
    distanceMiles
  );

  // Adjust the actual pace for conditions (make it "faster" for comparison)
  const adjustedPace = avgPaceSeconds - adjustmentSeconds;

  // Determine zone from adjusted pace
  const zone = determineTrainingZone(adjustedPace, easyPace, tempoPace, thresholdPace, intervalPace);
  const zoneInfo = TRAINING_ZONES[zone];

  // Analyze lap variability
  const lapAnalysis = laps ? analyzeLapVariability(laps) : null;

  // Determine if this was actually an interval workout based on laps
  const isIntervalWorkout = lapAnalysis?.isInterval || workoutType === 'interval';

  // Calculate how the pace compares to zone targets
  const paceVsEasy = avgPaceSeconds - easyPace;
  const paceVsTempo = avgPaceSeconds - tempoPace;
  const paceVsThreshold = avgPaceSeconds - thresholdPace;

  // Generate insight based on analysis
  let insight = '';
  let insightType: 'success' | 'warning' | 'info' = 'info';

  if (isIntervalWorkout && lapAnalysis) {
    insight = `Interval session: ${lapAnalysis.fastLaps} hard efforts detected with ${Math.round(lapAnalysis.paceRange)}s pace variation`;
    insightType = 'success';
  } else if (zone === 'easy' && paceVsEasy > -10 && paceVsEasy < 20) {
    insight = 'Good easy pace - building aerobic base without excess stress';
    insightType = 'success';
  } else if (zone === 'moderate' && workoutType === 'easy') {
    insight = 'Pace crept into moderate zone - consider slowing down for true easy runs';
    insightType = 'warning';
  } else if (zone === 'tempo' || zone === 'threshold') {
    insight = `Quality session at ${zoneInfo.name.toLowerCase()} effort`;
    insightType = 'success';
  } else if (reasons.length > 0) {
    insight = `Pace adjusted for conditions: ${reasons.join(', ')}`;
    insightType = 'info';
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-blue-500" />
        Training Zone Analysis
      </h2>

      {/* Primary zone badge */}
      <div className="flex items-center gap-4 mb-4">
        <div className={`px-4 py-2 rounded-lg ${zoneInfo.bgColor} text-white font-semibold`}>
          {zoneInfo.name}
        </div>
        <div className="text-sm text-slate-600">
          {zoneInfo.description}
        </div>
      </div>

      {/* Pace comparison bars */}
      <div className="space-y-3 mb-4">
        <PaceComparisonBar
          label="Easy"
          targetPace={easyPace}
          actualPace={avgPaceSeconds}
          adjustedPace={adjustedPace}
          color="bg-blue-400"
        />
        <PaceComparisonBar
          label="Tempo"
          targetPace={tempoPace}
          actualPace={avgPaceSeconds}
          adjustedPace={adjustedPace}
          color="bg-yellow-400"
        />
        <PaceComparisonBar
          label="Threshold"
          targetPace={thresholdPace}
          actualPace={avgPaceSeconds}
          adjustedPace={adjustedPace}
          color="bg-orange-400"
        />
      </div>

      {/* Condition adjustments */}
      {reasons.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {weatherTempF && weatherTempF > 65 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
              <Thermometer className="w-3 h-3" />
              {weatherTempF}°F
            </span>
          )}
          {elevationGainFeet && elevationGainFeet > 100 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">
              <Mountain className="w-3 h-3" />
              +{elevationGainFeet}ft
            </span>
          )}
          {adjustmentSeconds > 10 && (
            <span className="text-xs text-slate-500">
              Adjusted effort: {formatPace(adjustedPace)}/mi equivalent
            </span>
          )}
        </div>
      )}

      {/* Training benefit */}
      <div className="bg-slate-50 rounded-lg p-3 mb-4">
        <div className="flex items-start gap-2">
          <Zap className="w-4 h-4 text-yellow-500 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-slate-700">Training Benefit</p>
            <p className="text-sm text-slate-600">{zoneInfo.benefit}</p>
          </div>
        </div>
      </div>

      {/* Insight */}
      {insight && (
        <div className={`rounded-lg p-3 text-sm ${
          insightType === 'success' ? 'bg-green-50 text-green-700' :
          insightType === 'warning' ? 'bg-yellow-50 text-yellow-700' :
          'bg-blue-50 text-blue-700'
        }`}>
          {insight}
        </div>
      )}

      {/* HR context if available */}
      {avgHeartRate && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-sm text-slate-500">
          <Heart className="w-4 h-4 text-red-400" />
          <span>Avg HR: {avgHeartRate} bpm</span>
          {reasons.length > 0 && (
            <span className="text-slate-400">
              (may be elevated due to conditions)
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function PaceComparisonBar({
  label,
  targetPace,
  actualPace,
  adjustedPace,
  color,
}: {
  label: string;
  targetPace: number;
  actualPace: number;
  adjustedPace: number;
  color: string;
}) {
  // Calculate position on a scale where target is center (50%)
  // Faster pace (lower seconds) = right of center
  // Slower pace (higher seconds) = left of center
  const diff = actualPace - targetPace;
  const adjustedDiff = adjustedPace - targetPace;

  // Clamp to reasonable range (-60s to +60s from target)
  const clampedDiff = Math.max(-60, Math.min(60, diff));
  const position = 50 - (clampedDiff / 60) * 40; // 10% to 90% range

  const isFaster = diff < -5;
  const isSlower = diff > 5;
  const isOnPace = !isFaster && !isSlower;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-16">{label}</span>
      <span className="text-xs text-slate-400 w-14">{formatPace(targetPace)}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full relative">
        {/* Target marker */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-slate-300" style={{ left: '50%' }} />
        {/* Actual pace marker */}
        <div
          className={`absolute top-0 bottom-0 w-2 h-2 rounded-full ${color} transform -translate-x-1/2`}
          style={{ left: `${position}%` }}
          title={`Actual: ${formatPace(actualPace)}/mi`}
        />
      </div>
      <span className={`text-xs w-12 text-right ${
        isOnPace ? 'text-green-600' : isFaster ? 'text-blue-600' : 'text-slate-500'
      }`}>
        {diff > 0 ? '+' : ''}{diff}s
      </span>
    </div>
  );
}
