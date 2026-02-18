import { notFound } from 'next/navigation';

export default function StravaSetupTestPage() {
  // Keep this route unavailable in production builds.
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-4">
      <h1 className="text-2xl font-bold text-primary">Strava Internal Test</h1>
      <p className="text-sm text-textSecondary">
        This page is intentionally limited to non-production environments. Use the standard OAuth connect flow from
        Settings for real account linking.
      </p>
    </div>
  );
}
