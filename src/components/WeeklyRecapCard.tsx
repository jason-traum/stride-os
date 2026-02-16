'use client';

import { Share2, TrendingUp, TrendingDown, Award, Activity, Timer } from 'lucide-react';

interface WeeklyRecapData {
  week: string;
  summary: {
    total_miles: number;
    total_runs: number;
    avg_pace: string | null;
    avg_rpe: number | null;
  };
  plan_adherence: {
    planned_miles: number;
    actual_miles: number;
    percent_completed: number;
    workouts_completed: number;
    workouts_skipped: number;
  } | null;
  highlights: string[];
  concerns: string[];
  achievements?: string[];
  share_text?: string;
}

interface WeeklyRecapCardProps {
  data: WeeklyRecapData;
  onShare?: () => void;
  onDismiss?: () => void;
}

export function WeeklyRecapCard({ data, onShare, onDismiss }: WeeklyRecapCardProps) {
  const adherencePercent = data.plan_adherence?.percent_completed || 0;

  const getAdherenceColor = () => {
    if (adherencePercent >= 90) return 'text-dream-600';
    if (adherencePercent >= 70) return 'text-textSecondary';
    if (adherencePercent >= 50) return 'text-secondary';
    return 'text-rose-600';
  };

  const handleShare = async () => {
    if (data.share_text && navigator.share) {
      try {
        await navigator.share({
          text: data.share_text,
        });
      } catch {
        // User cancelled or error
        console.log('Share cancelled');
      }
    } else if (data.share_text) {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(data.share_text);
      // Could show a toast here
    }
    onShare?.();
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-surface-2 dark:to-surface-2 rounded-2xl border border-default overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-dream-600 to-indigo-600 px-5 py-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">Weekly Recap</h3>
            <p className="text-dream-100 text-sm">{data.week}</p>
          </div>
          <button
            onClick={handleShare}
            className="p-2 hover:bg-bgSecondary/20 rounded-full transition-colors"
            title="Share your week"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Stats */}
      <div className="p-5">
        <div className="flex items-center justify-center gap-8 mb-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">{data.summary.total_miles}</div>
            <div className="text-sm text-textTertiary">miles</div>
          </div>
          <div className="h-12 w-px bg-borderSecondary" />
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">{data.summary.total_runs}</div>
            <div className="text-sm text-textTertiary">runs</div>
          </div>
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-bgSecondary rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-dream-50 dark:bg-dream-900/30 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-dream-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-primary">
                {data.summary.avg_pace || '--'}/mi
              </div>
              <div className="text-xs text-textTertiary">Avg Pace</div>
            </div>
          </div>
          <div className="bg-bgSecondary rounded-xl p-3 flex items-center gap-3">
            <div className="w-10 h-10 bg-rose-50 dark:bg-rose-900/30 rounded-lg flex items-center justify-center">
              <Timer className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-primary">
                {data.summary.avg_rpe?.toFixed(1) || '--'}
              </div>
              <div className="text-xs text-textTertiary">Avg RPE</div>
            </div>
          </div>
        </div>

        {/* Plan Adherence */}
        {data.plan_adherence && (
          <div className="bg-bgSecondary rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-textSecondary">Plan Adherence</span>
              <span className={`text-lg font-bold ${getAdherenceColor()}`}>
                {adherencePercent}%
              </span>
            </div>
            <div className="w-full bg-bgTertiary rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  adherencePercent >= 90
                    ? 'bg-dream-500'
                    : adherencePercent >= 70
                    ? 'bg-dream-400'
                    : adherencePercent >= 50
                    ? 'bg-surface-3'
                    : 'bg-rose-400'
                }`}
                style={{ width: `${Math.min(100, adherencePercent)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-textTertiary">
              <span>{data.plan_adherence.actual_miles} of {data.plan_adherence.planned_miles} miles</span>
              <span>{data.plan_adherence.workouts_completed} workouts completed</span>
            </div>
          </div>
        )}

        {/* Achievements */}
        {data.achievements && data.achievements.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2">
              {data.achievements.map((achievement, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-surface-2 text-primary rounded-full text-sm font-medium"
                >
                  <Award className="w-4 h-4" />
                  {achievement}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Highlights & Concerns */}
        <div className="space-y-3">
          {data.highlights.length > 0 && (
            <div className="bg-bgTertiary rounded-lg p-3">
              <div className="flex items-center gap-2 text-textSecondary text-sm font-medium mb-1">
                <TrendingUp className="w-4 h-4" />
                Highlights
              </div>
              <ul className="text-sm text-textSecondary space-y-1">
                {data.highlights.map((h, i) => (
                  <li key={i}>• {h}</li>
                ))}
              </ul>
            </div>
          )}

          {data.concerns.length > 0 && (
            <div className="bg-surface-1 rounded-lg p-3">
              <div className="flex items-center gap-2 text-dream-700 dark:text-dream-300 text-sm font-medium mb-1">
                <TrendingDown className="w-4 h-4" />
                Areas to Watch
              </div>
              <ul className="text-sm text-textSecondary space-y-1">
                {data.concerns.map((c, i) => (
                  <li key={i}>• {c}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="w-full mt-4 py-2 text-sm text-textTertiary hover:text-textSecondary transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
