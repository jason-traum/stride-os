'use client';

import { useState } from 'react';
import { Download, FileSpreadsheet, FileJson, Trophy, Loader2 } from 'lucide-react';
import { useProfile } from '@/lib/profile-context';

type ExportType = 'workouts-csv' | 'workouts-json' | 'races-csv' | 'all-json';

interface ExportOption {
  id: ExportType;
  label: string;
  description: string;
  icon: typeof FileSpreadsheet;
  format: string;
  type: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  {
    id: 'workouts-csv',
    label: 'Workouts (CSV)',
    description: 'All workouts with pace, HR, weather, VDOT signals',
    icon: FileSpreadsheet,
    format: 'csv',
    type: 'workouts',
  },
  {
    id: 'workouts-json',
    label: 'Workouts (JSON)',
    description: 'Full workout data in JSON format',
    icon: FileJson,
    format: 'json',
    type: 'workouts',
  },
  {
    id: 'races-csv',
    label: 'Race Results (CSV)',
    description: 'Race history with times, VDOT, and effort levels',
    icon: Trophy,
    format: 'csv',
    type: 'races',
  },
  {
    id: 'all-json',
    label: 'Everything (JSON)',
    description: 'Workouts + race results combined',
    icon: Download,
    format: 'json',
    type: 'all',
  },
];

export function DataExport() {
  const { activeProfile } = useProfile();
  const [loadingId, setLoadingId] = useState<ExportType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(option: ExportOption) {
    setLoadingId(option.id);
    setError(null);

    try {
      const params = new URLSearchParams({
        format: option.format,
        type: option.type,
      });
      if (activeProfile?.id) {
        params.set('profileId', String(activeProfile.id));
      }

      // Auth cookies are httpOnly, so we use credentials: 'include'
      // to let the browser send them automatically
      const res = await fetch(`/api/export?${params.toString()}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Export failed' }));
        throw new Error(body.error || `Export failed (${res.status})`);
      }

      // Determine filename from Content-Disposition or generate one
      const disposition = res.headers.get('Content-Disposition');
      let filename = `dreamy-export.${option.format}`;
      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="space-y-3">
      {EXPORT_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isLoading = loadingId === option.id;
        return (
          <button
            key={option.id}
            onClick={() => handleExport(option)}
            disabled={loadingId !== null}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-default bg-surface-1 hover:bg-bgTertiary transition-colors text-left disabled:opacity-50"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              {isLoading ? (
                <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
              ) : (
                <Icon className="w-4 h-4 text-emerald-500" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-primary">{option.label}</p>
              <p className="text-xs text-textTertiary">{option.description}</p>
            </div>
            <Download className="w-4 h-4 text-textTertiary flex-shrink-0" />
          </button>
        );
      })}
      {error && (
        <p className="text-xs text-red-500 px-1">{error}</p>
      )}
    </div>
  );
}
