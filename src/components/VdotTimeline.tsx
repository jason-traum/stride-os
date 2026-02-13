'use client';

import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, Loader2, Activity, Trophy, Timer } from 'lucide-react';
import {
  getVdotHistory,
  getVdotTrend,
  getEquivalentTimes,
  type VdotHistoryEntry,
} from '@/actions/vdot-history';
import { parseLocalDate } from '@/lib/utils';

interface VdotTimelineProps {
  currentVdot?: number | null;
}

export function VdotTimeline({ currentVdot }: VdotTimelineProps) {
  const [history, setHistory] = useState<VdotHistoryEntry[]>([]);
  const [trend, setTrend] = useState<{
    current: number | null;
    previous: number | null;
    change: number | null;
    changePercent: number | null;
    trend: 'improving' | 'stable' | 'declining' | 'unknown';
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const [historyData, trendData] = await Promise.all([
        getVdotHistory({ limit: 20 }),
        getVdotTrend(90),
      ]);
      setHistory(historyData);
      setTrend(trendData);
      setLoading(false);
    }
    fetchData();
  }, []);

  const chartData = useMemo(() => {
    if (history.length < 2) return null;

    const sortedHistory = [...history].sort(
      (a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()
    );

    const vdots = sortedHistory.map((h) => h.vdot);
    const minVdot = Math.min(...vdots);
    const maxVdot = Math.max(...vdots);
    const range = maxVdot - minVdot || 5;

    return {
      entries: sortedHistory,
      minVdot: minVdot - range * 0.1,
      maxVdot: maxVdot + range * 0.1,
      range: range * 1.2,
    };
  }, [history]);

  const equivalentTimes = useMemo(() => {
    const vdot = currentVdot || trend?.current;
    return vdot ? getEquivalentTimes(vdot) : null;
  }, [currentVdot, trend?.current]);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-500" />
          Fitness Timeline
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  const displayVdot = currentVdot || trend?.current;
  const TrendIcon =
    trend?.trend === 'improving'
      ? TrendingUp
      : trend?.trend === 'declining'
        ? TrendingDown
        : Minus;
  const trendColor =
    trend?.trend === 'improving'
      ? 'text-green-600'
      : trend?.trend === 'declining'
        ? 'text-red-500'
        : 'text-textTertiary';

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-primary flex items-center gap-2">
          <Activity className="w-5 h-5 text-teal-500" />
          Fitness Timeline
        </h2>
        {trend && trend.change !== null && (
          <div className={`flex items-center gap-1 text-sm font-medium ${trendColor}`}>
            <TrendIcon className="w-4 h-4" />
            {trend.change > 0 ? '+' : ''}
            {trend.change} VDOT ({trend.trend})
          </div>
        )}
      </div>

      {/* Current VDOT Display */}
      {displayVdot && (
        <div className="flex items-center gap-6 mb-6">
          <div className="text-center">
            <p className="text-4xl font-bold text-teal-600">{displayVdot.toFixed(1)}</p>
            <p className="text-xs text-textTertiary uppercase tracking-wide">Current VDOT</p>
          </div>

          {/* Equivalent Times */}
          {equivalentTimes && (
            <div className="flex-1 grid grid-cols-4 gap-2 text-center">
              {equivalentTimes.map((pred) => (
                <div key={pred.distance} className="p-2 bg-bgTertiary rounded-lg">
                  <p className="text-xs text-textTertiary">{pred.distance}</p>
                  <p className="font-semibold text-primary text-sm">{pred.time}</p>
                  <p className="text-xs text-tertiary">{pred.pacePerMile}/mi</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Timeline Chart */}
      {chartData && chartData.entries.length >= 2 && (
        <div className="mb-4">
          <div className="relative h-32">
            <svg viewBox="0 0 100 40" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="vdotGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <line x1="0" y1="10" x2="100" y2="10" stroke="#e5e5e5" strokeWidth="0.3" />
              <line x1="0" y1="20" x2="100" y2="20" stroke="#e5e5e5" strokeWidth="0.3" />
              <line x1="0" y1="30" x2="100" y2="30" stroke="#e5e5e5" strokeWidth="0.3" />

              {/* Data line and area */}
              {(() => {
                const points = chartData.entries.map((entry, i) => {
                  const x = (i / (chartData.entries.length - 1)) * 100;
                  const y = 40 - ((entry.vdot - chartData.minVdot) / chartData.range) * 40;
                  return { x, y, entry };
                });

                const linePath = points
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                  .join(' ');
                const areaPath = `${linePath} L ${points[points.length - 1].x} 40 L 0 40 Z`;

                return (
                  <>
                    <path d={areaPath} fill="url(#vdotGradient)" />
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="1"
                      strokeLinejoin="round"
                    />
                    {points.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={p.entry.source === 'race' ? 2 : 1}
                        fill={p.entry.source === 'race' ? '#22c55e' : '#f59e0b'}
                      />
                    ))}
                  </>
                );
              })()}
            </svg>
          </div>

          {/* Date labels */}
          <div className="flex justify-between text-xs text-tertiary mt-1">
            <span>
              {parseLocalDate(chartData.entries[0].date).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })}
            </span>
            <span>
              {parseLocalDate(chartData.entries[chartData.entries.length - 1].date).toLocaleDateString(
                'en-US',
                { month: 'short', year: 'numeric' }
              )}
            </span>
          </div>
        </div>
      )}

      {/* History List */}
      {history.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          <p className="text-xs text-textTertiary uppercase tracking-wide mb-2">Recent Changes</p>
          {history.slice(0, 8).map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between py-1 border-b border-stone-50 last:border-0"
            >
              <div className="flex items-center gap-2">
                {entry.source === 'race' ? (
                  <Trophy className="w-4 h-4 text-green-500" />
                ) : entry.source === 'time_trial' ? (
                  <Timer className="w-4 h-4 text-teal-500" />
                ) : (
                  <Activity className="w-4 h-4 text-tertiary" />
                )}
                <span className="text-sm text-textSecondary">
                  {parseLocalDate(entry.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                <span className="text-xs text-tertiary capitalize">{entry.source}</span>
              </div>
              <span className="font-semibold text-primary">{entry.vdot.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {history.length === 0 && !currentVdot && (
        <div className="text-center py-8 text-textTertiary">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No fitness history yet</p>
          <p className="text-xs mt-1">Complete a race or time trial to track your VDOT</p>
        </div>
      )}
    </div>
  );
}
