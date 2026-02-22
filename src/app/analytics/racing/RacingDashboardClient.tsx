'use client';

import { useState } from 'react';
import { Trophy, TrendingUp, Activity, Gauge, Target, Info, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { cn, formatPace } from '@/lib/utils';
import { RACE_DISTANCES, formatTime } from '@/lib/training';
import { predictRaceTime } from '@/lib/training/vdot-calculator';
import type { PredictionDashboardData } from '@/actions/prediction-dashboard';
import Link from 'next/link';

interface Props {
  data: PredictionDashboardData | null;
  error?: string;
}

function getConfidenceInterval(time: number, confidence: 'high' | 'medium' | 'low') {
  const pct = { high: 0.02, medium: 0.04, low: 0.07 }[confidence];
  return { min: Math.round(time * (1 - pct)), max: Math.round(time * (1 + pct)) };
}

export function RacingDashboardClient({ data, error }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showSignals, setShowSignals] = useState(false);

  if (!data) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 text-center">
        <Trophy className="w-8 h-8 text-textTertiary mx-auto mb-3" />
        <p className="text-textSecondary">
          {error || 'Not enough data for race predictions yet.'}
        </p>
        <p className="text-sm text-textTertiary mt-2">
          Log more runs with heart rate data to unlock predictions.
        </p>
      </div>
    );
  }

  const { prediction, signalTimeline, vdotHistory, trainingVolume, fitnessState } = data;
  const vdot = prediction.vdot;
  const confidence: 'high' | 'medium' | 'low' = prediction.confidence;

  const keyDistances = ['5K', '10K', 'half_marathon', 'marathon'];
  const allPredictions = Object.entries(RACE_DISTANCES).map(([key, dist]) => {
    const time = predictRaceTime(vdot, dist.meters);
    const interval = getConfidenceInterval(time, confidence);
    return {
      key,
      label: dist.label,
      miles: dist.miles,
      time,
      min: interval.min,
      max: interval.max,
      pace: Math.round(time / dist.miles),
    };
  });

  const visible = expanded ? allPredictions : allPredictions.filter(p => keyDistances.includes(p.key));

  // TSB interpretation
  const tsbLabel = fitnessState.tsb > 10 ? 'Fresh' : fitnessState.tsb > -10 ? 'Neutral' : fitnessState.tsb > -25 ? 'Tired' : 'Overreached';
  const tsbColor = fitnessState.tsb > 10 ? 'text-green-400' : fitnessState.tsb > -10 ? 'text-textSecondary' : fitnessState.tsb > -25 ? 'text-amber-400' : 'text-red-400';

  // VDOT trend
  const sortedHistory = [...vdotHistory].sort((a, b) => a.date.localeCompare(b.date));
  const vdotTrend = sortedHistory.length >= 2
    ? sortedHistory[sortedHistory.length - 1].vdot - sortedHistory[0].vdot
    : 0;

  // Signal quality
  const steadyPct = signalTimeline.length > 0
    ? Math.round((signalTimeline.filter(s => s.isSteadyState).length / signalTimeline.length) * 100)
    : 0;
  const hrPct = trainingVolume.totalWorkouts180d > 0
    ? Math.round((trainingVolume.workoutsWithHr / trainingVolume.totalWorkouts180d) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Hero: VDOT + Confidence */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-5 h-5 text-dream-500" />
          <h3 className="font-semibold text-primary">Race Predictions</h3>
          <span className={cn(
            'ml-auto text-xs font-medium px-2 py-0.5 rounded-full',
            confidence === 'high' ? 'bg-green-950 text-green-300' :
            confidence === 'medium' ? 'bg-amber-950 text-amber-300' :
            'bg-red-950 text-red-300'
          )}>
            {confidence === 'high' ? 'High' : confidence === 'medium' ? 'Medium' : 'Low'} Confidence
          </span>
        </div>

        {/* VDOT + Fitness summary row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-bgTertiary rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">{vdot.toFixed(1)}</div>
            <div className="text-xs text-textTertiary">VDOT</div>
            {vdotTrend !== 0 && (
              <div className={cn('text-xs mt-0.5', vdotTrend > 0 ? 'text-green-400' : 'text-red-400')}>
                {vdotTrend > 0 ? '+' : ''}{vdotTrend.toFixed(1)}
              </div>
            )}
          </div>
          <div className="bg-bgTertiary rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">{Math.round(fitnessState.ctl)}</div>
            <div className="text-xs text-textTertiary">Fitness (CTL)</div>
          </div>
          <div className="bg-bgTertiary rounded-lg p-3 text-center">
            <div className={cn('text-2xl font-bold', tsbColor)}>{Math.round(fitnessState.tsb)}</div>
            <div className="text-xs text-textTertiary">Form ({tsbLabel})</div>
          </div>
          <div className="bg-bgTertiary rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">{trainingVolume.avgWeeklyMiles4Weeks}</div>
            <div className="text-xs text-textTertiary">Mi/Week (4wk)</div>
          </div>
        </div>

        {/* Predictions table */}
        <div className="space-y-1">
          {visible.map((pred) => (
            <div
              key={pred.key}
              className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-bgTertiary transition-colors border-b border-borderSecondary last:border-0"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-28 font-medium text-primary truncate">{pred.label}</div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-bold text-primary">{formatTime(pred.time)}</div>
                  <div className="text-xs text-textTertiary">
                    {formatTime(pred.min)} – {formatTime(pred.max)}
                  </div>
                </div>
                <div className="w-20 text-right text-sm text-textSecondary">
                  {formatPace(pred.pace)}/mi
                </div>
              </div>
            </div>
          ))}
        </div>

        {allPredictions.length > keyDistances.length && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center justify-center gap-1 w-full mt-3 py-2 text-sm text-dream-400 hover:text-dream-300 font-medium transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? 'Show Key Distances' : 'Show All Distances'}
          </button>
        )}
      </div>

      {/* VDOT History Timeline */}
      {sortedHistory.length > 0 && (
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-dream-500" />
            <h3 className="font-semibold text-primary">VDOT History</h3>
            {sortedHistory.length >= 2 && (
              <span className={cn(
                'ml-auto text-xs font-medium px-2 py-0.5 rounded-full',
                vdotTrend > 0 ? 'bg-green-950 text-green-300' :
                vdotTrend < 0 ? 'bg-red-950 text-red-300' :
                'bg-bgTertiary text-textSecondary'
              )}>
                {vdotTrend > 0 ? '+' : ''}{vdotTrend.toFixed(1)} over{' '}
                {Math.round(
                  (new Date(sortedHistory[sortedHistory.length - 1].date).getTime() -
                    new Date(sortedHistory[0].date).getTime()) /
                  (1000 * 60 * 60 * 24 * 7)
                )}{' '}
                weeks
              </span>
            )}
          </div>

          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-borderSecondary" />
            <div className="space-y-3">
              {sortedHistory.slice(-10).map((point, i, arr) => (
                <div key={i} className="relative pl-9">
                  <div className={cn(
                    'absolute left-1 w-5 h-5 rounded-full flex items-center justify-center',
                    point.source === 'race' ? 'bg-purple-500' : 'bg-dream-600'
                  )}>
                    {point.source === 'race' ? (
                      <Trophy className="w-3 h-3 text-white" />
                    ) : (
                      <Target className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <div className="bg-bgTertiary rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <span className="font-medium text-primary">VDOT {point.vdot.toFixed(1)}</span>
                      {point.source === 'race' && (
                        <span className="text-xs text-purple-400 ml-2">Race</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {i > 0 && (
                        <span className={cn(
                          'text-xs',
                          point.vdot > arr[i - 1].vdot ? 'text-green-400' : 'text-red-400'
                        )}>
                          {point.vdot > arr[i - 1].vdot ? '+' : ''}
                          {(point.vdot - arr[i - 1].vdot).toFixed(1)}
                        </span>
                      )}
                      <span className="text-xs text-textTertiary">
                        {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Signal Quality + Data card */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        <button
          onClick={() => setShowSignals(!showSignals)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-dream-500" />
            <h3 className="font-semibold text-primary">Prediction Signals</h3>
          </div>
          {showSignals ? <ChevronUp className="w-4 h-4 text-textTertiary" /> : <ChevronDown className="w-4 h-4 text-textTertiary" />}
        </button>

        {/* Always-visible summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
          <div className="text-center">
            <div className="text-lg font-bold text-primary">{trainingVolume.totalWorkouts180d}</div>
            <div className="text-xs text-textTertiary">Workouts (6mo)</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-primary">{hrPct}%</div>
            <div className="text-xs text-textTertiary">HR Coverage</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-primary">{steadyPct}%</div>
            <div className="text-xs text-textTertiary">Steady-State</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-primary">{trainingVolume.longestRecentRunMiles}</div>
            <div className="text-xs text-textTertiary">Long Run (mi)</div>
          </div>
        </div>

        {/* Expanded: individual signal points */}
        {showSignals && signalTimeline.length > 0 && (
          <div className="mt-4 pt-4 border-t border-borderSecondary">
            <p className="text-xs text-textTertiary mb-3">
              Recent workouts used for prediction (showing latest 20)
            </p>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {signalTimeline.slice(-20).reverse().map((s) => (
                <Link
                  key={s.workoutId}
                  href={`/workout/${s.workoutId}`}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-bgTertiary hover:bg-surface-interactive-hover transition-colors text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      s.isSteadyState ? 'bg-green-400' : 'bg-textTertiary'
                    )} />
                    <span className="text-primary truncate">{s.stravaName || s.workoutType}</span>
                    <span className="text-xs text-textTertiary">{s.distanceMiles.toFixed(1)} mi</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.effectiveVo2max && (
                      <span className="text-xs text-dream-400">eVO2 {s.effectiveVo2max.toFixed(1)}</span>
                    )}
                    {s.avgHr && (
                      <span className="text-xs text-textTertiary">{s.avgHr} bpm</span>
                    )}
                    <span className="text-xs text-textTertiary">
                      {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* How predictions work */}
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-5 h-5 text-dream-500" />
          <h3 className="font-semibold text-primary">How Predictions Work</h3>
        </div>
        <div className="text-sm text-textSecondary space-y-2">
          <p>
            Predictions combine <strong>multiple signals</strong> from your training: effective VO2max estimates,
            heart rate reserve, pace efficiency, and race results — weighted by recency and data quality.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
            <div className="flex items-start gap-2 p-2 bg-bgTertiary rounded-lg">
              <Zap className="w-4 h-4 text-dream-500 mt-0.5 shrink-0" />
              <div className="text-xs">
                <strong className="text-primary">Improve accuracy:</strong> Run with HR monitor and log race results
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 bg-bgTertiary rounded-lg">
              <Gauge className="w-4 h-4 text-dream-500 mt-0.5 shrink-0" />
              <div className="text-xs">
                <strong className="text-primary">Race a 5K:</strong> Every 4-6 weeks to calibrate VDOT
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
