'use client';

import { useState } from 'react';

export default function StravaManualSetupPage() {
  const [credentials, setCredentials] = useState({
    clientId: '199902',
    clientSecret: '283960e6891f39efe455144ff9b632e9cc98cf20',
    accessToken: '',
    refreshToken: '',
    athleteId: '',
  });

  const [activeTab, setActiveTab] = useState<'manual' | 'oauth'>('manual');

  const handleCopyCommand = () => {
    const command = `curl -X POST https://www.strava.com/oauth/token \\
  -d client_id=${credentials.clientId} \\
  -d client_secret=${credentials.clientSecret} \\
  -d code=YOUR_AUTH_CODE \\
  -d grant_type=authorization_code`;

    navigator.clipboard.writeText(command);
    alert('Command copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-bgTertiary py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-primary mb-8">Complete Strava Setup Guide</h1>

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-surface-1 rounded-lg mb-8">
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'manual'
                ? 'bg-surface-2 text-primary shadow-sm'
                : 'text-textSecondary hover:text-primary'
            }`}
          >
            Manual Token Entry
          </button>
          <button
            onClick={() => setActiveTab('oauth')}
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'oauth'
                ? 'bg-surface-2 text-primary shadow-sm'
                : 'text-textSecondary hover:text-primary'
            }`}
          >
            Normal OAuth Setup
          </button>
        </div>

        {activeTab === 'manual' ? (
          /* Manual Token Entry Guide */
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h2 className="font-semibold text-amber-900 mb-2">Current Issue</h2>
              <p className="text-amber-800 text-sm">
                Your current token has scope &quot;read&quot; but needs &quot;read,activity:read_all&quot; to sync activities.
              </p>
            </div>

            {/* Step 1: Strava App Setup */}
            <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary mb-4">
                Step 1: Configure Your Strava App
              </h2>
              <p className="text-textSecondary mb-4">Go to <a href="https://www.strava.com/settings/api" target="_blank" className="text-[#FC4C02] font-medium">strava.com/settings/api</a> and fill in:</p>

              <div className="space-y-4 bg-bgTertiary p-4 rounded-lg">
                <div>
                  <label className="text-sm font-medium text-secondary">Application Name:</label>
                  <p className="font-mono text-sm bg-surface-1 px-2 py-1 rounded mt-1">Dreamy Running Tracker</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-secondary">Category:</label>
                  <p className="font-mono text-sm bg-surface-1 px-2 py-1 rounded mt-1">Training</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-secondary">Club:</label>
                  <p className="font-mono text-sm bg-surface-1 px-2 py-1 rounded mt-1">(leave empty or choose any)</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-secondary">Website:</label>
                  <p className="font-mono text-sm bg-surface-1 px-2 py-1 rounded mt-1">https://getdreamy.run</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-secondary">Authorization Callback Domain:</label>
                  <p className="font-mono text-sm bg-surface-1 px-2 py-1 rounded mt-1">localhost:3005</p>
                  <p className="text-xs text-textTertiary mt-1">(Add more domains separated by commas if needed)</p>
                </div>
              </div>
            </div>

            {/* Step 2: Get Authorization Code */}
            <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary mb-4">
                Step 2: Get Authorization Code
              </h2>
              <p className="text-textSecondary mb-4">Visit this URL in your browser (replace CLIENT_ID with your ID):</p>

              <div className="bg-surface-0 text-textPrimary p-4 rounded-lg overflow-x-auto text-sm font-mono">
                https://www.strava.com/oauth/authorize?client_id={credentials.clientId}&response_type=code&redirect_uri=http://localhost:3005/api/strava/callback&approval_prompt=force&scope=read,activity:read_all
              </div>

              <p className="text-sm text-textSecondary mt-4">
                After authorizing, you\&apos;ll be redirected to a URL like:<br/>
                <code className="bg-surface-1 px-1">http://localhost:3005/api/strava/callback?code=<span className="text-[#FC4C02] font-bold">YOUR_CODE_HERE</span></code>
              </p>
              <p className="text-sm text-textSecondary mt-2">
                Copy the code value from the URL.
              </p>
            </div>

            {/* Step 3: Exchange Code for Tokens */}
            <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary mb-4">
                Step 3: Exchange Code for Tokens
              </h2>
              <p className="text-textSecondary mb-4">Run this command with your authorization code:</p>

              <div className="relative">
                <pre className="bg-surface-0 text-textPrimary p-4 rounded-lg overflow-x-auto text-xs">
{`curl -X POST https://www.strava.com/oauth/token \\
  -d client_id=${credentials.clientId} \\
  -d client_secret=${credentials.clientSecret} \\
  -d code=YOUR_AUTH_CODE \\
  -d grant_type=authorization_code`}
                </pre>
                <button
                  onClick={handleCopyCommand}
                  className="absolute top-2 right-2 px-3 py-1 bg-surface-2 text-textSecondary text-xs rounded hover:bg-surface-interactive-hover"
                >
                  Copy
                </button>
              </div>

              <p className="text-sm text-textSecondary mt-4">This will return JSON with:</p>
              <pre className="bg-surface-1 p-3 rounded text-xs mt-2 overflow-x-auto">
{`{
  "token_type": "Bearer",
  "expires_at": 1234567890,
  "expires_in": 21600,
  "refresh_token": "your_refresh_token_here",
  "access_token": "your_access_token_here",
  "athlete": {
    "id": 12345678,
    ...
  }
}`}
              </pre>
            </div>

            {/* Step 4: Enter Tokens */}
            <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary mb-4">
                Step 4: Enter Your Tokens
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Access Token</label>
                  <input
                    type="text"
                    value={credentials.accessToken}
                    onChange={(e) => setCredentials({...credentials, accessToken: e.target.value})}
                    placeholder="Paste your access_token here"
                    className="w-full px-3 py-2 border border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FC4C02]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Refresh Token</label>
                  <input
                    type="text"
                    value={credentials.refreshToken}
                    onChange={(e) => setCredentials({...credentials, refreshToken: e.target.value})}
                    placeholder="Paste your refresh_token here"
                    className="w-full px-3 py-2 border border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FC4C02]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-secondary mb-1">Athlete ID</label>
                  <input
                    type="text"
                    value={credentials.athleteId}
                    onChange={(e) => setCredentials({...credentials, athleteId: e.target.value})}
                    placeholder="Paste athlete.id here"
                    className="w-full px-3 py-2 border border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FC4C02]"
                  />
                </div>
              </div>

              <p className="text-sm text-textTertiary mt-4">
                Once you have all three values, use the Manual API Keys option in Settings.
              </p>
            </div>
          </div>
        ) : (
          /* Normal OAuth Setup Guide */
          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <h2 className="font-semibold text-green-900 mb-2">Normal OAuth Flow</h2>
              <p className="text-green-800 text-sm">
                This is the standard way to connect once you have regular Strava API access.
              </p>
            </div>

            {/* Setup Instructions */}
            <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary mb-4">
                OAuth Setup Instructions
              </h2>

              <div className="space-y-6">
                <div>
                  <h3 className="font-medium text-primary mb-2">1. Configure Strava App</h3>
                  <p className="text-textSecondary mb-2">At <a href="https://www.strava.com/settings/api" target="_blank" className="text-[#FC4C02] font-medium">strava.com/settings/api</a>:</p>
                  <ul className="space-y-2 text-sm text-textSecondary">
                    <li>• <strong>For Development:</strong> Add <code className="bg-surface-1 px-1">localhost:3000</code> to callback domains</li>
                    <li>• <strong>For Production:</strong> Add <code className="bg-surface-1 px-1">getdreamy.run</code></li>
                    <li>• <strong>For Vercel Preview:</strong> Add <code className="bg-surface-1 px-1">*.vercel.app</code></li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-medium text-primary mb-2">2. Environment Variables</h3>
                  <p className="text-textSecondary mb-2">Your app needs these in <code className="bg-surface-1 px-1">.env.local</code>:</p>
                  <pre className="bg-surface-0 text-textPrimary p-4 rounded-lg text-sm overflow-x-auto">
{`NEXT_PUBLIC_STRAVA_CLIENT_ID=199902
STRAVA_CLIENT_SECRET=283960e6891f39efe455144ff9b632e9cc98cf20`}
                  </pre>
                </div>

                <div>
                  <h3 className="font-medium text-primary mb-2">3. Connect Flow</h3>
                  <ol className="space-y-2 text-sm text-textSecondary">
                    <li>1. Go to Settings page</li>
                    <li>2. Click &quot;Connect with Strava&quot; orange button</li>
                    <li>3. Authorize the app on Strava</li>
                    <li>4. Get redirected back to your app</li>
                    <li>5. Tokens are automatically saved</li>
                  </ol>
                </div>

                <div>
                  <h3 className="font-medium text-primary mb-2">4. Testing Connection</h3>
                  <p className="text-textSecondary mb-2">After connecting:</p>
                  <ul className="space-y-1 text-sm text-textSecondary">
                    <li>• Click the refresh icon to sync recent activities</li>
                    <li>• Enable auto-sync for automatic imports</li>
                    <li>• Use &quot;Full sync&quot; to get 2 years of history</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Common Issues */}
            <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-primary mb-4">
                Common Issues & Fixes
              </h2>

              <div className="space-y-4 text-sm">
                <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <h3 className="font-medium text-red-900 mb-1">Invalid redirect URI</h3>
                  <p className="text-red-800">Make sure your callback domain matches exactly (including port)</p>
                </div>

                <div className="p-4 bg-amber-50 rounded-lg">
                  <h3 className="font-medium text-amber-900 mb-1">Missing activity:read_all scope</h3>
                  <p className="text-amber-800">Use approval_prompt=force to re-authorize with correct permissions</p>
                </div>

                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-1">Tokens expired</h3>
                  <p className="text-blue-800">The app should auto-refresh, but you can disconnect and reconnect if needed</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="mt-8 p-4 bg-surface-1 rounded-lg">
          <h3 className="font-medium text-primary mb-2">Quick Links</h3>
          <div className="flex gap-4 text-sm">
            <a href="/settings" className="text-[#FC4C02] hover:underline">Settings Page</a>
            <a href="https://www.strava.com/settings/api" target="_blank" className="text-[#FC4C02] hover:underline">Strava API Settings</a>
            <a href="https://developers.strava.com/docs/reference/" target="_blank" className="text-[#FC4C02] hover:underline">Strava API Docs</a>
          </div>
        </div>
      </div>
    </div>
  );
}