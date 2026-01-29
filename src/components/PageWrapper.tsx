'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { DemoModeGate } from './DemoModeGate';
import { DemoBanner } from './DemoBanner';

// Pages that should NOT redirect to onboarding in demo mode
const EXEMPT_PATHS = ['/onboarding', '/'];

export function PageWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isExempt = EXEMPT_PATHS.includes(pathname);

  return (
    <>
      <DemoBanner />
      {isExempt ? (
        children
      ) : (
        <DemoModeGate>{children}</DemoModeGate>
      )}
    </>
  );
}
