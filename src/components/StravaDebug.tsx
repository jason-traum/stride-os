'use client';

import { useState } from 'react';
import { getStravaAuthUrl } from '@/lib/strava-client';

export function StravaDebug() {
  const [debug, setDebug] = useState<any>({});

  const testConnection = () => {
    try {
      const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
      const redirectUri = `${window.location.origin}/api/strava/callback`;

      const authUrl = getStravaAuthUrl(redirectUri);

      setDebug({
        clientId: clientId || 'NOT SET',
        redirectUri,
        authUrl,
        origin: window.location.origin,
        env: process.env.NODE_ENV,
      });
    } catch (error: any) {
      setDebug({
        error: error.message,
        stack: error.stack,
      });
    }
  };

  return (
    <div className="p-4 bg-stone-100 rounded-lg">
      <h3 className="font-medium mb-2">Strava Debug Info</h3>

      <button
        onClick={testConnection}
        className="px-4 py-2 bg-blue-500 text-white rounded mb-4"
      >
        Test Strava Connection
      </button>

      {Object.keys(debug).length > 0 && (
        <pre className="text-xs overflow-auto bg-white p-2 rounded">
          {JSON.stringify(debug, null, 2)}
        </pre>
      )}

      <div className="mt-4 text-sm text-stone-600">
        <p>Environment Variables:</p>
        <ul className="list-disc list-inside">
          <li>NEXT_PUBLIC_STRAVA_CLIENT_ID: {process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || 'NOT SET'}</li>
          <li>Vercel URL: {process.env.NEXT_PUBLIC_VERCEL_URL || 'NOT SET'}</li>
        </ul>
      </div>
    </div>
  );
}