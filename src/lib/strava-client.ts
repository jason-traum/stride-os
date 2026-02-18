/**
 * Strava Client-Side Utilities
 *
 * These functions are safe to import from client components.
 * They don't import any server-side dependencies (database, etc.)
 */

const STRAVA_OAUTH_BASE = 'https://www.strava.com/oauth';

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

/**
 * Get the Strava OAuth callback URI.
 * Prefer configured app URL so oauth redirect stays stable across subdomains.
 */
export function getStravaRedirectUri(): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (configuredBaseUrl) {
    return `${normalizeBaseUrl(configuredBaseUrl)}/api/strava/callback`;
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/strava/callback`;
  }

  return 'https://www.getdreamy.run/api/strava/callback';
}

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
