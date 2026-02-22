import type { Metadata } from 'next';

// Force dynamic rendering - page depends on database
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Achievements | Dreamy',
  description: 'Track your running achievements, milestones, and badges.',
};

import { checkAchievements } from '@/actions/achievements';
import { AchievementsClient } from './AchievementsClient';

export default async function AchievementsPage() {
  const result = await checkAchievements();

  if (!result.success) {
    return (
      <div className="p-6 text-center text-textSecondary">
        <p>Unable to load achievements. {result.error}</p>
      </div>
    );
  }

  return <AchievementsClient data={result.data} />;
}
