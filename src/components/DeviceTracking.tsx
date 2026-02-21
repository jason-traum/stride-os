'use client';

import { useState, useEffect } from 'react';
import { Watch, Loader2 } from 'lucide-react';
import { AnimatedSection } from '@/components/AnimatedSection';
import { formatPace, parseLocalDate } from '@/lib/utils';
import {
  getDeviceTrackingData,
  type DeviceTrackingResult,
} from '@/actions/device-tracking';

// ── Helpers ──────────────────────────────────────────────────────────

/** Generate a stable color for a device based on its index */
const DEVICE_COLORS = [
  '#38bdf8', // sky-400
  '#a78bfa', // violet-400
  '#34d399', // emerald-400
  '#fb923c', // orange-400
  '#f472b6', // pink-400
  '#facc15', // yellow-400
  '#2dd4bf', // teal-400
  '#818cf8', // indigo-400
];

function getDeviceColor(index: number): string {
  return DEVICE_COLORS[index % DEVICE_COLORS.length];
}

function formatDate(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// ── Main Component ───────────────────────────────────────────────────

export function DeviceTrackingCard() {
  const [data, setData] = useState<DeviceTrackingResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDeviceTrackingData().then((result) => {
      if (result.success) setData(result.data);
      setLoading(false);
    });
  }, []);

  // Total workouts across all devices (for percentage bar)
  const totalWithDevice = data?.totalWorkoutsWithDevice ?? 0;

  if (loading) {
    return (
      <AnimatedSection>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
            <Watch className="w-5 h-5 text-dream-500" />
            Devices
          </h2>
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-textTertiary" />
          </div>
        </div>
      </AnimatedSection>
    );
  }

  if (!data || data.devices.length === 0) {
    return (
      <AnimatedSection>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
            <Watch className="w-5 h-5 text-dream-500" />
            Devices
          </h2>
          <p className="text-sm text-textTertiary">
            No device data yet. Device names are captured from Strava activity details.
          </p>
        </div>
      </AnimatedSection>
    );
  }

  return (
    <AnimatedSection>
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Watch className="w-5 h-5 text-dream-500" />
          <h3 className="font-semibold text-textPrimary">Devices</h3>
          <span className="text-xs text-textTertiary ml-auto">
            {data.devices.length} device{data.devices.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Usage distribution bar */}
        {data.devices.length > 1 && (
          <div className="mb-4">
            <div className="h-5 rounded-full overflow-hidden flex">
              {data.devices.map((device, i) => {
                const pct = totalWithDevice > 0
                  ? (device.workoutCount / totalWithDevice) * 100
                  : 0;
                return (
                  <div
                    key={device.deviceName}
                    className="h-full first:rounded-l-full last:rounded-r-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: getDeviceColor(i),
                      minWidth: pct > 0 ? '4px' : '0',
                    }}
                    title={`${device.deviceName}: ${device.workoutCount} workouts (${Math.round(pct)}%)`}
                  />
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {data.devices.map((device, i) => {
                const pct = totalWithDevice > 0
                  ? Math.round((device.workoutCount / totalWithDevice) * 100)
                  : 0;
                return (
                  <div key={device.deviceName} className="flex items-center gap-1.5">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getDeviceColor(i) }}
                    />
                    <span className="text-xs text-textSecondary">
                      {device.deviceName} <span className="text-textTertiary">({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Per-device stats */}
        <div className="space-y-3">
          {data.devices.map((device, i) => (
            <div
              key={device.deviceName}
              className="p-3 bg-bgTertiary rounded-lg"
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getDeviceColor(i) }}
                />
                <span className="text-sm font-medium text-textPrimary truncate">
                  {device.deviceName}
                </span>
                <span className="text-xs text-textTertiary ml-auto flex-shrink-0">
                  {device.workoutCount} run{device.workoutCount !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-textTertiary">Miles</span>
                  <p className="font-semibold text-textPrimary">{device.totalMiles.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-textTertiary">Avg Pace</span>
                  <p className="font-semibold text-textPrimary">
                    {device.avgPaceSeconds ? `${formatPace(device.avgPaceSeconds)}/mi` : '--'}
                  </p>
                </div>
                <div>
                  <span className="text-textTertiary">Avg HR</span>
                  <p className="font-semibold text-textPrimary">
                    {device.avgHr ? `${device.avgHr} bpm` : '--'}
                  </p>
                </div>
                <div>
                  <span className="text-textTertiary">Active</span>
                  <p className="font-semibold text-textPrimary">
                    {formatDate(device.firstUsed)} &ndash; {formatDate(device.lastUsed)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer note if workouts without device data exist */}
        {data.totalWorkoutsWithoutDevice > 0 && (
          <p className="text-xs text-textTertiary mt-3">
            {data.totalWorkoutsWithoutDevice} workout{data.totalWorkoutsWithoutDevice !== 1 ? 's' : ''} without
            device info (manual entries or older syncs).
          </p>
        )}
      </div>
    </AnimatedSection>
  );
}
