import { redirect } from 'next/navigation';
import { checkOnboardingStatus } from '@/actions/onboarding';

export default async function Home() {
  const { needsOnboarding } = await checkOnboardingStatus();

  if (needsOnboarding) {
    redirect('/onboarding');
  }

  redirect('/today');
}
