'use client';

import { useProfile } from '@/lib/profile-context';
import { cn } from '@/lib/utils';
import { User, ChevronDown, Eye } from 'lucide-react';

interface ProfileSwitcherProps {
  variant?: 'sidebar' | 'compact';
  className?: string;
}

export function ProfileSwitcher({ variant = 'sidebar', className }: ProfileSwitcherProps) {
  const { activeProfile, setShowPicker, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className={cn(
        'animate-pulse bg-stone-700 rounded-lg',
        variant === 'sidebar' ? 'h-12' : 'h-8 w-24',
        className
      )} />
    );
  }

  if (!activeProfile) {
    return null;
  }

  const isDemo = activeProfile.type === 'demo';

  if (variant === 'compact') {
    return (
      <button
        onClick={() => setShowPicker(true)}
        className={cn(
          'flex items-center gap-2 px-2 py-1 rounded-lg transition-colors',
          'hover:bg-stone-100 text-stone-700',
          className
        )}
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: activeProfile.avatarColor }}
        >
          {isDemo ? (
            <Eye className="w-3 h-3 text-white" />
          ) : (
            <User className="w-3 h-3 text-white" />
          )}
        </div>
        <span className="text-sm font-medium truncate max-w-[100px]">
          {activeProfile.name}
        </span>
        <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" />
      </button>
    );
  }

  // Sidebar variant
  return (
    <button
      onClick={() => setShowPicker(true)}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
        'hover:bg-stone-800 text-stone-200',
        className
      )}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: activeProfile.avatarColor }}
      >
        {isDemo ? (
          <Eye className="w-4 h-4 text-white" />
        ) : (
          <User className="w-4 h-4 text-white" />
        )}
      </div>
      <div className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium truncate">{activeProfile.name}</p>
        {isDemo && (
          <p className="text-xs text-stone-400">Demo Mode</p>
        )}
      </div>
      <ChevronDown className="w-4 h-4 text-stone-400 flex-shrink-0" />
    </button>
  );
}
