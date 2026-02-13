// Force dynamic rendering - page depends on database
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getWorkouts } from '@/actions/workouts';
import { WorkoutList } from '@/components/WorkoutList';
import { DemoHistory } from '@/components/DemoHistory';
import { DemoWrapper } from '@/components/DemoWrapper';
import { Clock } from 'lucide-react';
import { getActiveProfileId } from '@/lib/profile-server';

async function ServerHistory() {
  const profileId = await getActiveProfileId();
  const workouts = await getWorkouts(undefined, profileId);
  console.log(`[History] Profile ID: ${profileId}, Found ${workouts.length} workouts`);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-semibold text-textPrimary">History</h1>
        <Link
          href="/log"
          className="px-4 py-2 bg-accentTeal text-white rounded-lg text-sm font-medium hover:bg-accentTeal/90 transition-colors"
        >
          Log Run
        </Link>
      </div>

      {workouts.length === 0 ? (
        <div className="bg-bgSecondary rounded-xl border border-borderPrimary p-8 text-center shadow-sm">
          <div className="text-textTertiary mb-4">
            <Clock className="w-12 h-12 mx-auto" />
          </div>
          <h2 className="text-lg font-medium text-textPrimary mb-2">No workouts yet</h2>
          <p className="text-textSecondary mb-4">Start logging your runs to track your progress.</p>
          <Link
            href="/log"
            className="inline-flex items-center px-4 py-2 bg-accentTeal text-white rounded-lg text-sm font-medium hover:bg-accentTeal/90 transition-colors"
          >
            Log your first run
          </Link>
        </div>
      ) : (
        <WorkoutList workouts={workouts} />
      )}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <DemoWrapper
      demoComponent={<DemoHistory />}
      serverComponent={<ServerHistory />}
    />
  );
}
