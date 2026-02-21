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
} from 'lucide-react';
import { cn, parseLocalDate, formatPace } from '@/lib/utils';
import { formatRaceTime } from '@/lib/race-utils';
import { RACE_DISTANCES, getDistanceLabel } from '@/lib/training';
import Link from 'next/link';
import type { RaceResultWithContext } from '@/actions/races';

interface RaceHistoryTimelineProps {
  results: RaceResultWithContext[];
  onEditResult: (result: RaceResultWithContext) => void;
  onDeleteResult: (id: number) => void;
}

export function RaceHistoryTimeline({
  results,
  onEditResult,
  onDeleteResult,
}: RaceHistoryTimelineProps) {
  const [distanceFilter, setDistanceFilter] = useState<string>('all');

  // Derive unique distances present in the data
  const uniqueDistances = useMemo(() => {
    const labels = new Set(results.map(r => r.distanceLabel));
    // Order by distance
    const distOrder = Object.keys(RACE_DISTANCES);
    return distOrder.filter(d => labels.has(d));
  }, [results]);

  // Filter results
  const filteredResults = useMemo(() => {
    if (distanceFilter === 'all') return results;
    return results.filter(r => r.distanceLabel === distanceFilter);
  }, [results, distanceFilter]);

  // Compute PRs per distance (chronological: earliest first)
  const prMap = useMemo(() => {
    const prs = new Map<string, Set<number>>(); // distanceLabel -> set of result IDs that are PRs
    const bestByDist = new Map<string, number>(); // distanceLabel -> best time so far

    // Sort oldest-first for PR computation
    const sorted = [...results].sort((a, b) => a.date.localeCompare(b.date));
    for (const r of sorted) {
      const current = bestByDist.get(r.distanceLabel);
      if (current === undefined || r.finishTimeSeconds < current) {
        bestByDist.set(r.distanceLabel, r.finishTimeSeconds);
        if (!prs.has(r.distanceLabel)) prs.set(r.distanceLabel, new Set());
        prs.get(r.distanceLabel)!.add(r.id);
      }
    }
    return prs;
  }, [results]);

  // Compute VDOT delta from previous race
  const vdotDeltas = useMemo(() => {
    const deltas = new Map<number, number>();
    const sorted = [...results].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1].calculatedVdot;
      const curr = sorted[i].calculatedVdot;
      if (prev != null && curr != null) {
        deltas.set(sorted[i].id, curr - prev);
      }
    }
    return deltas;
  }, [results]);

  const isPR = (result: RaceResultWithContext) => {
    return prMap.get(result.distanceLabel)?.has(result.id) ?? false;
  };

  if (results.length === 0) {
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
            All ({results.length})
          </button>
          {uniqueDistances.map(dist => {
            const count = results.filter(r => r.distanceLabel === dist).length;
            return (
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
                {getDistanceLabel(dist)} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Vertical timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-borderSecondary" />

        {/* Timeline entries */}
        <div className="space-y-3">
          {filteredResults.map((result) => {
            const distanceInfo = RACE_DISTANCES[result.distanceLabel];
            const miles = distanceInfo ? distanceInfo.meters / 1609.34 : null;
            const paceSeconds = miles && miles > 0
              ? Math.round(result.finishTimeSeconds / miles)
              : null;
            const isCurrentPR = isPR(result);
            const delta = vdotDeltas.get(result.id);
            const linked = result.linkedRace;

            return (
              <div key={result.id} className="relative pl-10">
                {/* Timeline dot */}
                <div className={cn(
                  'absolute left-2 w-5 h-5 rounded-full flex items-center justify-center',
                  isCurrentPR ? 'bg-amber-500' : 'bg-dream-500'
                )}>
                  {isCurrentPR
                    ? <Award className="w-3 h-3 text-white" />
                    : <Trophy className="w-3 h-3 text-white" />
                  }
                </div>

                {/* Card */}
                <div className={cn(
                  'bg-surface-1 rounded-xl border p-4 shadow-sm',
                  isCurrentPR ? 'border-amber-500/40' : 'border-default'
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
                        {isCurrentPR && (
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
                          onClick={() => onEditResult(result)}
                          className="p-1 text-tertiary hover:text-dream-500"
                          title="Edit result"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteResult(result.id)}
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
          })}
        </div>
      </div>
    </div>
  );
}
