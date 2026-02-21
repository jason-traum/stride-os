'use client';

import { useMemo } from 'react';
import { Heart, Activity } from 'lucide-react';

interface ZoneData {
  zone: number;
  name: string;
  seconds: number;
  percentage: number;
  color: string; // Tailwind class (bg-sky-400) or hex (#38bdf8)
  textColor?: string;
}

interface ZoneDistributionChartProps {
  zones: ZoneData[];
  type: 'hr' | 'pace';
  totalSeconds?: number; // deprecated, zones already contain seconds
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

// Map hex colors to text color classes for zone labels
const hexToTextColor: Record<string, string> = {
  '#5ea8c8': 'text-sky-400',
  '#0ea5e9': 'text-sky-500',
  '#6366f1': 'text-indigo-400',
  '#8b5cf6': 'text-violet-400',
  '#e04545': 'text-red-400',
};

function isHex(color: string) {
  return color.startsWith('#');
}

export function ZoneDistributionChart({ zones, type }: ZoneDistributionChartProps) {
  const chartData = useMemo(() => {
    return zones.filter(z => z.seconds > 0);
  }, [zones]);

  if (!chartData.length) return null;

  const Icon = type === 'hr' ? Heart : Activity;
  const title = type === 'hr' ? 'Heart Rate Zones' : 'Pace Zones';

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-textPrimary flex items-center gap-2 mb-4">
        <Icon className={`w-5 h-5 ${type === 'hr' ? 'text-red-500' : 'text-dream-500'}`} />
        {title}
      </h2>

      {/* Horizontal stacked bar */}
      <div className="mb-4">
        <div className="flex h-8 rounded-lg overflow-hidden">
          {chartData.map((zone) => (
            <div
              key={zone.zone}
              className={`${isHex(zone.color) ? '' : zone.color} transition-all hover:opacity-90 relative group`}
              style={{
                width: `${zone.percentage}%`,
                ...(isHex(zone.color) ? { backgroundColor: zone.color } : {}),
              }}
              title={`${zone.name}: ${zone.percentage}%`}
            >
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
          const textColor = zone.textColor || (isHex(zone.color) ? hexToTextColor[zone.color] : undefined) || 'text-textSecondary';
          return (
            <div key={zone.zone} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded ${isHex(zone.color) ? '' : zone.color}`}
                  style={isHex(zone.color) ? { backgroundColor: zone.color } : undefined}
                />
                <span className="text-sm font-medium text-textSecondary">
                  {zone.name}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-textSecondary">{formatTime(zone.seconds)}</span>
                <span className={`font-medium ${textColor} min-w-[3rem] text-right`}>
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
          <span className="text-textSecondary">
            {type === 'hr' ? 'Time in Z4+:' : 'Time in Tempo+:'}
          </span>
          <span className="ml-2 font-medium text-textSecondary">
            {type === 'hr'
              ? chartData.filter(z => z.zone >= 4).reduce((sum, z) => sum + z.percentage, 0)
              : chartData.filter(z => z.zone >= 5).reduce((sum, z) => sum + z.percentage, 0)
            }%
          </span>
        </div>
      </div>
    </div>
  );
}
