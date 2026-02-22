import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Racing | Analytics | Dreamy',
  description: 'Race predictions, training zones, and goal race planning.',
};

export const dynamic = 'force-dynamic';

import { getPredictionDashboardData } from '@/actions/prediction-dashboard';
import { ZoneBoundariesCard } from '@/components/ZoneBoundariesCard';
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList';
import { RacingDashboardClient } from './RacingDashboardClient';

export default async function RacingPage() {
  const dashboardResult = await getPredictionDashboardData();

  return (
    <AnimatedList>
      <AnimatedListItem>
        <RacingDashboardClient data={dashboardResult.data} error={dashboardResult.error} />
      </AnimatedListItem>

      <AnimatedListItem>
        <div className="mt-4">
          <ZoneBoundariesCard />
        </div>
      </AnimatedListItem>
    </AnimatedList>
  );
}
