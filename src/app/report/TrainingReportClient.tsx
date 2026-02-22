'use client';

import { useState, useEffect, useCallback } from 'react';
import { Printer, Calendar, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { getTrainingReportData, type TrainingReportData } from '@/actions/training-report';
import { formatPace, formatDuration, parseLocalDate, toLocalDateString } from '@/lib/utils';

// ─── Formatting Helpers ──────────────────────────────────────────────────────

function formatTimeFromSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function capitalizeType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatShortDate(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Bar Chart Component ─────────────────────────────────────────────────────

function SimpleBarChart({ data, label }: {
  data: Array<{ label: string; value: number }>;
  label: string;
}) {
  if (data.length === 0) return null;
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div>
      <h4 className="text-xs font-medium text-textTertiary uppercase tracking-wide mb-3">{label}</h4>
      <div className="flex items-end gap-2 h-32">
        {data.map((d, i) => {
          const height = (d.value / maxValue) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-textSecondary font-medium">
                {d.value > 0 ? d.value.toFixed(1) : ''}
              </span>
              <div className="w-full flex items-end" style={{ height: '100px' }}>
                <div
                  className="w-full bg-accentBrand/80 rounded-t print:bg-[#7c6cf0]"
                  style={{ height: `${Math.max(height, 2)}%`, minHeight: d.value > 0 ? '4px' : '0px' }}
                />
              </div>
              <span className="text-[9px] text-textTertiary text-center leading-tight">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Breakdown Table ─────────────────────────────────────────────────────────

function BreakdownTable({ data }: { data: TrainingReportData }) {
  if (data.workoutBreakdown.length === 0) {
    return <p className="text-sm text-textTertiary">No workouts in this period.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-borderPrimary">
          <th className="text-left py-2 font-medium text-textSecondary">Type</th>
          <th className="text-right py-2 font-medium text-textSecondary">Runs</th>
          <th className="text-right py-2 font-medium text-textSecondary">Miles</th>
          <th className="text-right py-2 font-medium text-textSecondary">Time</th>
          <th className="text-right py-2 font-medium text-textSecondary">%</th>
        </tr>
      </thead>
      <tbody>
        {data.workoutBreakdown.map((row) => (
          <tr key={row.type} className="border-b border-borderPrimary/50">
            <td className="py-2 text-textPrimary">{capitalizeType(row.type)}</td>
            <td className="py-2 text-right text-textSecondary">{row.count}</td>
            <td className="py-2 text-right text-textPrimary font-medium">{row.miles}</td>
            <td className="py-2 text-right text-textSecondary">{formatDuration(row.minutes)}</td>
            <td className="py-2 text-right text-textTertiary">{row.percentage}%</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-borderPrimary font-semibold">
          <td className="py-2 text-textPrimary">Total</td>
          <td className="py-2 text-right text-textPrimary">{data.totalRuns}</td>
          <td className="py-2 text-right text-textPrimary">{data.totalMiles}</td>
          <td className="py-2 text-right text-textPrimary">{formatDuration(data.totalMinutes)}</td>
          <td className="py-2 text-right text-textTertiary">100%</td>
        </tr>
      </tfoot>
    </table>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center p-2">
      <p className="text-xs text-textTertiary uppercase tracking-wide mb-0.5 print:text-gray-500">{label}</p>
      <p className="text-lg font-bold text-textPrimary print:text-black">{value}</p>
    </div>
  );
}

function FitnessRow({ label, start, end }: { label: string; start: number; end: number }) {
  const change = end - start;
  return (
    <div className="flex justify-between items-center">
      <span className="text-textSecondary">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-textTertiary text-xs">{start}</span>
        <span className="text-textTertiary text-xs">&rarr;</span>
        <span className="text-textPrimary font-medium">{end}</span>
        <span className={`text-xs font-medium ${change >= 0 ? 'text-green-400 print:text-green-700' : 'text-red-400 print:text-red-700'}`}>
          ({change >= 0 ? '+' : ''}{Math.round(change * 10) / 10})
        </span>
      </div>
    </div>
  );
}

// ─── Main Report Client ──────────────────────────────────────────────────────

export function TrainingReportClient() {
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [dateStr, setDateStr] = useState<string>(() => toLocalDateString(new Date()));
  const [data, setData] = useState<TrainingReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getTrainingReportData(period, dateStr);
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error);
      }
    } catch (e) {
      setError('Failed to load report data.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [period, dateStr]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  function navigatePeriod(direction: -1 | 1) {
    const current = parseLocalDate(dateStr);
    if (period === 'week') {
      current.setDate(current.getDate() + direction * 7);
    } else {
      current.setMonth(current.getMonth() + direction);
    }
    setDateStr(toLocalDateString(current));
  }

  function goToToday() {
    setDateStr(toLocalDateString(new Date()));
  }

  return (
    <div className="space-y-6">
      {/* Controls - hidden when printing */}
      <div className="no-print space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-semibold text-textPrimary">Training Report</h1>
          <button
            onClick={() => window.print()}
            disabled={loading || !data}
            className="flex items-center gap-2 px-4 py-2 bg-accentBrand text-white rounded-lg font-medium hover:bg-accentBrand/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="w-4 h-4" />
            Print Report
          </button>
        </div>

        {/* Period Toggle */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex bg-bgSecondary rounded-lg border border-borderPrimary p-1">
            <button
              onClick={() => setPeriod('week')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === 'week'
                  ? 'bg-accentBrand text-white'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === 'month'
                  ? 'bg-accentBrand text-white'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              Monthly
            </button>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigatePeriod(-1)}
              className="p-2 rounded-lg hover:bg-bgSecondary text-textSecondary hover:text-textPrimary transition-colors"
              aria-label="Previous period"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToToday}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-bgSecondary text-sm text-textSecondary hover:text-textPrimary transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" />
              Today
            </button>
            <button
              onClick={() => navigatePeriod(1)}
              className="p-2 rounded-lg hover:bg-bgSecondary text-textSecondary hover:text-textPrimary transition-colors"
              aria-label="Next period"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-accentBrand" />
          <span className="ml-2 text-textSecondary">Generating report...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Report Content */}
      {!loading && data && (
        <div className="space-y-6 print:space-y-4">
          {/* Report Header */}
          <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm print:border-gray-300 print:shadow-none print:bg-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-display font-bold text-textPrimary print:text-black">
                  {data.periodLabel}
                </h2>
                <p className="text-sm text-textTertiary print:text-gray-500">
                  {formatShortDate(data.startDate)} &ndash; {formatShortDate(data.endDate)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-textTertiary print:text-gray-400 hidden print:block">
                  Dreamy Training Report
                </p>
                <p className="text-xs text-textTertiary print:text-gray-400">
                  Generated {new Date(data.generatedAt).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                  })}
                </p>
              </div>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <StatBox label="Total Miles" value={data.totalMiles.toString()} />
              <StatBox label="Runs" value={data.totalRuns.toString()} />
              <StatBox label="Time" value={formatDuration(data.totalMinutes)} />
              <StatBox label="Avg Pace" value={data.avgPaceSeconds ? `${formatPace(data.avgPaceSeconds)}/mi` : '--'} />
              <StatBox label="Avg Run" value={data.avgMilesPerRun ? `${data.avgMilesPerRun} mi` : '--'} />
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:gap-4">
            {/* Workout Breakdown */}
            <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm print:border-gray-300 print:shadow-none print:bg-white">
              <h3 className="font-semibold text-textPrimary mb-3 print:text-black">Workout Breakdown</h3>
              <BreakdownTable data={data} />
            </div>

            {/* Key Workouts */}
            <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm print:border-gray-300 print:shadow-none print:bg-white">
              <h3 className="font-semibold text-textPrimary mb-3 print:text-black">Key Workouts</h3>
              {data.keyWorkouts.length === 0 ? (
                <p className="text-sm text-textTertiary">No workouts in this period.</p>
              ) : (
                <div className="space-y-3">
                  {data.keyWorkouts.map((kw) => (
                    <div key={kw.id} className="flex items-start gap-3 p-3 rounded-lg bg-bgTertiary/50 print:bg-gray-50 print:border print:border-gray-200">
                      <div className="shrink-0">
                        <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${
                          kw.label === 'Fastest' ? 'bg-blue-500/20 text-blue-400 print:text-blue-700 print:bg-blue-50' :
                          kw.label === 'Longest' ? 'bg-green-500/20 text-green-400 print:text-green-700 print:bg-green-50' :
                          'bg-orange-500/20 text-orange-400 print:text-orange-700 print:bg-orange-50'
                        }`}>
                          {kw.label}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-textPrimary print:text-black">
                          {capitalizeType(kw.type)} &middot; {kw.distanceMiles} mi
                        </p>
                        <p className="text-xs text-textTertiary print:text-gray-500">
                          {formatShortDate(kw.date)}
                          {kw.avgPaceSeconds ? ` \u00B7 ${formatPace(kw.avgPaceSeconds)}/mi` : ''}
                          {kw.durationMinutes ? ` \u00B7 ${formatDuration(kw.durationMinutes)}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Daily Mileage Chart (weekly reports) */}
          {data.period === 'week' && data.dailyMileage.length > 0 && (
            <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm print:border-gray-300 print:shadow-none print:bg-white">
              <h3 className="font-semibold text-textPrimary mb-3 print:text-black">Daily Mileage</h3>
              <SimpleBarChart
                data={data.dailyMileage.map(d => ({
                  label: d.dayLabel,
                  value: d.miles,
                }))}
                label="Miles per Day"
              />
            </div>
          )}

          {/* Weekly Mileage Chart (monthly reports) */}
          {data.period === 'month' && data.weeklyProgression.length > 0 && (
            <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm print:border-gray-300 print:shadow-none print:bg-white">
              <h3 className="font-semibold text-textPrimary mb-3 print:text-black">Weekly Mileage</h3>
              <SimpleBarChart
                data={data.weeklyProgression.map(w => ({
                  label: w.weekLabel.split(' - ')[0],
                  value: w.miles,
                }))}
                label="Miles per Week"
              />

              {/* Weekly progression table */}
              <table className="w-full text-sm mt-4">
                <thead>
                  <tr className="border-b border-borderPrimary">
                    <th className="text-left py-2 font-medium text-textSecondary">Week</th>
                    <th className="text-right py-2 font-medium text-textSecondary">Runs</th>
                    <th className="text-right py-2 font-medium text-textSecondary">Miles</th>
                    <th className="text-right py-2 font-medium text-textSecondary">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.weeklyProgression.map((w) => (
                    <tr key={w.weekStart} className="border-b border-borderPrimary/50">
                      <td className="py-2 text-textPrimary">{w.weekLabel}</td>
                      <td className="py-2 text-right text-textSecondary">{w.runs}</td>
                      <td className="py-2 text-right text-textPrimary font-medium">{w.miles}</td>
                      <td className="py-2 text-right text-textSecondary">{formatDuration(w.minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom Row - Fitness, VDOT & Consistency */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:gap-4">
            {/* Fitness Trend */}
            <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm print:border-gray-300 print:shadow-none print:bg-white">
              <h3 className="font-semibold text-textPrimary mb-3 print:text-black">Fitness Trend</h3>
              {data.fitness ? (
                <div className="space-y-2 text-sm">
                  <FitnessRow label="CTL (Fitness)" start={data.fitness.startCtl} end={data.fitness.endCtl} />
                  <FitnessRow label="ATL (Fatigue)" start={data.fitness.startAtl} end={data.fitness.endAtl} />
                  <FitnessRow label="TSB (Form)" start={data.fitness.startTsb} end={data.fitness.endTsb} />
                  <div className="pt-2 border-t border-borderPrimary/50">
                    <p className="text-xs text-textTertiary">
                      Fitness {data.fitness.ctlChange >= 0 ? 'increased' : 'decreased'} by{' '}
                      <span className={`font-semibold ${data.fitness.ctlChange >= 0 ? 'text-green-400 print:text-green-700' : 'text-red-400 print:text-red-700'}`}>
                        {data.fitness.ctlChange >= 0 ? '+' : ''}{data.fitness.ctlChange}
                      </span>{' '}
                      points
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-textTertiary">Not enough data for fitness metrics.</p>
              )}
            </div>

            {/* VDOT */}
            <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm print:border-gray-300 print:shadow-none print:bg-white">
              <h3 className="font-semibold text-textPrimary mb-3 print:text-black">VDOT</h3>
              {data.vdot.endVdot ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-textSecondary">Start of Period</span>
                    <span className="text-textPrimary font-medium">{data.vdot.startVdot ?? '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-textSecondary">End of Period</span>
                    <span className="text-textPrimary font-medium">{data.vdot.endVdot}</span>
                  </div>
                  {data.vdot.change !== null && (
                    <div className="pt-2 border-t border-borderPrimary/50">
                      <p className="text-xs text-textTertiary">
                        Change:{' '}
                        <span className={`font-semibold ${data.vdot.change >= 0 ? 'text-green-400 print:text-green-700' : 'text-red-400 print:text-red-700'}`}>
                          {data.vdot.change >= 0 ? '+' : ''}{data.vdot.change}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-textTertiary">No VDOT data for this period.</p>
              )}
            </div>

            {/* Consistency */}
            <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm print:border-gray-300 print:shadow-none print:bg-white">
              <h3 className="font-semibold text-textPrimary mb-3 print:text-black">Consistency</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-textSecondary">Days Run</span>
                  <span className="text-textPrimary font-medium">
                    {data.consistency.daysRun} / {data.consistency.totalDaysInPeriod}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-textSecondary">Run Rate</span>
                  <span className="text-textPrimary font-medium">{data.consistency.runPercentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-textSecondary">Longest Streak</span>
                  <span className="text-textPrimary font-medium">{data.consistency.longestStreakInPeriod} days</span>
                </div>
                {data.consistency.currentStreak > 0 && (
                  <div className="flex justify-between">
                    <span className="text-textSecondary">Current Streak</span>
                    <span className="text-textPrimary font-medium">{data.consistency.currentStreak} days</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PRs Achieved */}
          {data.prsAchieved.length > 0 && (
            <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm print:border-gray-300 print:shadow-none print:bg-white">
              <h3 className="font-semibold text-textPrimary mb-3 print:text-black">PRs Achieved</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {data.prsAchieved.map((pr, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 print:bg-yellow-50 print:border-yellow-300">
                    <div>
                      <p className="text-sm font-semibold text-textPrimary print:text-black">{pr.distanceLabel}</p>
                      <p className="text-xs text-textTertiary print:text-gray-500">
                        {formatTimeFromSeconds(pr.timeSeconds)} &middot; {formatShortDate(pr.date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Print footer */}
          <div className="hidden print:block text-center pt-4 border-t border-gray-300">
            <p className="text-xs text-gray-400">
              Generated by Dreamy &middot; getdreamy.run
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
