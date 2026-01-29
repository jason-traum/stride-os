'use client';

import { ToastProvider } from './Toast';
import { PWAProvider } from './PWAProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PWAProvider>
      <ToastProvider>{children}</ToastProvider>
    </PWAProvider>
  );
}
