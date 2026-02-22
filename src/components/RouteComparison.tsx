'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import {
  MapPin,
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  ChevronDown,
  ChevronUp,
  Loader2,
  Route,
} from 'lucide-react';
import { AnimatedSection } from '@/components/AnimatedSection';
import {
  getFrequentRoutes,
  getRouteHistory,
  type FrequentRoute,
  type RouteHistoryResult,
} from '@/actions/route-comparison';
import { formatPace } from '@/lib/utils';

// ==================== Helpers ====================

function TrendArrow({ direction }: { direction: FrequentRoute['trend']['direction'] }) {
  switch (direction) {
    case 'improving':
      return <TrendingDown className="w-4 h-4 text-emerald-400" />;
    case 'declining':
      return <TrendingUp className="w-4 h-4 text-rose-400" />;
    case 'stable':
      return <Minus className="w-4 h-4 text-textTertiary" />;
    default:
      return <Minus className="w-4 h-4 text-textTertiary opacity-50" />;
  }
}

function trendLabel(trend: FrequentRoute['trend']): string {
  if (trend.direction === 'insufficient_data') return 'Need more runs';
  if (trend.recentVsOlderDelta != null) {
    const abs = Math.abs(trend.recentVsOlderDelta);
    if (abs <= 3) return 'Stable';
    const dir = trend.recentVsOlderDelta < 0 ? 'faster' : 'slower';
    return `${abs}s/mi ${dir}`;
  }
  if (trend.direction === 'improving') return 'Improving';
  if (trend.direction === 'declining') return 'Slowing';
  return 'Stable';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Format seconds per mile into M:SS */
function paceLabel(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ==================== Sparkline ====================

function PaceSparkline({ paces, bestPace }: { paces: number[]; bestPace: number | null }) {
  if (paces.length < 2) {
    return (
      <div className="h-10 flex items-center justify-center">
        <span className="text-[10px] text-textTertiary">Need 2+ runs</span>
      </div>
    );
  }

  const data = paces.map((pace, i) => ({
    idx: i,
    pace,
    isPR: bestPace != null && pace <= bestPace,
  }));

  const minPace = Math.min(...paces);
  const maxPace = Math.max(...paces);
  const padding = Math.max(5, (maxPace - minPace) * 0.15);

  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <YAxis domain={[minPace - padding, maxPace + padding]} hide />
        <Line
          type="monotone"
          dataKey="pace"
          stroke="#818cf8"
          strokeWidth={1.5}
          dot={(props: Record<string, unknown>) => {
            const { cx, cy, payload } = props as { cx: number; cy: number; payload: { isPR: boolean } };
            if (payload.isPR) {
              return (
                <circle
                  key={`dot-${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  r={3}
                  fill="#22c55e"
                  stroke="#22c55e"
                  strokeWidth={1}
                />
              );
            }
            return (
              <circle
                key={`dot-${cx}-${cy}`}
                cx={cx}
                cy={cy}
                r={2}
                fill="#818cf8"
                stroke="none"
              />
            );
          }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ==================== Expanded Detail ====================

function RouteDetailPanel({ routeId }: { routeId: number }) {
  const [data, setData] = useState<RouteHistoryResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getRouteHistory(routeId).then((result) => {
      if (result.success) setData(result.data);
      setLoading(false);
    });
  }, [routeId]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.workouts
      .filter((w) => w.avgPaceSeconds != null)
      .reverse() // oldest first for chart
      .map((w) => ({
        date: formatDate(w.date),
        fullDate: formatDateLong(w.date),
        pace: w.avgPaceSeconds!,
        hr: w.avgHr,
        isPR: w.isPR,
      }));
  }, [data]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-textTertiary" />
      </div>
    );
  }

  if (!data || data.workouts.length === 0) {
    return (
      <div className="py-4 text-center text-sm text-textTertiary">No workout data available.</div>
    );
  }

  const bestPace = data.route.bestPaceSeconds;

  return (
    <div className="mt-3 space-y-3">
      {/* Pace over time chart */}
      {chartData.length >= 2 && (
        <div className="bg-bgTertiary rounded-lg p-3">
          <h4 className="text-xs font-medium text-textTertiary uppercase tracking-wide mb-2">
            Pace Over Time
          </h4>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={{ stroke: '#334155' }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => paceLabel(v)}
                domain={['auto', 'auto']}
                reversed
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const d = payload[0].payload as { fullDate: string; pace: number; hr: number | null; isPR: boolean };
                  return (
                    <div className="bg-bgPrimary border border-borderPrimary rounded-lg p-2.5 shadow-xl text-xs">
                      <p className="font-semibold text-textPrimary">{d.fullDate}</p>
                      <p className="text-textSecondary mt-0.5">
                        Pace: <span className="font-medium text-textPrimary">{paceLabel(d.pace)}/mi</span>
                      </p>
                      {d.hr && (
                        <p className="text-textSecondary">
                          HR: <span className="font-medium text-textPrimary">{d.hr} bpm</span>
                        </p>
                      )}
                      {d.isPR && (
                        <p className="text-emerald-400 font-medium mt-0.5">Route PR</p>
                      )}
                    </div>
                  );
                }}
              />
              {bestPace && (
                <ReferenceLine
                  y={bestPace}
                  stroke="#22c55e"
                  strokeDasharray="4 3"
                  strokeWidth={1}
                  label={{
                    value: `PR ${paceLabel(bestPace)}`,
                    position: 'right',
                    fill: '#22c55e',
                    fontSize: 10,
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="pace"
                stroke="#818cf8"
                strokeWidth={2}
                dot={(props: Record<string, unknown>) => {
                  const { cx, cy, payload } = props as { cx: number; cy: number; payload: { isPR: boolean } };
                  if (payload.isPR) {
                    return (
                      <circle
                        key={`det-${cx}-${cy}`}
                        cx={cx}
                        cy={cy}
                        r={4}
                        fill="#22c55e"
                        stroke="#166534"
                        strokeWidth={1.5}
                      />
                    );
                  }
                  return (
                    <circle
                      key={`det-${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill="#818cf8"
                      stroke="none"
                    />
                  );
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent runs table */}
      <div>
        <h4 className="text-xs font-medium text-textTertiary uppercase tracking-wide mb-2">
          Recent Runs
        </h4>
        <div className="space-y-1">
          {data.workouts.slice(0, 8).map((w) => (
            <Link
              key={w.id}
              href={`/workout/${w.id}`}
              className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-bgTertiary transition-colors group"
            >
              <div className="flex items-center gap-2">
                {w.isPR && <Award className="w-3.5 h-3.5 text-emerald-400" />}
                <span className="text-xs text-textSecondary group-hover:text-textPrimary">
                  {formatDateLong(w.date)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {w.avgHr && (
                  <span className="text-xs text-textTertiary">{w.avgHr} bpm</span>
                )}
                <span
                  className={`text-xs font-mono font-medium ${
                    w.isPR ? 'text-emerald-400' : 'text-textPrimary'
                  }`}
                >
                  {w.avgPaceSeconds ? `${paceLabel(w.avgPaceSeconds)}/mi` : '--'}
                </span>
              </div>
            </Link>
          ))}
        </div>
        {data.workouts.length > 8 && (
          <Link
            href={`/routes/${data.route.id}`}
            className="block text-center text-xs text-dream-500 hover:text-dream-400 mt-2 py-1"
          >
            View all {data.workouts.length} runs
          </Link>
        )}
      </div>
    </div>
  );
}

// ==================== Route Row ====================

function RouteRow({ route }: { route: FrequentRoute }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-borderSecondary last:border-b-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-3 hover:bg-bgTertiary/50 transition-colors"
      >
        <div className="flex items-center justify-between">
          {/* Left: name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-textPrimary truncate">{route.name}</span>
              {route.runCount >= 3 && (
                <TrendArrow direction={route.trend.direction} />
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xs text-textTertiary">{route.distanceMiles.toFixed(1)} mi</span>
              <span className="text-xs text-textTertiary">{route.runCount} runs</span>
              {route.lastRunDate && (
                <span className="text-xs text-textTertiary hidden sm:inline">
                  Last: {formatDate(route.lastRunDate)}
                </span>
              )}
            </div>
          </div>

          {/* Middle: sparkline */}
          <div className="w-24 mx-3 hidden sm:block">
            <PaceSparkline paces={route.recentPaces} bestPace={route.bestPaceSeconds} />
          </div>

          {/* Right: pace stats */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-right">
              <div className="text-xs text-textTertiary">Best</div>
              <div className="text-sm font-mono font-semibold text-emerald-400">
                {formatPace(route.bestPaceSeconds)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-textTertiary">Avg</div>
              <div className="text-sm font-mono text-textSecondary">
                {formatPace(route.avgPaceSeconds)}
              </div>
            </div>
            <div className="text-right hidden sm:block w-20">
              <div className="text-xs text-textTertiary">Trend</div>
              <div className={`text-xs font-medium ${
                route.trend.direction === 'improving' ? 'text-emerald-400' :
                route.trend.direction === 'declining' ? 'text-rose-400' :
                'text-textTertiary'
              }`}>
                {trendLabel(route.trend)}
              </div>
            </div>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-textTertiary" />
            ) : (
              <ChevronDown className="w-4 h-4 text-textTertiary" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3">
          <RouteDetailPanel routeId={route.id} />
        </div>
      )}
    </div>
  );
}

// ==================== Main Component ====================

export function RouteComparisonCard() {
  const [routes, setRoutes] = useState<FrequentRoute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFrequentRoutes(10).then((result) => {
      if (result.success) setRoutes(result.data);
      setLoading(false);
    });
  }, []);

  // Summary stats
  const improvingCount = routes.filter((r) => r.trend.direction === 'improving').length;
  const totalRuns = routes.reduce((sum, r) => sum + r.runCount, 0);

  if (loading) {
    return (
      <AnimatedSection>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
            <Route className="w-5 h-5 text-dream-500" />
            Route Pace Comparison
          </h2>
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-textTertiary" />
          </div>
        </div>
      </AnimatedSection>
    );
  }

  if (routes.length === 0) {
    return (
      <AnimatedSection>
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
          <h2 className="font-semibold text-textPrimary mb-4 flex items-center gap-2">
            <Route className="w-5 h-5 text-dream-500" />
            Route Pace Comparison
          </h2>
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-bgTertiary rounded-full flex items-center justify-center mx-auto mb-3">
              <MapPin className="w-6 h-6 text-textTertiary" />
            </div>
            <p className="text-sm text-textTertiary">
              No routes detected yet. Routes are automatically created when you run similar paths
              multiple times with GPS data.
            </p>
          </div>
        </div>
      </AnimatedSection>
    );
  }

  return (
    <AnimatedSection>
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm overflow-hidden">
        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Route className="w-5 h-5 text-dream-500" />
              <h3 className="font-semibold text-textPrimary">Route Pace Comparison</h3>
            </div>
            <Link
              href="/routes"
              className="text-xs text-dream-500 hover:text-dream-400 transition-colors"
            >
              View all routes
            </Link>
          </div>

          {/* Summary bar */}
          <div className="flex items-center gap-4 p-3 bg-bgTertiary rounded-lg">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-dream-500" />
              <span className="text-sm text-textSecondary">
                <span className="font-semibold text-textPrimary">{routes.length}</span> routes
              </span>
            </div>
            <div className="text-sm text-textSecondary">
              <span className="font-semibold text-textPrimary">{totalRuns}</span> total runs
            </div>
            {improvingCount > 0 && (
              <div className="text-sm text-textSecondary">
                <span className="font-semibold text-emerald-400">{improvingCount}</span> improving
              </div>
            )}
          </div>
        </div>

        {/* Route list */}
        <div>
          {routes.map((route) => (
            <RouteRow key={route.id} route={route} />
          ))}
        </div>
      </div>
    </AnimatedSection>
  );
}
