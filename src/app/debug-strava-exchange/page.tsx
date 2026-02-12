'use client';

import { useState } from 'react';

export default function DebugStravaExchangePage() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testExchange = async () => {
    if (!code) {
      alert('Please enter a code');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/debug-strava', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || '199902';
  const redirectUri = typeof window !== 'undefined'
    ? `${window.location.origin}/api/strava/callback`
    : '';
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=read,activity:read_all&approval_prompt=force`;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Debug Strava Token Exchange</h1>

      <div className="bg-blue-50 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">Step 1: Get Authorization Code</h2>
        <p className="text-sm mb-3">Click below to authorize and get a code (it will fail at callback, but check the URL for the code parameter):</p>
        <a
          href={authUrl}
          className="inline-block px-4 py-2 bg-[#FC4C02] text-white rounded hover:bg-[#E34402]"
          target="_blank"
          rel="noopener noreferrer"
        >
          Get Authorization Code
        </a>
        <p className="text-xs mt-2 text-gray-600">Look for ?code=XXXXX in the redirect URL</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="font-semibold mb-4">Step 2: Test Token Exchange</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Authorization Code:</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste the code from the URL"
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <button
            onClick={testExchange}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test Token Exchange'}
          </button>
        </div>
      </div>

      {result && (
        <div className="bg-gray-100 p-6 rounded-lg">
          <h2 className="font-semibold mb-2">Result:</h2>
          <pre className="text-xs overflow-auto whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div className="bg-yellow-50 p-4 rounded-lg text-sm">
        <p><strong>Note:</strong> Authorization codes are single-use and expire quickly. You need a fresh code for each test.</p>
      </div>
    </div>
  );
}