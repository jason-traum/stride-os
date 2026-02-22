import { NextRequest, NextResponse } from 'next/server';
import { connectStrava, syncStravaActivities } from '@/actions/strava';

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function getCallbackUrl(request: NextRequest): string {
  const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (configuredBaseUrl) {
    return `${normalizeBaseUrl(configuredBaseUrl)}/api/strava/callback`;
  }
  return `${request.nextUrl.origin}/api/strava/callback`;
}

function getProfileIdFromState(state: string | null): number | undefined {
  if (!state) return undefined;
  const match = /^p:(\d+)$/.exec(state);
  if (!match) return undefined;
  const parsed = parseInt(match[1], 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');
  const stateProfileId = getProfileIdFromState(state);

  // Handle error from Strava
  if (error) {
    console.error('Strava OAuth error:', error);
    const res = NextResponse.redirect(
      new URL('/settings/integrations?strava=error&message=' + encodeURIComponent(error), request.url)
    );
    if (stateProfileId) {
      res.cookies.set('stride_active_profile', String(stateProfileId), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      });
    }
    return res;
  }

  // Verify code is present
  if (!code) {
    return NextResponse.redirect(
      new URL('/settings/integrations?strava=error&message=No+authorization+code', request.url)
    );
  }

  try {
    // Exchange code for tokens
    const result = await connectStrava(code, getCallbackUrl(request), stateProfileId);

    if (!result.success) {
      const res = NextResponse.redirect(
        new URL('/settings/integrations?strava=error&message=' + encodeURIComponent(result.error || 'Unknown error'), request.url)
      );
      if (stateProfileId) {
        res.cookies.set('stride_active_profile', String(stateProfileId), {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 365,
          path: '/',
        });
      }
      return res;
    }

    // Start initial sync in the background
    syncStravaActivities().catch(err => {
      console.error('Background Strava sync failed:', err);
    });

    // Redirect to settings/integrations with success
    const res = NextResponse.redirect(
      new URL('/settings/integrations?strava=success', request.url)
    );
    if (stateProfileId) {
      res.cookies.set('stride_active_profile', String(stateProfileId), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
      });
    }
    return res;
  } catch (error) {
    console.error('Strava callback error:', error);
    return NextResponse.redirect(
      new URL('/settings/integrations?strava=error&message=Connection+failed', request.url)
    );
  }
}
