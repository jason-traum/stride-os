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
  type WorkoutSignalPoint,
} from '@/actions/prediction-dashboard';
import { formatRaceTime } from '@/lib/race-utils';
import { formatPace } from '@/lib/training';
import { cn, parseLocalDate } from '@/lib/utils';
import { useProfile } from '@/lib/profile-context';

export default function PredictionsPage() {
  const { activeProfile } = useProfile();
  const [data, setData] = useState<PredictionDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const result = await getPredictionDashboardData(activeProfile?.id);
      setData(result);
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
            Sync some runs with heart rate data to see predictions.
          </p>
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

      {/* Signal Comparison */}
      <SignalComparisonChart prediction={prediction} />

      {/* VO2max Timeline */}
      <Vo2maxTimeline signalTimeline={signalTimeline} blendedVdot={prediction.vdot} />

      {/* Efficiency Factor Trend */}
      <EfTrendChart signalTimeline={signalTimeline} />

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

// ==================== VO2max Timeline ====================

function Vo2maxTimeline({
  signalTimeline,
  blendedVdot,
}: {
  signalTimeline: WorkoutSignalPoint[];
  blendedVdot: number;
}) {
  const vo2Points = useMemo(() => {
    return signalTimeline
      .filter((s) => s.effectiveVo2max != null && s.isSteadyState)
      .map((s) => ({
        date: s.date,
        vo2max: s.effectiveVo2max!,
        workoutType: s.workoutType,
        distanceMiles: s.distanceMiles,
        name: s.stravaName,
      }));
  }, [signalTimeline]);

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
  const VB_H = 180;
  const PAD = { top: 10, bottom: 25, left: 40, right: 10 };
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

  // Date labels
  const firstDate = vo2Points[0].date;
  const lastDate = vo2Points[vo2Points.length - 1].date;

  return (
    <div>
      <SectionHeader label="Effective VO2max Over Time" />
      <div className="bg-surface-1 rounded-xl border border-default p-5 shadow-sm">
        <p className="text-xs text-textTertiary mb-3">
          Each dot is a workout&apos;s estimated VO2max from heart rate. The line is the 7-day rolling
          average. Higher = fitter.
        </p>

        <div className="relative">
          <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
            {/* Grid */}
            {gridLines.map((v) => (
              <g key={v}>
                <line
                  x1={PAD.left}
                  y1={getY(v)}
                  x2={VB_W - PAD.right}
                  y2={getY(v)}
                  stroke="var(--chart-grid, #e5e7eb)"
                  strokeWidth="0.5"
                />
                <text
                  x={PAD.left - 4}
                  y={getY(v) + 3}
                  textAnchor="end"
                  fill="var(--chart-axis, #9ca3af)"
                  fontSize="8"
                >
                  {v}
                </text>
              </g>
            ))}

            {/* Blended VDOT reference line */}
            {blendedY >= PAD.top && blendedY <= PAD.top + chartH && (
              <line
                x1={PAD.left}
                y1={blendedY}
                x2={VB_W - PAD.right}
                y2={blendedY}
                stroke="var(--accent-brand, #7c6cf0)"
                strokeWidth="0.8"
                strokeDasharray="4 3"
                opacity="0.6"
              />
            )}

            {/* Rolling average line */}
            <path
              d={avgPath}
              fill="none"
              stroke="var(--accent-brand, #7c6cf0)"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />

            {/* Individual data points */}
            {vo2Points.map((p, i) => (
              <circle
                key={i}
                cx={getX(i)}
                cy={getY(p.vo2max)}
                r={2}
                fill={p.workoutType === 'easy' ? '#5ea8c8' : p.workoutType === 'long' ? '#14b8a6' : p.workoutType === 'tempo' ? '#6366f1' : '#a78bfa'}
                opacity={0.7}
              >
                <title>
                  {p.date}: VO2max {p.vo2max.toFixed(1)} ({p.workoutType}
                  {p.name ? ` — ${p.name}` : ''})
                </title>
              </circle>
            ))}
          </svg>
        </div>

        {/* Date labels */}
        <div className="flex justify-between text-[10px] text-textTertiary mt-1 px-1">
          <span>
            {parseLocalDate(firstDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-5 h-0.5 rounded" style={{ background: 'var(--accent-brand, #7c6cf0)' }} />
            7-day avg
          </span>
          <span>
            {parseLocalDate(lastDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ==================== EF Trend Chart ====================

function EfTrendChart({ signalTimeline }: { signalTimeline: WorkoutSignalPoint[] }) {
  const efPoints = useMemo(() => {
    return signalTimeline
      .filter(
        (s) =>
          s.efficiencyFactor != null &&
          s.isSteadyState &&
          s.distanceMiles >= 1 &&
          s.durationMinutes >= 20
      )
      .map((s) => ({
        date: s.date,
        ef: s.efficiencyFactor!,
        workoutType: s.workoutType,
        name: s.stravaName,
      }));
  }, [signalTimeline]);

  // Linear regression for trend line
  const regression = useMemo(() => {
    if (efPoints.length < 5) return null;

    const firstDate = new Date(efPoints[0].date + 'T12:00:00Z').getTime();
    const xs = efPoints.map((p) => (new Date(p.date + 'T12:00:00Z').getTime() - firstDate) / (1000 * 60 * 60 * 24));
    const ys = efPoints.map((p) => p.ef);
    const n = xs.length;
    const xMean = xs.reduce((s, x) => s + x, 0) / n;
    const yMean = ys.reduce((s, y) => s + y, 0) / n;

    let num = 0, den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i] - xMean) * (ys[i] - yMean);
      den += (xs[i] - xMean) * (xs[i] - xMean);
    }

    if (den === 0) return null;
    const slope = num / den;
    const intercept = yMean - slope * xMean;
    const totalDays = xs[xs.length - 1];
    const pctChange = totalDays > 0 ? ((slope * totalDays) / yMean) * 100 : 0;

    return { slope, intercept, xs, totalDays, pctChange };
  }, [efPoints]);

  if (efPoints.length < 5) return null;

  const efs = efPoints.map((p) => p.ef);
  const minEf = Math.min(...efs) - 0.05;
  const maxEf = Math.max(...efs) + 0.05;
  const rangeEf = maxEf - minEf || 0.2;

  const VB_W = 500;
  const VB_H = 160;
  const PAD = { top: 10, bottom: 25, left: 40, right: 10 };
  const chartW = VB_W - PAD.left - PAD.right;
  const chartH = VB_H - PAD.top - PAD.bottom;

  const getX = (i: number) => PAD.left + (i / (efPoints.length - 1)) * chartW;
  const getY = (v: number) => PAD.top + chartH - ((v - minEf) / rangeEf) * chartH;

  const improving = regression && regression.pctChange > 0;

  return (
    <div>
      <SectionHeader label="Efficiency Factor Trend" />
      <div className="bg-surface-1 rounded-xl border border-default p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-textTertiary">
            Pace / Heart Rate ratio for easy/steady runs. Rising EF = improving aerobic fitness.
          </p>
          {regression && (
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded',
                improving
                  ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30'
                  : 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
              )}
            >
              {improving ? '+' : ''}
              {regression.pctChange.toFixed(1)}% trend
            </span>
          )}
        </div>

        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid */}
          {[0.25, 0.5, 0.75].map((frac) => {
            const v = minEf + rangeEf * frac;
            return (
              <g key={frac}>
                <line
                  x1={PAD.left}
                  y1={getY(v)}
                  x2={VB_W - PAD.right}
                  y2={getY(v)}
                  stroke="var(--chart-grid, #e5e7eb)"
                  strokeWidth="0.5"
                />
                <text
                  x={PAD.left - 4}
                  y={getY(v) + 3}
                  textAnchor="end"
                  fill="var(--chart-axis, #9ca3af)"
                  fontSize="7"
                >
                  {v.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Regression line */}
          {regression && (
            <line
              x1={getX(0)}
              y1={getY(regression.intercept)}
              x2={getX(efPoints.length - 1)}
              y2={getY(regression.intercept + regression.slope * regression.totalDays)}
              stroke={improving ? '#22c55e' : '#ef4444'}
              strokeWidth="1.2"
              strokeDasharray="6 3"
              opacity="0.7"
            />
          )}

          {/* Data points */}
          {efPoints.map((p, i) => (
            <circle
              key={i}
              cx={getX(i)}
              cy={getY(p.ef)}
              r={2.5}
              fill={p.workoutType === 'easy' ? '#5ea8c8' : p.workoutType === 'long' ? '#14b8a6' : '#a78bfa'}
              opacity={0.7}
            >
              <title>
                {p.date}: EF {p.ef.toFixed(3)} ({p.workoutType}
                {p.name ? ` — ${p.name}` : ''})
              </title>
            </circle>
          ))}
        </svg>

        <div className="flex justify-between text-[10px] text-textTertiary mt-1 px-1">
          <span>
            {parseLocalDate(efPoints[0].date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <span>{efPoints.length} workouts</span>
          <span>
            {parseLocalDate(efPoints[efPoints.length - 1].date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
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
              <div
                key={w.workoutId}
                className="flex items-center gap-3 py-1.5 border-b border-borderSecondary last:border-0"
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
              </div>
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
