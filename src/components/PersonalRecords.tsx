'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trophy, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Zap, Clock } from 'lucide-react';
import { cn, formatPace } from '@/lib/utils';
import { formatTime } from '@/lib/training/types';
import type { PersonalRecord } from '@/actions/personal-records';

interface PersonalRecordsProps {
  records: PersonalRecord[];
  lastUpdated?: string;
}

/**
 * Format seconds into pace per mile for a given distance.
 */
function pacePerMile(timeSeconds: number, distanceMeters: number): string {
  const miles = distanceMeters / 1609.34;
  if (miles <= 0) return '--:--';
  const paceSeconds = Math.round(timeSeconds / miles);
  return formatPace(paceSeconds);
}

export function PersonalRecords({ records, lastUpdated }: PersonalRecordsProps) {
  const [expanded, setExpanded] = useState(false);

  if (records.length === 0) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-dream-500" />
          <h3 className="font-semibold text-primary">Personal Records</h3>
        </div>
        <div className="text-center py-8 text-textTertiary">
          <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No personal records yet</p>
          <p className="text-sm mt-1">
            Keep running and your best efforts will appear here automatically.
          </p>
        </div>
      </div>
    );
  }

  // Show key distances by default, all on expand
  const keyDistances = ['1mi', '5K', '10K', 'HM', 'Marathon'];
  const visibleRecords = expanded
    ? records
    : records.filter(r => keyDistances.includes(r.distanceKey));

  // Count recent PRs
  const recentPrCount = records.filter(r => r.isRecentPr).length;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-dream-500" />
          <h3 className="font-semibold text-primary">Personal Records</h3>
        </div>
        {recentPrCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded-full">
            <Zap className="w-3 h-3" />
            {recentPrCount} new PR{recentPrCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* PR Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-textTertiary border-b border-borderSecondary">
              <th className="pb-2 font-medium">Distance</th>
              <th className="pb-2 font-medium">PR</th>
              <th className="pb-2 font-medium">Pace</th>
              <th className="pb-2 font-medium">VDOT</th>
              <th className="pb-2 font-medium text-right">Trend</th>
            </tr>
          </thead>
          <tbody>
            {visibleRecords.map((record) => (
              <PersonalRecordRow key={record.distanceKey} record={record} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Expand/Collapse button */}
      {records.length > visibleRecords.length || expanded ? (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-center gap-1 w-full mt-3 py-2 text-sm text-dream-300 font-medium hover:text-dream-200 transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show Key Distances
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show All Distances ({records.length})
            </>
          )}
        </button>
      ) : null}

      {/* Footer */}
      {lastUpdated && (
        <p className="text-xs text-textTertiary mt-3 pt-3 border-t border-borderSecondary">
          Based on Strava best efforts and logged race results
        </p>
      )}
    </div>
  );
}

// ==================== Individual Row ====================

function PersonalRecordRow({ record }: { record: PersonalRecord }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <>
      <tr
        className="border-b border-borderSecondary hover:bg-bgTertiary cursor-pointer transition-colors"
        onClick={() => setShowDetails(!showDetails)}
      >
        {/* Distance */}
        <td className="py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-medium text-primary">{record.distanceLabel}</span>
            {record.isRecentPr && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded bg-yellow-900/40 text-yellow-300 border border-yellow-700/40">
                NEW
              </span>
            )}
          </div>
        </td>

        {/* PR Time */}
        <td className="py-2.5">
          <div className="flex items-center gap-1.5">
            {record.prWorkoutId ? (
              <Link
                href={`/workout/${record.prWorkoutId}`}
                className="font-bold text-primary hover:text-dream-400 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {formatTime(record.prTimeSeconds)}
              </Link>
            ) : (
              <span className="font-bold text-primary">
                {formatTime(record.prTimeSeconds)}
              </span>
            )}
            <Clock className="w-3 h-3 text-textTertiary" />
          </div>
          <div className="text-xs text-textTertiary">
            {new Date(record.prDate + 'T12:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </td>

        {/* Pace */}
        <td className="py-2.5 text-textSecondary">
          {pacePerMile(record.prTimeSeconds, record.distanceMeters)}/mi
        </td>

        {/* VDOT */}
        <td className="py-2.5">
          <span className="text-dream-400 font-medium">{record.prVdot.toFixed(1)}</span>
        </td>

        {/* Trend */}
        <td className="py-2.5 text-right">
          {record.improvementSeconds !== null && record.improvementSeconds > 0 ? (
            <span className="flex items-center justify-end gap-1 text-green-500 text-xs font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              {record.improvementSeconds}s
            </span>
          ) : record.improvementSeconds !== null && record.improvementSeconds < 0 ? (
            <span className="flex items-center justify-end gap-1 text-red-400 text-xs font-medium">
              <TrendingDown className="w-3.5 h-3.5" />
              {Math.abs(record.improvementSeconds)}s
            </span>
          ) : (
            <span className="flex items-center justify-end gap-1 text-textTertiary text-xs">
              <Minus className="w-3.5 h-3.5" />
              --
            </span>
          )}
        </td>
      </tr>

      {/* Expandable Details: Recent Top-3 */}
      {showDetails && record.recentTop3.length > 0 && (
        <tr>
          <td colSpan={5} className="pb-3">
            <div className="bg-bgTertiary rounded-lg p-3 ml-2">
              <p className="text-xs font-medium text-textTertiary uppercase tracking-wide mb-2">
                Recent Performances
              </p>
              <div className="space-y-1.5">
                {record.recentTop3.map((perf, idx) => (
                  <div
                    key={`${perf.date}-${perf.timeSeconds}-${idx}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'w-5 text-center font-medium text-xs',
                        perf.timeSeconds === record.prTimeSeconds
                          ? 'text-yellow-400'
                          : 'text-textTertiary'
                      )}>
                        {idx + 1}.
                      </span>
                      {perf.workoutId ? (
                        <Link
                          href={`/workout/${perf.workoutId}`}
                          className="font-medium text-primary hover:text-dream-400 transition-colors"
                        >
                          {formatTime(perf.timeSeconds)}
                        </Link>
                      ) : (
                        <span className="font-medium text-primary">
                          {formatTime(perf.timeSeconds)}
                        </span>
                      )}
                      <span className="text-xs text-textTertiary">
                        ({pacePerMile(perf.timeSeconds, record.distanceMeters)}/mi)
                      </span>
                    </div>
                    <span className="text-xs text-textTertiary">
                      {new Date(perf.date + 'T12:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
