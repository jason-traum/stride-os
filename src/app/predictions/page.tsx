import type { Metadata } from 'next';
import PredictionsClient from './PredictionsClient';

export const metadata: Metadata = {
  title: 'Race Predictions | Dreamy',
  description: 'Multi-signal VO2max analysis, race predictions, and training signal breakdown.',
};

export const dynamic = 'force-dynamic';

export default function PredictionsPage() {
  return <PredictionsClient />;
}
