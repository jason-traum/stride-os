'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { recategorizeAllWorkouts } from '@/actions/recategorize';
import { useToast } from '@/components/Toast';

export function RecategorizeButton() {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function handleRecategorize() {
    setLoading(true);
    try {
      const result = await recategorizeAllWorkouts();
      showToast(
        `Recategorized ${result.successful} of ${result.total} runs${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
        result.failed > 0 ? 'info' : 'success'
      );
    } catch {
      showToast('Failed to recategorize runs', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRecategorize}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-textSecondary bg-bgTertiary hover:bg-borderPrimary rounded-lg transition-colors disabled:opacity-50"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      {loading ? 'Recategorizing...' : 'Recategorize All Runs'}
    </button>
  );
}
