export default function StravaAuthPage() {
  const clientId = '199902';
  const redirectUri = 'http://localhost:3005/api/strava/callback';
  const scope = 'read,activity:read_all';

  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&approval_prompt=force`;

  return (
    <div className="min-h-screen bg-bgTertiary p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Get New Strava Token</h1>

        <div className="bg-surface-1 p-6 rounded-lg shadow-sm border border-default mb-6">
          <p className="mb-4">Your current token has wrong permissions. Click below to get a new one:</p>

          <a
            href={authUrl}
            className="inline-block bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-700"
          >
            Authorize Strava with Correct Permissions
          </a>
        </div>

        <div className="bg-amber-50 p-4 rounded-lg">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> Make sure &quot;localhost:3005&quot; is in your Strava app&apos;s callback domains.
          </p>
        </div>
      </div>
    </div>
  );
}