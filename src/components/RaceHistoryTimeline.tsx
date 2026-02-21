'use client';

import { useState, useMemo } from 'react';
import {
  Trophy,
  Calendar,
  Clock,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Target,
  Award,
  CheckCircle,
  Zap,
} from 'lucide-react';
import { cn, parseLocalDate, formatPace } from '@/lib/utils';
import { formatRaceTime } from '@/lib/race-utils';
import { RACE_DISTANCES, getDistanceLabel } from '@/lib/training';
import Link from 'next/link';
import type { RaceResultWithContext } from '@/actions/races';
import type { BestEffortTimelineEntry } from '@/actions/personal-records';

type TimelineEntry =
  | { type: 'race'; data: RaceResultWithContext }
  | { type: 'effort'; data: BestEffortTimelineEntry };

interface RaceHistoryTimelineProps {
  results: RaceResultWithContext[];
  bestEfforts?: BestEffortTimelineEntry[];
  onEditResult: (result: RaceResultWithContext) => void;
  onDeleteResult: (id: number) => void;
}

// Map BestEffortTimelineEntry distanceLabel to RACE_DISTANCES key
const effortLabelToDistanceKey: Record<string, string> = {
  '5K': '5K',
  '10K': '10K',
  'Half Marathon': 'half_marathon',
  'Marathon': 'marathon',
  '400m': '400m',
  '1K': '1K',
  '1 Mile': '1mi',
};

export function RaceHistoryTimeline({
  results,
  bestEfforts = [],
  onEditResult,
  onDeleteResult,
}: RaceHistoryTimelineProps) {
  const [distanceFilter, setDistanceFilter] = useState<string>('all');

  // PR-filter efforts: only keep efforts that were PRs when set (chronological high-water-mark)
  const prEfforts = useMemo(() => {
    if (bestEfforts.length === 0) return [];

    // Group by distance
    const byDistance = new Map<string, BestEffortTimelineEntry[]>();
    for (const e of bestEfforts) {
      const list = byDistance.get(e.distanceLabel) || [];
      list.push(e);
      byDistance.set(e.distanceLabel, list);
    }

    const result: BestEffortTimelineEntry[] = [];

    byDistance.forEach((efforts) => {
      // Sort oldest first for high-water-mark scan
      const sorted = [...efforts].sort((a, b) => a.date.localeCompare(b.date));
      let bestTime = Infinity;
      for (const e of sorted) {
        if (e.timeSeconds < bestTime) {
          bestTime = e.timeSeconds;
          result.push(e);
        }
      }
    });

    return result;
  }, [bestEfforts]);

  // Build unified timeline
  const allEntries = useMemo((): TimelineEntry[] => {
    const entries: TimelineEntry[] = [];

    for (const r of results) {
      entries.push({ type: 'race', data: r });
    }
    for (const e of prEfforts) {
      entries.push({ type: 'effort', data: e });
    }

    // Sort by date descending (newest first)
    entries.sort((a, b) => {
      const dateA = a.type === 'race' ? a.data.date : a.data.date;
      const dateB = b.type === 'race' ? b.data.date : b.data.date;
      return dateB.localeCompare(dateA);
    });

    return entries;
  }, [results, prEfforts]);

  // Get canonical distance key for an entry
  const getEntryDistanceKey = (entry: TimelineEntry): string => {
    if (entry.type === 'race') return entry.data.distanceLabel;
    return effortLabelToDistanceKey[entry.data.distanceLabel] || entry.data.distanceLabel;
  };

  // Derive unique distances from both sources
  const uniqueDistances = useMemo(() => {
    const labels = new Set<string>();
    for (const r of results) labels.add(r.distanceLabel);
    for (const e of prEfforts) {
      const key = effortLabelToDistanceKey[e.distanceLabel] || e.distanceLabel;
      labels.add(key);
    }
    // Order by RACE_DISTANCES order, then append any extras
    const distOrder = Object.keys(RACE_DISTANCES);
    const ordered = distOrder.filter(d => labels.has(d));
    // Add non-RACE_DISTANCES entries (like 400m, 1K, 1mi)
    labels.forEach(label => {
      if (!ordered.includes(label)) ordered.push(label);
    });
    return ordered;
  }, [results, prEfforts]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    if (distanceFilter === 'all') return allEntries;
    return allEntries.filter(entry => getEntryDistanceKey(entry) === distanceFilter);
  }, [allEntries, distanceFilter]);

  // Unified PR computation: true fastest per distance across both sources
  const prSet = useMemo(() => {
    const prs = new Set<string>(); // entry IDs (race id or effort id)
    const bestByDist = new Map<string, number>(); // distance key -> best time

    // Sort oldest-first
    const sorted = [...allEntries].sort((a, b) => {
      const dateA = a.type === 'race' ? a.data.date : a.data.date;
      const dateB = b.type === 'race' ? b.data.date : b.data.date;
      return dateA.localeCompare(dateB);
    });

    for (const entry of sorted) {
      const distKey = getEntryDistanceKey(entry);
      const time = entry.type === 'race' ? entry.data.finishTimeSeconds : entry.data.timeSeconds;
      const entryId = entry.type === 'race' ? `race-${entry.data.id}` : entry.data.id;

      const current = bestByDist.get(distKey);
      if (current === undefined || time < current) {
        bestByDist.set(distKey, time);
        prs.add(entryId);
      }
    }

    // Only keep the actual current PR per distance (the latest-set best)
    // Walk forward again and track which is the current best
    const currentPr = new Map<string, string>(); // dist -> entryId of current best
    for (const entry of sorted) {
      const distKey = getEntryDistanceKey(entry);
      const time = entry.type === 'race' ? entry.data.finishTimeSeconds : entry.data.timeSeconds;
      const entryId = entry.type === 'race' ? `race-${entry.data.id}` : entry.data.id;

      const currentBest = bestByDist.get(distKey);
      if (time === currentBest && prs.has(entryId)) {
        currentPr.set(distKey, entryId);
      }
    }

    return { allTimePrs: prs, currentPr };
  }, [allEntries]);

  // VDOT deltas: per-distance, comparing to previous entry of same distance from either source
  const vdotDeltas = useMemo(() => {
    const deltas = new Map<string, number>(); // entry id -> delta
    const lastVdotByDist = new Map<string, number>(); // distance key -> last vdot

    // Sort oldest-first
    const sorted = [...allEntries].sort((a, b) => {
      const dateA = a.type === 'race' ? a.data.date : a.data.date;
      const dateB = b.type === 'race' ? b.data.date : b.data.date;
      return dateA.localeCompare(dateB);
    });

    for (const entry of sorted) {
      const distKey = getEntryDistanceKey(entry);
      const vdot = entry.type === 'race' ? entry.data.calculatedVdot : entry.data.vdot;
      const entryId = entry.type === 'race' ? `race-${entry.data.id}` : entry.data.id;

      if (vdot != null) {
        const prev = lastVdotByDist.get(distKey);
        if (prev != null) {
          deltas.set(entryId, vdot - prev);
        }
        lastVdotByDist.set(distKey, vdot);
      }
    }

    return deltas;
  }, [allEntries]);

  const totalCount = allEntries.length;

  if (totalCount === 0) {
    return (
      <div className="bg-surface-1 rounded-xl border border-default p-6 text-center">
        <Trophy className="w-8 h-8 text-textTertiary mx-auto mb-2" />
        <p className="text-textTertiary">No race results logged yet.</p>
        <p className="text-sm text-textTertiary mt-1">
          Log a result or sync from Strava to see your race history here.
        </p>
      </div>
    );
  }

  const getDistanceLabelForFilter = (dist: string): string => {
    // Try RACE_DISTANCES first
    const label = getDistanceLabel(dist);
    if (label !== dist) return label;
    // For effort-only distances like 400m, 1K, 1mi — return as-is
    return dist;
  };

  const getCountForDistance = (dist: string): number => {
    return allEntries.filter(e => getEntryDistanceKey(e) === dist).length;
  };

  return (
    <div>
      {/* Distance filter chips */}
      {uniqueDistances.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setDistanceFilter('all')}
            className={cn(
              'px-3 py-1 text-sm rounded-full border font-medium transition-colors',
              distanceFilter === 'all'
                ? 'bg-dream-600 text-white border-dream-600'
                : 'bg-surface-2 text-textSecondary border-borderPrimary hover:border-dream-400'
            )}
          >
            All ({totalCount})
          </button>
          {uniqueDistances.map(dist => (
            <button
              key={dist}
              onClick={() => setDistanceFilter(dist)}
              className={cn(
                'px-3 py-1 text-sm rounded-full border font-medium transition-colors',
                distanceFilter === dist
                  ? 'bg-dream-600 text-white border-dream-600'
                  : 'bg-surface-2 text-textSecondary border-borderPrimary hover:border-dream-400'
              )}
            >
              {getDistanceLabelForFilter(dist)} ({getCountForDistance(dist)})
            </button>
          ))}
        </div>
      )}

      {/* Vertical timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-borderSecondary" />

        {/* Timeline entries */}
        <div className="space-y-3">
          {filteredEntries.map((entry) => {
            if (entry.type === 'race') {
              return (
                <RaceTimelineCard
                  key={`race-${entry.data.id}`}
                  result={entry.data}
                  isPR={prSet.currentPr.get(getEntryDistanceKey(entry)) === `race-${entry.data.id}`}
                  delta={vdotDeltas.get(`race-${entry.data.id}`)}
                  onEdit={onEditResult}
                  onDelete={onDeleteResult}
                />
              );
            } else {
              return (
                <EffortTimelineCard
                  key={entry.data.id}
                  effort={entry.data}
                  isPR={prSet.currentPr.get(getEntryDistanceKey(entry)) === entry.data.id}
                  delta={vdotDeltas.get(entry.data.id)}
                />
              );
            }
          })}
        </div>
      </div>
    </div>
  );
}

// ==================== Race Timeline Card ====================

function RaceTimelineCard({
  result,
  isPR,
  delta,
  onEdit,
  onDelete,
}: {
  result: RaceResultWithContext;
  isPR: boolean;
  delta: number | undefined;
  onEdit: (result: RaceResultWithContext) => void;
  onDelete: (id: number) => void;
}) {
  const distanceInfo = RACE_DISTANCES[result.distanceLabel];
  const miles = distanceInfo ? distanceInfo.meters / 1609.34 : null;
  const paceSeconds = miles && miles > 0
    ? Math.round(result.finishTimeSeconds / miles)
    : null;
  const linked = result.linkedRace;

  return (
    <div className="relative pl-10">
      {/* Timeline dot */}
      <div className={cn(
        'absolute left-2 w-5 h-5 rounded-full flex items-center justify-center',
        isPR ? 'bg-amber-500' : 'bg-dream-500'
      )}>
        {isPR
          ? <Award className="w-3 h-3 text-white" />
          : <Trophy className="w-3 h-3 text-white" />
        }
      </div>

      {/* Card */}
      <div className={cn(
        'bg-surface-1 rounded-xl border p-4 shadow-sm',
        isPR ? 'border-amber-500/40' : 'border-default'
      )}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Top row: name + badges */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {result.raceName && (
                <h3 className="font-semibold text-primary text-sm">{result.raceName}</h3>
              )}
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-surface-2 text-primary border border-default">
                {getDistanceLabel(result.distanceLabel)}
              </span>
              {isPR && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/25">
                  PR
                </span>
              )}
              {linked && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-500/15 text-green-600 border border-green-500/25 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  {linked.priority} Race
                </span>
              )}
            </div>

            {/* Date + time + pace */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-textSecondary">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {parseLocalDate(result.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1 font-medium text-primary">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-mono">{formatRaceTime(result.finishTimeSeconds)}</span>
              </span>
              {paceSeconds && (
                <span className="text-textTertiary">
                  {formatPace(paceSeconds)}/mi
                </span>
              )}
            </div>

            {/* VDOT delta + target comparison */}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {delta != null && Math.abs(delta) >= 0.1 && (
                <span className={cn(
                  'flex items-center gap-0.5 text-xs font-medium',
                  delta > 0 ? 'text-green-600' : 'text-red-500'
                )}>
                  {delta > 0
                    ? <TrendingUp className="w-3 h-3" />
                    : <TrendingDown className="w-3 h-3" />
                  }
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)} VDOT
                </span>
              )}
              {linked?.targetTimeSeconds != null && (
                <span className={cn(
                  'text-xs font-medium flex items-center gap-1',
                  result.finishTimeSeconds <= linked.targetTimeSeconds
                    ? 'text-green-600'
                    : 'text-rose-500'
                )}>
                  <Target className="w-3 h-3" />
                  {result.finishTimeSeconds <= linked.targetTimeSeconds
                    ? `${formatRaceTime(linked.targetTimeSeconds - result.finishTimeSeconds)} under goal`
                    : `${formatRaceTime(result.finishTimeSeconds - linked.targetTimeSeconds)} over goal`
                  }
                </span>
              )}
              {result.workoutId && (
                <Link
                  href={`/workout/${result.workoutId}`}
                  className="inline-flex items-center gap-1 text-xs text-dream-500 hover:text-dream-600 font-medium"
                >
                  <ExternalLink className="w-3 h-3" />
                  Workout
                </Link>
              )}
            </div>
          </div>

          {/* Right side: VDOT + actions */}
          <div className="flex items-center gap-3 ml-3 flex-shrink-0">
            {result.calculatedVdot && (
              <div className="text-right">
                <p className="text-lg font-bold text-green-600">
                  {result.calculatedVdot.toFixed(1)}
                </p>
                <p className="text-[10px] text-textTertiary">VDOT</p>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <button
                onClick={() => onEdit(result)}
                className="p-1 text-tertiary hover:text-dream-500"
                title="Edit result"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(result.id)}
                className="p-1 text-tertiary hover:text-red-500"
                title="Delete result"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== Effort Timeline Card ====================

function EffortTimelineCard({
  effort,
  isPR,
  delta,
}: {
  effort: BestEffortTimelineEntry;
  isPR: boolean;
  delta: number | undefined;
}) {
  // Compute pace
  const miles = effort.distanceMeters / 1609.34;
  const paceSeconds = miles > 0 ? Math.round(effort.timeSeconds / miles) : null;

  return (
    <div className="relative pl-10">
      {/* Timeline dot */}
      <div className={cn(
        'absolute left-2 w-5 h-5 rounded-full flex items-center justify-center',
        isPR ? 'bg-amber-500' : 'bg-violet-500'
      )}>
        {isPR
          ? <Award className="w-3 h-3 text-white" />
          : <Zap className="w-3 h-3 text-white" />
        }
      </div>

      {/* Card */}
      <div className={cn(
        'bg-surface-1 rounded-xl border p-4 shadow-sm',
        isPR ? 'border-amber-500/40' : 'border-violet-500/30'
      )}>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            {/* Top row: workout name + badges */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-semibold text-primary text-sm">
                {effort.workoutName || 'Workout'}
              </h3>
              <span className="px-2 py-0.5 text-xs font-medium rounded bg-surface-2 text-primary border border-default">
                {effort.distanceLabel}
              </span>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-violet-500/15 text-violet-600 border border-violet-500/25">
                Workout
              </span>
              {isPR && (
                <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/15 text-amber-600 border border-amber-500/25">
                  PR
                </span>
              )}
            </div>

            {/* Date + time + pace */}
            <div className="flex flex-wrap items-center gap-3 text-sm text-textSecondary">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {parseLocalDate(effort.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1 font-medium text-primary">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-mono">{formatRaceTime(effort.timeSeconds)}</span>
              </span>
              {paceSeconds && (
                <span className="text-textTertiary">
                  {formatPace(paceSeconds)}/mi
                </span>
              )}
            </div>

            {/* VDOT delta + workout link */}
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {delta != null && Math.abs(delta) >= 0.1 && (
                <span className={cn(
                  'flex items-center gap-0.5 text-xs font-medium',
                  delta > 0 ? 'text-green-600' : 'text-red-500'
                )}>
                  {delta > 0
                    ? <TrendingUp className="w-3 h-3" />
                    : <TrendingDown className="w-3 h-3" />
                  }
                  {delta > 0 ? '+' : ''}{delta.toFixed(1)} VDOT
                </span>
              )}
              <Link
                href={`/workout/${effort.workoutId}`}
                className="inline-flex items-center gap-1 text-xs text-violet-500 hover:text-violet-600 font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                Workout
              </Link>
            </div>
          </div>

          {/* Right side: VDOT */}
          <div className="flex items-center gap-3 ml-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-lg font-bold text-violet-600">
                {effort.vdot.toFixed(1)}
              </p>
              <p className="text-[10px] text-textTertiary">VDOT</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
