'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { DemoModeGate } from './DemoModeGate';
import { AnimatedPage } from './AnimatedPage';

// Pages that should NOT redirect to onboarding in demo mode
const EXEMPT_PATHS = ['/onboarding', '/', '/welcome2'];

// Pages that skip AnimatedPage wrapper (need raw rendering for fixed/scroll)
const SKIP_ANIMATION_PATHS = ['/', '/welcome2', '/sheep-jump'];

export function PageWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isExempt = EXEMPT_PATHS.includes(pathname);
  const skipAnimation = SKIP_ANIMATION_PATHS.includes(pathname);

  const content = skipAnimation
    ? <div key={pathname}>{children}</div>
    : <AnimatedPage key={pathname}>{children}</AnimatedPage>;

  return isExempt ? content : <DemoModeGate>{content}</DemoModeGate>;
}
