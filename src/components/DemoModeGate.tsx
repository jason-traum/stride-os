'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useDemoMode } from './DemoModeProvider';

/**
 * In demo mode, redirects to onboarding if not completed.
 * Wrap main app content with this component.
 */
export function DemoModeGate({ children }: { children: React.ReactNode }) {
  const { isDemo, settings, isLoading } = useDemoMode();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;

    // In demo mode, redirect to onboarding if not completed
    if (isDemo && !settings?.onboardingCompleted) {
      // Don't redirect if already on onboarding
      if (pathname !== '/onboarding') {
        router.push('/onboarding');
      }
    }
  }, [isDemo, settings, isLoading, pathname, router]);

  // Show loading state briefly while checking demo mode
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse text-tertiary">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
}
