// Force dynamic rendering for real-time data
export const dynamic = 'force-dynamic';

import { getTodayReadinessWithFactors } from '@/actions/readiness';
import { ReadinessDetailedCard } from '@/components/ReadinessDetailedCard';
import { ReadinessCard } from '@/components/ReadinessCard';
import { ArrowLeft, ToggleLeft, ToggleRight } from 'lucide-react';
import Link from 'next/link';

export default async function ReadinessPage() {
  const { result, factors } = await getTodayReadinessWithFactors();

  return (
    <div className="min-h-screen bg-bgTertiary">
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
          <Link
            href="/today"
            className="flex items-center gap-2 text-textSecondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Today</span>
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-primary mb-2">Your Readiness</h1>
        <p className="text-textSecondary mb-8">
          Understanding your body's readiness helps optimize training and prevent overtraining.
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Detailed Card */}
          <div>
            <h2 className="text-lg font-semibold text-primary mb-3">Enhanced View</h2>
            <ReadinessDetailedCard readiness={result} factors={factors} />
          </div>

          {/* Original Card */}
          <div>
            <h2 className="text-lg font-semibold text-primary mb-3">Simple View</h2>
            <ReadinessCard readiness={result} />
          </div>
        </div>

        {/* Explanation */}
        <div className="mt-12 prose prose-stone max-w-none">
          <h2 className="text-xl font-semibold text-primary">How Readiness Works</h2>

          <div className="grid gap-4 md:grid-cols-2 mt-6">
            <div className="bg-surface-1 p-5 rounded-lg border border-default">
              <h3 className="font-medium text-primary mb-2">Sleep (35% weight)</h3>
              <p className="text-sm text-textSecondary">
                Quality and duration of your sleep. The most important factor for recovery.
                Aim for 7-9 hours of quality sleep.
              </p>
            </div>

            <div className="bg-surface-1 p-5 rounded-lg border border-default">
              <h3 className="font-medium text-primary mb-2">Training (25% weight)</h3>
              <p className="text-sm text-textSecondary">
                Your Training Stress Balance (TSB) indicates fatigue vs freshness.
                Negative TSB means you're building fitness but need recovery.
              </p>
            </div>

            <div className="bg-surface-1 p-5 rounded-lg border border-default">
              <h3 className="font-medium text-primary mb-2">Physical (25% weight)</h3>
              <p className="text-sm text-textSecondary">
                How your body feels - soreness, leg fatigue, and overall physical state.
                Listen to these signals to prevent injury.
              </p>
            </div>

            <div className="bg-surface-1 p-5 rounded-lg border border-default">
              <h3 className="font-medium text-primary mb-2">Life (15% weight)</h3>
              <p className="text-sm text-textSecondary">
                Stress and mood affect recovery. High life stress requires more recovery
                time between hard efforts.
              </p>
            </div>
          </div>

          <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 rounded-lg p-5 mt-6">
            <h3 className="font-medium text-teal-900 dark:text-teal-300 mb-2">Using Your Readiness Score</h3>
            <ul className="text-sm text-teal-800 dark:text-teal-200 space-y-1">
              <li><strong>80+:</strong> Perfect for hard workouts, races, or time trials</li>
              <li><strong>65-79:</strong> Good for planned workouts, adjust by feel</li>
              <li><strong>50-64:</strong> Consider easier effort or shorter duration</li>
              <li><strong>35-49:</strong> Easy run or cross-training recommended</li>
              <li><strong>&lt;35:</strong> Rest day - focus on recovery</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}