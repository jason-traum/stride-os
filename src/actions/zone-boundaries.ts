'use server';

import { getSettings } from './settings';
import { resolveZones, type ZoneBoundaries } from '@/lib/training/effort-classifier';
import { formatPace } from '@/lib/utils';
import { getActiveProfileId } from '@/lib/profile-server';

export interface ZoneBoundaryDisplay {
  zone: string;
  paceRange: string;
  color: string;
  paceMin: number;
  paceMax: number;
}

export interface CurrentZoneBoundariesResult {
  zones: ZoneBoundaryDisplay[];
  vdot: number | null;
  source: 'vdot' | 'manual' | 'none';
}

/**
 * Get the current zone boundaries used by the effort classifier.
 * Returns formatted display data showing each zone's pace range.
 */
export async function getCurrentZoneBoundaries(): Promise<CurrentZoneBoundariesResult | null> {
  const profileId = await getActiveProfileId();
  const settings = await getSettings(profileId);

  if (!settings) return null;

  const hasVdot = settings.vdot != null && settings.vdot > 0;
  const hasManualPaces = settings.easyPaceSeconds != null && settings.easyPaceSeconds > 0;

  if (!hasVdot && !hasManualPaces) return null;

  // Resolve zones using the same logic as the classifier
  const boundaries: ZoneBoundaries = resolveZones([], {
    vdot: settings.vdot,
    easyPace: settings.easyPaceSeconds,
    tempoPace: settings.tempoPaceSeconds,
    thresholdPace: settings.thresholdPaceSeconds,
    intervalPace: settings.intervalPaceSeconds,
    marathonPace: settings.marathonPaceSeconds,
  });

  // Build display zones with pace ranges
  // Each zone is: pace >= boundary → classified as that zone
  // So the range for "easy" is: [steady boundary, easy boundary]
  const zones: ZoneBoundaryDisplay[] = [
    {
      zone: 'Easy',
      paceRange: `${formatPace(boundaries.easy)} + slower`,
      color: 'bg-sky-400 dark:bg-sky-500',
      paceMin: boundaries.easy,
      paceMax: boundaries.easy + 60,
    },
    {
      zone: 'Steady',
      paceRange: `${formatPace(boundaries.steady)} – ${formatPace(boundaries.easy - 1)}`,
      color: 'bg-sky-500 dark:bg-sky-600',
      paceMin: boundaries.steady,
      paceMax: boundaries.easy - 1,
    },
    {
      zone: 'Marathon',
      paceRange: `${formatPace(boundaries.marathon)} – ${formatPace(boundaries.steady - 1)}`,
      color: 'bg-blue-500 dark:bg-blue-600',
      paceMin: boundaries.marathon,
      paceMax: boundaries.steady - 1,
    },
    {
      zone: 'Tempo',
      paceRange: `${formatPace(boundaries.tempo)} – ${formatPace(boundaries.marathon - 1)}`,
      color: 'bg-indigo-500 dark:bg-indigo-600',
      paceMin: boundaries.tempo,
      paceMax: boundaries.marathon - 1,
    },
    {
      zone: 'Threshold',
      paceRange: `${formatPace(boundaries.interval)} – ${formatPace(boundaries.tempo - 1)}`,
      color: 'bg-violet-500 dark:bg-violet-600',
      paceMin: boundaries.interval,
      paceMax: boundaries.tempo - 1,
    },
    {
      zone: 'Interval',
      paceRange: `${formatPace(boundaries.interval - 1)} + faster`,
      color: 'bg-red-500 dark:bg-red-600',
      paceMin: boundaries.interval - 60,
      paceMax: boundaries.interval - 1,
    },
  ];

  return {
    zones,
    vdot: hasVdot ? settings.vdot : null,
    source: hasVdot ? 'vdot' : 'manual',
  };
}
