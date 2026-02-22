import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new Response('Not found', { status: 404 });
  }

  try {
    const { code } = await request.json();

    const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json({
        error: 'Missing credentials',
        clientId: !!clientId,
        clientSecret: !!clientSecret,
      });
    }

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const responseText = await response.text();

    if (!response.ok) {
      return NextResponse.json({
        error: 'Token exchange failed',
        status: response.status,
        statusText: response.statusText,
        response: responseText,
        debugInfo: {
          clientId,
          clientSecretLength: clientSecret.length,
        }
      });
    }

    const data = JSON.parse(responseText);
    return NextResponse.json({
      success: true,
      athleteId: data.athlete?.id,
      scope: data.scope,
      expiresAt: data.expires_at,
    });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      error: 'Exception during token exchange',
      message: error.message,
    });
  }
}