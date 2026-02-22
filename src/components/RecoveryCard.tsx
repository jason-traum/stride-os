import { cn } from '@/lib/utils';
import { Activity, CheckCircle, Clock, XCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { RecoveryAnalysis, PersonalRecoveryRate } from '@/lib/training/recovery-model';

interface RecoveryCardProps {
  recovery: RecoveryAnalysis;
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 60) return 'text-sky-400';
  if (score >= 40) return 'text-amber-400';
  return 'text-red-400';
}

function getScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-sky-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Fully recovered';
  if (score >= 70) return 'Well recovered';
  if (score >= 55) return 'Moderate';
  if (score >= 40) return 'Still recovering';
  return 'Low recovery';
}

function getRateIcon(rate: PersonalRecoveryRate) {
  if (rate === 'fast') return TrendingUp;
  if (rate === 'slow') return TrendingDown;
  return Minus;
}

function getRateLabel(rate: PersonalRecoveryRate): string {
  if (rate === 'fast') return 'Fast';
  if (rate === 'slow') return 'Slow';
  return 'Average';
}

function getRateColor(rate: PersonalRecoveryRate): string {
  if (rate === 'fast') return 'text-emerald-400';
  if (rate === 'slow') return 'text-amber-400';
  return 'text-sky-400';
}

function formatRecoveryTime(hours: number): string {
  if (hours <= 0) return 'Recovered';
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.round(hours / 24 * 10) / 10;
  if (days === 1) return '1 day';
  return `${days >= 2 ? Math.round(days) : days} days`;
}

export function RecoveryCard({ recovery }: RecoveryCardProps) {
  const RateIcon = getRateIcon(recovery.personalRecoveryRate);

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-borderPrimary">
        <Activity className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-medium text-textPrimary">Recovery</span>
        {recovery.confidence < 0.5 && (
          <span className="text-[10px] text-textTertiary ml-auto">Limited data</span>
        )}
      </div>

      <div className="p-4">
        {/* Score + Ready status row */}
        <div className="flex items-center gap-4 mb-3">
          {/* Score */}
          <div className="flex items-baseline gap-1.5">
            <span className={cn('text-3xl font-bold', getScoreColor(recovery.recoveryScore))}>
              {recovery.recoveryScore}
            </span>
            <span className="text-sm text-textTertiary">/100</span>
          </div>

          {/* Score bar */}
          <div className="flex-1">
            <div className="h-2 bg-bgTertiary rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', getScoreBarColor(recovery.recoveryScore))}
                style={{ width: `${recovery.recoveryScore}%` }}
              />
            </div>
            <span className={cn('text-xs mt-1 block', getScoreColor(recovery.recoveryScore))}>
              {getScoreLabel(recovery.recoveryScore)}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {/* Ready for quality */}
          <div className="text-center">
            {recovery.readyForQuality ? (
              <CheckCircle className="w-4 h-4 mx-auto text-emerald-400 mb-1" />
            ) : (
              <XCircle className="w-4 h-4 mx-auto text-amber-400 mb-1" />
            )}
            <div className="text-[10px] text-textTertiary">
              {recovery.readyForQuality ? 'Ready for quality' : 'Not ready yet'}
            </div>
          </div>

          {/* Est. recovery */}
          <div className="text-center">
            <Clock className="w-4 h-4 mx-auto text-textTertiary mb-1" />
            <div className="text-xs font-medium text-textPrimary">
              {formatRecoveryTime(recovery.estimatedRecoveryHours)}
            </div>
            <div className="text-[10px] text-textTertiary">Est. full recovery</div>
          </div>

          {/* Personal rate */}
          <div className="text-center">
            <RateIcon className={cn('w-4 h-4 mx-auto mb-1', getRateColor(recovery.personalRecoveryRate))} />
            <div className={cn('text-xs font-medium', getRateColor(recovery.personalRecoveryRate))}>
              {getRateLabel(recovery.personalRecoveryRate)}
            </div>
            <div className="text-[10px] text-textTertiary">Your rate</div>
          </div>
        </div>

        {/* Top recommendation */}
        {recovery.recommendations.length > 0 && (
          <div className="bg-bgTertiary rounded-lg p-3">
            <p className="text-sm text-textSecondary">{recovery.recommendations[0]}</p>
            {recovery.recommendations.length > 1 && (
              <p className="text-xs text-textTertiary mt-1.5">{recovery.recommendations[1]}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
