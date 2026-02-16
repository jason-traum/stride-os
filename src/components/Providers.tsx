'use client';

import { ToastProvider } from './Toast';
import { PWAProvider } from './PWAProvider';
import { DemoModeProvider } from './DemoModeProvider';
import { ProfileProvider } from '@/lib/profile-context';
import { ProfilePicker } from './ProfilePicker';
import { ErrorBoundary } from './ErrorBoundary';
import { SheepMoodProvider } from '@/context/SheepMoodContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <PWAProvider>
        <ProfileProvider>
          <DemoModeProvider>
            <SheepMoodProvider>
              <ToastProvider>
                {children}
                <ProfilePicker />
              </ToastProvider>
            </SheepMoodProvider>
          </DemoModeProvider>
        </ProfileProvider>
      </PWAProvider>
    </ErrorBoundary>
  );
}
