'use client';

import { useState, useEffect } from 'react';
import { PieChart, TrendingUp, Target, Loader2, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { formatPace } from '@/lib/utils';
import {
  analyzeTrainingDistribution,
  getWeeklyRollups,
  getMonthlyRollups,
  getTrainingLoadRecommendations,
  type TrainingDistributionAnalysis,
  type WeeklyRollup,
  type MonthlyRollup,
} from '@/actions/training-analysis';

/**
 * Training Distribution Chart - shows polarized/pyramidal/threshold analysis
 */
export function TrainingDistributionChart() {
  const [analysis, setAnalysis] = useState<TrainingDistributionAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyzeTrainingDistribution(90).then(data => {
      setAnalysis(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <PieChart className="w-5 h-5 text-purple-500" />
          Training Distribution
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (!analysis || analysis.distribution === 'insufficient') {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <PieChart className="w-5 h-5 text-purple-500" />
          Training Distribution
        </h2>
        <p className="text-sm text-textTertiary">{analysis?.description || 'Not enough data yet'}</p>
      </div>
    );
  }

  const distributionLabels: Record<string, { label: string; color: string; bgColor: string }> = {
    polarized: { label: 'Polarized', color: 'text-teal-700 dark:text-teal-300', bgColor: 'bg-teal-50 dark:bg-teal-900/30' },
    pyramidal: { label: 'Pyramidal', color: 'text-indigo-700 dark:text-indigo-300', bgColor: 'bg-indigo-50 dark:bg-indigo-900/30' },
    threshold: { label: 'Threshold', color: 'text-rose-700 dark:text-rose-300', bgColor: 'bg-rose-50 dark:bg-rose-900/30' },
    mixed: { label: 'Mixed', color: 'text-textSecondary', bgColor: 'bg-bgTertiary' },
  };

  const distInfo = distributionLabels[analysis.distribution] || distributionLabels.mixed;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <PieChart className="w-5 h-5 text-purple-500" />
        Training Distribution
        <span className="text-xs text-tertiary font-normal ml-auto">Last 90 days</span>
      </h2>

      {/* Distribution type badge */}
      <div className="flex items-center gap-3 mb-4">
        <span className={`px-3 py-1.5 rounded-lg font-semibold ${distInfo.bgColor} ${distInfo.color}`}>
          {distInfo.label}
        </span>
        <span className="text-sm text-textSecondary">Distribution</span>
      </div>

      {/* Zone distribution bar */}
      <div className="h-8 rounded-full overflow-hidden flex mb-4">
        {analysis.zones.map(zone => (
          <div
            key={zone.zone}
            className={`${zone.color} transition-all`}
            style={{ width: `${zone.percentage}%` }}
            title={`${zone.label}: ${zone.percentage}%`}
          />
        ))}
      </div>

      {/* Zone legend */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {analysis.zones.map(zone => (
          <div key={zone.zone} className="text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <div className={`w-3 h-3 rounded-full ${zone.color}`} />
              <span className="text-xs text-textTertiary">{zone.label}</span>
            </div>
            <p className="text-lg font-bold text-primary">{zone.percentage}%</p>
            <p className="text-xs text-tertiary">{Math.round(zone.minutes / 60)}h {zone.minutes % 60}m</p>
          </div>
        ))}
      </div>

      {/* Ideal comparison */}
      <div className="bg-bgTertiary rounded-lg p-3 mb-4">
        <p className="text-xs font-medium text-textTertiary mb-2">vs. Ideal {distInfo.label}</p>
        <div className="space-y-2">
          {analysis.idealComparison.map(comp => {
            const diff = comp.actual - comp.ideal;
            const isGood = Math.abs(diff) <= 5;
            return (
              <div key={comp.zone} className="flex items-center gap-2 text-sm">
                <span className="w-16 text-textSecondary">{comp.zone}</span>
                <div className="flex-1 h-2 bg-bgTertiary rounded-full relative">
                  <div
                    className="absolute h-2 bg-textTertiary rounded-full"
                    style={{ width: `${Math.min(comp.actual, 100)}%` }}
                  />
                  <div
                    className="absolute h-4 w-0.5 bg-textSecondary -top-1"
                    style={{ left: `${comp.ideal}%` }}
                    title={`Ideal: ${comp.ideal}%`}
                  />
                </div>
                <span className={`w-16 text-right ${isGood ? 'text-teal-600' : 'text-textTertiary'}`}>
                  {comp.actual}% {diff !== 0 && `(${diff > 0 ? '+' : ''}${diff})`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Description and recommendation */}
      <p className="text-sm text-textSecondary mb-2">{analysis.description}</p>
      <div className={`rounded-lg p-3 text-sm ${
        analysis.score >= 70 ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300' :
        analysis.score >= 50 ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' :
        'bg-bgTertiary text-textSecondary'
      }`}>
        {analysis.score >= 70 ? <CheckCircle className="w-4 h-4 inline mr-1" /> :
         analysis.score >= 50 ? <AlertTriangle className="w-4 h-4 inline mr-1" /> :
         <Info className="w-4 h-4 inline mr-1" />}
        {analysis.recommendation}
      </div>
    </div>
  );
}

/**
 * Weekly Rollup Table
 */
export function WeeklyRollupTable() {
  const [rollups, setRollups] = useState<WeeklyRollup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWeeklyRollups(12).then(data => {
      setRollups(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-teal-500" />
          Weekly Summary
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-tertiary" />
        </div>
      </div>
    );
  }

  if (rollups.length === 0) {
    return null;
  }

  // Format date range
  function formatWeekRange(start: string, end: string): string {
    const s = new Date(start);
    const e = new Date(end);
    const sMonth = s.toLocaleDateString('en-US', { month: 'short' });
    const eMonth = e.toLocaleDateString('en-US', { month: 'short' });
    if (sMonth === eMonth) {
      return `${sMonth} ${s.getDate()}-${e.getDate()}`;
    }
    return `${sMonth} ${s.getDate()} - ${eMonth} ${e.getDate()}`;
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-4 sm:p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-teal-500" />
        Weekly Summary
      </h2>

      <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead>
            <tr className="text-left text-textTertiary border-b border-borderSecondary">
              <th className="pb-2 pr-2 font-medium whitespace-nowrap">Week</th>
              <th className="pb-2 px-1 font-medium text-right whitespace-nowrap">Miles</th>
              <th className="pb-2 px-1 font-medium text-right whitespace-nowrap hidden sm:table-cell">Runs</th>
              <th className="pb-2 px-1 font-medium text-right whitespace-nowrap">Long</th>
              <th className="pb-2 px-1 font-medium text-right whitespace-nowrap hidden sm:table-cell">Q</th>
              <th className="pb-2 px-1 font-medium text-right whitespace-nowrap hidden md:table-cell">Pace</th>
              <th className="pb-2 px-1 font-medium text-right whitespace-nowrap">CTL</th>
              <th className="pb-2 pl-1 font-medium text-right whitespace-nowrap">TSB</th>
            </tr>
          </thead>
          <tbody>
            {rollups.slice(0, 8).map((week, i) => {
              // Calculate week-over-week change
              const prevWeek = rollups[i + 1];
              const change = prevWeek ? ((week.totalMiles - prevWeek.totalMiles) / prevWeek.totalMiles) * 100 : 0;

              // TSB color coding
              const tsbColor = week.tsb === null ? 'text-tertiary' :
                week.tsb > 10 ? 'text-teal-600' :
                week.tsb > -10 ? 'text-textSecondary' :
                'text-rose-600';

              return (
                <tr key={week.weekStart} className="border-b border-borderSecondary">
                  <td className="py-2 pr-2">
                    <span className="text-primary whitespace-nowrap">{formatWeekRange(week.weekStart, week.weekEnd)}</span>
                  </td>
                  <td className="py-2 px-1 text-right">
                    <span className="font-mono font-semibold text-primary">{week.totalMiles}</span>
                    {change !== 0 && (
                      <span className={`ml-0.5 text-[10px] ${change > 0 ? 'text-teal-600' : 'text-rose-600'}`}>
                        {change > 0 ? '+' : ''}{Math.round(change)}%
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-1 text-right text-textSecondary hidden sm:table-cell">{week.workoutCount}</td>
                  <td className="py-2 px-1 text-right text-textSecondary">
                    {week.longRunMiles ? `${week.longRunMiles}` : '-'}
                  </td>
                  <td className="py-2 px-1 text-right hidden sm:table-cell">
                    {week.qualityWorkouts > 0 ? (
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-fuchsia-50 text-fuchsia-700 dark:text-fuchsia-300 text-[10px] font-medium">
                        {week.qualityWorkouts}
                      </span>
                    ) : (
                      <span className="text-tertiary">-</span>
                    )}
                  </td>
                  <td className="py-2 px-1 text-right font-mono text-textSecondary hidden md:table-cell">
                    {week.avgPaceSeconds ? formatPace(week.avgPaceSeconds) : '-'}
                  </td>
                  <td className="py-2 px-1 text-right font-mono text-emerald-600">
                    {week.ctl !== null ? Math.round(week.ctl) : '-'}
                  </td>
                  <td className={`py-2 pl-1 text-right font-mono ${tsbColor}`}>
                    {week.tsb !== null ? (week.tsb > 0 ? '+' : '') + Math.round(week.tsb) : '-'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Monthly Rollup Cards
 */
export function MonthlyRollupCards() {
  const [rollups, setRollups] = useState<MonthlyRollup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMonthlyRollups(6).then(data => {
      setRollups(data);
      setLoading(false);
    });
  }, []);

  if (loading || rollups.length === 0) {
    return null;
  }

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-teal-500" />
        Monthly Summary
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {rollups.slice(0, 6).map((month, i) => {
          const prevMonth = rollups[i + 1];
          const changePercent = prevMonth && prevMonth.totalMiles > 0
            ? Math.round(((month.totalMiles - prevMonth.totalMiles) / prevMonth.totalMiles) * 100)
            : null;

          return (
            <div key={`${month.year}-${month.month}`} className="bg-bgTertiary rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-textSecondary">{month.month} {month.year}</p>
                {changePercent !== null && (
                  <span className={`text-xs font-medium ${changePercent >= 0 ? 'text-teal-600' : 'text-rose-600'}`}>
                    {changePercent >= 0 ? '+' : ''}{changePercent}%
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-primary mb-1">{month.totalMiles}<span className="text-sm font-normal text-tertiary ml-1">mi</span></p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-textTertiary">
                <span>{month.workoutCount} runs</span>
                <span>~{month.weeklyAvgMiles}/wk</span>
                {month.races > 0 && (
                  <span className="text-purple-600 font-medium">{month.races} race{month.races > 1 ? 's' : ''}</span>
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
 * Training Load Recommendation Card
 */
export function TrainingLoadRecommendation() {
  const [rec, setRec] = useState<{
    currentWeeklyMiles: number;
    recommendedNextWeek: number;
    recommendation: string;
    reason: string;
    trend: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTrainingLoadRecommendations().then(data => {
      setRec(data);
      setLoading(false);
    });
  }, []);

  if (loading || !rec) {
    return null;
  }

  const trendColors: Record<string, { bg: string; text: string; icon: string }> = {
    building: { bg: 'bg-violet-50 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', icon: 'text-violet-600 dark:text-violet-400' },
    maintaining: { bg: 'bg-teal-50 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300', icon: 'text-teal-500 dark:text-teal-400' },
    recovering: { bg: 'bg-sky-50 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-300', icon: 'text-sky-500 dark:text-sky-400' },
    inconsistent: { bg: 'bg-bgTertiary', text: 'text-textSecondary', icon: 'text-textTertiary' },
  };

  const trendStyle = trendColors[rec.trend] || trendColors.inconsistent;

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      <h2 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <Target className="w-5 h-5 text-emerald-500" />
        Next Week
      </h2>

      <div className="flex items-center gap-4 mb-4">
        <div className="text-center">
          <p className="text-xs text-textTertiary mb-1">This Week</p>
          <p className="text-2xl font-bold text-primary">{rec.currentWeeklyMiles}</p>
          <p className="text-xs text-tertiary">miles</p>
        </div>
        <div className="text-2xl text-tertiary">&rarr;</div>
        <div className="text-center">
          <p className="text-xs text-textTertiary mb-1">Suggested</p>
          <p className="text-2xl font-bold text-emerald-600">{rec.recommendedNextWeek}</p>
          <p className="text-xs text-tertiary">miles</p>
        </div>
      </div>

      <div className={`rounded-lg p-3 ${trendStyle.bg}`}>
        <p className={`text-sm font-medium ${trendStyle.text}`}>{rec.recommendation}</p>
        <p className="text-xs text-textSecondary mt-1">{rec.reason}</p>
      </div>
    </div>
  );
}
