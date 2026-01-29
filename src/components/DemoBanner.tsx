'use client';

import { useDemoMode } from './DemoModeProvider';
import { Sparkles, X } from 'lucide-react';

export function DemoBanner() {
  const { isDemo, exitDemo, settings } = useDemoMode();

  if (!isDemo) return null;

  return (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 mb-4 rounded-xl flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">
          Demo Mode {settings?.name ? `- Welcome, ${settings.name}!` : ''}
        </span>
      </div>
      <button
        onClick={exitDemo}
        className="p-1 hover:bg-white/20 rounded transition-colors"
        title="Exit demo mode"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
