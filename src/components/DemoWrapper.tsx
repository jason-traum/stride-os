'use client';

import { useEffect, useState, ReactNode, Suspense } from 'react';
import { isDemoMode } from '@/lib/demo-mode';

interface DemoWrapperProps {
  demoComponent: ReactNode;
  serverComponent: ReactNode;
}

export function DemoWrapper({ demoComponent, serverComponent }: DemoWrapperProps) {
  const [isDemo, setIsDemo] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDemo(isDemoMode());
  }, []);

  // While checking, show server component (will work for non-demo users)
  if (isDemo === null) {
    return <Suspense fallback={<div className="animate-pulse">Loading...</div>}>{serverComponent}</Suspense>;
  }

  // If demo mode, show demo component
  if (isDemo) {
    return <>{demoComponent}</>;
  }

  // Otherwise show server component
  return <Suspense fallback={<div className="animate-pulse">Loading...</div>}>{serverComponent}</Suspense>;
}
