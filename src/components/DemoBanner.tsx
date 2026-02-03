'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDemoMode } from './DemoModeProvider';
import { ConfirmModal } from './ConfirmModal';
import { Sparkles, X, RotateCcw } from 'lucide-react';

export function DemoBanner() {
  const { isDemo, exitDemo, settings } = useDemoMode();
  const router = useRouter();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  if (!isDemo) return null;

  const handleResetDemo = () => {
    // Clear all demo localStorage keys
    const keysToRemove = [
      'dreamy_demo_mode',
      'dreamy_demo_settings',
      'dreamy_demo_workouts',
      'dreamy_demo_shoes',
      'dreamy_demo_races',
      'dreamy_demo_planned_workouts',
      'dreamy_demo_race_results',
      'dreamy_demo_injuries',
      'dreamy_demo_wardrobe',
      'dreamy_demo_outfit_feedback',
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));

    // Re-initialize demo mode and redirect to onboarding
    localStorage.setItem('dreamy_demo_mode', 'true');
    router.push('/onboarding');
    window.location.reload();
  };

  return (
    <>
      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleResetDemo}
        title="Reset Demo?"
        message="This will clear all your demo data (workouts, races, settings) and start fresh with the onboarding process."
        confirmText="Reset Demo"
        cancelText="Keep Data"
        variant="warning"
      />
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 mb-4 rounded-xl flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4" />
        <span className="text-sm font-medium">
          Demo Mode {settings?.name ? `- Welcome, ${settings.name}!` : ''}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowResetConfirm(true)}
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
    </>
  );
}
