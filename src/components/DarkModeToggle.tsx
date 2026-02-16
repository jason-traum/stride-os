'use client';

import { Moon } from 'lucide-react';

export function DarkModeToggle() {
  // Dark mode is forced for now — dreamy aesthetic
  return (
    <button
      className="p-2 rounded-lg hover:bg-surface-interactive-hover transition-colors opacity-50 cursor-default"
      title="Dark mode"
      aria-label="Dark mode (always on)"
      disabled
    >
      <Moon className="w-5 h-5 text-textSecondary" />
    </button>
  );
}
