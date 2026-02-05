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

    return Object.entries(zones).map(([label, data]) => ({
      label,
      ...data,
      color: categorizedLaps.find((l) => l.categoryLabel === label)?.categoryColor || 'bg-gray-100 text-gray-700',
    }));
  }, [categorizedLaps]);

  if (!laps.length) return null;

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-stone-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-500" />
          Mile Splits
        </h2>
        {intervalStructure.isInterval && (
          <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
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
        <div className="mb-4 pb-4 border-b border-stone-100">
          <p className="text-xs text-stone-500 mb-2">Effort Distribution</p>
          <div className="flex flex-wrap gap-2">
            {zoneDistribution.map((zone) => (
              <span key={zone.label} className={`px-2 py-1 rounded text-xs font-medium ${zone.color}`}>
                {zone.label}: {zone.count} mile{zone.count !== 1 ? 's' : ''} ({formatTime(zone.time)})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Detailed splits table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-stone-500 border-b border-stone-100">
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
            {categorizedLaps.map((lap, idx) => {
              const diff = avgPaceSeconds ? lap.avgPaceSeconds - avgPaceSeconds : 0;
              const diffStr =
                diff === 0 ? '--' : diff > 0 ? `+${Math.abs(diff)}s` : `-${Math.abs(diff)}s`;
              const diffColor = diff < -5 ? 'text-green-600' : diff > 5 ? 'text-red-500' : 'text-stone-400';

              return (
                <tr key={lap.lapNumber} className="border-b border-stone-50 hover:bg-stone-50">
                  <td className="py-2">
                    <span className="flex items-center gap-1">
                      <CircleDot className="w-3 h-3 text-stone-300" />
                      <span className="font-medium">{lap.lapNumber}</span>
                    </span>
                  </td>
                  <td className="py-2">{formatTime(lap.durationSeconds)}</td>
                  <td className="py-2 font-semibold">{formatPace(lap.avgPaceSeconds)}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${lap.categoryColor}`}>
                      {lap.categoryLabel}
                    </span>
                  </td>
                  {laps.some((l) => l.avgHeartRate) && (
                    <td className="py-2 text-stone-600">{lap.avgHeartRate || '--'}</td>
                  )}
                  {laps.some((l) => l.elevationGainFeet) && (
                    <td className="py-2 text-stone-600">
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
