'use client';

export default function StravaSimplePage() {
  const clientId = '199902';
  const redirectUri = 'https://www.getdreamy.run/api/strava/callback';
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=read,activity:read_all&approval_prompt=auto`;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Simple Strava Connect Test</h1>

      <div className="space-y-4">
        <div>
          <p className="mb-2">Method 1: Direct Link</p>
          <a
            href={authUrl}
            className="inline-block px-6 py-3 bg-[#FC4C02] text-white rounded-lg hover:bg-[#E34402]"
          >
            Connect with Strava (Direct Link)
          </a>
        </div>

        <div>
          <p className="mb-2">Method 2: Window.open</p>
          <button
            onClick={() => window.open(authUrl, '_blank')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Connect with Strava (New Tab)
          </button>
        </div>

        <div>
          <p className="mb-2">Method 3: Copy URL</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(authUrl);
              alert('URL copied to clipboard! Paste it in a new tab.');
            }}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Copy Strava URL to Clipboard
          </button>
        </div>

        <div className="mt-8 p-4 bg-surface-2 rounded">
          <p className="font-semibold mb-2">Manual URL:</p>
          <p className="text-xs break-all">{authUrl}</p>
        </div>
      </div>
    </div>
  );
}