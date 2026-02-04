'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, TrendingUp, Calendar, Target, Loader2, ChevronRight, Award } from 'lucide-react';
import { formatPace } from '@/lib/utils';
import {
  getPRTimeline,
  getCumulativeProgress,
  getProgressMilestones,
  getPaceProgression,
  type PRTimeline,
  type CumulativeProgress,
  type ProgressMilestones,
} from '@/actions/progress-tracking';

// Format seconds to time string
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * PR Timeline Card - Shows when PRs were achieved
 */
export function PRTimelineCard() {
  const [timeline, setTimeline] = useState<PRTimeline | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPRTimeline().then(data => {
      setTimeline(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          PR Timeline
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        </div>
      </div>
    );
  }

  if (!timeline || timeline.prs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
        <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          PR Timeline
        </h2>
        <p className="text-sm text-stone-500">Complete runs at standard distances to see your PR history.</p>
      </div>
    );
  }

  // Show recent PRs (last 10)
  const recentPRs = timeline.prs.slice(0, 10);

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-500" />
        PR Timeline
      </h2>

      <div className="space-y-3">
        {recentPRs.map((pr, i) => (
          <Link
            key={`${pr.distance}-${pr.date}`}
            href={`/workout/${pr.workoutId}`}
            className="block p-3 -mx-3 rounded-lg hover:bg-stone-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  i === 0 ? 'bg-yellow-100 text-yellow-600' :
                  i < 3 ? 'bg-amber-100 text-amber-600' : 'bg-stone-100 text-stone-500'
                }`}>
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-900">{pr.distance}</p>
                  <p className="text-xs text-stone-500">{formatDate(pr.date)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono font-semibold text-stone-900">{formatTime(pr.time)}</p>
                {pr.improvement && pr.improvement > 0 && (
                  <p className="text-xs text-green-600">-{formatTime(pr.improvement)} improvement</p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/**
 * Yearly Comparison Card
 */
export function YearlyComparisonCard() {
  const [progress, setProgress] = useState<CumulativeProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCumulativeProgress().then(data => {
      setProgress(data);
      setLoading(false);
    });
  }, []);

  if (loading || !progress || progress.yearlyComparison.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-amber-500" />
        Year-over-Year
      </h2>

      <div className="space-y-3">
        {progress.yearlyComparison.slice(0, 5).map((year, i) => {
          const prevYear = progress.yearlyComparison[i + 1];
          const milesDiff = prevYear ? year.totalMiles - prevYear.totalMiles : 0;
          const pctChange = prevYear ? ((year.totalMiles - prevYear.totalMiles) / prevYear.totalMiles) * 100 : 0;

          return (
            <div key={year.year} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
              <div>
                <p className="text-lg font-bold text-stone-900">{year.year}</p>
                <p className="text-xs text-stone-500">{year.totalRuns} runs</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-stone-700">{year.totalMiles} mi</p>
                {prevYear && (
                  <p className={`text-xs ${pctChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {pctChange >= 0 ? '+' : ''}{Math.round(pctChange)}% vs {prevYear.year}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Cumulative Miles Chart
 */
export function CumulativeMilesChart() {
  const [progress, setProgress] = useState<CumulativeProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCumulativeProgress().then(data => {
      setProgress(data);
      setLoading(false);
    });
  }, []);

  if (loading || !progress || progress.monthly.length < 3) {
    return null;
  }

  // Show last 12 months
  const recentMonths = progress.monthly.slice(-12);
  const maxCumulative = Math.max(...recentMonths.map(m => m.cumulativeMiles));
  const minCumulative = recentMonths[0]?.cumulativeMiles || 0;
  const range = maxCumulative - minCumulative || 1;

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-green-500" />
        Cumulative Miles
      </h2>

      {/* Simple line chart visualization */}
      <div className="h-32 flex items-end gap-1">
        {recentMonths.map((month, i) => {
          const height = ((month.cumulativeMiles - minCumulative) / range) * 100;

          return (
            <div
              key={`${month.year}-${month.month}`}
              className="flex-1 flex flex-col items-center"
            >
              <div className="w-full flex flex-col items-center">
                <div
                  className="w-full bg-gradient-to-t from-green-500 to-emerald-400 rounded-t"
                  style={{ height: `${Math.max(height, 5)}%` }}
                  title={`${month.month} ${month.year}: ${month.cumulativeMiles} total miles`}
                />
              </div>
              {i === 0 || i === recentMonths.length - 1 || i === Math.floor(recentMonths.length / 2) ? (
                <span className="text-xs text-stone-400 mt-1">{month.month}</span>
              ) : (
                <span className="text-xs text-transparent mt-1">.</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-4 border-t border-stone-100 flex justify-between text-sm">
        <span className="text-stone-500">Total Miles</span>
        <span className="font-bold text-stone-900">{maxCumulative.toLocaleString()} mi</span>
      </div>
    </div>
  );
}

/**
 * Milestone Tracker Card
 */
export function MilestoneTrackerCard() {
  const [milestones, setMilestones] = useState<ProgressMilestones | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProgressMilestones().then(data => {
      setMilestones(data);
      setLoading(false);
    });
  }, []);

  if (loading || !milestones) {
    return null;
  }

  const hasData = milestones.milestoneDates.length > 0 || milestones.projectedMilestones.length > 0;
  if (!hasData) return null;

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <h2 className="font-semibold text-stone-900 mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-purple-500" />
        Mileage Milestones
      </h2>

      {/* Achieved milestones */}
      {milestones.milestoneDates.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-stone-500 uppercase tracking-wide mb-2">Achieved</p>
          <div className="space-y-2">
            {milestones.milestoneDates.slice(-3).reverse().map((m) => (
              <div key={m.milestone} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-yellow-500" />
                  <span className="font-medium">{m.milestone.toLocaleString()} miles</span>
                </div>
                <span className="text-stone-500">{formatDate(m.date)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Projected milestones */}
      {milestones.projectedMilestones.length > 0 && (
        <div>
          <p className="text-xs text-stone-500 uppercase tracking-wide mb-2">Next Up</p>
          <div className="space-y-2">
            {milestones.projectedMilestones.slice(0, 2).map((m) => (
              <div key={m.milestone} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-400" />
                  <span className="font-medium text-stone-600">{m.milestone.toLocaleString()} miles</span>
                </div>
                <span className="text-stone-400">~{m.daysRemaining} days</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Pace Progression Card
 */
export function PaceProgressionCard() {
  const [progression, setProgression] = useState<{
    data: { date: string; pace: number; movingAvg: number }[];
    trend: string;
    totalImprovement: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPaceProgression('easy').then(data => {
      setProgression(data);
      setLoading(false);
    });
  }, []);

  if (loading || !progression || progression.data.length < 5) {
    return null;
  }

  // Show recent data points
  const recentData = progression.data.slice(-20);
  const minPace = Math.min(...recentData.map(d => d.movingAvg));
  const maxPace = Math.max(...recentData.map(d => d.movingAvg));
  const range = maxPace - minPace || 30;

  const trendColors = {
    improving: 'text-green-600',
    stable: 'text-amber-600',
    declining: 'text-orange-600',
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-stone-900 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-500" />
          Easy Pace Trend
        </h2>
        <span className={`text-sm font-medium capitalize ${trendColors[progression.trend as keyof typeof trendColors] || 'text-stone-500'}`}>
          {progression.trend}
          {progression.totalImprovement && progression.totalImprovement > 0 && (
            <span className="text-xs ml-1">(-{progression.totalImprovement}s/mi)</span>
          )}
        </span>
      </div>

      {/* Simple visualization - pace trend */}
      <div className="h-24 flex items-end gap-0.5">
        {recentData.map((d, i) => {
          // Invert: faster pace (lower number) = taller bar
          const height = ((maxPace - d.movingAvg) / range) * 100;

          return (
            <div
              key={`${d.date}-${i}`}
              className="flex-1 bg-gradient-to-t from-amber-500 to-cyan-400 rounded-t transition-all"
              style={{ height: `${Math.max(height, 5)}%` }}
              title={`${formatDate(d.date)}: ${formatPace(d.movingAvg)}/mi avg`}
            />
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-stone-400 mt-2">
        <span>{formatDate(recentData[0].date)}</span>
        <span>{formatDate(recentData[recentData.length - 1].date)}</span>
      </div>
    </div>
  );
}
