'use client';

import { useState } from 'react';
import { AlertCircle, Check, Info } from 'lucide-react';

interface StravaManualConnectProps {
  onConnect: (credentials: { accessToken: string; refreshToken: string; athleteId: string }) => Promise<boolean>;
}

export function StravaManualConnect({ onConnect }: StravaManualConnectProps) {
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [athleteId, setAthleteId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const success = await onConnect({
        accessToken,
        refreshToken,
        athleteId,
      });

      if (success) {
        setSuccess(true);
        // Clear form
        setAccessToken('');
        setRefreshToken('');
        setAthleteId('');
      } else {
        setError('Failed to save credentials');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900">Manual API Token Entry</p>
            <p className="text-blue-700 dark:text-blue-300 mt-1">
              Enter your Strava API tokens manually. Need help getting these tokens?{' '}
              <a
                href="/strava-manual-setup"
                className="underline font-medium"
              >
                View step-by-step guide
              </a>
            </p>
          </div>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 rounded-lg text-sm">
          <Check className="w-4 h-4" />
          Successfully connected to Strava!
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Access Token
          </label>
          <input
            type="text"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="Your access token"
            required
            className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-[#FC4C02] focus:border-[#FC4C02]"
          />
          <p className="text-xs text-tertiary mt-1">
            Found under "Your Access Token" in Strava API settings
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Refresh Token
          </label>
          <input
            type="text"
            value={refreshToken}
            onChange={(e) => setRefreshToken(e.target.value)}
            placeholder="Your refresh token"
            required
            className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-[#FC4C02] focus:border-[#FC4C02]"
          />
          <p className="text-xs text-tertiary mt-1">
            Found under "Your Refresh Token" in Strava API settings
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Athlete ID
          </label>
          <input
            type="text"
            value={athleteId}
            onChange={(e) => setAthleteId(e.target.value)}
            placeholder="Your athlete ID"
            required
            className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-[#FC4C02] focus:border-[#FC4C02]"
          />
          <p className="text-xs text-tertiary mt-1">
            Your numeric Strava athlete ID
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-[#FC4C02] text-white rounded-lg hover:bg-[#E34402] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Connecting...' : 'Connect with Manual Tokens'}
        </button>
      </form>

      <div className="text-xs text-secondary space-y-1">
        <p><strong>Note:</strong> Your tokens are stored locally and used only to sync your activities.</p>
        <p>The access token expires periodically and will need to be updated.</p>
      </div>
    </div>
  );
}