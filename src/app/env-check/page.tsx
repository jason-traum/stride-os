import { redirect } from 'next/navigation';

export default function EnvCheckPage() {
  if (process.env.NODE_ENV === 'production') {
    redirect('/');
  }

  // Server-side environment check
  const envVars = {
    'NEXT_PUBLIC_STRAVA_CLIENT_ID': process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID ? '✅ Set' : '❌ Missing',
    'STRAVA_CLIENT_SECRET': process.env.STRAVA_CLIENT_SECRET ? '✅ Set' : '❌ Missing',
    'DATABASE_URL': process.env.DATABASE_URL ? '✅ Set' : '❌ Missing',
    'ANTHROPIC_API_KEY': process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Missing',
  };

  const stravaClientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
  const hasSecret = !!process.env.STRAVA_CLIENT_SECRET;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold text-primary">Environment Variables Check</h1>

      <div className="bg-surface-1 p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Server Environment Variables</h2>
        <div className="space-y-2 font-mono text-sm">
          {Object.entries(envVars).map(([key, status]) => (
            <div key={key} className="flex justify-between">
              <span>{key}:</span>
              <span>{status}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-yellow-950 p-6 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">🔍 Strava Configuration Status</h2>

        <div className="space-y-2 text-sm">
          <p><strong>Client ID:</strong> {stravaClientId || 'Not set'}</p>
          <p><strong>Client Secret:</strong> {hasSecret ? 'Set ✅' : 'NOT SET ❌'}</p>
        </div>

        {!hasSecret && (
          <div className="mt-4 p-4 bg-red-950 rounded">
            <p className="font-semibold text-red-300">⚠️ STRAVA_CLIENT_SECRET is missing!</p>
            <p className="text-sm mt-2">This is why the connection is failing. To fix:</p>
            <ol className="list-decimal list-inside text-sm mt-2 space-y-1">
              <li>Go to <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener noreferrer" className="underline text-blue-600">Strava API Settings</a></li>
              <li>Find your app&apos;s &quot;Client Secret&quot;</li>
              <li>Add it to Vercel: Go to your project settings → Environment Variables</li>
              <li>Add: <code className="bg-surface-2 px-1">STRAVA_CLIENT_SECRET</code> = [your secret]</li>
              <li>Redeploy the app</li>
            </ol>
          </div>
        )}
      </div>

      <div className="bg-blue-950 p-4 rounded-lg">
        <p className="text-sm">
          <strong>Note:</strong> Client Secret should NEVER have the NEXT_PUBLIC_ prefix.
          It must be kept server-side only for security.
        </p>
      </div>
    </div>
  );
}