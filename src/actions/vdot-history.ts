'use server';

import { db, vdotHistory } from '@/lib/db';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';

export interface VdotHistoryEntry {
  id: number;
  date: string;
  vdot: number;
  source: 'race' | 'time_trial' | 'workout' | 'estimate' | 'manual';
  sourceId?: number;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

/**
 * Record a new VDOT entry
 */
export async function recordVdotEntry(
  vdot: number,
  source: VdotHistoryEntry['source'],
  options?: {
    date?: string;
    sourceId?: number;
    confidence?: VdotHistoryEntry['confidence'];
    notes?: string;
    profileId?: number;
  }
): Promise<VdotHistoryEntry> {
  // Reject out-of-range VDOT values
  if (vdot < 15 || vdot > 85) {
    throw new Error('VDOT must be between 15 and 85');
  }

  const profileId = options?.profileId ?? await getActiveProfileId();
  const date = options?.date ?? new Date().toISOString().split('T')[0];

  const [entry] = await db
    .insert(vdotHistory)
    .values({
      profileId,
      date,
      vdot,
      source,
      sourceId: options?.sourceId,
      confidence: options?.confidence ?? 'medium',
      notes: options?.notes,
      createdAt: new Date().toISOString(),
    })
    .returning();

  return {
    id: entry.id,
    date: entry.date,
    vdot: entry.vdot,
    source: entry.source as VdotHistoryEntry['source'],
    sourceId: entry.sourceId ?? undefined,
    confidence: (entry.confidence ?? 'medium') as VdotHistoryEntry['confidence'],
    notes: entry.notes ?? undefined,
  };
}

/**
 * Get VDOT history for timeline display
 */
export async function getVdotHistory(
  options?: {
    limit?: number;
    startDate?: string;
    endDate?: string;
    profileId?: number;
  }
): Promise<VdotHistoryEntry[]> {
  const profileId = options?.profileId ?? await getActiveProfileId();
  if (!profileId) return [];

  const conditions = [eq(vdotHistory.profileId, profileId)];

  if (options?.startDate) {
    conditions.push(gte(vdotHistory.date, options.startDate));
  }

  if (options?.endDate) {
    conditions.push(lte(vdotHistory.date, options.endDate));
  }

  const entries = await db.query.vdotHistory.findMany({
    where: and(...conditions),
    orderBy: [desc(vdotHistory.date)],
    limit: options?.limit ?? 50,
  });

  return entries.map(entry => ({
    id: entry.id,
    date: entry.date,
    vdot: entry.vdot,
    source: entry.source as VdotHistoryEntry['source'],
    sourceId: entry.sourceId ?? undefined,
    confidence: (entry.confidence ?? 'medium') as VdotHistoryEntry['confidence'],
    notes: entry.notes ?? undefined,
  }));
}

/**
 * Get the latest VDOT entry
 */
export async function getLatestVdot(profileId?: number): Promise<VdotHistoryEntry | null> {
  const pid = profileId ?? await getActiveProfileId();
  if (!pid) return null;

  const entry = await db.query.vdotHistory.findFirst({
    where: eq(vdotHistory.profileId, pid),
    orderBy: [desc(vdotHistory.date)],
  });

  if (!entry) return null;

  return {
    id: entry.id,
    date: entry.date,
    vdot: entry.vdot,
    source: entry.source as VdotHistoryEntry['source'],
    sourceId: entry.sourceId ?? undefined,
    confidence: (entry.confidence ?? 'medium') as VdotHistoryEntry['confidence'],
    notes: entry.notes ?? undefined,
  };
}

/**
 * Calculate VDOT change over a period
 */
export async function getVdotTrend(
  days: number = 90,
  profileId?: number
): Promise<{
  current: number | null;
  previous: number | null;
  change: number | null;
  changePercent: number | null;
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
}> {
  const pid = profileId ?? await getActiveProfileId();
  if (!pid) {
    return { current: null, previous: null, change: null, changePercent: null, trend: 'unknown' };
  }

  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const midDate = new Date(now.getTime() - (days / 2) * 24 * 60 * 60 * 1000);

  // Get recent entries (last half of period)
  const recentEntries = await db.query.vdotHistory.findMany({
    where: and(
      eq(vdotHistory.profileId, pid),
      gte(vdotHistory.date, midDate.toISOString().split('T')[0])
    ),
    orderBy: [desc(vdotHistory.date)],
  });

  // Get older entries (first half of period)
  const olderEntries = await db.query.vdotHistory.findMany({
    where: and(
      eq(vdotHistory.profileId, pid),
      gte(vdotHistory.date, startDate.toISOString().split('T')[0]),
      lte(vdotHistory.date, midDate.toISOString().split('T')[0])
    ),
    orderBy: [desc(vdotHistory.date)],
  });

  const current = recentEntries.length > 0
    ? recentEntries.reduce((sum, e) => sum + e.vdot, 0) / recentEntries.length
    : null;

  const previous = olderEntries.length > 0
    ? olderEntries.reduce((sum, e) => sum + e.vdot, 0) / olderEntries.length
    : null;

  if (current === null || previous === null) {
    return {
      current: current ? Math.round(current * 10) / 10 : null,
      previous: previous ? Math.round(previous * 10) / 10 : null,
      change: null,
      changePercent: null,
      trend: 'unknown',
    };
  }

  const change = current - previous;
  const changePercent = (change / previous) * 100;

  let trend: 'improving' | 'stable' | 'declining';
  if (change > 0.5) {
    trend = 'improving';
  } else if (change < -0.5) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  return {
    current: Math.round(current * 10) / 10,
    previous: Math.round(previous * 10) / 10,
    change: Math.round(change * 10) / 10,
    changePercent: Math.round(changePercent * 10) / 10,
    trend,
  };
}

/**
 * Get VDOT at specific race distances based on current VDOT
 */
export function getEquivalentTimes(vdot: number): {
  distance: string;
  time: string;
  pacePerMile: string;
}[] {
  // VDOT time predictions (based on Daniels tables)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _predictions = [
    { distance: '5K', meters: 5000, factor: 0.000104 },
    { distance: '10K', meters: 10000, factor: 0.000104 },
    { distance: 'Half Marathon', meters: 21097.5, factor: 0.000104 },
    { distance: 'Marathon', meters: 42195, factor: 0.000104 },
  ];

  // Approximate time calculation based on VDOT
  // Time = D × e^(1.5 × ln(D/M) - V)
  // Simplified for common distances
  const times: Record<string, number> = {
    '5K': Math.round(29 * 60 * Math.pow(2, (40 - vdot) / 10)),
    '10K': Math.round(60.5 * 60 * Math.pow(2, (40 - vdot) / 10)),
    'Half Marathon': Math.round(133 * 60 * Math.pow(2, (40 - vdot) / 10)),
    'Marathon': Math.round(280 * 60 * Math.pow(2, (40 - vdot) / 10)),
  };

  const distances: Record<string, number> = {
    '5K': 3.107,
    '10K': 6.214,
    'Half Marathon': 13.109,
    'Marathon': 26.219,
  };

  return Object.entries(times).map(([distance, seconds]) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const paceSeconds = Math.round(seconds / distances[distance]);
    const paceMin = Math.floor(paceSeconds / 60);
    const paceSec = paceSeconds % 60;

    return {
      distance,
      time: hours > 0
        ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${minutes}:${secs.toString().padStart(2, '0')}`,
      pacePerMile: `${paceMin}:${paceSec.toString().padStart(2, '0')}`,
    };
  });
}
