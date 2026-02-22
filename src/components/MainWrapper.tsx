'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AccessModeBanner } from './AccessModeBanner';

type AuthRole = 'admin' | 'user' | 'viewer' | 'coach' | 'customer' | null;

interface MainWrapperProps {
  children: ReactNode;
  role: AuthRole;
  appViewMode: 'private' | 'share' | 'publish';
  globalMode: 'public' | 'private';
  sessionMode: 'public' | 'private';
}

const CHROME_FREE_PATHS = ['/gate'];

export function MainWrapper({ children, role, appViewMode, globalMode, sessionMode }: MainWrapperProps) {
  const pathname = usePathname();
  const isChromeFree = CHROME_FREE_PATHS.some(
    p => pathname === p || pathname.startsWith(p + '/')
  );

  if (isChromeFree) {
    return (
      <main className="min-h-screen">
        {children}
      </main>
    );
  }

  return (
    <main className="pt-[calc(48px+env(safe-area-inset-top))] md:pt-0 md:pl-64 pb-20 md:pb-0 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <AccessModeBanner
          role={role}
          appViewMode={appViewMode}
          globalMode={globalMode}
          sessionMode={sessionMode}
        />
        {children}
      </div>
    </main>
  );
}
