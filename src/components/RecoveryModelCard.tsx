'use client';

import { cn } from '@/lib/utils';
import { Battery, BatteryFull, BatteryMedium, BatteryLow, Clock, CheckCircle, AlertTriangle, Lightbulb, BarChart3 } from 'lucide-react';
import type { RecoveryAnalysis } from '@/lib/training/recovery-model';

interface RecoveryModelCardProps {
  recovery: RecoveryAnalysis;
}

function getRecoveryRateLabel(rate: string): { label: string; color: string } {
  switch (rate) {
    case 'fast':
      return { label: 'Faster than average', color: 'text-green-400' };
    case 'slow':
      return { label: 'Slower than average', color: 'text-amber-400' };
    default:
      return { label: 'Average', color: 'text-textSecondary' };
  }
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 65) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  if (score >= 30) return 'text-orange-400';
  return 'text-red-400';
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 65) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-500';
  if (score >= 30) return 'bg-orange-500';
  return 'bg-red-500';
}

export function RecoveryModelCard({ recovery }: RecoveryModelCardProps) {
  const BatteryIcon = recovery.recoveryScore >= 80 ? BatteryFull
    : recovery.recoveryScore >= 50 ? BatteryMedium
    : BatteryLow;

  const rateInfo = getRecoveryRateLabel(recovery.personalRecoveryRate);
  const confidenceLabel = recovery.confidence >= 0.7 ? 'High'
    : recovery.confidence >= 0.4 ? 'Moderate'
    : 'Low';

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-textPrimary text-sm flex items-center gap-2">
            <Battery className="w-4 h-4 text-dream-500" />
            Personalized Recovery Model
          </h3>
          <p className="text-[10px] text-textTertiary mt-0.5">
            Learned from your training patterns &middot; Confidence: {confidenceLabel} ({Math.round(recovery.confidence * 100)}%)
          </p>
        </div>
        {recovery.readyForQuality ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-green-500/15 text-green-400">
            <CheckCircle className="w-3 h-3" />
            Ready for Quality
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-400">
            <Clock className="w-3 h-3" />
            Recovering
          </span>
        )}
      </div>

      {/* Recovery Score + Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
        {/* Recovery Score */}
        <div className="flex flex-col items-center sm:items-start">
          <div className="flex items-center gap-2 mb-1">
            <BatteryIcon className={cn('w-5 h-5', getScoreColor(recovery.recoveryScore))} />
            <span className={cn('text-3xl font-bold', getScoreColor(recovery.recoveryScore))}>
              {recovery.recoveryScore}
            </span>
            <span className="text-sm text-textTertiary">/100</span>
          </div>
          <p className="text-[10px] text-textTertiary">Recovery Score</p>
          {/* Score bar */}
          <div className="w-full h-2 bg-bgTertiary rounded-full mt-2 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', getScoreBarColor(recovery.recoveryScore))}
              style={{ width: `${recovery.recoveryScore}%` }}
            />
          </div>
        </div>

        {/* Est. Recovery Time */}
        <div className="text-center sm:text-left">
          <p className="text-2xl font-bold text-textPrimary">
            {recovery.estimatedRecoveryHours > 0
              ? `${Math.round(recovery.estimatedRecoveryHours)}h`
              : 'Recovered'}
          </p>
          <p className="text-[10px] text-textTertiary mt-0.5">Est. Recovery Time</p>
          <p className="text-[10px] text-textTertiary mt-1">from last hard session</p>
        </div>

        {/* Personal Recovery Rate */}
        <div className="text-center sm:text-left">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-textTertiary" />
            <span className={cn('text-sm font-semibold', rateInfo.color)}>
              {rateInfo.label}
            </span>
          </div>
          <p className="text-[10px] text-textTertiary mt-1">Your Personal Recovery Rate</p>
          <p className="text-[10px] text-textTertiary mt-0.5">
            Based on quality session spacing
          </p>
        </div>
      </div>

      {/* Recommendations */}
      {recovery.recommendations.length > 0 && (
        <div className="border-t border-borderPrimary pt-3">
          <h4 className="text-xs font-medium text-textSecondary mb-2 flex items-center gap-1.5">
            <Lightbulb className="w-3 h-3" />
            Personalized Insights
          </h4>
          <div className="space-y-1.5">
            {recovery.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-textSecondary">
                <span className="text-textTertiary mt-0.5 flex-shrink-0">
                  {rec.toLowerCase().includes('risk') || rec.toLowerCase().includes('hurt') || rec.toLowerCase().includes('elevated')
                    ? <AlertTriangle className="w-3 h-3 text-amber-400" />
                    : rec.toLowerCase().includes('ready') || rec.toLowerCase().includes('well')
                    ? <CheckCircle className="w-3 h-3 text-green-400" />
                    : <Lightbulb className="w-3 h-3 text-dream-400" />
                  }
                </span>
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
