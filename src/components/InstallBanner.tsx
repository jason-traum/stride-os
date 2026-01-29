'use client';

import { useState, useEffect } from 'react';
import { Download, X, WifiOff } from 'lucide-react';
import { usePWA } from './PWAProvider';

export function InstallBanner() {
  const { isInstallable, isInstalled, installApp } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Check if user has dismissed the banner before
    const wasDismissed = localStorage.getItem('pwa-banner-dismissed');
    if (wasDismissed) {
      setDismissed(true);
    }
    // Delay showing banner to not be intrusive
    const timer = setTimeout(() => {
      setShowBanner(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  if (!showBanner || isInstalled || !isInstallable || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-24 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-40">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-4 text-white">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">Install Dreamy</h3>
            <p className="text-sm text-indigo-100 mt-0.5">
              Add to your home screen for quick access
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={installApp}
                className="bg-white text-indigo-600 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors"
              >
                Install
              </button>
              <button
                onClick={handleDismiss}
                className="text-indigo-100 px-3 py-1.5 text-sm hover:text-white transition-colors"
              >
                Not now
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-indigo-200 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function OfflineBanner() {
  const { isOnline } = usePWA();

  if (isOnline) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-900 px-4 py-2 text-center text-sm font-medium">
      <WifiOff className="w-4 h-4 inline-block mr-2" />
      You are offline. Some features may be limited.
    </div>
  );
}
