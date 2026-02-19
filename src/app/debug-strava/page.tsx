'use client';

import { useState, useEffect } from 'react';
import { notFound } from 'next/navigation';
import { getStravaAuthUrl } from '@/lib/strava-client';

export default function DebugStravaPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const [origin, setOrigin] = useState('');
  const [redirectUri, setRedirectUri] = useState('');
  const [authUrl, setAuthUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentOrigin = window.location.origin;
      const currentRedirectUri = `${currentOrigin}/api/strava/callback`;

      setOrigin(currentOrigin);
      setRedirectUri(currentRedirectUri);

      try {
        const url = getStravaAuthUrl(currentRedirectUri);
        setAuthUrl(url);
      } catch (err) {
        setAuthUrl('Error: ' + err);
      }
    }
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Strava Debug Info</h1>

      <div className="bg-surface-1 p-6 rounded-lg shadow space-y-4">
        <div>
          <h3 className="font-semibold text-sm text-textSecondary">Current Origin:</h3>
          <code className="block bg-stone-100 p-2 rounded mt-1">{origin}</code>
        </div>

        <div>
          <h3 className="font-semibold text-sm text-textSecondary">Redirect URI being sent:</h3>
          <code className="block bg-stone-100 p-2 rounded mt-1 break-all">{redirectUri}</code>
        </div>

        <div>
          <h3 className="font-semibold text-sm text-textSecondary">Full Auth URL:</h3>
          <code className="block bg-stone-100 p-2 rounded mt-1 text-xs break-all">{authUrl}</code>
        </div>

        <div className="pt-4 border-t">
          <h3 className="font-semibold text-sm text-textSecondary mb-2">What to add to Strava App Settings:</h3>
          <p className="text-sm text-secondary">In your Strava app&apos;s &quot;Authorization Callback Domain&quot; field, make sure you have:</p>
          <code className="block bg-yellow-100 p-2 rounded mt-2">
            {origin.replace('https://', '').replace('http://', '')}
          </code>
        </div>

        <div className="pt-4 border-t">
          <h3 className="font-semibold text-sm text-textSecondary mb-2">Test Connection:</h3>
          <a
            href={authUrl}
            className="inline-flex items-center px-4 py-2 bg-[#FC4C02] text-white rounded hover:bg-[#E34402]"
          >
            Test Strava Connection
          </a>
        </div>
      </div>
    </div>
  );
}