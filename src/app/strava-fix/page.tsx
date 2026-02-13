'use client';

export default function StravaFixPage() {
  // Your current credentials
  const clientId = '199902';
  const clientSecret = '283960e6891f39efe455144ff9b632e9cc98cf20';

  // Correct authorization URL with proper scope
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=http://localhost:3005/api/strava/callback&response_type=code&scope=read,activity:read_all&approval_prompt=force`;

  return (
    <div className="min-h-screen bg-bgTertiary py-12">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-primary mb-8">Fix Strava Integration</h1>

        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-red-900 mb-3">Issue Found</h2>
          <p className="text-red-800 mb-2">
            Your current token has scope: <code className="bg-red-100 px-1 rounded">read</code>
          </p>
          <p className="text-red-800">
            But we need scope: <code className="bg-red-100 px-1 rounded">read,activity:read_all</code>
          </p>
          <p className="text-sm text-red-700 dark:text-red-300 mt-2">
            This is why you\'re getting "activity:read_permission missing" errors.
          </p>
        </div>

        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-primary mb-4">Solution</h2>

          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-primary mb-2">Step 1: Update Strava App Settings</h3>
              <p className="text-sm text-textSecondary mb-2">
                Add this to your Strava app\'s Authorization Callback Domain:
              </p>
              <code className="block bg-stone-100 p-3 rounded text-sm">
                localhost:3005
              </code>
            </div>

            <div>
              <h3 className="font-medium text-primary mb-2">Step 2: Get New Token with Correct Scope</h3>
              <p className="text-sm text-textSecondary mb-3">
                Click the button below to authorize with the correct permissions:
              </p>
              <a
                href={authUrl}
                className="inline-block px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium"
              >
                Connect to Strava (with activity:read_all)
              </a>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Alternative: Manual Token Exchange</h3>
          <p className="text-sm text-blue-800 mb-3">
            If you prefer, you can manually exchange your authorization code for tokens using curl:
          </p>
          <pre className="bg-blue-900 text-blue-100 p-4 rounded-lg overflow-x-auto text-xs">
{`curl -X POST https://www.strava.com/oauth/token \\
  -d client_id=${clientId} \\
  -d client_secret=${clientSecret} \\
  -d code=YOUR_AUTHORIZATION_CODE \\
  -d grant_type=authorization_code`}
          </pre>
        </div>

        <div className="mt-6 text-sm text-textSecondary">
          <p className="font-medium mb-2">Your Credentials:</p>
          <ul className="space-y-1">
            <li>Client ID: {clientId}</li>
            <li>Client Secret: {clientSecret.slice(0, 10)}...</li>
            <li>Current Token (limited scope): 90990446d1e5...</li>
          </ul>
        </div>
      </div>
    </div>
  );
}