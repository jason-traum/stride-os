'use client';

import { Footprints, Ruler, Activity } from 'lucide-react';

/**
 * Optimal reference ranges for running form metrics.
 *
 * Cadence: Most elite runners land 170-190 spm; recreational runners often
 * sit around 160-170, which isn't necessarily bad. Green = 170-190, amber =
 * 155-170 or 190-200, red = below 155 or above 200.
 *
 * Stride length: Highly individual (depends on height, pace). A reasonable
 * steady-state range for recreational runners is 0.9-1.4 m. Longer strides
 * at easy paces often signal overstriding; very short strides at fast paces
 * suggest form limitations.
 */

interface RunningFormMetric {
  label: string;
  value: string;
  unit: string;
  numericValue: number;
  status: 'optimal' | 'acceptable' | 'attention';
  tooltip: string;
  icon: React.ReactNode;
}

interface RunningFormCardProps {
  /** Average cadence in spm (total, both feet). Already doubled from Strava's one-foot value. */
  avgCadenceSpm: number;
  /** Distance in miles */
  distanceMiles: number | null;
  /** Duration in minutes */
  durationMinutes: number | null;
  /** Average pace in seconds per mile */
  avgPaceSeconds: number | null;
  /** Cadence stream data (per-second spm values, already doubled). Used for variability. */
  cadenceStream?: number[];
  /** User's historical average cadence (spm) across recent runs, for personal comparison. */
  personalAvgCadence?: number | null;
}

function getCadenceStatus(spm: number): 'optimal' | 'acceptable' | 'attention' {
  if (spm >= 170 && spm <= 190) return 'optimal';
  if ((spm >= 155 && spm < 170) || (spm > 190 && spm <= 200)) return 'acceptable';
  return 'attention';
}

function getCadenceTooltip(spm: number): string {
  if (spm >= 170 && spm <= 190) return 'Cadence in optimal range (170-190 spm)';
  if (spm >= 155 && spm < 170) return 'Cadence slightly below optimal. Higher cadence often reduces overstriding.';
  if (spm > 190 && spm <= 200) return 'Cadence above typical range. Fine for faster efforts.';
  if (spm < 155) return 'Low cadence may indicate overstriding. Try small increases of 5%.';
  return 'Very high cadence. Check that the data is accurate.';
}

function getStrideLengthStatus(meters: number, paceSecondsPerMile: number | null): 'optimal' | 'acceptable' | 'attention' {
  // Stride length varies significantly with pace.
  // At easy pace (>9:00/mi = >540s), expect 0.8-1.2m.
  // At tempo (~7:00/mi = ~420s), expect 1.1-1.5m.
  // At interval (<6:00/mi = <360s), expect 1.3-1.8m.
  if (!paceSecondsPerMile) {
    // Fallback: just use absolute ranges
    if (meters >= 0.9 && meters <= 1.5) return 'optimal';
    if (meters >= 0.7 && meters <= 1.7) return 'acceptable';
    return 'attention';
  }

  // Pace-adjusted ranges (wider is more forgiving)
  if (paceSecondsPerMile > 540) {
    // Easy pace
    if (meters >= 0.8 && meters <= 1.25) return 'optimal';
    if (meters >= 0.65 && meters <= 1.45) return 'acceptable';
    return 'attention';
  } else if (paceSecondsPerMile > 420) {
    // Moderate/tempo pace
    if (meters >= 1.0 && meters <= 1.45) return 'optimal';
    if (meters >= 0.85 && meters <= 1.6) return 'acceptable';
    return 'attention';
  } else {
    // Fast pace
    if (meters >= 1.2 && meters <= 1.7) return 'optimal';
    if (meters >= 1.0 && meters <= 1.9) return 'acceptable';
    return 'attention';
  }
}

function getStrideLengthTooltip(meters: number, status: 'optimal' | 'acceptable' | 'attention'): string {
  if (status === 'optimal') return 'Stride length well-matched to your pace';
  if (meters > 1.5) return 'Long stride length -- check for overstriding at easier paces';
  if (meters < 0.8) return 'Short stride length -- could indicate fatigue or terrain';
  return 'Stride length slightly outside typical range for this pace';
}

const statusColors = {
  optimal: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    dot: 'bg-emerald-400',
    label: 'Optimal',
  },
  acceptable: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
    label: 'Acceptable',
  },
  attention: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    dot: 'bg-red-400',
    label: 'Attention',
  },
};

export function RunningFormCard({
  avgCadenceSpm,
  distanceMiles,
  durationMinutes,
  avgPaceSeconds,
  cadenceStream,
  personalAvgCadence,
}: RunningFormCardProps) {
  const metrics: RunningFormMetric[] = [];

  // --- Cadence ---
  const cadenceStatus = getCadenceStatus(avgCadenceSpm);
  metrics.push({
    label: 'Avg Cadence',
    value: Math.round(avgCadenceSpm).toString(),
    unit: 'spm',
    numericValue: avgCadenceSpm,
    status: cadenceStatus,
    tooltip: getCadenceTooltip(avgCadenceSpm),
    icon: <Footprints className="w-4 h-4" />,
  });

  // --- Stride Length (computed) ---
  // stride_length_meters = (distance_meters) / (cadence_steps * duration_minutes * 60 / 2 / 60)
  // Simpler: each step covers distance/(total_steps). Total steps = cadence * duration_min / 60 * 60 = cadence * duration_sec
  // Actually: total strides (pairs) = cadence/2 * duration_min. One stride = two steps.
  // stride_length = distance / (cadence * duration_seconds / 2)
  // where cadence is total spm (both feet), so total steps = cadence * duration_seconds / 60
  // stride_length_meters = distance_meters / (cadence * duration_minutes)
  // Wait, let's be precise:
  // Total steps in duration = cadence_spm * duration_minutes
  // Each step = distance / total_steps
  // Stride = 2 steps = 2 * distance / total_steps = 2 * distance / (cadence * duration_min)
  let strideLengthMeters: number | null = null;
  if (distanceMiles && durationMinutes && avgCadenceSpm > 0) {
    const distanceMeters = distanceMiles * 1609.34;
    const totalSteps = avgCadenceSpm * durationMinutes; // total steps (both feet) over the run
    strideLengthMeters = distanceMeters / totalSteps; // meters per step
    const strideLength = strideLengthMeters * 2; // meters per stride (left-right cycle)

    const slStatus = getStrideLengthStatus(strideLength, avgPaceSeconds);
    metrics.push({
      label: 'Stride Length',
      value: strideLength.toFixed(2),
      unit: 'm',
      numericValue: strideLength,
      status: slStatus,
      tooltip: getStrideLengthTooltip(strideLength, slStatus),
      icon: <Ruler className="w-4 h-4" />,
    });
  }

  // --- Cadence Variability (from stream) ---
  let cadenceVariability: { stdDev: number; cv: number } | null = null;
  if (cadenceStream && cadenceStream.length > 10) {
    const validCadence = cadenceStream.filter(c => c > 100 && c < 230);
    if (validCadence.length > 10) {
      const mean = validCadence.reduce((a, b) => a + b, 0) / validCadence.length;
      const variance = validCadence.reduce((sum, c) => sum + (c - mean) ** 2, 0) / validCadence.length;
      const stdDev = Math.sqrt(variance);
      const cv = (stdDev / mean) * 100;
      cadenceVariability = { stdDev, cv };
    }
  }

  if (metrics.length === 0) return null;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 sm:p-6 shadow-sm">
      <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-violet-400" />
        Running Form
        <span className="text-xs font-normal text-textTertiary ml-auto">From device</span>
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {metrics.map((metric) => {
          const colors = statusColors[metric.status];
          return (
            <div
              key={metric.label}
              className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}
              title={metric.tooltip}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={colors.text}>{metric.icon}</span>
                <span className="text-xs text-textSecondary">{metric.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-textPrimary">{metric.value}</span>
                <span className="text-sm text-textTertiary">{metric.unit}</span>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                <span className={`text-xs ${colors.text}`}>{colors.label}</span>
              </div>
            </div>
          );
        })}

        {/* Cadence Variability mini-stat */}
        {cadenceVariability && (
          <div
            className="rounded-lg border border-borderSecondary bg-bgTertiary p-3"
            title={`Standard deviation: ${cadenceVariability.stdDev.toFixed(1)} spm. Lower variability indicates more consistent form.`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-textTertiary"><Activity className="w-4 h-4" /></span>
              <span className="text-xs text-textSecondary">Cadence Consistency</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-textPrimary">{cadenceVariability.cv.toFixed(1)}</span>
              <span className="text-sm text-textTertiary">% CV</span>
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full ${cadenceVariability.cv < 4 ? 'bg-emerald-400' : cadenceVariability.cv < 7 ? 'bg-amber-400' : 'bg-red-400'}`} />
              <span className={`text-xs ${cadenceVariability.cv < 4 ? 'text-emerald-400' : cadenceVariability.cv < 7 ? 'text-amber-400' : 'text-red-400'}`}>
                {cadenceVariability.cv < 4 ? 'Very consistent' : cadenceVariability.cv < 7 ? 'Normal' : 'Variable'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Personal comparison */}
      {personalAvgCadence && personalAvgCadence > 0 && (
        <div className="mt-4 pt-3 border-t border-borderSecondary">
          <div className="flex items-center justify-between text-sm">
            <span className="text-textSecondary">vs. your average</span>
            <span className={`font-medium ${
              Math.abs(avgCadenceSpm - personalAvgCadence) < 3
                ? 'text-textTertiary'
                : avgCadenceSpm > personalAvgCadence
                  ? 'text-emerald-400'
                  : 'text-amber-400'
            }`}>
              {avgCadenceSpm > personalAvgCadence ? '+' : ''}
              {Math.round(avgCadenceSpm - personalAvgCadence)} spm
              <span className="text-textTertiary ml-1">
                (avg {Math.round(personalAvgCadence)} spm)
              </span>
            </span>
          </div>
        </div>
      )}

      {/* Optimal range reference */}
      <div className="mt-3 pt-3 border-t border-borderSecondary">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-textTertiary">
          <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1" />Cadence: 170-190 spm</span>
          {strideLengthMeters && (
            <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1" />Stride: pace-dependent</span>
          )}
        </div>
      </div>
    </div>
  );
}
