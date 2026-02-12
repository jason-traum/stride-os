'use client';

import { ToastProvider } from './Toast';
import { PWAProvider } from './PWAProvider';
import { DemoModeProvider } from './DemoModeProvider';
import { ProfileProvider } from '@/lib/profile-context';
import { ProfilePicker } from './ProfilePicker';
import { ErrorBoundary } from './ErrorBoundary';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <PWAProvider>
        <ProfileProvider>
          <DemoModeProvider>
            <ToastProvider>
              {children}
              <ProfilePicker />
            </ToastProvider>
          </DemoModeProvider>
        </ProfileProvider>
      </PWAProvider>
    </ErrorBoundary>
  );
}
