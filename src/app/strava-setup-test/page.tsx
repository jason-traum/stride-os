'use client';

import { useState } from 'react';
import { connectStravaManual } from '@/actions/strava-manual';

export default function StravaSetupTestPage() {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  // Your Strava credentials
  const credentials = {
    accessToken: '90990446d1e5c5beae61acd3cece4a5b27d828ad',
    refreshToken: 'a46cfcfaa32afb4ca2b80c807e9bacab59cd0760',
    athleteId: '199902', // Using Client ID as athlete ID for now
  };

  const handleSetup = async () => {
    setLoading(true);
    setStatus('Setting up Strava...');

    try {
      // First, try to get the athlete ID from Strava API
      const response = await fetch('https://www.strava.com/api/v3/athlete', {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
        },
      });

      if (response.ok) {
        const athlete = await response.json();
        credentials.athleteId = athlete.id.toString();
        setStatus(`Found athlete: ${athlete.firstname} ${athlete.lastname} (ID: ${athlete.id})`);
      }

      // Now connect using the manual method
      const result = await connectStravaManual(credentials);

      if (result.success) {
        setStatus(prev => prev + '\n✅ Successfully connected Strava!');
      } else {
        setStatus(prev => prev + `\n❌ Error: ${result.error}`);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bgTertiary py-12">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-primary mb-8">Strava Setup Test</h1>

        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-primary mb-4">Your Strava Credentials</h2>

          <div className="space-y-2 mb-6 text-sm font-mono bg-bgTertiary p-4 rounded">
            <div>Access Token: {credentials.accessToken.slice(0, 20)}...</div>
            <div>Refresh Token: {credentials.refreshToken.slice(0, 20)}...</div>
            <div>Expires: 2026-02-13T21:33:45Z</div>
            <div>Scope: read</div>
          </div>

          <button
            onClick={handleSetup}
            disabled={loading}
            className="w-full px-4 py-2 bg-dream-600 text-white rounded-lg hover:bg-dream-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Setting up...' : 'Setup Strava Connection'}
          </button>

          {status && (
            <div className="mt-4 p-4 bg-bgTertiary rounded-lg text-sm whitespace-pre-wrap">
              {status}
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">Next Steps</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>1. Click the button above to setup your tokens</li>
            <li>2. Go to Settings page to verify connection</li>
            <li>3. Use &quot;Sync from Strava&quot; to import your activities</li>
          </ul>
        </div>
      </div>
    </div>
  );
}