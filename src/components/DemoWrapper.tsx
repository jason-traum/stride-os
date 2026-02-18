'use client';

import { ReactNode, Suspense } from 'react';
import { useDemoMode } from '@/components/DemoModeProvider';

interface DemoWrapperProps {
  demoComponent: ReactNode;
  serverComponent: ReactNode;
}

export function DemoWrapper({ demoComponent, serverComponent }: DemoWrapperProps) {
  const { isDemo, isLoading } = useDemoMode();

  // Show loading state while demo mode initializes
  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  // In demo mode, show the demo component
  if (isDemo) {
    return <>{demoComponent}</>;
  }

  // Otherwise show the server component
  return <Suspense fallback={<div className="animate-pulse">Loading...</div>}>{serverComponent}</Suspense>;
}
