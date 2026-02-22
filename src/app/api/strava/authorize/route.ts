import { NextRequest, NextResponse } from 'next/server';
import { getStravaAuthUrl } from '@/lib/strava';

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function getCallbackUrl(request: NextRequest): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (configuredBaseUrl) {
    return `${normalizeBaseUrl(configuredBaseUrl)}/api/strava/callback`;
  }

  const origin = request.nextUrl.origin;
  return `${origin}/api/strava/callback`;
}

export async function GET(request: NextRequest) {
  try {
    const callbackUrl = getCallbackUrl(request);
    const activeProfileCookie = request.cookies.get('stride_active_profile')?.value;
    const profileId = activeProfileCookie ? parseInt(activeProfileCookie, 10) : NaN;
    const state = Number.isNaN(profileId) ? undefined : `p:${profileId}`;
    const authUrl = getStravaAuthUrl(callbackUrl, state);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to build Strava auth URL';
    const url = request.nextUrl.clone();
    url.pathname = '/settings/integrations';
    url.searchParams.set('strava', 'error');
    url.searchParams.set('message', message);
    return NextResponse.redirect(url);
  }
}
