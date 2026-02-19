'use server';

import { db, vdotHistory, raceResults, userSettings } from '@/lib/db';
import { eq, desc, asc, and, gte, lte } from 'drizzle-orm';
import { getActiveProfileId } from '@/lib/profile-server';
import { calculateVDOT, calculatePaceZones } from '@/lib/training/vdot-calculator';
import {
  MONTHLY_VDOT_START_DATE,
} from '@/lib/vdot-history-config';

export interface VdotHistoryEntry {
  id: number;
  date: string;
  vdot: number;
  source: 'race' | 'time_trial' | 'workout' | 'estimate' | 'manual';
  sourceId?: number;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
}

function toIsoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function toMonthStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(1);
  return toIsoDate(d);
}

function addMonth(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(1);
  return toIsoDate(d);
}

function mapVdotEntry(entry: typeof vdotHistory.$inferSelect): VdotHistoryEntry {
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
  if (!profileId) {
    throw new Error('No active profile for VDOT history');
  }

  const rawDate = options?.date ?? toIsoDate(new Date());
  const monthDate = toMonthStart(rawDate);
  const nowIso = new Date().toISOString();

  const existingMonthEntry = await db.query.vdotHistory.findFirst({
    where: and(
      eq(vdotHistory.profileId, profileId),
      eq(vdotHistory.date, monthDate)
    ),
    orderBy: [desc(vdotHistory.createdAt)],
  });

  const roundedVdot = Math.round(vdot * 10) / 10;

  if (existingMonthEntry) {
    const [updated] = await db.update(vdotHistory)
      .set({
        vdot: roundedVdot,
        source,
        sourceId: options?.sourceId,
        confidence: options?.confidence ?? 'medium',
        notes: options?.notes,
      })
      .where(eq(vdotHistory.id, existingMonthEntry.id))
      .returning();

    return mapVdotEntry(updated);
  }

  const [entry] = await db
    .insert(vdotHistory)
    .values({
      profileId,
      date: monthDate,
      vdot: roundedVdot,
      source,
      sourceId: options?.sourceId,
      confidence: options?.confidence ?? 'medium',
      notes: options?.notes,
      createdAt: nowIso,
    })
    .returning();

  return mapVdotEntry(entry);
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
  if (!profileId) {
    console.warn('[getVdotHistory] No active profile');
    return [];
  }

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

  return entries.map(mapVdotEntry);
}

/**
 * Rebuild vdot_history into monthly snapshots (one point per month).
 * Flat months are intentionally retained so timeline charts draw flat segments.
 */
export async function rebuildMonthlyVdotHistory(options?: {
  profileId?: number;
  startDate?: string;
  endDate?: string;
}): Promise<{
  profileId: number | null;
  startDate: string;
  endDate: string;
  previousEntries: number;
  rebuiltEntries: number;
}> {
  const pid = options?.profileId ?? await getActiveProfileId();
  if (!pid) {
    return {
      profileId: null,
      startDate: options?.startDate ?? MONTHLY_VDOT_START_DATE,
      endDate: options?.endDate ?? toIsoDate(new Date()),
      previousEntries: 0,
      rebuiltEntries: 0,
    };
  }

  const startMonth = toMonthStart(options?.startDate ?? MONTHLY_VDOT_START_DATE);
  const endMonth = toMonthStart(options?.endDate ?? toIsoDate(new Date()));

  const rawEntries = await db.query.vdotHistory.findMany({
    where: eq(vdotHistory.profileId, pid),
    orderBy: [asc(vdotHistory.date), asc(vdotHistory.createdAt)],
  });

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, pid),
  });

  const monthlyLatest = new Map<string, typeof rawEntries[number]>();
  for (const entry of rawEntries) {
    monthlyLatest.set(toMonthStart(entry.date), entry);
  }

  let carryVdot: number | null = null;
  let carrySource: VdotHistoryEntry['source'] = 'estimate';
  let carrySourceId: number | undefined;
  let carryConfidence: VdotHistoryEntry['confidence'] = 'medium';
  let carryNotes: string | undefined;

  const firstKnown = rawEntries[0];
  if (firstKnown) {
    carryVdot = firstKnown.vdot;
    carrySource = firstKnown.source as VdotHistoryEntry['source'];
    carrySourceId = firstKnown.sourceId ?? undefined;
    carryConfidence = (firstKnown.confidence ?? 'medium') as VdotHistoryEntry['confidence'];
    carryNotes = firstKnown.notes ?? undefined;
  } else if (settings?.vdot && settings.vdot >= 15 && settings.vdot <= 85) {
    carryVdot = settings.vdot;
    carrySource = 'manual';
    carryConfidence = 'medium';
    carryNotes = 'monthly baseline from settings';
  }

  const nowIso = new Date().toISOString();
  const rebuiltRows: Array<typeof vdotHistory.$inferInsert> = [];
  let cursor = startMonth;

  while (cursor <= endMonth) {
    const monthEntry = monthlyLatest.get(cursor);

    if (monthEntry) {
      carryVdot = Math.round(monthEntry.vdot * 10) / 10;
      carrySource = monthEntry.source as VdotHistoryEntry['source'];
      carrySourceId = monthEntry.sourceId ?? undefined;
      carryConfidence = (monthEntry.confidence ?? 'medium') as VdotHistoryEntry['confidence'];
      carryNotes = monthEntry.notes ?? undefined;
    }

    if (carryVdot != null) {
      rebuiltRows.push({
        profileId: pid,
        date: cursor,
        vdot: carryVdot,
        source: carrySource,
        sourceId: carrySourceId ?? null,
        confidence: carryConfidence,
        notes: monthEntry ? (monthEntry.notes ?? carryNotes) : (carryNotes ?? 'monthly carry-forward'),
        createdAt: nowIso,
      });
    }

    cursor = addMonth(cursor);
  }

  await db.delete(vdotHistory).where(eq(vdotHistory.profileId, pid));
  if (rebuiltRows.length > 0) {
    await db.insert(vdotHistory).values(rebuiltRows);
  }

  return {
    profileId: pid,
    startDate: startMonth,
    endDate: endMonth,
    previousEntries: rawEntries.length,
    rebuiltEntries: rebuiltRows.length,
  };
}

/**
 * Get the latest VDOT entry
 */
export async function getLatestVdot(profileId?: number): Promise<VdotHistoryEntry | null> {
  const pid = profileId ?? await getActiveProfileId();
  if (!pid) {
    console.warn('[getLatestVdot] No active profile');
    return null;
  }

  const entry = await db.query.vdotHistory.findFirst({
    where: eq(vdotHistory.profileId, pid),
    orderBy: [desc(vdotHistory.date)],
  });

  if (!entry) return null;

  return mapVdotEntry(entry);
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
 * Recalculate VDOT from all race results.
 * Finds the best (highest) VDOT from races, clamps to 15-85, updates settings + pace zones.
 */
export async function recalculateVdotFromRaces(profileId?: number): Promise<{
  bestVdot: number | null;
  raceCount: number;
  updated: boolean;
}> {
  const pid = profileId ?? await getActiveProfileId();
  if (!pid) return { bestVdot: null, raceCount: 0, updated: false };

  // Get all race results for this profile
  const races = await db.query.raceResults.findMany({
    where: eq(raceResults.profileId, pid),
  });

  if (races.length === 0) {
    return { bestVdot: null, raceCount: 0, updated: false };
  }

  // Recalculate VDOT for each race and find the best
  let bestVdot = 0;
  for (const race of races) {
    const vdot = calculateVDOT(race.distanceMeters, race.finishTimeSeconds);
    // Clamp to valid range
    const clamped = Math.max(15, Math.min(85, vdot));
    if (clamped > bestVdot) {
      bestVdot = clamped;
    }
  }

  if (bestVdot < 15) {
    return { bestVdot: null, raceCount: races.length, updated: false };
  }

  // Calculate pace zones from the best VDOT
  const zones = calculatePaceZones(bestVdot);

  // Update user settings with the recalculated VDOT and pace zones
  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.profileId, pid),
  });

  if (settings) {
    await db.update(userSettings)
      .set({
        vdot: bestVdot,
        easyPaceSeconds: zones.easy,
        tempoPaceSeconds: zones.tempo,
        thresholdPaceSeconds: zones.threshold,
        intervalPaceSeconds: zones.interval,
        marathonPaceSeconds: zones.marathon,
        halfMarathonPaceSeconds: zones.halfMarathon,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(userSettings.id, settings.id));
  }

  return { bestVdot, raceCount: races.length, updated: true };
}
