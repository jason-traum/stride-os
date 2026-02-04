'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface TrainingLoadBarProps {
  currentLoad: number;
  optimalMin: number;
  optimalMax: number;
  previousLoad: number;
  percentChange: number | null;
}

export function TrainingLoadBar({
  currentLoad,
  optimalMin,
  optimalMax,
  previousLoad,
  percentChange,
}: TrainingLoadBarProps) {
  // Calculate positions on the gradient bar
  const { markerPosition, status, statusColor, statusLabel } = useMemo(() => {
    // Bar ranges: 0-50% is low (blue), 50-80% is optimal (green), 80-100% is high (red)
    // Map currentLoad to this scale

    // Define the full range (0 to 150% of optimal max)
    const maxRange = optimalMax * 1.5;

    // Calculate where current load falls
    let position: number;
    if (currentLoad <= 0) {
      position = 0;
    } else if (currentLoad >= maxRange) {
      position = 100;
    } else {
      position = (currentLoad / maxRange) * 100;
    }

    // Determine status
    let stat: 'low' | 'optimal' | 'high';
    let color: string;
    let label: string;

    if (currentLoad < optimalMin) {
      stat = 'low';
      color = 'text-teal-600';
      label = 'Below Optimal';
    } else if (currentLoad > optimalMax) {
      stat = 'high';
      color = 'text-rose-600';
      label = 'Above Optimal';
    } else {
      stat = 'optimal';
      color = 'text-stone-700';
      label = 'Optimal Load';
    }

    return {
      markerPosition: Math.min(100, Math.max(0, position)),
      status: stat,
      statusColor: color,
      statusLabel: label,
    };
  }, [currentLoad, optimalMin, optimalMax]);

  // Calculate optimal zone position on the bar
  const optimalZone = useMemo(() => {
    const maxRange = optimalMax * 1.5;
    const start = (optimalMin / maxRange) * 100;
    const end = (optimalMax / maxRange) * 100;
    return { start, width: end - start };
  }, [optimalMin, optimalMax]);

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-stone-900">Training Load</h3>
          <p className="text-xs text-stone-500">7-day rolling load</p>
        </div>
        <div className="text-right">
          <div className={cn('text-2xl font-bold', statusColor)}>{currentLoad}</div>
          <div className={cn('text-xs font-medium', statusColor)}>{statusLabel}</div>
        </div>
      </div>

      {/* Gradient bar */}
      <div className="relative h-8 rounded-full overflow-hidden bg-gradient-to-r from-teal-400 via-green-400 to-red-400">
        {/* Optimal zone highlight */}
        <div
          className="absolute top-0 bottom-0 bg-green-500/30 border-x-2 border-green-600/50"
          style={{
            left: `${optimalZone.start}%`,
            width: `${optimalZone.width}%`,
          }}
        />

        {/* Current load marker */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-stone-900 shadow-lg transition-all duration-500"
          style={{ left: `${markerPosition}%`, transform: 'translateX(-50%)' }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-stone-900 rounded-full border-2 border-white shadow" />
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-stone-900 rounded-full border-2 border-white shadow" />
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between mt-2 text-xs text-stone-500">
        <span>Low</span>
        <span className="text-green-600 font-medium">
          Optimal ({optimalMin}-{optimalMax})
        </span>
        <span>High</span>
      </div>

      {/* Week over week comparison */}
      {percentChange !== null && (
        <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between text-sm">
          <span className="text-stone-500">vs. last week:</span>
          <span className={cn('font-medium', percentChange >= 0 ? 'text-teal-600' : 'text-teal-600')}>
            {percentChange >= 0 ? '+' : ''}{percentChange}%
            <span className="text-stone-400 font-normal ml-1">
              ({previousLoad} load)
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
