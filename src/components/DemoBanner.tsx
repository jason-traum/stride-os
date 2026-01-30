'use client';

import { useRouter } from 'next/navigation';
import { useDemoMode } from './DemoModeProvider';
import { Sparkles, X, RotateCcw } from 'lucide-react';

export function DemoBanner() {
  const { isDemo, exitDemo, settings } = useDemoMode();
  const router = useRouter();

  if (!isDemo) return null;

  const handleResetDemo = () => {
    if (confirm('Reset demo? This will clear all your demo data and start fresh.')) {
      // Clear all demo localStorage keys
      const keysToRemove = [
        'dreamy_demo_mode',
        'dreamy_demo_settings',
        'dreamy_demo_workouts',
        'dreamy_demo_shoes',
        'dreamy_demo_races',
        'dreamy_demo_planned_workouts',
      ];
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Re-initialize demo mode and redirect to onboarding
      localStorage.setItem('dreamy_demo_mode', 'true');
      router.push('/onboarding');
      window.location.reload();
    }
  };

  return (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 mb-4 rounded-xl flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">
          Demo Mode {settings?.name ? `- Welcome, ${settings.name}!` : ''}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={handleResetDemo}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-white/20 hover:bg-white/30 rounded transition-colors"
          title="Reset demo data and start over"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </button>
        <button
          onClick={exitDemo}
          className="p-1 hover:bg-white/20 rounded transition-colors"
          title="Exit demo mode"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
