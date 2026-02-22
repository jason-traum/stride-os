'use client';

import { useState, useEffect } from 'react';
import { Activity, Loader2, Zap, HeartPulse, Timer, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { getThresholdEstimate, type ThresholdEstimate } from '@/actions/threshold';
import { formatPace } from '@/lib/utils';

/**
 * Card displaying the auto-detected lactate threshold pace from workout history.
 * Wired into the training analytics page.
 */
export function ThresholdPaceCard() {
  const [estimate, setEstimate] = useState<ThresholdEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEstimate() {
      const result = await getThresholdEstimate();
      if (result.success) {
        setEstimate(result.data);
      } else {
        setError(result.error);
      }
      setLoading(false);
    }
    fetchEstimate();
  }, []);

  if (loading) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-400" />
          Threshold Pace
        </h3>
        <div className="flex items-center justify-center py-6 text-textTertiary">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          Analyzing workouts...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-400" />
          Threshold Pace
        </h3>
        <p className="text-sm text-textTertiary">Unable to load threshold data.</p>
      </div>
    );
  }

  if (!estimate || estimate.method === 'insufficient_data') {
    return (
      <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
        <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-orange-400" />
          Threshold Pace
        </h3>
        <p className="text-sm text-textTertiary">
          Need more workout data to estimate threshold pace.
          {estimate && estimate.evidence.workoutsAnalyzed > 0 && (
            <span className="block mt-1">
              Analyzed {estimate.evidence.workoutsAnalyzed} workout{estimate.evidence.workoutsAnalyzed !== 1 ? 's' : ''} but
              couldn&apos;t identify enough threshold-effort patterns.
            </span>
          )}
        </p>
        <p className="text-xs text-textTertiary mt-2">
          Tip: Steady-state runs of 20-40 minutes at a comfortably hard effort help the algorithm detect your threshold.
        </p>
      </div>
    );
  }

  const confidenceColor = getConfidenceColor(estimate.confidence);
  const confidenceLabel = getConfidenceLabel(estimate.confidence);

  const signals = getActiveSignals(estimate);

  return (
    <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-6 shadow-sm">
      {/* Header */}
      <h3 className="font-semibold text-primary mb-4 flex items-center gap-2">
        <Zap className="w-4 h-4 text-orange-400" />
        Threshold Pace
      </h3>

      {/* Main pace display */}
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-3xl font-bold text-primary tabular-nums">
          {formatPace(estimate.thresholdPaceSecondsPerMile)}
        </span>
        <span className="text-sm text-textSecondary">/mi</span>
        <span
          className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${confidenceColor}`}
        >
          {confidenceLabel}
        </span>
      </div>

      {/* Low confidence caveat */}
      {estimate.confidence < 0.5 && (
        <div className="flex items-start gap-2 mb-4 p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-yellow-200/80">
            Low confidence estimate. More steady-state hard runs will improve accuracy.
          </p>
        </div>
      )}

      {/* Signals that contributed */}
      <div className="space-y-1.5 mb-4">
        <p className="text-xs text-textTertiary font-medium uppercase tracking-wider">Signals</p>
        {signals.map(signal => (
          <div key={signal.key} className="flex items-center gap-2 text-sm">
            {signal.icon}
            <span className="text-textSecondary">{signal.label}</span>
          </div>
        ))}
      </div>

      {/* VDOT validation */}
      {estimate.vdotValidation && (
        <div className="border-t border-borderPrimary pt-3 mt-3">
          <VdotValidationRow validation={estimate.vdotValidation} />
        </div>
      )}

      {/* Threshold efforts list */}
      {estimate.evidence.thresholdEfforts.length > 0 && (
        <div className="border-t border-borderPrimary pt-3 mt-3">
          <p className="text-xs text-textTertiary font-medium uppercase tracking-wider mb-2">
            Identified Threshold Efforts
          </p>
          <div className="space-y-1">
            {estimate.evidence.thresholdEfforts.slice(0, 5).map((effort, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-textTertiary">
                  {formatDate(effort.workoutDate)}
                </span>
                <span className="text-textSecondary tabular-nums">
                  {formatPace(effort.pace)}/mi
                </span>
                <span className="text-textTertiary tabular-nums">
                  {Math.round(effort.durationSeconds / 60)}min
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data summary footer */}
      <div className="flex items-center gap-1 mt-4 text-xs text-textTertiary">
        <Info className="w-3 h-3" />
        <span>
          {estimate.evidence.workoutsAnalyzed} workouts analyzed
          {estimate.evidence.workoutsWithHR > 0 &&
            ` (${estimate.evidence.workoutsWithHR} with HR)`
          }
        </span>
      </div>
    </div>
  );
}

// ---- Helpers ----

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return 'bg-green-500/15 text-green-400';
  if (confidence >= 0.45) return 'bg-yellow-500/15 text-yellow-400';
  return 'bg-orange-500/15 text-orange-400';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.7) return 'High confidence';
  if (confidence >= 0.45) return 'Moderate confidence';
  return 'Low confidence';
}

function getActiveSignals(estimate: ThresholdEstimate) {
  const signals: { key: string; icon: React.ReactNode; label: string }[] = [];

  if (estimate.evidence.thresholdEfforts.length > 0) {
    signals.push({
      key: 'efforts',
      icon: <Activity className="w-3.5 h-3.5 text-blue-400" />,
      label: `${estimate.evidence.thresholdEfforts.length} threshold-effort run${estimate.evidence.thresholdEfforts.length !== 1 ? 's' : ''} identified`,
    });
  }

  if (estimate.evidence.deflectionPace) {
    signals.push({
      key: 'deflection',
      icon: <HeartPulse className="w-3.5 h-3.5 text-red-400" />,
      label: `HR deflection at ${formatPace(estimate.evidence.deflectionPace)}/mi`,
    });
  }

  if (estimate.evidence.sustainabilityBoundaryPace) {
    signals.push({
      key: 'sustainability',
      icon: <Timer className="w-3.5 h-3.5 text-purple-400" />,
      label: `Sustainability boundary at ${formatPace(estimate.evidence.sustainabilityBoundaryPace)}/mi`,
    });
  }

  if (signals.length === 0) {
    signals.push({
      key: 'none',
      icon: <Info className="w-3.5 h-3.5 text-textTertiary" />,
      label: 'Pace-only analysis (no HR data)',
    });
  }

  return signals;
}

function VdotValidationRow({ validation }: { validation: NonNullable<ThresholdEstimate['vdotValidation']> }) {
  const agreementConfig = {
    strong: { icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />, label: 'Strong agreement', color: 'text-green-400' },
    moderate: { icon: <AlertTriangle className="w-3.5 h-3.5 text-yellow-400" />, label: 'Moderate agreement', color: 'text-yellow-400' },
    weak: { icon: <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />, label: 'Weak agreement', color: 'text-orange-400' },
  };

  const config = agreementConfig[validation.agreement];
  const diffLabel = validation.differenceSeconds > 0
    ? `${Math.abs(validation.differenceSeconds)}s slower`
    : validation.differenceSeconds < 0
      ? `${Math.abs(validation.differenceSeconds)}s faster`
      : 'exact match';

  return (
    <div className="flex items-center gap-2 text-xs">
      {config.icon}
      <span className={config.color}>{config.label}</span>
      <span className="text-textTertiary">
        vs VDOT threshold ({formatPace(validation.vdotThresholdPace)}/mi, {diffLabel})
      </span>
    </div>
  );
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
