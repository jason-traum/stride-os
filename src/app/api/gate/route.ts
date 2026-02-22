import { NextResponse } from 'next/server';
import { db, profiles, userSettings } from '@/lib/db';
import { isNotNull, desc } from 'drizzle-orm';
import {
  CUSTOMER_AUTH_COOKIE,
  CUSTOMER_PROFILE_COOKIE,
  SESSION_MODE_COOKIE,
} from '@/lib/auth-access';
import { createSessionToken } from '@/lib/session-tokens';
import { isPublishAccessMode } from '@/lib/access-mode';
import { authenticateCustomerAccount, createCustomerAccount } from '@/lib/customer-auth';

type AuthRole = 'admin' | 'user' | 'viewer' | 'coach' | 'customer';

async function resolveDefaultProfileId(): Promise<number | undefined> {
  // Prefer an actively connected Strava profile so auth looks consistent across browsers/devices.
  const stravaConnected = await db
    .select({ profileId: userSettings.profileId })
    .from(userSettings)
    .where(isNotNull(userSettings.stravaAccessToken))
    .orderBy(desc(userSettings.updatedAt))
    .limit(1);

  const connectedProfileId = stravaConnected[0]?.profileId ?? undefined;
  if (connectedProfileId) return connectedProfileId;

  const allProfiles = await db.select().from(profiles);
  if (allProfiles.length === 0) return undefined;

  const personal = allProfiles.find((p) => p.type === 'personal');
  return personal?.id ?? allProfiles[0]?.id;
}

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
  const body = await request.json().catch(() => ({}));
  const { username, password } = body;
  const intent = body?.intent === 'signup' ? 'signup' : 'login';
  const normalizedUsername = String(username || '').trim();
  const normalizedPassword = String(password || '');
  const publishModeEnabled = isPublishAccessMode();

  let role: AuthRole | null = null;
  let customerProfileId: number | undefined;

  if (intent === 'signup') {
    if (!publishModeEnabled) {
      return NextResponse.json({ error: 'Account creation is disabled in this mode' }, { status: 403 });
    }

    const created = await createCustomerAccount({
      username: normalizedUsername,
      password: normalizedPassword,
      displayName: body?.displayName,
    });
    if (!created.success || !created.profileId) {
      return NextResponse.json({ error: created.error || 'Failed to create account' }, { status: 400 });
    }

    role = 'customer';
    customerProfileId = created.profileId;
  } else {
    role = getRoleForCredentials(normalizedUsername, normalizedPassword);
    if (!role && publishModeEnabled) {
      const customer = await authenticateCustomerAccount({
        username: normalizedUsername,
        password: normalizedPassword,
      });
      if (customer.success && customer.profileId) {
        role = 'customer';
        customerProfileId = customer.profileId;
      }
    }
  }

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
  for (const cookieName of ['site-auth', 'user-auth', 'viewer-auth', 'coach-auth', CUSTOMER_AUTH_COOKIE, CUSTOMER_PROFILE_COOKIE]) {
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
        : role === 'customer'
          ? CUSTOMER_AUTH_COOKIE
        : role === 'coach'
          ? 'coach-auth'
          : 'viewer-auth';
  const maxAge = role === 'viewer' || role === 'coach'
    ? 60 * 60 * 24 * 7
    : 60 * 60 * 24 * 30;
  const tokenValue = role === 'customer'
    ? `${Date.now()}-${Math.random().toString(36).slice(2)}`
    : createSessionToken(role);
  response.cookies.set(tokenCookieName, tokenValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge,
    path: '/',
  });

  if (role === 'customer' && customerProfileId) {
    response.cookies.set(CUSTOMER_PROFILE_COOKIE, String(customerProfileId), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
      path: '/',
    });
  }

  // Privileged sessions default to private mode even if site-wide sharing is enabled.
  if (role === 'admin' || role === 'user') {
    response.cookies.set(SESSION_MODE_COOKIE, 'private', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 14,
      path: '/',
    });
  }
  if (role === 'customer') {
    response.cookies.set(SESSION_MODE_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });
  }

  const defaultProfileId = customerProfileId || await resolveDefaultProfileId();
  if (defaultProfileId) {
    response.cookies.set('stride_active_profile', String(defaultProfileId), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    });
  }

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  for (const cookieName of ['site-auth', 'user-auth', 'viewer-auth', 'coach-auth', CUSTOMER_AUTH_COOKIE, CUSTOMER_PROFILE_COOKIE, 'auth-role', 'auth-user', 'stride_active_profile', SESSION_MODE_COOKIE]) {
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
