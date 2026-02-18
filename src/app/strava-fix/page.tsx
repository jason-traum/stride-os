import Link from 'next/link';

export default function StravaFixPage() {
  return (
    <div className="min-h-screen bg-bgTertiary py-12">
      <div className="max-w-3xl mx-auto px-4 space-y-6">
        <h1 className="text-3xl font-bold text-primary">Strava OAuth Troubleshooting</h1>

        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <p className="text-textSecondary mb-4">
            Use the standard OAuth connection from Settings. Do not exchange tokens manually in production.
          </p>
          <Link href="/settings" className="inline-block px-4 py-2 bg-[#FC4C02] text-white rounded-lg hover:bg-[#E34402] font-medium">
            Go to Settings
          </Link>
        </div>

        <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-primary mb-3">Checklist</h2>
          <ul className="list-disc list-inside text-sm text-textSecondary space-y-1">
            <li>Callback domain in Strava app settings is correct for this deployment.</li>
            <li>Deployment env has <code>NEXT_PUBLIC_STRAVA_CLIENT_ID</code> and <code>STRAVA_CLIENT_SECRET</code>.</li>
            <li>App middleware allows <code>/api/strava/*</code> routes.</li>
            <li>User authorized with <code>read,activity:read_all</code> scope.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
