'use client';

import { useState } from 'react';
import { setupStravaTokens, testStravaConnection } from '@/actions/setup-strava';

export default function SetupStravaPage() {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    setStatus('Setting up Strava tokens...');

    try {
      const result = await setupStravaTokens();
      if (result.success && result.athleteId) {
        setStatus(`✅ Success! Connected to Strava athlete: ${result.athleteName} (ID: ${result.athleteId})`);
      } else {
        setStatus(`✅ Tokens updated. ${result.message || ''}`);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setLoading(true);
    setStatus('Testing Strava connection...');

    try {
      const result = await testStravaConnection();
      if (result.success && result.athlete) {
        setStatus(`✅ Connected to: ${result.athlete.name} (ID: ${result.athlete.id})`);
      } else {
        setStatus(`❌ Connection failed: ${result.error}`);
      }
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-stone-900 mb-8">Setup Strava Integration</h1>

        <div className="bg-white rounded-xl border border-stone-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-stone-900 mb-4">Strava Credentials</h2>

          <div className="space-y-3 mb-6 text-sm">
            <div>
              <span className="font-medium text-stone-700">Client ID:</span>
              <span className="ml-2 font-mono text-stone-600">199902</span>
            </div>
            <div>
              <span className="font-medium text-stone-700">Access Token:</span>
              <span className="ml-2 font-mono text-stone-600">90990446d1e5...27d828ad</span>
            </div>
            <div>
              <span className="font-medium text-stone-700">Expires:</span>
              <span className="ml-2 text-stone-600">2026-02-13</span>
            </div>
            <div>
              <span className="font-medium text-stone-700">Scope:</span>
              <span className="ml-2 text-stone-600">read</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSetup}
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Setting up...' : 'Setup Strava Tokens'}
            </button>

            <button
              onClick={handleTest}
              disabled={loading}
              className="px-4 py-2 bg-stone-600 text-white rounded-lg hover:bg-stone-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Testing...' : 'Test Connection'}
            </button>
          </div>

          {status && (
            <div className="mt-4 p-3 bg-stone-50 rounded-lg text-sm">
              {status}
            </div>
          )}
        </div>

        <div className="mt-6 text-sm text-stone-600">
          <p>This page will:</p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Save your Strava access and refresh tokens</li>
            <li>Fetch your Strava athlete ID</li>
            <li>Verify the connection is working</li>
          </ul>
        </div>
      </div>
    </div>
  );
}