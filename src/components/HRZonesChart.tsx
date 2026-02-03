'use client';

import { useState, useEffect } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { getWorkoutHRZones } from '@/actions/strava';

interface HRZonesChartProps {
  workoutId: number;
  stravaActivityId: number | null;
}

// Format seconds to mm:ss or h:mm:ss
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function HRZonesChart({ workoutId, stravaActivityId }: HRZonesChartProps) {
  const [zones, setZones] = useState<
    { zone: number; name: string; seconds: number; percentage: number; color: string }[] | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!stravaActivityId) return;

    const fetchZones = async () => {
      setLoading(true);
      setError(null);

      const result = await getWorkoutHRZones(workoutId);

      if (result.success && result.zones) {
        setZones(result.zones);
      } else {
        setError(result.error || 'Failed to load HR zones');
      }

      setLoading(false);
    };

    fetchZones();
  }, [workoutId, stravaActivityId]);

  // Don't show anything for non-Strava workouts
  if (!stravaActivityId) {
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500" />
          HR Zones
        </h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500" />
          HR Zones
        </h2>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    );
  }

  if (!zones || zones.length === 0) {
    return null;
  }

  // Calculate total time for the stacked bar
  const totalSeconds = zones.reduce((sum, z) => sum + z.seconds, 0);

  // Find the dominant zone
  const dominantZone = zones.reduce((prev, curr) =>
    curr.seconds > prev.seconds ? curr : prev
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
      <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Heart className="w-5 h-5 text-red-500" />
        HR Zones
        <span className="text-xs font-normal text-slate-500 ml-2">
          Mostly Z{dominantZone.zone} ({dominantZone.name})
        </span>
      </h2>

      {/* Stacked horizontal bar */}
      <div className="flex h-8 rounded-lg overflow-hidden mb-4">
        {zones.map((zone) => {
          if (zone.seconds === 0) return null;
          const widthPercent = (zone.seconds / totalSeconds) * 100;

          return (
            <div
              key={zone.zone}
              className={`${zone.color} flex items-center justify-center text-white text-xs font-medium transition-all`}
              style={{ width: `${widthPercent}%`, minWidth: widthPercent > 5 ? '24px' : '0' }}
              title={`Z${zone.zone} ${zone.name}: ${formatDuration(zone.seconds)} (${zone.percentage}%)`}
            >
              {widthPercent > 8 && `Z${zone.zone}`}
            </div>
          );
        })}
      </div>

      {/* Zone breakdown table */}
      <div className="space-y-2">
        {zones.map((zone) => (
          <div key={zone.zone} className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded ${zone.color}`} />
            <span className="text-sm text-slate-600 w-24">
              Z{zone.zone} {zone.name}
            </span>
            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full ${zone.color} transition-all`}
                style={{ width: `${zone.percentage}%` }}
              />
            </div>
            <span className="text-sm text-slate-500 w-16 text-right">
              {formatDuration(zone.seconds)}
            </span>
            <span className="text-sm font-medium text-slate-700 w-12 text-right">
              {zone.percentage}%
            </span>
          </div>
        ))}
      </div>

      {/* Training distribution insight */}
      {zones[0].percentage + zones[1].percentage > 70 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            <span className="font-medium text-green-600">Polarized training:</span> {zones[0].percentage + zones[1].percentage}% in Z1-Z2
          </p>
        </div>
      )}
      {zones[2].percentage > 40 && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            <span className="font-medium text-yellow-600">Threshold focus:</span> {zones[2].percentage + zones[3].percentage}% in Z3-Z4
          </p>
        </div>
      )}
    </div>
  );
}
