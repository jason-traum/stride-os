'use client';

import { useMemo } from 'react';
import { Activity, Zap, CircleDot } from 'lucide-react';
import { formatPace } from '@/lib/utils';
import { getSegmentCategoryColor, getSegmentBarColor } from '@/lib/workout-colors';
import { classifySplitEfforts, type EffortCategory } from '@/lib/training/effort-classifier';

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
  avgPaceSeconds: number | null;
  workoutType: string;
  easyPace?: number | null;
  tempoPace?: number | null;
  thresholdPace?: number | null;
  intervalPace?: number | null;
  marathonPace?: number | null;
  vdot?: number | null;
}

type SegmentCategory = EffortCategory;

interface CategorizedLap extends Lap {
  category: SegmentCategory;
  categoryLabel: string;
  categoryColor: string;
  categoryBgHex: string;
  categoryTextHex: string;
}

// Format seconds to mm:ss
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function EnhancedSplits({
  laps,
  avgPaceSeconds,
  workoutType,
  easyPace,
  tempoPace,
  thresholdPace,
  intervalPace,
  marathonPace,
  vdot,
}: EnhancedSplitsProps) {
  // 7-stage effort classification pipeline (see /src/lib/training/effort-classifier.ts)
  const categorizedLaps = useMemo((): CategorizedLap[] => {
    if (!laps.length) return [];

    const classified = classifySplitEfforts(laps, {
      vdot,
      easyPace,
      tempoPace,
      thresholdPace,
      intervalPace,
      marathonPace,
      workoutType,
      avgPaceSeconds,
    });

    return laps.map((lap, idx): CategorizedLap => {
      const split = classified[idx];
      const colors = getSegmentCategoryColor(split.category);

      return {
        ...lap,
        category: split.category,
        categoryLabel: split.categoryLabel,
        categoryColor: `${colors.bg} ${colors.text}`,
        categoryBgHex: colors.bgHex || '#3b4252',
        categoryTextHex: colors.textHex || '#d8dee9',
      };
    });
  }, [laps, avgPaceSeconds, easyPace, tempoPace, thresholdPace, intervalPace, marathonPace, vdot, workoutType]);

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

    categorizedLaps.forEach((lap) => {
      if (!zones[lap.categoryLabel]) {
        zones[lap.categoryLabel] = { count: 0, distance: 0, time: 0 };
      }
      zones[lap.categoryLabel].count++;
      zones[lap.categoryLabel].distance += lap.distanceMiles;
      zones[lap.categoryLabel].time += lap.durationSeconds;
    });

    return Object.entries(zones).map(([label, data]) => {
      const matchingLap = categorizedLaps.find((l) => l.categoryLabel === label);
      return {
        label,
        ...data,
        bgHex: matchingLap?.categoryBgHex || '#3b4252',
        textHex: matchingLap?.categoryTextHex || '#d8dee9',
      };
    });
  }, [categorizedLaps]);

  if (!laps.length) return null;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-primary flex items-center gap-2">
          <Activity className="w-5 h-5 text-dream-500" />
          Mile Splits
        </h2>
        {intervalStructure.isInterval && (
          <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-950 px-2 py-1 rounded">
            <Zap className="w-3 h-3" />
            {intervalStructure.reps} reps @ {formatPace(intervalStructure.avgWorkPace)}
          </span>
        )}
      </div>

      {/* Visual mile bar with zones */}
      <div className="flex h-10 rounded-lg overflow-hidden mb-4">
        {categorizedLaps.map((lap, i) => {
          const widthPercent = (lap.distanceMiles / laps.reduce((sum, l) => sum + l.distanceMiles, 0)) * 100;

          // Color intensity based on pace relative to workout average
          const avgPace = avgPaceSeconds || 480;
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
              title={`Mile ${lap.lapNumber}: ${formatPace(lap.avgPaceSeconds)}/mi (${lap.categoryLabel})`}
            >
              <span className="font-bold">{lap.lapNumber}</span>
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

      {/* Detailed splits table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-textTertiary border-b border-borderSecondary">
              <th className="pb-2 font-medium w-12">Mile</th>
              <th className="pb-2 font-medium">Time</th>
              <th className="pb-2 font-medium">Pace</th>
              <th className="pb-2 font-medium">Effort</th>
              {laps.some((l) => l.avgHeartRate) && <th className="pb-2 font-medium">HR</th>}
              {laps.some((l) => l.elevationGainFeet) && <th className="pb-2 font-medium">Elev</th>}
              <th className="pb-2 font-medium text-right">+/-</th>
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
            {categorizedLaps.map((lap, _idx) => {
              const diff = avgPaceSeconds ? lap.avgPaceSeconds - avgPaceSeconds : 0;
              const diffStr =
                diff === 0 ? '--' : diff > 0 ? `+${Math.abs(diff)}s` : `-${Math.abs(diff)}s`;
              const diffColor = diff < -5 ? 'text-green-600' : diff > 5 ? 'text-red-500' : 'text-tertiary';

              return (
                <tr key={lap.lapNumber} className="border-b border-borderSecondary hover:bg-bgTertiary">
                  <td className="py-2">
                    <span className="flex items-center gap-1">
                      <CircleDot className="w-3 h-3 text-tertiary" />
                      <span className="font-medium">{lap.lapNumber}</span>
                    </span>
                  </td>
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
                  {laps.some((l) => l.avgHeartRate) && (
                    <td className="py-2 text-textSecondary">{lap.avgHeartRate || '--'}</td>
                  )}
                  {laps.some((l) => l.elevationGainFeet) && (
                    <td className="py-2 text-textSecondary">
                      {lap.elevationGainFeet ? `${lap.elevationGainFeet > 0 ? '+' : ''}${lap.elevationGainFeet}` : '--'}
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
