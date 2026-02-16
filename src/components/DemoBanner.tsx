'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProfile } from '@/lib/profile-context';
import { useDemoMode } from './DemoModeProvider';
import { ConfirmModal } from './ConfirmModal';
import { Eye, X, RotateCcw, ArrowRight } from 'lucide-react';

export function DemoBanner() {
  // Try new profile system first, fall back to old demo mode
  const { isDemo: isProfileDemo, setShowPicker, clearDemoOverlay, activeProfile } = useProfile();
  const { isDemo: isLegacyDemo, exitDemo, settings } = useDemoMode();
  const router = useRouter();
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Use new profile system if active, otherwise fall back to legacy
  const isDemo = isProfileDemo || isLegacyDemo;

  if (!isDemo) return null;

  // Handle reset for new profile system
  const handleProfileReset = () => {
    clearDemoOverlay();
    window.location.reload();
  };

  // Handle reset for legacy demo mode
  const handleLegacyResetDemo = () => {
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

  // Use new profile-based demo banner if profile system is active
  if (isProfileDemo && activeProfile) {
    return (
      <>
        <ConfirmModal
          isOpen={showResetConfirm}
          onClose={() => setShowResetConfirm(false)}
          onConfirm={handleProfileReset}
          title="Reset Demo?"
          message="This will clear all your demo changes and restore the original sample data."
          confirmText="Reset Demo"
          cancelText="Keep Changes"
          variant="warning"
        />
        <div className="bg-bgPrimary border-b border-default px-4 py-2">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-textSecondary">
              <Eye className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">
                Demo Mode
              </span>
              <span className="text-sm text-dream-600 hidden sm:inline">
                - Changes won&apos;t be saved
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowResetConfirm(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-dream-700 dark:text-dream-300 hover:text-primary hover:bg-dream-50 rounded transition-colors"
                title="Reset demo data"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Reset</span>
              </button>
              <button
                onClick={() => setShowPicker(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-accentTeal text-white hover:bg-accentTeal-hover rounded transition-all shadow-sm"
              >
                <span>Switch Profile</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Legacy demo banner (URL-based demo mode)
  return (
    <>
      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleLegacyResetDemo}
        title="Reset Demo?"
        message="This will clear all your demo data (workouts, races, settings) and start fresh with the onboarding process."
        confirmText="Reset Demo"
        cancelText="Keep Data"
        variant="warning"
      />
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 mb-4 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4" />
          <span className="text-sm font-medium">
            Demo Mode {settings?.name ? `- Welcome, ${settings.name}!` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-bgSecondary/20 hover:bg-bgSecondary/30 rounded transition-colors"
            title="Reset demo data and start over"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
          <button
            onClick={exitDemo}
            className="p-1 hover:bg-bgSecondary/20 rounded transition-colors"
            title="Exit demo mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
}
