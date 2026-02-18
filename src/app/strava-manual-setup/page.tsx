export default function StravaManualSetupPage() {
  return (
    <div className="min-h-screen bg-bgTertiary py-8">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        <h1 className="text-3xl font-bold text-primary">Strava Connection Guide</h1>

        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm space-y-4">
          <p className="text-textSecondary">
            Dreamy uses the standard Strava OAuth flow. Manual token entry is disabled in production for security and compliance.
          </p>
          <ol className="list-decimal list-inside text-sm text-textSecondary space-y-2">
            <li>Open Settings in Dreamy and click <strong>Connect with Strava</strong>.</li>
            <li>Authorize access in Strava.</li>
            <li>You should be redirected back to Dreamy and can sync activities.</li>
          </ol>
        </div>

        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm space-y-3">
          <h2 className="text-lg font-semibold text-primary">If OAuth fails</h2>
          <ul className="list-disc list-inside text-sm text-textSecondary space-y-1">
            <li>Confirm the callback domain in Strava app settings matches your app domain.</li>
            <li>Make sure <code>NEXT_PUBLIC_STRAVA_CLIENT_ID</code> and <code>STRAVA_CLIENT_SECRET</code> are set in your deployment environment.</li>
            <li>Retry using a fresh incognito session to avoid stale auth state.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
