import { notFound } from 'next/navigation';
import { StravaConnect } from '@/components/StravaConnect';
import { StravaSyncStatus } from '@/components/StravaSyncStatus';
import { StravaDebug } from '@/components/StravaDebug';
import { getStravaStatus } from '@/actions/strava';

export default async function TestStravaPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const status = await getStravaStatus();

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Strava Integration Test</h1>
        <p className="text-textSecondary mt-1">Test and debug your Strava connection</p>
      </div>

      {/* Main Connection Component */}
      <div>
        <h2 className="text-lg font-medium mb-3">Connection Status</h2>
        <StravaConnect initialStatus={status} />
      </div>

      {/* Sync Status */}
      {status.isConnected && (
        <div>
          <h2 className="text-lg font-medium mb-3">Sync Controls</h2>
          <StravaSyncStatus />
        </div>
      )}

      {/* Debug Info */}
      <div>
        <h2 className="text-lg font-medium mb-3">Debug Information</h2>
        <StravaDebug />
      </div>

      {/* Environment Check */}
      <div className="p-4 bg-stone-100 rounded-lg">
        <h3 className="font-medium mb-2">Environment Variables</h3>
        <div className="space-y-1 text-sm font-mono">
          <div>
            NEXT_PUBLIC_STRAVA_CLIENT_ID:{' '}
            <span className={process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID ? 'text-green-600' : 'text-red-600'}>
              {process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || 'NOT SET'}
            </span>
          </div>
          <div>
            STRAVA_CLIENT_SECRET:{' '}
            <span className={process.env.STRAVA_CLIENT_SECRET ? 'text-green-600' : 'text-red-600'}>
              {process.env.STRAVA_CLIENT_SECRET ? 'SET' : 'NOT SET'}
            </span>
          </div>
          <div>
            STRAVA_WEBHOOK_VERIFY_TOKEN:{' '}
            <span className={process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ? 'text-green-600' : 'text-red-600'}>
              {process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ? 'SET' : 'NOT SET'}
            </span>
          </div>
        </div>
      </div>

      {/* Manual Connect URL */}
      <div className="p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium mb-2">Manual Connection URL</h3>
        <p className="text-sm text-textSecondary mb-2">
          If the button doesn&apos;t work, copy this URL:
        </p>
        <code className="block p-2 bg-surface-1 rounded text-xs break-all">
          {`https://www.strava.com/oauth/authorize?client_id=${
            process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || '199902'
          }&response_type=code&redirect_uri=${
            process.env.NEXT_PUBLIC_VERCEL_URL
              ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}/api/strava/callback`
              : 'http://localhost:3000/api/strava/callback'
          }&scope=read,activity:read_all&approval_prompt=auto`}
        </code>
      </div>
    </div>
  );
}