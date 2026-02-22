import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Predictions | Analytics | Dreamy',
  description: 'Multi-signal VO2max analysis, race predictions, and training signal breakdown.',
};

import PredictionsClient from '@/app/predictions/PredictionsClient';

export default function PredictionsAnalyticsPage() {
  return <PredictionsClient />;
}
