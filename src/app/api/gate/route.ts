import { NextResponse } from 'next/server';

type AuthRole = 'admin' | 'user' | 'viewer' | 'coach';

function getRoleForCredentials(username: string, password: string): AuthRole | null {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.SITE_PASSWORD;
  if (adminPassword && username === adminUsername && password === adminPassword) {
    return 'admin';
  }

  const userUsername = process.env.USER_USERNAME || '';
  const userPassword = process.env.USER_PASSWORD || '';
  if (userUsername && userPassword && username === userUsername && password === userPassword) {
    return 'user';
  }

  const viewerUsername = process.env.VIEWER_USERNAME || 'viewer';
  const viewerPassword = process.env.VIEWER_PASSWORD || '';
  if (viewerPassword && username === viewerUsername && password === viewerPassword) {
    return 'viewer';
  }

  const coachUsername = process.env.COACH_USERNAME || '';
  const coachPassword = process.env.COACH_PASSWORD || '';
  if (coachUsername && coachPassword && username === coachUsername && password === coachPassword) {
    return 'coach';
  }

  return null;
}

export async function POST(request: Request) {
  const { username, password } = await request.json();
  const normalizedUsername = String(username || '').trim();
  const normalizedPassword = String(password || '');

  const role = getRoleForCredentials(normalizedUsername, normalizedPassword);
  if (!role) {
    return NextResponse.json({ error: 'wrong' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, role });
  response.cookies.set('auth-role', role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
  response.cookies.set('auth-user', normalizedUsername, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });

  // Clear all existing role cookies before setting the active one.
  for (const cookieName of ['site-auth', 'user-auth', 'viewer-auth', 'coach-auth']) {
    response.cookies.set(cookieName, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
  }

  const tokenCookieName =
    role === 'admin'
      ? 'site-auth'
      : role === 'user'
        ? 'user-auth'
        : role === 'coach'
          ? 'coach-auth'
          : 'viewer-auth';
  const maxAge = role === 'viewer' || role === 'coach'
    ? 60 * 60 * 24 * 7
    : 60 * 60 * 24 * 30;
  response.cookies.set(tokenCookieName, normalizedPassword, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  for (const cookieName of ['site-auth', 'user-auth', 'viewer-auth', 'coach-auth', 'auth-role', 'auth-user']) {
    response.cookies.set(cookieName, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
  }
  return response;
}
