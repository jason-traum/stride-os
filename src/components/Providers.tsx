'use client';

import { ToastProvider } from './Toast';
import { PWAProvider } from './PWAProvider';
import { DemoModeProvider } from './DemoModeProvider';
import { GuestModeProvider } from './GuestModeProvider';
import { ProfileProvider } from '@/lib/profile-context';
import { ProfilePicker } from './ProfilePicker';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PWAProvider>
      <ProfileProvider>
        <DemoModeProvider>
          <GuestModeProvider>
            <ToastProvider>
              {children}
              <ProfilePicker />
            </ToastProvider>
          </GuestModeProvider>
        </DemoModeProvider>
      </ProfileProvider>
    </PWAProvider>
  );
}
