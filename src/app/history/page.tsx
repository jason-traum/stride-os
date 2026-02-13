// Force dynamic rendering - page depends on database
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getWorkouts, getWorkoutCount } from '@/actions/workouts';
import { WorkoutList } from '@/components/WorkoutList';
import { DemoHistory } from '@/components/DemoHistory';
import { DemoWrapper } from '@/components/DemoWrapper';
import { Clock } from 'lucide-react';
import { getActiveProfileId } from '@/lib/profile-server';

const PAGE_SIZE = 30;

async function ServerHistory() {
  const profileId = await getActiveProfileId();
  const [workouts, totalCount] = await Promise.all([
    getWorkouts(PAGE_SIZE, profileId),
    getWorkoutCount(profileId),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display font-semibold text-textPrimary">History</h1>
        <div className="flex items-center gap-3">
          {totalCount > 0 && (
            <span className="text-sm text-textTertiary">{totalCount} runs</span>
          )}
          <Link
            href="/log"
            className="btn-primary text-sm"
          >
            Log Run
          </Link>
        </div>
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
            className="btn-primary inline-flex items-center text-sm"
          >
            Log your first run
          </Link>
        </div>
      ) : (
        <WorkoutList initialWorkouts={workouts} totalCount={totalCount} pageSize={PAGE_SIZE} />
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
