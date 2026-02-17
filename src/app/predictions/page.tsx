'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Heart,
  Info,
  Loader2,
  Shield,
  Target,
  Timer,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  getPredictionDashboardData,
  type PredictionDashboardData,
  type PredictionDashboardResult,
  type WorkoutSignalPoint,
} from '@/actions/prediction-dashboard';
import type { VdotHistoryEntry } from '@/actions/vdot-history';
import { formatRaceTime } from '@/lib/race-utils';
import { predictRaceTime } from '@/lib/training/vdot-calculator';
import { formatPace } from '@/lib/training';
import { cn, parseLocalDate } from '@/lib/utils';
import { useProfile } from '@/lib/profile-context';

export default function PredictionsPage() {
  const { activeProfile } = useProfile();
  const [data, setData] = useState<PredictionDashboardData | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const result = await getPredictionDashboardData(activeProfile?.id);
      setData(result.data);
      setError(result.error);
      setLoading(false);
    }
    load();
  }, [activeProfile?.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-dream-500" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="bg-surface-1 rounded-xl border border-default p-8 text-center">
          <Activity className="w-10 h-10 mx-auto mb-3 text-textTertiary opacity-50" />
          <p className="text-primary font-medium">Not enough data yet</p>
          <p className="text-sm text-textTertiary mt-1">
            Log some runs with heart rate data, or add a race result to see predictions.
          </p>
          {error && (
            <p className="text-xs text-red-500 mt-2 font-mono bg-red-50 dark:bg-red-900/20 rounded p-2">
              {error}
            </p>
          )}
          <Link href="/races" className="inline-block mt-3 text-sm text-dream-500 hover:text-dream-600 font-medium">
            Go to Racing page
          </Link>
        </div>
      </div>
    );
  }

  const { prediction, signalTimeline } = data;

  return (
    <div className="space-y-6 pb-8">
      <Header />

      {/* Hero: Blended VDOT + Confidence */}
      <HeroSection prediction={prediction} fitnessState={data.fitnessState} />

      {/* Distance Predictions */}
      <PredictionsGrid prediction={prediction} />

      {/* Race Prediction Trends */}
      {data.vdotHistory.length < 2 && (
        <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded p-2 font-mono">
          Race trends: {data.vdotHistory.length} VDOT history entries (need 2+)
          {error && <div className="mt-1">Server errors: {error}</div>}
        </div>
      )}
      <RacePredictionTrends vdotHistory={data.vdotHistory} />

      {/* Signal Comparison */}
      <SignalComparisonChart prediction={prediction} />

      {/* VO2max Timeline */}
      <Vo2maxTimeline signalTimeline={signalTimeline} blendedVdot={prediction.vdot} />

      {/* Efficiency Factor Trend */}
      <EfTrendChart signalTimeline={signalTimeline} />

      {/* Pace vs Heart Rate Scatter */}
      <PaceHrScatter signalTimeline={signalTimeline} />

      {/* Readiness Breakdown */}
      <ReadinessBreakdown prediction={prediction} volume={data.trainingVolume} />

      {/* Recent Workout Impact */}
      <RecentWorkoutImpact signalTimeline={signalTimeline} />

      {/* Signal Explainers */}
      <SignalExplainers prediction={prediction} />

      {/* Data Quality Footer */}
      <div className="text-center text-xs text-textTertiary space-y-1">
        <p>
          Based on {prediction.dataQuality.signalsUsed} signals from{' '}
          {prediction.dataQuality.workoutsUsed} workouts
          {prediction.dataQuality.hasHr && ' with HR data'}
          {prediction.dataQuality.hasRaces && ' + race results'}
        </p>
        <p>
          Predictions assume race-day conditions and proper taper. Actual results vary with
          weather, course, pacing strategy, and race execution.
        </p>
      </div>
    </div>
  );
}

// ==================== Header ====================

function Header() {
  return (
    <div className="flex items-center gap-3">
      <Link
        href="/races"
        className="p-1.5 rounded-lg hover:bg-surface-2 transition-colors text-textTertiary hover:text-primary"
      >
        <ArrowLeft className="w-5 h-5" />
      </Link>
      <div>
        <h1 className="text-2xl font-display font-semibold text-primary">Race Predictions</h1>
        <p className="text-sm text-textTertiary">Multi-signal analysis of your race fitness</p>
      </div>
    </div>
  );
}

// ==================== Hero Section ====================

function HeroSection({
  prediction,
  fitnessState,
}: {
  prediction: PredictionDashboardData['prediction'];
  fitnessState: PredictionDashboardData['fitnessState'];
}) {
  const confidenceBg =
    prediction.confidence === 'high'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : prediction.confidence === 'medium'
        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
        : 'bg-surface-2 text-textTertiary';

  const agreementColor =
    prediction.agreementScore >= 0.7
      ? 'text-green-600 dark:text-green-400'
      : prediction.agreementScore >= 0.4
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-red-500';

  return (
    <div className="bg-surface-1 rounded-xl border border-default p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* VDOT */}
        <div className="text-center sm:text-left">
          <p className="text-5xl font-bold text-dream-600 font-mono">{prediction.vdot}</p>
          <p className="text-sm text-textTertiary mt-1">
            VDOT ({prediction.vdotRange.low} &ndash; {prediction.vdotRange.high})
          </p>
        </div>

        <div className="hidden sm:block h-14 w-px bg-borderSecondary" />

        {/* Stats row */}
        <div className="flex flex-wrap gap-3 flex-1">
          <StatBadge
            label="Confidence"
            value={prediction.confidence}
            className={confidenceBg}
          />
          <StatBadge
            label="Agreement"
            value={`${Math.round(prediction.agreementScore * 100)}%`}
            icon={<Shield className="w-3.5 h-3.5" />}
            className={agreementColor}
          />
          <StatBadge
            label="CTL"
            value={Math.round(fitnessState.ctl).toString()}
            subtext="fitness"
          />
          <StatBadge
            label="TSB"
            value={Math.round(fitnessState.tsb).toString()}
            subtext={fitnessState.tsb >= 5 ? 'fresh' : fitnessState.tsb <= -10 ? 'fatigued' : 'normal'}
          />
        </div>
      </div>

      {/* Form note */}
      {prediction.formAdjustmentPct !== 0 && (
        <p className="mt-3 text-xs text-textTertiary">
          {prediction.formDescription}
        </p>
      )}

      {/* Agreement detail */}
      <p className="mt-2 text-xs text-textTertiary italic">{prediction.agreementDetails}</p>
    </div>
  );
}

function StatBadge({
  label,
  value,
  subtext,
  icon,
  className,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="bg-surface-2 rounded-lg px-3 py-2 min-w-[70px]">
      <p className="text-[10px] text-textTertiary uppercase tracking-wide">{label}</p>
      <p className={cn('text-sm font-semibold flex items-center gap-1', className || 'text-primary')}>
        {icon}
        {value}
      </p>
      {subtext && <p className="text-[10px] text-textTertiary">{subtext}</p>}
    </div>
  );
}

// ==================== Predictions Grid ====================

function PredictionsGrid({ prediction }: { prediction: PredictionDashboardData['prediction'] }) {
  return (
    <div>
      <SectionHeader label="Race Predictions" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {prediction.predictions.map((pred) => (
          <div
            key={pred.distance}
            className="bg-surface-1 rounded-xl border border-default p-4 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-textTertiary">{pred.distance}</p>
              {pred.readiness < 0.7 && (
                <span className="text-xs text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">
                  Low readiness
                </span>
              )}
            </div>

            <p className="text-2xl font-bold text-primary font-mono">
              {formatRaceTime(pred.predictedSeconds)}
            </p>
            <p className="text-sm text-textTertiary">{formatPace(pred.pacePerMile)}/mi</p>

            {/* Range */}
            <div className="mt-2 flex items-center gap-2 text-xs text-textTertiary">
              <span>Range:</span>
              <span className="font-mono">
                {formatRaceTime(pred.range.fast)} &ndash; {formatRaceTime(pred.range.slow)}
              </span>
            </div>

            {/* Readiness */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-textTertiary">Readiness</span>
                <span className="font-medium text-primary">{Math.round(pred.readiness * 100)}%</span>
              </div>
              <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    pred.readiness >= 0.7
                      ? 'bg-green-500'
                      : pred.readiness >= 0.5
                        ? 'bg-yellow-500'
                        : 'bg-red-400'
                  )}
                  style={{ width: `${Math.round(pred.readiness * 100)}%` }}
                />
              </div>
              {/* Readiness factors */}
              <div className="flex gap-3 mt-1.5 text-[10px] text-textTertiary">
                <span>Vol {Math.round(pred.readinessFactors.volume * 100)}%</span>
                <span>Long {Math.round(pred.readinessFactors.longRun * 100)}%</span>
                <span>Consistency {Math.round(pred.readinessFactors.consistency * 100)}%</span>
              </div>
            </div>

            {/* Adjustment reasons */}
            {pred.adjustmentReasons.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {pred.adjustmentReasons.map((reason, i) => (
                  <p key={i} className="text-[10px] text-amber-600 dark:text-amber-400">
                    {reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== Signal Comparison Chart ====================

function SignalComparisonChart({ prediction }: { prediction: PredictionDashboardData['prediction'] }) {
  const absoluteSignals = prediction.signals.filter(
    (s) => s.name !== 'Efficiency Factor Trend'
  );
  const efTrend = prediction.signals.find((s) => s.name === 'Efficiency Factor Trend');

  if (absoluteSignals.length === 0) return null;

  const minVdot = Math.min(...absoluteSignals.map((s) => s.estimatedVdot)) - 2;
  const maxVdot = Math.max(...absoluteSignals.map((s) => s.estimatedVdot)) + 2;
  const range = maxVdot - minVdot;

  return (
    <div>
      <SectionHeader label="Signal Comparison" />
      <div className="bg-surface-1 rounded-xl border border-default p-5 shadow-sm">
        <p className="text-xs text-textTertiary mb-4">
          Each signal independently estimates your VDOT. Higher agreement = more reliable prediction.
        </p>

        <div className="space-y-3">
          {absoluteSignals.map((signal) => {
            const pct = ((signal.estimatedVdot - minVdot) / range) * 100;
            const blendedPct = ((prediction.vdot - minVdot) / range) * 100;

            return (
              <div key={signal.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-primary truncate mr-2">
                    {signal.name}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm font-mono font-bold text-primary">
                      {signal.estimatedVdot.toFixed(1)}
                    </span>
                    <span className="text-[10px] text-textTertiary">
                      w={signal.weight.toFixed(1)} c={signal.confidence.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Bar */}
                <div className="relative h-5 bg-surface-2 rounded-full overflow-visible">
                  {/* Blended VDOT marker */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-dream-500 z-10"
                    style={{ left: `${Math.max(0, Math.min(100, blendedPct))}%` }}
                    title={`Blended: ${prediction.vdot}`}
                  />

                  {/* Signal bar */}
                  <div
                    className={cn(
                      'absolute top-0.5 bottom-0.5 rounded-full transition-all',
                      signal.confidence >= 0.6
                        ? 'bg-dream-500/80'
                        : signal.confidence >= 0.4
                          ? 'bg-dream-400/60'
                          : 'bg-dream-300/40'
                    )}
                    style={{
                      left: `${Math.max(0, Math.min(pct, blendedPct))}%`,
                      right: `${100 - Math.max(pct, blendedPct)}%`,
                      minWidth: '4px',
                    }}
                  />

                  {/* Signal dot */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-dream-600 border-2 border-surface-1 z-20"
                    style={{ left: `calc(${Math.max(2, Math.min(98, pct))}% - 6px)` }}
                  />
                </div>

                <p className="text-[10px] text-textTertiary mt-0.5">{signal.description}</p>
              </div>
            );
          })}
        </div>

        {/* EF Trend modifier */}
        {efTrend && (
          <div className="mt-4 pt-3 border-t border-borderSecondary">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-primary">{efTrend.name}</span>
              <span
                className={cn(
                  'text-sm font-mono font-bold',
                  efTrend.estimatedVdot > 0
                    ? 'text-green-600'
                    : efTrend.estimatedVdot < 0
                      ? 'text-red-500'
                      : 'text-textTertiary'
                )}
              >
                {efTrend.estimatedVdot > 0 ? '+' : ''}
                {efTrend.estimatedVdot.toFixed(1)} VDOT modifier
              </span>
            </div>
            <p className="text-[10px] text-textTertiary">{efTrend.description}</p>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-[10px] text-textTertiary">
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 bg-dream-500 rounded inline-block" />
            Blended VDOT ({prediction.vdot})
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-dream-600 border-2 border-surface-1 inline-block" />
            Signal estimate
          </span>
        </div>
      </div>
    </div>
  );
}

// ==================== Shared Chart Helpers ====================

const TIME_RANGES = [
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '2Y', days: 730 },
] as const;

type TimeRangeLabel = typeof TIME_RANGES[number]['label'];

const WORKOUT_COLORS: Record<string, string> = {
  easy: '#5ea8c8',
  long: '#14b8a6',
  tempo: '#6366f1',
  interval: '#f59e0b',
};
const WORKOUT_COLOR_DEFAULT = '#a78bfa';

function getWorkoutColor(type: string) {
  return WORKOUT_COLORS[type] || WORKOUT_COLOR_DEFAULT;
}

function filterByRange<T extends { date: string }>(points: T[], days: number): T[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return points.filter(p => p.date >= cutoffStr);
}

/** IQR-based outlier removal. Returns points within Q1 - k*IQR to Q3 + k*IQR. */
function filterOutliersIQR<T>(points: T[], getValue: (p: T) => number, k = 1.5): T[] {
  if (points.length < 5) return points;
  const sorted = points.map(getValue).sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  const lo = q1 - k * iqr;
  const hi = q3 + k * iqr;
  return points.filter(p => {
    const v = getValue(p);
    return v >= lo && v <= hi;
  });
}

function computeDateLabels(
  points: { date: string }[],
  getX: (i: number) => number,
  rangeDays: number,
) {
  if (points.length < 2) return [];
  const targetCount = rangeDays > 365 ? 6 : rangeDays > 180 ? 5 : 4;
  const labels: { x: number; label: string }[] = [];
  const includeYear = rangeDays > 365;
  for (let t = 0; t <= targetCount; t++) {
    const idx = Math.round((t / targetCount) * (points.length - 1));
    const date = points[idx].date;
    const fmt: Intl.DateTimeFormatOptions = includeYear
      ? { month: 'short', year: '2-digit' }
      : { month: 'short', day: 'numeric' };
    labels.push({
      x: getX(idx),
      label: parseLocalDate(date).toLocaleDateString('en-US', fmt),
    });
  }
  return labels;
}

function TimeRangeSelector({ selected, onChange }: { selected: TimeRangeLabel; onChange: (r: TimeRangeLabel) => void }) {
  return (
    <div className="flex gap-1">
      {TIME_RANGES.map(r => (
        <button
          key={r.label}
          onClick={() => onChange(r.label)}
          className={cn(
            'px-2 py-0.5 text-[10px] rounded font-medium transition-colors',
            selected === r.label
              ? 'bg-dream-600 text-white'
              : 'bg-surface-2 text-textTertiary hover:text-primary'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

function ChartLegend({ items, x, y }: { items: { label: string; color: string; type: 'dot' | 'line' }[]; x: number; y: number }) {
  let offsetY = 0;
  return (
    <g>
      {items.map((item, i) => {
        const thisY = y + offsetY;
        offsetY += 10;
        return (
          <g key={i}>
            {item.type === 'dot' ? (
              <circle cx={x + 4} cy={thisY} r={2.5} fill={item.color} opacity={0.8} />
            ) : (
              <line x1={x} y1={thisY} x2={x + 8} y2={thisY} stroke={item.color} strokeWidth={1.2} />
            )}
            <text x={x + 11} y={thisY + 3} fill="var(--chart-axis, #9ca3af)" fontSize="6.5">
              {item.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ==================== VO2max Timeline ====================

function Vo2maxTimeline({
  signalTimeline,
  blendedVdot,
}: {
  signalTimeline: WorkoutSignalPoint[];
  blendedVdot: number;
}) {
  const [range, setRange] = useState<TimeRangeLabel>('6M');
  const rangeDays = TIME_RANGES.find(r => r.label === range)!.days;
  const showDots = true;

  const allVo2Points = useMemo(() => {
    return signalTimeline
      .filter((s) => s.effectiveVo2max != null && s.isSteadyState &&
        // Exclude workouts with suspiciously low HR (bad sensor data)
        (s.avgHr == null || s.avgHr >= 90))
      .map((s) => ({
        date: s.date,
        vo2max: s.effectiveVo2max!,
        workoutType: s.workoutType,
        distanceMiles: s.distanceMiles,
        name: s.stravaName,
      }));
  }, [signalTimeline]);

  const vo2Points = useMemo(() => {
    const ranged = filterByRange(allVo2Points, rangeDays);
    return filterOutliersIQR(ranged, p => p.vo2max);
  }, [allVo2Points, rangeDays]);

  if (vo2Points.length < 3) return null;

  const vdots = vo2Points.map((p) => p.vo2max);
  const minV = Math.min(...vdots) - 2;
  const maxV = Math.max(...vdots) + 2;
  const rangeV = maxV - minV || 5;

  // 7-day rolling average
  const rollingAvg = vo2Points.map((p, i) => {
    const cutoff = new Date(p.date);
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const window = vo2Points.filter((q, j) => j <= i && q.date >= cutoffStr);
    return window.reduce((s, q) => s + q.vo2max, 0) / window.length;
  });

  const VB_W = 500;
  const VB_H = 195;
  const PAD = { top: 10, bottom: 40, left: 40, right: 10 };
  const chartW = VB_W - PAD.left - PAD.right;
  const chartH = VB_H - PAD.top - PAD.bottom;

  const getX = (i: number) => PAD.left + (i / (vo2Points.length - 1)) * chartW;
  const getY = (v: number) => PAD.top + chartH - ((v - minV) / rangeV) * chartH;

  // Grid lines
  const gridStep = rangeV > 10 ? 5 : rangeV > 4 ? 2 : 1;
  const gridLines: number[] = [];
  for (let v = Math.ceil(minV / gridStep) * gridStep; v <= maxV; v += gridStep) {
    gridLines.push(v);
  }

  // Rolling avg path
  const avgPath = rollingAvg
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(v).toFixed(1)}`)
    .join(' ');

  // Blended VDOT line
  const blendedY = getY(blendedVdot);

  const dateLabels = useMemo(
    () => computeDateLabels(vo2Points, getX, rangeDays),
    [vo2Points, rangeDays]
  );

  // Workout types present (for legend)
  const typesPresent = useMemo(() => {
    const types = new Set(vo2Points.map(p => p.workoutType));
    return ['easy', 'long', 'tempo', 'interval'].filter(t => types.has(t));
  }, [vo2Points]);

  const legendItems = [
    ...typesPresent.map(t => ({ label: t, color: getWorkoutColor(t), type: 'dot' as const })),
    { label: '7d avg', color: 'var(--accent-brand, #7c6cf0)', type: 'line' as const },
  ];

  return (
    <div>
      <SectionHeader label="Effective VO2max (from HR)" />
      <div className="bg-surface-1 rounded-xl border border-default p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-textTertiary">
            Each dot is a workout&apos;s estimated VO2max from pace + heart rate.{' '}
            7-day rolling average. Not the same as VDOT (which uses race data).
          </p>
          <TimeRangeSelector selected={range} onChange={setRange} />
        </div>

        <div className="relative">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
            {/* Grid */}
            {gridLines.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.left} y1={getY(v)} x2={VB_W - PAD.right} y2={getY(v)}
                  stroke="var(--chart-grid, #e5e7eb)" strokeWidth="0.5"
                />
                <text x={PAD.left - 4} y={getY(v) + 3} textAnchor="end" fill="var(--chart-axis, #9ca3af)" fontSize="8">
                  {v}
                </text>
              </g>
            ))}

            {/* Date tick marks */}
            {dateLabels.map((dl, i) => (
              <g key={i}>
                <line
                  x1={dl.x} y1={PAD.top + chartH} x2={dl.x} y2={PAD.top + chartH + 3}
                  stroke="var(--chart-axis, #9ca3af)" strokeWidth="0.5"
                />
                <text x={dl.x} y={PAD.top + chartH + 12} textAnchor="middle" fill="var(--chart-axis, #9ca3af)" fontSize="7">
                  {dl.label}
                </text>
              </g>
            ))}

            {/* Blended VDOT reference line */}
            {blendedY >= PAD.top && blendedY <= PAD.top + chartH && (
              <line
                x1={PAD.left} y1={blendedY} x2={VB_W - PAD.right} y2={blendedY}
                stroke="var(--accent-brand, #7c6cf0)" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.6"
              />
            )}

            {/* Rolling average line */}
            <path d={avgPath} fill="none" stroke="var(--accent-brand, #7c6cf0)" strokeWidth="1.5" strokeLinejoin="round" />

            {/* Individual data points (hidden for > 1Y) */}
            {showDots && vo2Points.map((p, i) => (
              <circle
                key={i}
                cx={getX(i)} cy={getY(p.vo2max)} r={2}
                fill={getWorkoutColor(p.workoutType)} opacity={0.7}
              >
                <title>
                  {p.date}: VO2max {p.vo2max.toFixed(1)} ({p.workoutType}{p.name ? ` — ${p.name}` : ''})
                </title>
              </circle>
            ))}

          </svg>
        </div>
        {/* Legend below chart */}
        <div className="flex flex-wrap gap-3 mt-1.5 justify-center">
          {legendItems.map((item, i) => (
            <span key={i} className="flex items-center gap-1 text-[10px] text-textTertiary capitalize">
              {item.type === 'dot' ? (
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: item.color }} />
              ) : (
                <span className="w-4 h-0.5 rounded inline-block" style={{ backgroundColor: item.color }} />
              )}
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== EF Trend Chart ====================

function EfTrendChart({ signalTimeline }: { signalTimeline: WorkoutSignalPoint[] }) {
  const [range, setRange] = useState<TimeRangeLabel>('6M');
  const rangeDays = TIME_RANGES.find(r => r.label === range)!.days;
  const showDots = true;

  const allEfPoints = useMemo(() => {
    return signalTimeline
      .filter(
        (s) =>
          s.efficiencyFactor != null &&
          s.isSteadyState &&
          s.distanceMiles >= 1 &&
          s.durationMinutes >= 20 &&
          // Exclude workouts with suspiciously low HR (bad sensor data)
          (s.avgHr == null || s.avgHr >= 90)
      )
      .map((s) => ({
        date: s.date,
        ef: s.efficiencyFactor!,
        workoutType: s.workoutType,
        name: s.stravaName,
      }));
  }, [signalTimeline]);

  const efPoints = useMemo(() => {
    const ranged = filterByRange(allEfPoints, rangeDays);
    return filterOutliersIQR(ranged, p => p.ef);
  }, [allEfPoints, rangeDays]);

  // Theil-Sen robust regression (median of pairwise slopes — resistant to outliers)
  const regression = useMemo(() => {
    if (efPoints.length < 5) return null;

    const firstDate = new Date(efPoints[0].date + 'T12:00:00Z').getTime();
    const xs = efPoints.map((p) => (new Date(p.date + 'T12:00:00Z').getTime() - firstDate) / (1000 * 60 * 60 * 24));
    const ys = efPoints.map((p) => p.ef);
    const n = xs.length;

    // Collect all pairwise slopes (deterministic)
    const slopes: number[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (xs[j] !== xs[i]) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
      }
    }

    if (slopes.length === 0) return null;
    slopes.sort((a, b) => a - b);
    const slope = slopes[Math.floor(slopes.length / 2)];

    // Intercept: median of (y_i - slope * x_i)
    const intercepts = xs.map((x, i) => ys[i] - slope * x);
    intercepts.sort((a, b) => a - b);
    const intercept = intercepts[Math.floor(intercepts.length / 2)];

    const totalDays = xs[xs.length - 1];
    const yMean = ys.reduce((s, y) => s + y, 0) / n;
    const pctChange = totalDays > 0 ? ((slope * totalDays) / yMean) * 100 : 0;

    return { slope, intercept, xs, totalDays, pctChange };
  }, [efPoints]);

  if (efPoints.length < 5) return null;

  const efs = efPoints.map((p) => p.ef);
  const minEf = Math.min(...efs) - 0.05;
  const maxEf = Math.max(...efs) + 0.05;
  const rangeEf = maxEf - minEf || 0.2;

  const VB_W = 500;
  const VB_H = 195;
  const PAD = { top: 10, bottom: 40, left: 40, right: 10 };
  const chartW = VB_W - PAD.left - PAD.right;
  const chartH = VB_H - PAD.top - PAD.bottom;

  const getX = (i: number) => PAD.left + (i / (efPoints.length - 1)) * chartW;
  const getY = (v: number) => PAD.top + chartH - ((v - minEf) / rangeEf) * chartH;

  const improving = regression && regression.pctChange > 0;

  const dateLabels = useMemo(
    () => computeDateLabels(efPoints, getX, rangeDays),
    [efPoints, rangeDays]
  );

  // Workout types present (for legend)
  const typesPresent = useMemo(() => {
    const types = new Set(efPoints.map(p => p.workoutType));
    return ['easy', 'long', 'tempo', 'interval'].filter(t => types.has(t));
  }, [efPoints]);

  const legendItems = [
    ...typesPresent.map(t => ({ label: t, color: getWorkoutColor(t), type: 'dot' as const })),
    { label: 'trend', color: improving ? '#22c55e' : '#ef4444', type: 'line' as const },
  ];

  return (
    <div>
      <SectionHeader label="Efficiency Factor Trend" />
      <div className="bg-surface-1 rounded-xl border border-default p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <p className="text-xs text-textTertiary">
              Pace / HR ratio for easy/steady runs. Rising EF = improving fitness.
            </p>
            {regression && (
              <span
                className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded flex-shrink-0',
                  improving
                    ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
                    : 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                )}
              >
                {improving ? '+' : ''}
                {regression.pctChange.toFixed(1)}%
              </span>
            )}
          </div>
          <TimeRangeSelector selected={range} onChange={setRange} />
        </div>

        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid */}
          {[0.25, 0.5, 0.75].map((frac) => {
            const v = minEf + rangeEf * frac;
            return (
              <g key={frac}>
                <line
                  x1={PAD.left} y1={getY(v)} x2={VB_W - PAD.right} y2={getY(v)}
                  stroke="var(--chart-grid, #e5e7eb)" strokeWidth="0.5"
                />
                <text x={PAD.left - 4} y={getY(v) + 3} textAnchor="end" fill="var(--chart-axis, #9ca3af)" fontSize="7">
                  {v.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Date tick marks */}
          {dateLabels.map((dl, i) => (
            <g key={i}>
              <line
                x1={dl.x} y1={PAD.top + chartH} x2={dl.x} y2={PAD.top + chartH + 3}
                stroke="var(--chart-axis, #9ca3af)" strokeWidth="0.5"
              />
              <text x={dl.x} y={PAD.top + chartH + 12} textAnchor="middle" fill="var(--chart-axis, #9ca3af)" fontSize="7">
                {dl.label}
              </text>
            </g>
          ))}

          {/* Regression line */}
          {regression && (
            <line
              x1={getX(0)} y1={getY(regression.intercept)}
              x2={getX(efPoints.length - 1)} y2={getY(regression.intercept + regression.slope * regression.totalDays)}
              stroke={improving ? '#22c55e' : '#ef4444'} strokeWidth="1.2" strokeDasharray="6 3" opacity="0.7"
            />
          )}

          {/* Data points (hidden for > 1Y) */}
          {showDots && efPoints.map((p, i) => (
            <circle
              key={i}
              cx={getX(i)} cy={getY(p.ef)} r={2.5}
              fill={getWorkoutColor(p.workoutType)} opacity={0.7}
            >
              <title>
                {p.date}: EF {p.ef.toFixed(3)} ({p.workoutType}{p.name ? ` — ${p.name}` : ''})
              </title>
            </circle>
          ))}

        </svg>
        {/* Legend below chart */}
        <div className="flex flex-wrap gap-3 mt-1.5 justify-center">
          {legendItems.map((item, i) => (
            <span key={i} className="flex items-center gap-1 text-[10px] text-textTertiary capitalize">
              {item.type === 'dot' ? (
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: item.color }} />
              ) : (
                <span className="w-4 h-0.5 rounded inline-block" style={{ backgroundColor: item.color }} />
              )}
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== Pace vs Heart Rate Scatter ====================

function PaceHrScatter({ signalTimeline }: { signalTimeline: WorkoutSignalPoint[] }) {
  const [range, setRange] = useState<TimeRangeLabel>('6M');
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(['easy', 'long', 'tempo', 'interval', 'steady', 'marathon']));
  const rangeDays = TIME_RANGES.find(r => r.label === range)!.days;

  // Build scatter points from cleaned data
  const allPoints = useMemo(() => {
    return signalTimeline
      .filter(s =>
        s.avgHr != null && s.avgHr >= 90 && s.avgHr <= 210 &&
        s.isSteadyState &&
        s.distanceMiles >= 1 &&
        s.durationMinutes >= 15 &&
        (s.elevationAdjustedPace || s.weatherAdjustedPace || s.avgPaceSeconds)
      )
      .map(s => {
        // Use most adjusted pace available (seconds per mile)
        const rawPace = s.elevationAdjustedPace || s.weatherAdjustedPace || s.avgPaceSeconds!;
        return {
          date: s.date,
          pace: rawPace, // seconds per mile
          hr: s.avgHr!,
          workoutType: s.workoutType,
          name: s.stravaName,
          distanceMiles: s.distanceMiles,
        };
      })
      // Filter out unrealistic paces (faster than 4:00/mi or slower than 16:00/mi)
      .filter(p => p.pace >= 240 && p.pace <= 960);
  }, [signalTimeline]);

  // Apply range + type filters, then outlier removal
  const points = useMemo(() => {
    const ranged = filterByRange(allPoints, rangeDays);
    const typed = ranged.filter(p => activeTypes.has(p.workoutType));
    // IQR outlier removal on both pace and HR independently
    const cleanPace = filterOutliersIQR(typed, p => p.pace);
    return filterOutliersIQR(cleanPace, p => p.hr);
  }, [allPoints, rangeDays, activeTypes]);

  // Theil-Sen regression: HR = slope * pace + intercept
  const regression = useMemo(() => {
    if (points.length < 5) return null;

    const xs = points.map(p => p.pace);
    const ys = points.map(p => p.hr);
    const n = xs.length;

    // Pairwise slopes
    const slopes: number[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (xs[j] !== xs[i]) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
      }
    }
    if (slopes.length === 0) return null;
    slopes.sort((a, b) => a - b);
    const slope = slopes[Math.floor(slopes.length / 2)];

    const intercepts = xs.map((x, i) => ys[i] - slope * x);
    intercepts.sort((a, b) => a - b);
    const intercept = intercepts[Math.floor(intercepts.length / 2)];

    // R² (coefficient of determination)
    const yMean = ys.reduce((s, y) => s + y, 0) / n;
    const ssRes = ys.reduce((s, y, i) => s + (y - (slope * xs[i] + intercept)) ** 2, 0);
    const ssTot = ys.reduce((s, y) => s + (y - yMean) ** 2, 0);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

    return { slope, intercept, r2 };
  }, [points]);

  // Workout types present in the full dataset (for toggles)
  const typesInData = useMemo(() => {
    const types = new Set(allPoints.map(p => p.workoutType));
    return ['easy', 'long', 'steady', 'marathon', 'tempo', 'interval'].filter(t => types.has(t));
  }, [allPoints]);

  const toggleType = (type: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size > 1) next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  if (points.length < 5) return null;

  // Fixed chart bounds (round numbers covering ~97% of activities, auto-expand if needed)
  const paces = points.map(p => p.pace);
  const hrs = points.map(p => p.hr);
  const minPace = Math.min(360, ...paces);  // 6:00/mi floor
  const maxPace = Math.max(600, ...paces);  // 10:00/mi ceiling
  const minHr = Math.min(130, ...hrs);       // 130 bpm floor
  const maxHr = Math.max(190, ...hrs);       // 190 bpm ceiling
  const paceRange = maxPace - minPace;
  const hrRange = maxHr - minHr;

  const VB_W = 500;
  const VB_H = 260;
  const PAD = { top: 12, bottom: 40, left: 38, right: 12 };
  const chartW = VB_W - PAD.left - PAD.right;
  const chartH = VB_H - PAD.top - PAD.bottom;

  // X axis: faster pace (lower seconds) on RIGHT side (more intuitive)
  const getX = (pace: number) => PAD.left + chartW - ((pace - minPace) / paceRange) * chartW;
  const getY = (hr: number) => PAD.top + chartH - ((hr - minHr) / hrRange) * chartH;

  // Grid lines for HR (Y axis)
  const hrStep = hrRange > 40 ? 10 : hrRange > 20 ? 5 : 2;
  const hrGridLines: number[] = [];
  for (let h = Math.ceil(minHr / hrStep) * hrStep; h <= maxHr; h += hrStep) {
    hrGridLines.push(h);
  }

  // Grid lines for Pace (X axis) — every 30 seconds
  const paceStep = paceRange > 240 ? 60 : 30;
  const paceGridLines: number[] = [];
  for (let p = Math.ceil(minPace / paceStep) * paceStep; p <= maxPace; p += paceStep) {
    paceGridLines.push(p);
  }

  // Regression line endpoints
  const regLine = regression ? {
    x1: getX(minPace),
    y1: getY(regression.slope * minPace + regression.intercept),
    x2: getX(maxPace),
    y2: getY(regression.slope * maxPace + regression.intercept),
  } : null;

  return (
    <div>
      <SectionHeader label="Pace vs Heart Rate" />
      <div className="bg-surface-1 rounded-xl border border-default p-5 shadow-sm">
        {/* Controls */}
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-2">
            <p className="text-xs text-textTertiary">
              Adjusted pace vs HR for steady runs. Tighter cluster = more consistent fitness.
            </p>
            {regression && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs font-mono font-medium text-dream-500 bg-dream-50 dark:bg-dream-900/20 px-2 py-0.5 rounded">
                  R² = {regression.r2.toFixed(2)}
                </span>
                <span className="text-xs font-mono font-medium text-textTertiary bg-surface-2 px-2 py-0.5 rounded">
                  {(regression.slope * 60).toFixed(1)} bpm/min
                </span>
              </div>
            )}
          </div>
          <TimeRangeSelector selected={range} onChange={setRange} />
        </div>

        {/* Type toggles */}
        <div className="flex items-center gap-1.5 mb-3">
          {typesInData.map(type => (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={cn(
                'px-2 py-0.5 text-[10px] rounded font-medium transition-colors border capitalize',
                activeTypes.has(type)
                  ? 'border-transparent text-white'
                  : 'border-borderSecondary text-textTertiary bg-surface-2'
              )}
              style={activeTypes.has(type) ? { backgroundColor: getWorkoutColor(type) } : undefined}
            >
              {type}
            </button>
          ))}
          <span className="text-[10px] text-textTertiary ml-auto">{points.length} workouts</span>
        </div>

        {/* Chart */}
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* HR grid lines (horizontal) */}
          {hrGridLines.map(h => (
            <g key={`hr-${h}`}>
              <line
                x1={PAD.left} y1={getY(h)} x2={VB_W - PAD.right} y2={getY(h)}
                stroke="var(--chart-grid, #e5e7eb)" strokeWidth="0.5"
              />
              <text x={PAD.left - 4} y={getY(h) + 3} textAnchor="end" fill="var(--chart-axis, #9ca3af)" fontSize="7">
                {h}
              </text>
            </g>
          ))}

          {/* Pace grid lines (vertical) */}
          {paceGridLines.map(p => (
            <g key={`pace-${p}`}>
              <line
                x1={getX(p)} y1={PAD.top} x2={getX(p)} y2={PAD.top + chartH}
                stroke="var(--chart-grid, #e5e7eb)" strokeWidth="0.5"
              />
              <text x={getX(p)} y={PAD.top + chartH + 12} textAnchor="middle" fill="var(--chart-axis, #9ca3af)" fontSize="7">
                {formatPaceFromSeconds(p)}
              </text>
            </g>
          ))}

          {/* Axis labels */}
          <text x={VB_W / 2} y={VB_H - 2} textAnchor="middle" fill="var(--chart-axis, #9ca3af)" fontSize="7">
            Pace (min/mi) — faster →
          </text>
          <text
            x={8} y={VB_H / 2}
            textAnchor="middle" fill="var(--chart-axis, #9ca3af)" fontSize="7"
            transform={`rotate(-90, 8, ${VB_H / 2})`}
          >
            Heart Rate (bpm)
          </text>

          {/* Regression line */}
          {regLine && (
            <line
              x1={regLine.x1} y1={regLine.y1} x2={regLine.x2} y2={regLine.y2}
              stroke="var(--accent-brand, #7c6cf0)" strokeWidth="1.2" strokeDasharray="6 3" opacity="0.7"
            />
          )}

          {/* Data points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={getX(p.pace)} cy={getY(p.hr)}
              r={2.5}
              fill={getWorkoutColor(p.workoutType)}
              opacity={0.7}
            >
              <title>
                {p.name || p.workoutType}{'\n'}
                {formatPaceFromSeconds(p.pace)}/mi · {Math.round(p.hr)} bpm{'\n'}
                {p.distanceMiles.toFixed(1)} mi · {parseLocalDate(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </title>
            </circle>
          ))}

          {/* Legend inside chart — top left */}
          <ChartLegend
            items={[
              ...typesInData.filter(t => activeTypes.has(t)).map(t => ({ label: t, color: getWorkoutColor(t), type: 'dot' as const })),
              ...(regression ? [{ label: `fit (R²=${regression.r2.toFixed(2)})`, color: 'var(--accent-brand, #7c6cf0)', type: 'line' as const }] : []),
            ]}
            x={PAD.left + 4}
            y={PAD.top + 4}
          />
        </svg>
      </div>
    </div>
  );
}

// ==================== Readiness Breakdown ====================

function ReadinessBreakdown({
  prediction,
  volume,
}: {
  prediction: PredictionDashboardData['prediction'];
  volume: PredictionDashboardData['trainingVolume'];
}) {
  return (
    <div>
      <SectionHeader label="Endurance Readiness" />
      <div className="bg-surface-1 rounded-xl border border-default p-5 shadow-sm">
        <p className="text-xs text-textTertiary mb-4">
          Readiness measures whether your training volume, long runs, and consistency support each
          race distance. Low readiness adds a time penalty because undertrained runners slow more
          than fitness alone would predict.
        </p>

        {/* Volume context */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <MiniStat
            label="Weekly Miles"
            value={`${volume.avgWeeklyMiles4Weeks}`}
            subtext="4-week avg"
          />
          <MiniStat
            label="Longest Run"
            value={`${volume.longestRecentRunMiles} mi`}
            subtext="last 4 weeks"
          />
          <MiniStat
            label="Workouts"
            value={`${volume.totalWorkouts180d}`}
            subtext="180 days"
          />
          <MiniStat
            label="With HR"
            value={`${volume.workoutsWithHr}`}
            subtext={`${volume.totalWorkouts180d > 0 ? Math.round(volume.workoutsWithHr / volume.totalWorkouts180d * 100) : 0}% of runs`}
          />
        </div>

        {/* Per-distance readiness */}
        <div className="space-y-3">
          {prediction.predictions.map((pred) => (
            <div key={pred.distance} className="flex items-center gap-3">
              <span className="text-sm font-medium text-primary w-28 flex-shrink-0">
                {pred.distance}
              </span>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-3 bg-surface-2 rounded-full overflow-hidden flex">
                  {/* Volume portion */}
                  <div
                    className="h-full bg-blue-400"
                    style={{ width: `${Math.round(pred.readinessFactors.volume * 40)}%` }}
                    title={`Volume: ${Math.round(pred.readinessFactors.volume * 100)}%`}
                  />
                  {/* Long run portion */}
                  <div
                    className="h-full bg-teal-400"
                    style={{ width: `${Math.round(pred.readinessFactors.longRun * 35)}%` }}
                    title={`Long run: ${Math.round(pred.readinessFactors.longRun * 100)}%`}
                  />
                  {/* Consistency portion */}
                  <div
                    className="h-full bg-dream-400"
                    style={{ width: `${Math.round(pred.readinessFactors.consistency * 25)}%` }}
                    title={`Consistency: ${Math.round(pred.readinessFactors.consistency * 100)}%`}
                  />
                </div>
                <span
                  className={cn(
                    'text-xs font-mono font-bold w-10 text-right',
                    pred.readiness >= 0.7
                      ? 'text-green-600'
                      : pred.readiness >= 0.5
                        ? 'text-yellow-600'
                        : 'text-red-500'
                  )}
                >
                  {Math.round(pred.readiness * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="flex gap-4 mt-3 text-[10px] text-textTertiary">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" />
            Weekly volume
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-teal-400 inline-block" />
            Long run
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-sm bg-dream-400 inline-block" />
            Consistency
          </span>
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext: string;
}) {
  return (
    <div className="bg-surface-2 rounded-lg p-2.5">
      <p className="text-[10px] text-textTertiary uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-primary">{value}</p>
      <p className="text-[10px] text-textTertiary">{subtext}</p>
    </div>
  );
}

// ==================== Recent Workout Impact ====================

function RecentWorkoutImpact({ signalTimeline }: { signalTimeline: WorkoutSignalPoint[] }) {
  const recentWithVo2 = useMemo(() => {
    return signalTimeline
      .filter((s) => s.effectiveVo2max != null)
      .slice(-10)
      .reverse();
  }, [signalTimeline]);

  if (recentWithVo2.length === 0) return null;

  // Overall average for comparison
  const allVo2 = signalTimeline
    .filter((s) => s.effectiveVo2max != null)
    .map((s) => s.effectiveVo2max!);
  const overallAvg = allVo2.reduce((s, v) => s + v, 0) / allVo2.length;

  return (
    <div>
      <SectionHeader label="Recent Workout Impact" />
      <div className="bg-surface-1 rounded-xl border border-default p-5 shadow-sm">
        <p className="text-xs text-textTertiary mb-4">
          How each recent workout contributed to your effective VO2max estimate. Workouts above the
          average pull your prediction up; below pulls it down.
        </p>

        <div className="space-y-2">
          {recentWithVo2.map((w) => {
            const diff = w.effectiveVo2max! - overallAvg;
            const isAbove = diff > 0;

            return (
              <Link
                key={w.workoutId}
                href={`/workout/${w.workoutId}`}
                className="flex items-center gap-3 py-1.5 border-b border-borderSecondary last:border-0 hover:bg-surface-2 -mx-2 px-2 rounded-lg transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-primary truncate">
                      {w.stravaName || `${w.workoutType} run`}
                    </span>
                    <span className="text-[10px] text-textTertiary capitalize flex-shrink-0">
                      {w.workoutType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-textTertiary">
                    <span>
                      {parseLocalDate(w.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span>{w.distanceMiles.toFixed(1)} mi</span>
                    {w.avgHr && (
                      <span className="flex items-center gap-0.5">
                        <Heart className="w-2.5 h-2.5" />
                        {w.avgHr} bpm
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-mono font-bold text-primary">
                    {w.effectiveVo2max!.toFixed(1)}
                  </p>
                  <p
                    className={cn(
                      'text-[10px] font-medium',
                      isAbove ? 'text-green-600' : 'text-red-500'
                    )}
                  >
                    {isAbove ? '+' : ''}
                    {diff.toFixed(1)} vs avg
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-3 text-[10px] text-textTertiary">
          Average effective VO2max: {overallAvg.toFixed(1)}
        </div>
      </div>
    </div>
  );
}

// ==================== Signal Explainers ====================

function SignalExplainers({ prediction }: { prediction: PredictionDashboardData['prediction'] }) {
  const [expanded, setExpanded] = useState(false);

  const explanations: Record<string, { icon: React.ReactNode; what: string; how: string }> = {
    'Race VDOT': {
      icon: <Target className="w-4 h-4 text-green-500" />,
      what: 'Your actual race performances, converted to VDOT using Jack Daniels\' formula.',
      how: 'This is the gold standard — a real race result is the most direct measure of fitness. More recent races are weighted higher. All-out efforts get a confidence boost.',
    },
    'Best Effort VDOT': {
      icon: <Zap className="w-4 h-4 text-yellow-500" />,
      what: 'Your fastest training segments (1mi+), derated 3% since training isn\'t race conditions.',
      how: 'Strava detects best efforts for various distances. We convert these to VDOT but discount them slightly because race-day adrenaline, competition, and focused effort typically produce faster times than training.',
    },
    'Effective VO2max (HR)': {
      icon: <Heart className="w-4 h-4 text-rose-500" />,
      what: 'Estimated VO2max from your easy/steady runs using pace + heart rate data.',
      how: 'For each easy run with HR, we compute: how fast were you running (corrected for weather and elevation), what % of your HR reserve were you at, and what VO2max would produce those numbers. This is the key signal for runners who don\'t race often.',
    },
    'Efficiency Factor Trend': {
      icon: <TrendingUp className="w-4 h-4 text-blue-500" />,
      what: 'Whether your pace-to-HR ratio is improving over time.',
      how: 'EF = pace / heart rate. If your EF is trending up over 90 days, it means you\'re running faster at the same heart rate (or the same pace at lower HR) — aerobic fitness is improving. A +3% EF improvement maps to roughly +1.5 VDOT.',
    },
    'Critical Speed': {
      icon: <Timer className="w-4 h-4 text-indigo-500" />,
      what: 'The fastest pace you can sustain "indefinitely" — approximates your threshold.',
      how: 'If you have best efforts at 3+ different distances, we can fit a regression to estimate your critical speed. This maps to roughly 88% VO2max and gives a distance-independent fitness estimate.',
    },
    'Training Pace Inference': {
      icon: <Activity className="w-4 h-4 text-textTertiary" />,
      what: 'Fallback: estimates VDOT from your training paces when no HR data is available.',
      how: 'If we know you run easy at 9:00/mi, we can estimate what VDOT would produce that easy pace (since easy = ~65% VO2max). Less reliable than HR-based signals but useful when nothing else is available.',
    },
    'Saved VDOT': {
      icon: <Info className="w-4 h-4 text-textTertiary" />,
      what: 'Your manually set VDOT from profile settings.',
      how: 'Used as a low-confidence fallback when no training data is available. Gets replaced as soon as real signals become available.',
    },
  };

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-secondary hover:text-primary transition-colors w-full"
      >
        <Info className="w-4 h-4" />
        <span className="font-medium">How predictions work</span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="mt-3 bg-surface-1 rounded-xl border border-default p-5 shadow-sm space-y-4">
          <p className="text-sm text-textSecondary">
            Dreamy combines up to 6 independent signals to estimate your race fitness (VDOT). Each
            signal uses a different method and data source. The blended VDOT is a weighted average
            where signals with more data and higher confidence count more. Predictions are then
            adjusted for your endurance readiness (training volume) and current form (fatigue level).
          </p>

          {prediction.signals.map((signal) => {
            const info = explanations[signal.name];
            if (!info) return null;

            return (
              <div key={signal.name} className="border-t border-borderSecondary pt-3">
                <div className="flex items-center gap-2 mb-1">
                  {info.icon}
                  <span className="text-sm font-medium text-primary">{signal.name}</span>
                  {signal.dataPoints > 0 && (
                    <span className="text-[10px] text-textTertiary">
                      ({signal.dataPoints} data point{signal.dataPoints !== 1 ? 's' : ''})
                    </span>
                  )}
                </div>
                <p className="text-xs text-textSecondary mb-1">{info.what}</p>
                <p className="text-xs text-textTertiary">{info.how}</p>
              </div>
            );
          })}

          <div className="border-t border-borderSecondary pt-3">
            <p className="text-xs text-textTertiary">
              <strong>Distance adjustments:</strong> A VDOT of 45 predicts a 3:32 marathon — but
              only if you&apos;re trained for the distance. If your longest run is 10 miles and you average
              25 mpw, the marathon prediction gets a time penalty because physiological fitness alone
              isn&apos;t enough for longer races.
            </p>
          </div>

          <div className="border-t border-borderSecondary pt-3">
            <p className="text-xs text-textTertiary">
              <strong>Form adjustment:</strong> Your Training Stress Balance (TSB) indicates
              freshness vs fatigue. Tapered runners (TSB 5-25) get a slight time bonus. Fatigued
              runners (TSB below -10) get a time penalty since predictions assume race-day freshness.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Race Prediction Trends ====================

const RACE_DISTANCES = [
  { key: '5k', name: '5K', meters: 5000, miles: 3.107, color: '#22c55e' },
  { key: '10k', name: '10K', meters: 10000, miles: 6.214, color: '#f59e0b' },
  { key: 'half', name: 'Half', meters: 21097, miles: 13.109, color: '#6366f1' },
  { key: 'marathon', name: 'Marathon', meters: 42195, miles: 26.219, color: '#f43f5e' },
] as const;

type DistKey = typeof RACE_DISTANCES[number]['key'];
type ViewMode = 'pace' | 'time';

function formatPaceFromSeconds(secPerMile: number): string {
  const min = Math.floor(secPerMile / 60);
  const sec = Math.round(secPerMile % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function RacePredictionTrends({ vdotHistory }: { vdotHistory: VdotHistoryEntry[] }) {
  const [range, setRange] = useState<TimeRangeLabel>('6M');
  const [viewMode, setViewMode] = useState<ViewMode>('pace');
  const [selectedDists, setSelectedDists] = useState<Set<DistKey>>(new Set(['5k', 'half', 'marathon']));
  const [singleDist, setSingleDist] = useState<DistKey>('half');

  const rangeDays = TIME_RANGES.find(r => r.label === range)!.days;
  const showDots = true;

  // Filter by time range
  const filteredHistory = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return vdotHistory.filter(e => e.vdot >= 15 && e.vdot <= 85 && e.date >= cutoffStr);
  }, [vdotHistory, rangeDays]);

  // In pace mode: show all selected distances. In time mode: show single distance.
  const activeDists = viewMode === 'pace'
    ? RACE_DISTANCES.filter(d => selectedDists.has(d.key))
    : RACE_DISTANCES.filter(d => d.key === singleDist);

  // Build data series per distance
  const series = useMemo(() => {
    return activeDists.map(dist => {
      const points = filteredHistory.map(e => {
        const predSec = predictRaceTime(e.vdot, dist.meters);
        return {
          date: e.date,
          vdot: e.vdot,
          predictedSeconds: predSec,
          pacePerMile: predSec / dist.miles,
          source: e.source,
          confidence: e.confidence,
        };
      });
      return { dist, points };
    });
  }, [activeDists, filteredHistory]);

  if (filteredHistory.length < 2) return null;

  // Compute Y-axis bounds
  const allYValues = series.flatMap(s =>
    s.points.map(p => viewMode === 'pace' ? p.pacePerMile : p.predictedSeconds)
  );
  if (allYValues.length === 0) return null;

  const rawMin = Math.min(...allYValues);
  const rawMax = Math.max(...allYValues);
  const padding = (rawMax - rawMin) * 0.12 || (viewMode === 'pace' ? 15 : 60);
  // For both pace and time: lower = faster = higher on chart
  const yMin = rawMin - padding;
  const yMax = rawMax + padding;
  const yRange = yMax - yMin;

  const VB_W = 500;
  const VB_H = 210;
  const PAD = { top: 12, bottom: 40, left: 50, right: 12 };
  const chartW = VB_W - PAD.left - PAD.right;
  const chartH = VB_H - PAD.top - PAD.bottom;

  const getX = (i: number, total: number) => PAD.left + (i / Math.max(total - 1, 1)) * chartW;
  const getY = (val: number) => PAD.top + ((val - yMin) / yRange) * chartH;

  // Grid lines
  const gridLines = useMemo(() => {
    let step: number;
    if (viewMode === 'pace') {
      step = yRange > 120 ? 30 : yRange > 60 ? 15 : 10; // seconds per mile
    } else {
      step = yRange > 7200 ? 1800 : yRange > 3600 ? 600 : yRange > 1200 ? 300 : 60;
    }
    const lines: number[] = [];
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
      lines.push(v);
    }
    return lines;
  }, [yMin, yMax, yRange, viewMode]);

  const dateLabels = useMemo(
    () => computeDateLabels(filteredHistory, (i) => getX(i, filteredHistory.length), rangeDays),
    [filteredHistory, rangeDays]
  );

  // Toggle a distance in pace mode
  const toggleDist = (key: DistKey) => {
    setSelectedDists(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key); // don't allow empty
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Improvement badge for single-distance or single selected
  const primarySeries = series[0];
  const improvement = primarySeries && primarySeries.points.length >= 2
    ? primarySeries.points[0].predictedSeconds - primarySeries.points[primarySeries.points.length - 1].predictedSeconds
    : 0;

  return (
    <div>
      <SectionHeader label="Race Prediction Trends" />
      <div className="bg-surface-1 rounded-xl border border-default p-5 shadow-sm">
        {/* Controls row */}
        <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
          {/* View mode toggle */}
          <div className="flex items-center gap-2">
            <div className="flex bg-surface-2 rounded-lg p-0.5">
              {(['pace', 'time'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'px-2.5 py-1 text-[10px] rounded font-medium transition-colors capitalize',
                    viewMode === mode ? 'bg-dream-600 text-white' : 'text-textTertiary hover:text-primary'
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            <p className="text-xs text-textTertiary hidden sm:block">
              {viewMode === 'pace' ? 'Pace/mi across distances' : 'Finish time for one distance'}
            </p>
          </div>

          <TimeRangeSelector selected={range} onChange={setRange} />
        </div>

        {/* Distance toggles */}
        <div className="flex items-center gap-1.5 mb-3">
          {viewMode === 'pace' ? (
            // Multi-select toggles
            RACE_DISTANCES.map(d => (
              <button
                key={d.key}
                onClick={() => toggleDist(d.key)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-lg font-medium transition-colors border',
                  selectedDists.has(d.key)
                    ? 'border-transparent text-white'
                    : 'border-borderSecondary text-textTertiary hover:text-primary bg-surface-2'
                )}
                style={selectedDists.has(d.key) ? { backgroundColor: d.color } : undefined}
              >
                {d.name}
              </button>
            ))
          ) : (
            // Single-select for time mode
            RACE_DISTANCES.map(d => (
              <button
                key={d.key}
                onClick={() => setSingleDist(d.key)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-lg font-medium transition-colors',
                  singleDist === d.key
                    ? 'text-white'
                    : 'bg-surface-2 text-textTertiary hover:text-primary'
                )}
                style={singleDist === d.key ? { backgroundColor: d.color } : undefined}
              >
                {d.name}
              </button>
            ))
          )}

          {/* Improvement badge */}
          {viewMode === 'time' && improvement !== 0 && (
            <span className={cn(
              'text-[10px] font-medium px-2 py-0.5 rounded ml-auto',
              improvement > 0
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            )}>
              {improvement > 0 ? '+' : ''}{formatRaceTime(Math.abs(Math.round(improvement)))}
            </span>
          )}
        </div>

        {/* Chart */}
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid */}
          {gridLines.map(v => (
            <g key={v}>
              <line
                x1={PAD.left} y1={getY(v)} x2={VB_W - PAD.right} y2={getY(v)}
                stroke="var(--chart-grid, #e5e7eb)" strokeWidth="0.5"
              />
              <text x={PAD.left - 4} y={getY(v) + 3} textAnchor="end" fill="var(--chart-axis, #9ca3af)" fontSize="7">
                {viewMode === 'pace' ? formatPaceFromSeconds(v) : formatRaceTime(Math.round(v))}
              </text>
            </g>
          ))}

          {/* Date tick marks */}
          {dateLabels.map((dl, i) => (
            <g key={i}>
              <line
                x1={dl.x} y1={PAD.top + chartH} x2={dl.x} y2={PAD.top + chartH + 3}
                stroke="var(--chart-axis, #9ca3af)" strokeWidth="0.5"
              />
              <text x={dl.x} y={PAD.top + chartH + 12} textAnchor="middle" fill="var(--chart-axis, #9ca3af)" fontSize="7">
                {dl.label}
              </text>
            </g>
          ))}

          {/* Series */}
          {series.map(({ dist, points }) => {
            const vals = points.map(p => viewMode === 'pace' ? p.pacePerMile : p.predictedSeconds);
            const linePath = vals
              .map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i, vals.length).toFixed(1)} ${getY(v).toFixed(1)}`)
              .join(' ');

            return (
              <g key={dist.key}>
                {/* Line */}
                <path d={linePath} fill="none" stroke={dist.color} strokeWidth="1.8" strokeLinejoin="round" />

                {/* Data points */}
                {showDots && points.map((p, i) => (
                  <circle
                    key={i}
                    cx={getX(i, points.length)} cy={getY(viewMode === 'pace' ? p.pacePerMile : p.predictedSeconds)}
                    r={p.source === 'race' ? 3 : 2}
                    fill={dist.color}
                    opacity={p.confidence === 'high' ? 0.9 : p.confidence === 'medium' ? 0.65 : 0.4}
                  >
                    <title>
                      {parseLocalDate(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {'\n'}{dist.name}: {formatRaceTime(p.predictedSeconds)} ({formatPaceFromSeconds(p.pacePerMile)}/mi)
                      {'\n'}VDOT {p.vdot} ({p.source})
                    </title>
                  </circle>
                ))}
              </g>
            );
          })}

          {/* Legend inside chart — top right */}
          <ChartLegend
            items={series.map(s => ({ label: s.dist.name, color: s.dist.color, type: 'line' as const }))}
            x={VB_W - PAD.right - 55}
            y={PAD.top + 4}
          />
        </svg>

        {/* Footer */}
        <div className="flex justify-between text-[10px] text-textTertiary mt-1 px-1">
          <span>{filteredHistory.length} VDOT data points</span>
          {series.length === 1 && series[0].points.length > 0 && (
            <span>
              Current: {formatRaceTime(series[0].points[series[0].points.length - 1].predictedSeconds)} ({series[0].dist.name})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== Helpers ====================

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3 mt-1">
      <div className="h-px flex-1 bg-borderSecondary" />
      <span className="text-textTertiary uppercase tracking-wide text-xs font-medium">
        {label}
      </span>
      <div className="h-px flex-1 bg-borderSecondary" />
    </div>
  );
}
