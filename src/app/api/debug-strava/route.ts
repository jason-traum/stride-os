import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
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

    // Log what we're sending (without exposing secret)
    console.log('Token exchange attempt:', {
      clientId,
      clientSecretLength: clientSecret.length,
      clientSecretFirst4: clientSecret.substring(0, 4),
      clientSecretLast4: clientSecret.substring(clientSecret.length - 4),
      codeLength: code?.length,
    });

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
    console.log('Strava response:', response.status, responseText);

    if (!response.ok) {
      return NextResponse.json({
        error: 'Token exchange failed',
        status: response.status,
        statusText: response.statusText,
        response: responseText,
        debugInfo: {
          clientId,
          clientSecretLength: clientSecret.length,
          clientSecretFirst4: clientSecret.substring(0, 4),
          clientSecretLast4: clientSecret.substring(clientSecret.length - 4),
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
      stack: error.stack,
    });
  }
}