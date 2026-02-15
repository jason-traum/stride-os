import { getActiveProfileId } from '@/lib/profile-server';
import { getRacePredictions } from '@/lib/race-predictor';
import { RacePredictorCard } from '@/components/RacePredictorCard';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default async function RacePredictorPage() {
  const profileId = await getActiveProfileId();
  if (!profileId) {
    return (
      <div className="min-h-screen bg-bgTertiary p-4">
        <p className="text-center text-textTertiary">No active profile</p>
      </div>
    );
  }

  const predictions = await getRacePredictions(profileId);

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
          <h1 className="text-3xl font-bold text-primary mb-2">Race Predictor</h1>
          <p className="text-textSecondary">
            Predict your race times based on recent performances and current fitness
          </p>
        </div>

        {/* Race Predictions */}
        <RacePredictorCard data={predictions} />

        {/* How It Works */}
        <div className="mt-8 bg-surface-1 rounded-xl border border-default p-6 space-y-4">
          <h2 className="text-lg font-semibold text-primary">How Predictions Work</h2>

          <div className="space-y-3 text-sm text-textSecondary">
            <div>
              <p className="font-medium text-secondary mb-1">Recent Race Performance</p>
              <p>If you&apos;ve raced recently, we use that result as the primary predictor, scaling it to other distances using proven formulas.</p>
            </div>

            <div>
              <p className="font-medium text-secondary mb-1">VO2 Max Based</p>
              <p>Your VO₂ max (from profile or estimated) helps predict sustainable paces across different distances.</p>
            </div>

            <div>
              <p className="font-medium text-secondary mb-1">Training Pace Analysis</p>
              <p>We analyze your tempo runs and quality workouts to estimate race potential when other data isn&apos;t available.</p>
            </div>

            <div>
              <p className="font-medium text-secondary mb-1">Confidence Levels</p>
              <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                <li><strong>High:</strong> Recent race + appropriate training volume</li>
                <li><strong>Medium:</strong> Older race data or VO₂ max based</li>
                <li><strong>Low:</strong> Training paces only, less reliable</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-6 bg-teal-50 rounded-xl border border-teal-200 p-6">
          <h3 className="text-lg font-semibold text-teal-900 mb-3">Improve Your Predictions</h3>
          <ul className="space-y-2 text-sm text-teal-800">
            <li>• Race a 5K or 10K time trial for accurate baseline data</li>
            <li>• Log all workouts, especially tempo runs and intervals</li>
            <li>• Update your VO₂ max in your profile if you know it</li>
            <li>• Maintain consistent training for better predictions</li>
            <li>• Remember: predictions assume optimal conditions and proper taper</li>
          </ul>
        </div>
      </div>
    </div>
  );
}