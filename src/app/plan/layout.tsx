import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Training Plan | Dreamy',
  description: 'View and manage your personalized AI-generated training plan.',
};

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
