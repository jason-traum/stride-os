'use client';

import { ReactNode, Suspense } from 'react';

interface DemoWrapperProps {
  demoComponent: ReactNode;
  serverComponent: ReactNode;
}

export function DemoWrapper({ serverComponent }: DemoWrapperProps) {
  // Always show server component - database is pre-seeded with demo data
  // This ensures demo users see the full analytics features
  return <Suspense fallback={<div className="animate-pulse">Loading...</div>}>{serverComponent}</Suspense>;
}
