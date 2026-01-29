'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { initDemoMode, isDemoMode, exitDemoMode, getDemoSettings, saveDemoSettings, type DemoSettings } from '@/lib/demo-mode';

interface DemoModeContextType {
  isDemo: boolean;
  settings: DemoSettings | null;
  updateSettings: (settings: Partial<DemoSettings>) => void;
  exitDemo: () => void;
  isLoading: boolean;
}

const DemoModeContext = createContext<DemoModeContextType>({
  isDemo: false,
  settings: null,
  updateSettings: () => {},
  exitDemo: () => {},
  isLoading: true,
});

export function useDemoMode() {
  return useContext(DemoModeContext);
}

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemo, setIsDemo] = useState(false);
  const [settings, setSettings] = useState<DemoSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize demo mode from URL or localStorage
    const demoActive = initDemoMode();
    setIsDemo(demoActive);

    if (demoActive) {
      // Load demo settings
      const demoSettings = getDemoSettings();
      setSettings(demoSettings);
    }

    setIsLoading(false);
  }, []);

  const updateSettings = (newSettings: Partial<DemoSettings>) => {
    if (!isDemo) return;
    const updated = saveDemoSettings(newSettings);
    setSettings(updated);
  };

  const exitDemo = () => {
    exitDemoMode();
    setIsDemo(false);
    setSettings(null);
    // Reload to get database data
    window.location.reload();
  };

  return (
    <DemoModeContext.Provider value={{ isDemo, settings, updateSettings, exitDemo, isLoading }}>
      {children}
    </DemoModeContext.Provider>
  );
}
