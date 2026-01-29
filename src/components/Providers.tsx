'use client';

import { ToastProvider } from './Toast';
import { PWAProvider } from './PWAProvider';
import { DemoModeProvider } from './DemoModeProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PWAProvider>
      <DemoModeProvider>
        <ToastProvider>{children}</ToastProvider>
      </DemoModeProvider>
    </PWAProvider>
  );
}
