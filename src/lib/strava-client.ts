/**
 * Strava Client-Side Utilities
 *
 * These functions are safe to import from client components.
 * They don't import any server-side dependencies (database, etc.)
 */

const STRAVA_OAUTH_BASE = 'https://www.strava.com/oauth';

/**
 * Get the Strava OAuth authorization URL
 */
export function getStravaAuthUrl(redirectUri: string, state?: string): string {
  const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;

  if (!clientId) {
    throw new Error('NEXT_PUBLIC_STRAVA_CLIENT_ID environment variable not set');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'read,activity:read_all',
    approval_prompt: 'auto',
  });

  if (state) {
    params.set('state', state);
  }

  return `${STRAVA_OAUTH_BASE}/authorize?${params.toString()}`;
}
