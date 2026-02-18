'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

type AuthRole = 'admin' | 'user' | 'viewer' | 'coach' | null;
type SessionMode = 'public' | 'private';

interface AccessModeBannerProps {
  role: AuthRole;
  globalMode: SessionMode;
  sessionMode: SessionMode;
}

export function AccessModeBanner({ role, globalMode, sessionMode }: AccessModeBannerProps) {
  const pathname = usePathname();
  const [savingMode, setSavingMode] = useState<SessionMode | null>(null);
  const isPrivileged = role === 'admin' || role === 'user';
  const isGuestView = sessionMode === 'public' && !isPrivileged;

  if (pathname === '/gate') return null;

  const updateSessionMode = async (mode: SessionMode) => {
    if (!isPrivileged || savingMode) return;
    setSavingMode(mode);
    try {
      const response = await fetch('/api/access-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      if (!response.ok) {
        setSavingMode(null);
        return;
      }
      window.location.reload();
    } catch {
      setSavingMode(null);
    }
  };

  if (isGuestView) {
    return (
      <div className="mb-4 rounded-xl border border-sky-600/50 bg-sky-950/40 px-4 py-3 text-sm text-sky-100">
        Viewing the public share profile. You can explore everything, but changes are read-only.
      </div>
    );
  }

  if (!isPrivileged) return null;

  const globalModeLabel = globalMode === 'public' ? 'Public (shared)' : 'Private (prod)';
  const sessionModeLabel = sessionMode === 'public' ? 'Public Preview' : 'Private Editing';

  return (
    <div className="mb-4 rounded-xl border border-borderPrimary bg-bgSecondary px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">
            Access Mode: {sessionModeLabel}
          </p>
          <p className="text-xs text-textTertiary mt-1">
            Site default is {globalModeLabel}. Private Editing enables full writes for your admin/user session.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => updateSessionMode('private')}
            disabled={savingMode !== null}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              sessionMode === 'private'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-surface-2 text-textSecondary border border-borderSecondary hover:text-primary'
            )}
          >
            Private Editing
          </button>
          <button
            onClick={() => updateSessionMode('public')}
            disabled={savingMode !== null}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              sessionMode === 'public'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : 'bg-surface-2 text-textSecondary border border-borderSecondary hover:text-primary'
            )}
          >
            Public Preview
          </button>
        </div>
      </div>
    </div>
  );
}
