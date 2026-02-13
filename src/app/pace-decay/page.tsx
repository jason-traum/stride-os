import { getActiveProfileId } from '@/lib/profile-server';
import { analyzePaceDecay } from '@/lib/pace-decay';
import { PaceDecayCard } from '@/components/PaceDecayCard';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default async function PaceDecayPage() {
  const profileId = await getActiveProfileId();
  if (!profileId) {
    return (
      <div className="min-h-screen bg-bgTertiary p-4">
        <p className="text-center text-textTertiary">No active profile</p>
      </div>
    );
  }

  const paceDecayData = await analyzePaceDecay(profileId);

  return (
    <div className="min-h-screen bg-bgTertiary">
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/tools"
            className="inline-flex items-center text-sm text-textSecondary hover:text-teal-600 mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Tools
          </Link>
          <h1 className="text-3xl font-bold text-primary mb-2">Pace Decay Analysis</h1>
          <p className="text-textSecondary">
            Understand how your pace changes throughout your runs and learn to pace more effectively
          </p>
        </div>

        {/* Pace Decay Card */}
        <PaceDecayCard data={paceDecayData} />

        {/* Explanation */}
        <div className="mt-8 bg-surface-1 rounded-xl border border-default p-6 space-y-4">
          <h2 className="text-lg font-semibold text-primary">Understanding Pace Decay</h2>

          <div className="space-y-3 text-sm text-textSecondary">
            <p>
              <strong>What is pace decay?</strong> It's the natural tendency to slow down as a run progresses due to fatigue.
              Measured as seconds per mile added for every 10% of the run completed.
            </p>

            <p>
              <strong>How is it calculated?</strong> We analyze your split data from the last 90 days,
              using linear regression to find the trend in how your pace changes from start to finish.
            </p>

            <div>
              <p className="font-medium text-secondary mb-2">What the numbers mean:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Excellent (&lt;2s/mi):</strong> Very consistent pacing, minimal slowdown</li>
                <li><strong>Good (2-5s/mi):</strong> Normal fatigue-related slowdown</li>
                <li><strong>Moderate (5-10s/mi):</strong> Noticeable slowdown, could improve pacing</li>
                <li><strong>High (&gt;10s/mi):</strong> Starting too fast, significant positive splits</li>
              </ul>
            </div>

            <p>
              <strong>Why it matters:</strong> Better pacing leads to faster overall times, more enjoyable runs,
              and reduced injury risk. Most runners perform best with even or slight negative splits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}