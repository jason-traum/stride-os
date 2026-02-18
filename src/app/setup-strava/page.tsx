'use client';

import { useState } from 'react';
import { testStravaConnection } from '@/actions/setup-strava';

export default function SetupStravaPage() {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    setLoading(true);
    setStatus('Testing Strava connection...');

    try {
      const result = await testStravaConnection();
      if (result.success && result.athlete) {
        setStatus(`Connected to: ${result.athlete.name} (ID: ${result.athlete.id})`);
      } else {
        setStatus(`Connection failed: ${result.error}`);
      }
    } catch (error) {
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bgTertiary py-12">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-primary mb-8">Strava Connection Check</h1>

        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <p className="text-sm text-textSecondary mb-4">
            Manual token setup is disabled. Use Settings to connect with Strava OAuth, then use this page to validate
            the stored connection.
          </p>

          <button
            onClick={handleTest}
            disabled={loading}
            className="px-4 py-2 bg-dream-600 text-white rounded-lg hover:bg-dream-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all shadow-sm hover:shadow-md"
          >
            {loading ? 'Testing...' : 'Test Connection'}
          </button>

          {status && (
            <div className="mt-4 p-3 bg-bgTertiary rounded-lg text-sm">
              {status}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
