// Force dynamic rendering for real-time data
export const dynamic = 'force-dynamic';

import { getTodayReadinessWithFactors } from '@/actions/readiness';
import { ReadinessDetailedCard } from '@/components/ReadinessDetailedCard';
import { ReadinessCard } from '@/components/ReadinessCard';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function ReadinessPage() {
  const defaultReadinessData = {
    result: {
      score: null as number | null,
      confidence: 0,
      category: 'unknown' as const,
      color: 'text-textTertiary',
      label: 'Unknown',
      limitingFactor: null,
      recommendation: 'Unable to calculate readiness right now. Try again later.',
      breakdown: { sleep: 0, training: 0, physical: 0, life: 0 },
    },
    factors: {} as Record<string, undefined>,
  };
  const readinessResponse = await getTodayReadinessWithFactors();
  const readinessData = readinessResponse.success ? readinessResponse.data : defaultReadinessData;
  const { result, factors } = readinessData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/today"
          className="flex items-center gap-2 text-textSecondary hover:text-textPrimary transition-colors mb-3 -ml-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back to Today</span>
        </Link>

        <h1 className="text-3xl font-bold text-primary">Your Readiness</h1>
        <p className="text-sm text-textSecondary mt-1">
          Understanding your body&apos;s readiness helps optimize training and prevent overtraining.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Detailed Card */}
        <div>
          <h2 className="text-lg font-semibold text-textPrimary mb-3">Enhanced View</h2>
          <ReadinessDetailedCard readiness={result} factors={factors} />
        </div>

        {/* Original Card */}
        <div>
          <h2 className="text-lg font-semibold text-textPrimary mb-3">Simple View</h2>
          <ReadinessCard readiness={result} />
        </div>
      </div>

      {/* Explanation */}
      <div>
        <h2 className="text-xl font-semibold text-textPrimary mb-4">How Readiness Works</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-bgSecondary p-5 rounded-xl border border-borderPrimary shadow-sm">
            <h3 className="font-medium text-textPrimary mb-2">Sleep (35% weight)</h3>
            <p className="text-sm text-textSecondary">
              Quality and duration of your sleep. The most important factor for recovery.
              Aim for 7-9 hours of quality sleep.
            </p>
          </div>

          <div className="bg-bgSecondary p-5 rounded-xl border border-borderPrimary shadow-sm">
            <h3 className="font-medium text-textPrimary mb-2">Training (25% weight)</h3>
            <p className="text-sm text-textSecondary">
              Your Training Stress Balance (TSB) indicates fatigue vs freshness.
              Negative TSB means you&apos;re building fitness but need recovery.
            </p>
          </div>

          <div className="bg-bgSecondary p-5 rounded-xl border border-borderPrimary shadow-sm">
            <h3 className="font-medium text-textPrimary mb-2">Physical (25% weight)</h3>
            <p className="text-sm text-textSecondary">
              How your body feels - soreness, leg fatigue, and overall physical state.
              Listen to these signals to prevent injury.
            </p>
          </div>

          <div className="bg-bgSecondary p-5 rounded-xl border border-borderPrimary shadow-sm">
            <h3 className="font-medium text-textPrimary mb-2">Life (15% weight)</h3>
            <p className="text-sm text-textSecondary">
              Stress and mood affect recovery. High life stress requires more recovery
              time between hard efforts.
            </p>
          </div>
        </div>

        <div className="bg-dream-900/20 border border-dream-700 rounded-xl p-5 mt-6">
          <h3 className="font-medium text-dream-300 mb-2">Using Your Readiness Score</h3>
          <ul className="text-sm text-dream-200 space-y-1">
            <li><strong>80+:</strong> Perfect for hard workouts, races, or time trials</li>
            <li><strong>65-79:</strong> Good for planned workouts, adjust by feel</li>
            <li><strong>50-64:</strong> Consider easier effort or shorter duration</li>
            <li><strong>35-49:</strong> Easy run or cross-training recommended</li>
            <li><strong>&lt;35:</strong> Rest day - focus on recovery</li>
          </ul>
        </div>
      </div>
    </div>
  );
}