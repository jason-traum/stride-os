import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Racing | Analytics | Dreamy',
  description: 'Race predictions, training zones, and goal race planning.',
};

import { RacePredictorCard, GoalRaceCalculator } from '@/components/RacePredictor';
import { ZoneBoundariesCard } from '@/components/ZoneBoundariesCard';
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList';

export default function RacingPage() {
  return (
    <AnimatedList>
      <AnimatedListItem>
        <div className="mb-4">
          <ZoneBoundariesCard />
        </div>
      </AnimatedListItem>

      <AnimatedListItem>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <RacePredictorCard />
          <GoalRaceCalculator />
        </div>
      </AnimatedListItem>
    </AnimatedList>
  );
}
