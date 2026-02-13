'use client';

import { useMemo } from 'react';
import { Heart, Activity } from 'lucide-react';

interface ZoneData {
  zone: number;
  name: string;
  seconds: number;
  percentage: number;
  color: string;
}

interface ZoneDistributionChartProps {
  zones: ZoneData[];
  type: 'hr' | 'pace';
  totalSeconds: number;
}

// Format seconds to mm:ss or h:mm:ss
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Pace zones based on workout type/effort
const PACE_ZONES = [
  { zone: 1, name: 'Recovery', color: 'bg-cyan-400 dark:bg-cyan-500', textColor: 'text-cyan-700 dark:text-cyan-300' },
  { zone: 2, name: 'Easy', color: 'bg-teal-400 dark:bg-teal-500', textColor: 'text-teal-700 dark:text-teal-300 dark:text-teal-300' },
  { zone: 3, name: 'Steady', color: 'bg-amber-400 dark:bg-amber-500', textColor: 'text-amber-700 dark:text-amber-300' },
  { zone: 4, name: 'Threshold', color: 'bg-orange-500 dark:bg-orange-600', textColor: 'text-orange-700 dark:text-orange-300' },
  { zone: 5, name: 'VO2max', color: 'bg-rose-500 dark:bg-rose-600', textColor: 'text-rose-700 dark:text-rose-300' },
  { zone: 6, name: 'Speed', color: 'bg-purple-600 dark:bg-purple-700', textColor: 'text-purple-700 dark:text-purple-300' },
];

export function ZoneDistributionChart({ zones, type, totalSeconds }: ZoneDistributionChartProps) {
  const chartData = useMemo(() => {
    // Filter out zones with no time
    return zones.filter(z => z.seconds > 0);
  }, [zones]);

  if (!chartData.length) return null;

  const zoneConfig = type === 'hr' ? zones : PACE_ZONES;
  const Icon = type === 'hr' ? Heart : Activity;
  const title = type === 'hr' ? 'Heart Rate Zones' : 'Pace Zones';

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-textPrimary flex items-center gap-2 mb-4">
        <Icon className={`w-5 h-5 ${type === 'hr' ? 'text-red-500' : 'text-teal-500'}`} />
        {title}
      </h2>

      {/* Horizontal stacked bar */}
      <div className="mb-4">
        <div className="flex h-8 rounded-lg overflow-hidden">
          {chartData.map((zone) => (
            <div
              key={zone.zone}
              className={`${zone.color} transition-all hover:opacity-90 relative group`}
              style={{ width: `${zone.percentage}%` }}
              title={`Zone ${zone.zone}: ${zone.percentage}%`}
            >
              {/* Show percentage if wide enough */}
              {zone.percentage > 5 && (
                <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium">
                  {zone.percentage}%
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Zone breakdown list */}
      <div className="space-y-2">
        {chartData.map((zone) => {
          const config = zoneConfig.find(z => z.zone === zone.zone) || zone;
          return (
            <div key={zone.zone} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded ${zone.color}`} />
                <span className="text-sm font-medium text-textSecondary">
                  Z{zone.zone} - {zone.name}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-textSecondary">{formatTime(zone.seconds)}</span>
                <span className={`font-medium ${config.textColor || 'text-textSecondary'} min-w-[3rem] text-right`}>
                  {zone.percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="mt-4 pt-4 border-t border-borderSecondary grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-textSecondary">Avg Zone:</span>
          <span className="ml-2 font-medium text-textSecondary">
            {(chartData.reduce((sum, z) => sum + z.zone * z.percentage, 0) / 100).toFixed(1)}
          </span>
        </div>
        <div>
          <span className="text-textSecondary">Time in Z4+:</span>
          <span className="ml-2 font-medium text-textSecondary">
            {chartData.filter(z => z.zone >= 4).reduce((sum, z) => sum + z.percentage, 0)}%
          </span>
        </div>
      </div>
    </div>
  );
}