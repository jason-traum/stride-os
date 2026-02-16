'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { DemoModeGate } from './DemoModeGate';
import { AnimatedPage } from './AnimatedPage';

// Pages that should NOT redirect to onboarding in demo mode
const EXEMPT_PATHS = ['/onboarding', '/'];

export function PageWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isExempt = EXEMPT_PATHS.includes(pathname);

  const content = <AnimatedPage key={pathname}>{children}</AnimatedPage>;

  // DemoBanner is rendered in layout.tsx, not here (to avoid duplicates)
  return isExempt ? content : <DemoModeGate>{content}</DemoModeGate>;
}
