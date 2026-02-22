'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Zap, CircleDot } from 'lucide-react';
import { cn, formatPace } from '@/lib/utils';
import { getSegmentCategoryColor, getSegmentBarColor } from '@/lib/workout-colors';
import { classifySplitEffortsWithZones, type EffortCategory, type ZoneBoundaries } from '@/lib/training/effort-classifier';
import { buildInterpolatedMileSplitsFromLaps, type MileSplit } from '@/lib/mile-split-interpolation';

interface Lap {
  lapNumber: number;
  distanceMiles: number;
  durationSeconds: number;
  avgPaceSeconds: number;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  elevationGainFeet: number | null;
  lapType: string;
}

interface EnhancedSplitsProps {
  laps: Lap[];
  mileSplits?: MileSplit[];
  mileSplitSource?: 'stream' | 'laps';
  avgPaceSeconds: number | null;
  workoutType: string;
  easyPace?: number | null;
  tempoPace?: number | null;
  thresholdPace?: number | null;
  intervalPace?: number | null;
  marathonPace?: number | null;
  vdot?: number | null;
  conditionAdjustment?: number;
}

type SegmentCategory = EffortCategory;

interface CategorizedLap extends Lap {
  category: SegmentCategory;
  categoryLabel: string;
  categoryColor: string;
  categoryBgHex: string;
  categoryTextHex: string;
}

interface DisplaySplit extends CategorizedLap {
  displayLabel: string;
  sourceKind: 'mile' | 'lap';
}

// Format seconds to mm:ss
function formatTime(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  const m = Math.floor(rounded / 60);
  const s = rounded % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function EnhancedSplits({
  laps,
  mileSplits,
  mileSplitSource,
  avgPaceSeconds,
  workoutType,
  easyPace,
  tempoPace,
  thresholdPace,
  intervalPace,
  marathonPace,
  vdot,
  conditionAdjustment,
}: EnhancedSplitsProps) {
  const resolvedMileSplits = useMemo(
    () => (mileSplits && mileSplits.length > 0 ? mileSplits : buildInterpolatedMileSplitsFromLaps(laps)),
    [mileSplits, laps]
  );
  const hasMileSplits = resolvedMileSplits.length > 0;
  const resolvedMileSplitSource = hasMileSplits ? (mileSplitSource || 'laps') : null;
  // Default to lap view when laps are clearly not mile-length (e.g., km splits, manual laps)
  const defaultView = useMemo((): 'mile' | 'lap' => {
    if (!hasMileSplits) return 'lap';
    if (laps.length === 0) return 'mile';
    const avgDist = laps.reduce((s, l) => s + l.distanceMiles, 0) / laps.length;
    // If average lap distance is close to 1 mile (0.85-1.15), default to mile view
    if (avgDist >= 0.85 && avgDist <= 1.15) return 'mile';
    // Otherwise default to lap view (km splits, manual laps, etc.)
    return 'lap';
  }, [hasMileSplits, laps]);
  const [viewMode, setViewMode] = useState<'mile' | 'lap'>(defaultView);

  useEffect(() => {
    if (viewMode === 'mile' && !hasMileSplits) {
      setViewMode('lap');
    }
  }, [viewMode, hasMileSplits]);

  // 7-stage effort classification pipeline (see /src/lib/training/effort-classifier.ts)
  const { categorizedLaps, lapZones } = useMemo((): { categorizedLaps: CategorizedLap[]; lapZones: ZoneBoundaries | null } => {
    if (!laps.length) return { categorizedLaps: [], lapZones: null };

    const { splits: classified, zones: resolvedZones } = classifySplitEffortsWithZones(laps, {
      vdot,
      easyPace,
      tempoPace,
      thresholdPace,
      intervalPace,
      marathonPace,
      workoutType,
      avgPaceSeconds,
      conditionAdjustment,
    });

    return {
      categorizedLaps: laps.map((lap, idx): CategorizedLap => {
        const split = classified[idx];
        const colors = getSegmentCategoryColor(split.category);
        return {
          ...lap,
          category: split.category,
          categoryLabel: split.categoryLabel,
          categoryColor: `${colors.bg} ${colors.text}`,
          categoryBgHex: colors.hex || '#3b4252',
          categoryTextHex: '#d8dee9',
        };
      }),
      lapZones: resolvedZones,
    };
  }, [laps, avgPaceSeconds, easyPace, tempoPace, thresholdPace, intervalPace, marathonPace, vdot, workoutType, conditionAdjustment]);

  const categorizedMileSplits = useMemo((): CategorizedLap[] => {
    if (!resolvedMileSplits.length) return [];

    const mileAvgPace = resolvedMileSplits.length
      ? Math.round(resolvedMileSplits.reduce((sum, split) => sum + split.avgPaceSeconds, 0) / resolvedMileSplits.length)
      : avgPaceSeconds;

    const { splits: classified } = classifySplitEffortsWithZones(resolvedMileSplits, {
      vdot,
      easyPace,
      tempoPace,
      thresholdPace,
      intervalPace,
      marathonPace,
      workoutType,
      avgPaceSeconds: mileAvgPace,
      conditionAdjustment,
    });

    return resolvedMileSplits.map((lap, idx): CategorizedLap => {
      const split = classified[idx];
      const colors = getSegmentCategoryColor(split.category);
      return {
        ...lap,
        category: split.category,
        categoryLabel: split.categoryLabel,
        categoryColor: `${colors.bg} ${colors.text}`,
        categoryBgHex: colors.hex || '#3b4252',
        categoryTextHex: '#d8dee9',
      };
    });
  }, [resolvedMileSplits, avgPaceSeconds, easyPace, tempoPace, thresholdPace, intervalPace, marathonPace, vdot, workoutType, conditionAdjustment]);

  const activeSplits = useMemo((): DisplaySplit[] => {
    if (viewMode === 'mile') {
      return categorizedMileSplits.map(split => ({
        ...split,
        displayLabel: `M${split.lapNumber}`,
        sourceKind: 'mile',
      }));
    }

    return categorizedLaps.map(split => ({
      ...split,
      displayLabel: `L${split.lapNumber}`,
      sourceKind: 'lap',
    }));
  }, [viewMode, categorizedMileSplits, categorizedLaps]);

  const totalActiveDistance = useMemo(
    () => activeSplits.reduce((sum, split) => sum + split.distanceMiles, 0),
    [activeSplits]
  );

  const displayAvgPaceSeconds = useMemo(() => {
    if (!activeSplits.length || totalActiveDistance <= 0) return avgPaceSeconds || 0;
    const totalTime = activeSplits.reduce((sum, split) => sum + split.durationSeconds, 0);
    return Math.round(totalTime / totalActiveDistance);
  }, [activeSplits, totalActiveDistance, avgPaceSeconds]);

  // Detect interval structure
  const intervalStructure = useMemo(() => {
    const hardLaps = categorizedLaps.filter(
      (l) => l.category === 'interval' || l.category === 'threshold' || l.category === 'tempo'
    );
    const easyLaps = categorizedLaps.filter((l) => l.category === 'recovery' || l.category === 'steady' || l.category === 'easy');

    if (hardLaps.length >= 2 && workoutType === 'interval') {
      return {
        isInterval: true,
        reps: hardLaps.length,
        avgWorkPace: Math.round(hardLaps.reduce((sum, l) => sum + l.avgPaceSeconds, 0) / hardLaps.length),
        avgRecoveryPace: easyLaps.length
          ? Math.round(easyLaps.reduce((sum, l) => sum + l.avgPaceSeconds, 0) / easyLaps.length)
          : null,
      };
    }

    return { isInterval: false };
  }, [categorizedLaps, workoutType]);

  // Calculate zone distribution
  const zoneDistribution = useMemo(() => {
    const zones: Record<string, { count: number; distance: number; time: number }> = {};

    activeSplits.forEach((lap) => {
      if (!zones[lap.categoryLabel]) {
        zones[lap.categoryLabel] = { count: 0, distance: 0, time: 0 };
      }
      zones[lap.categoryLabel].count++;
      zones[lap.categoryLabel].distance += lap.distanceMiles;
      zones[lap.categoryLabel].time += lap.durationSeconds;
    });

    return Object.entries(zones).map(([label, data]) => {
      const matchingLap = activeSplits.find((l) => l.categoryLabel === label);
      return {
        label,
        ...data,
        bgHex: matchingLap?.categoryBgHex || '#3b4252',
        textHex: matchingLap?.categoryTextHex || '#d8dee9',
      };
    });
  }, [activeSplits]);

  if (!laps.length) return null;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-primary flex items-center gap-2">
          <Activity className="w-5 h-5 text-dream-500" />
          Workout Splits
        </h2>
        {intervalStructure.isInterval && viewMode === 'lap' && (
          <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-950 px-2 py-1 rounded">
            <Zap className="w-3 h-3" />
            {intervalStructure.reps} reps @ {formatPace(intervalStructure.avgWorkPace)}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setViewMode('mile')}
          disabled={!hasMileSplits}
          className={cn(
            'text-xs px-2.5 py-1 rounded-full border transition-colors',
            !hasMileSplits
              ? 'bg-surface-2 border-borderSecondary text-textTertiary/50 cursor-not-allowed'
              : viewMode === 'mile'
              ? 'bg-dream-500/15 border-dream-500/30 text-primary'
              : 'bg-surface-2 border-borderSecondary text-textTertiary hover:text-primary'
          )}
        >
          Mile Splits (Interpolated)
        </button>
        <button
          onClick={() => setViewMode('lap')}
          className={cn(
            'text-xs px-2.5 py-1 rounded-full border transition-colors',
            viewMode === 'lap'
              ? 'bg-dream-500/15 border-dream-500/30 text-primary'
              : 'bg-surface-2 border-borderSecondary text-textTertiary hover:text-primary'
          )}
        >
          Laps / Intervals (Actual)
        </button>
      </div>

      {viewMode === 'mile' ? (
        <p className="text-[11px] text-textTertiary mb-3">
          {resolvedMileSplitSource === 'stream'
            ? 'Mile splits are interpolated from raw stream data (distance + elapsed time), not equalized lap chunks.'
            : hasMileSplits
              ? 'Mile splits are estimated from fine-grained lap data.'
              : 'Mile splits unavailable: this workout needs stream data (or finer laps) for true per-mile interpolation.'}
        </p>
      ) : (
        <p className="text-[11px] text-textTertiary mb-3">
          This view shows the exact lap/interval segments sent by your device source.
        </p>
      )}

      {/* Visual mile bar with zones */}
      <div className="flex h-10 rounded-lg overflow-hidden mb-4">
        {activeSplits.map((lap, i) => {
          const widthPercent = totalActiveDistance > 0 ? (lap.distanceMiles / totalActiveDistance) * 100 : 0;

          // Color intensity based on pace relative to workout average
          const avgPace = displayAvgPaceSeconds || 480;
          const diff = (lap.avgPaceSeconds - avgPace) / avgPace;
          let intensity: 300 | 400 | 500 | 600 = 500;
          if (diff < -0.1) intensity = 600;
          else if (diff < -0.05) intensity = 500;
          else if (diff < 0.05) intensity = 400;
          else intensity = 300;

          // Use hex colors from centralized system for proper rendering
          const bgColor = getSegmentBarColor(lap.category, intensity);

          return (
            <div
              key={i}
              className="flex flex-col items-center justify-center text-white text-xs font-medium border-r border-white/20 last:border-r-0"
              style={{ width: `${widthPercent}%`, minWidth: '28px', backgroundColor: bgColor }}
              title={`${viewMode === 'mile' ? 'Mile' : 'Lap'} ${lap.lapNumber}: ${lap.distanceMiles.toFixed(2)}mi @ ${formatPace(lap.avgPaceSeconds)}/mi (${lap.categoryLabel})`}
            >
              <span className="font-bold">{lap.displayLabel}</span>
              <span className="text-[10px] opacity-80">{formatPace(lap.avgPaceSeconds)}</span>
            </div>
          );
        })}
      </div>

      {/* Effort distribution summary */}
      {zoneDistribution.length > 1 && (
        <div className="mb-4 pb-4 border-b border-borderSecondary">
          <p className="text-xs text-textTertiary mb-2">Effort Distribution</p>
          <div className="flex flex-wrap gap-2">
            {zoneDistribution.map((zone) => {
              const avgPacePerMile = zone.time / zone.distance;
              return (
                <span
                  key={zone.label}
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{ backgroundColor: zone.bgHex, color: zone.textHex }}
                >
                  {zone.label}: {zone.distance.toFixed(1)}mi @ {formatPace(Math.round(avgPacePerMile))}/mi
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Zone boundaries reference */}
      {lapZones && (
        <div className="mb-4 pb-4 border-b border-borderSecondary">
          <p className="text-xs text-textTertiary mb-1.5">
            Zone Boundaries {vdot ? `(VDOT ${Number(vdot).toFixed(1)})` : ''}
            {conditionAdjustment && conditionAdjustment > 0
              ? <span className="text-amber-400 ml-1">+{conditionAdjustment}s heat/elevation adj.</span>
              : ''}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-textTertiary">
            {([
              ['Easy', lapZones.easy],
              ['Steady', lapZones.steady],
              ['Marathon', lapZones.marathon],
              ['Tempo', lapZones.tempo],
              ['Threshold', lapZones.threshold],
              ['Interval', lapZones.interval],
            ] as const).map(([label, boundary]) => {
              const adj = conditionAdjustment || 0;
              const basePace = Math.round(boundary - adj);
              const adjPace = Math.round(boundary);
              return (
                <span key={label}>
                  <span className="text-textSecondary">{label}:</span>{' '}
                  {adj > 0 ? (
                    <>
                      <span className="text-textTertiary">{formatPace(basePace)}</span>
                      <span className="text-textTertiary mx-0.5">&rarr;</span>
                      <span className="text-amber-300">{formatPace(adjPace)}</span>
                    </>
                  ) : (
                    formatPace(adjPace)
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Detailed splits table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-textTertiary border-b border-borderSecondary">
              <th className="pb-2 font-medium w-16">{viewMode === 'mile' ? 'Mile' : 'Lap'}</th>
              <th className="pb-2 font-medium">Dist</th>
              <th className="pb-2 font-medium">Time</th>
              <th className="pb-2 font-medium">Pace</th>
              <th className="pb-2 font-medium">Effort</th>
              {activeSplits.some((l) => l.avgHeartRate) && <th className="pb-2 font-medium">HR</th>}
              {activeSplits.some((l) => l.elevationGainFeet) && <th className="pb-2 font-medium">Elev</th>}
              <th className="pb-2 font-medium text-right">+/-</th>
            </tr>
          </thead>
          <tbody>
            {activeSplits.map((lap, idx) => {
              const diff = displayAvgPaceSeconds ? lap.avgPaceSeconds - displayAvgPaceSeconds : 0;
              const diffStr =
                diff === 0 ? '--' : diff > 0 ? `+${Math.abs(diff)}s` : `-${Math.abs(diff)}s`;
              const diffColor = diff < -5 ? 'text-green-500 dark:text-green-400' : diff > 5 ? 'text-red-500 dark:text-red-400' : 'text-tertiary';

              return (
                <tr key={`${lap.sourceKind}-${lap.lapNumber}-${idx}`} className="border-b border-borderSecondary hover:bg-bgTertiary">
                  <td className="py-2">
                    <span className="flex items-center gap-1">
                      <CircleDot className="w-3 h-3 text-tertiary" />
                      <span className="font-medium">{lap.displayLabel}</span>
                    </span>
                  </td>
                  <td className="py-2 text-textSecondary">{lap.distanceMiles.toFixed(2)} mi</td>
                  <td className="py-2">{formatTime(lap.durationSeconds)}</td>
                  <td className="py-2 font-semibold">{formatPace(lap.avgPaceSeconds)}</td>
                  <td className="py-2">
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: lap.categoryBgHex, color: lap.categoryTextHex }}
                    >
                      {lap.categoryLabel}
                    </span>
                  </td>
                  {activeSplits.some((l) => l.avgHeartRate) && (
                    <td className="py-2 text-textSecondary">{lap.avgHeartRate || '--'}</td>
                  )}
                  {activeSplits.some((l) => l.elevationGainFeet) && (
                    <td className="py-2 text-textSecondary">
                      {lap.elevationGainFeet ? `${lap.elevationGainFeet > 0 ? '+' : ''}${Math.round(lap.elevationGainFeet)}` : '--'}
                    </td>
                  )}
                  <td className={`py-2 text-right font-medium ${diffColor}`}>{diffStr}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
