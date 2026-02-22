import type { Metadata } from 'next';
import RacesClient from './RacesClient';

export const metadata: Metadata = {
  title: 'Racing | Dreamy',
  description: 'Upcoming races, race results, predictions, and personal records.',
};

export const dynamic = 'force-dynamic';

export default function RacesPage() {
  return <RacesClient />;
}
