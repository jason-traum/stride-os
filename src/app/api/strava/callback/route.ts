import { NextRequest, NextResponse } from 'next/server';
import { connectStrava, syncStravaActivities } from '@/actions/strava';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  // Handle error from Strava
  if (error) {
    console.error('Strava OAuth error:', error);
    return NextResponse.redirect(
      new URL('/settings?strava=error&message=' + encodeURIComponent(error), request.url)
    );
  }

  // Verify code is present
  if (!code) {
    return NextResponse.redirect(
      new URL('/settings?strava=error&message=No+authorization+code', request.url)
    );
  }

  try {
    // Exchange code for tokens
    const result = await connectStrava(code);

    if (!result.success) {
      return NextResponse.redirect(
        new URL('/settings?strava=error&message=' + encodeURIComponent(result.error || 'Unknown error'), request.url)
      );
    }

    // Start initial sync in the background
    syncStravaActivities().catch(err => {
      console.error('Background Strava sync failed:', err);
    });

    // Redirect to settings with success
    return NextResponse.redirect(
      new URL('/settings?strava=success', request.url)
    );
  } catch (error) {
    console.error('Strava callback error:', error);
    return NextResponse.redirect(
      new URL('/settings?strava=error&message=Connection+failed', request.url)
    );
  }
}
