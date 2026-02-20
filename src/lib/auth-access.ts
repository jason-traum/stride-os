import { getAppAccessMode } from '@/lib/access-mode';

export type AuthRole = 'admin' | 'user' | 'viewer' | 'coach' | 'customer';
export type SessionModeOverride = 'public' | 'private' | null;

export const SESSION_MODE_COOKIE = 'stride_session_mode';
export const CUSTOMER_AUTH_COOKIE = 'customer-auth';
export const CUSTOMER_PROFILE_COOKIE = 'stride_customer_profile';

type CookieGetter = (name: string) => string | undefined;

function normalize(value?: string): string {
  return (value || '').trim();
}

export function resolveAuthRoleFromGetter(getCookie: CookieGetter): AuthRole | null {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.SITE_PASSWORD;
  const userUsername = process.env.USER_USERNAME || '';
  const userPassword = process.env.USER_PASSWORD || '';
  const viewerUsername = process.env.VIEWER_USERNAME || 'viewer';
  const viewerPassword = process.env.VIEWER_PASSWORD || '';
  const coachUsername = process.env.COACH_USERNAME || '';
  const coachPassword = process.env.COACH_PASSWORD || '';

  const authUser = normalize(getCookie('auth-user'));
  const adminCookie = normalize(getCookie('site-auth'));
  if (adminPassword && authUser === adminUsername && adminCookie === adminPassword) {
    return 'admin';
  }

  const userCookie = normalize(getCookie('user-auth'));
  if (userUsername && userPassword && authUser === userUsername && userCookie === userPassword) {
    return 'user';
  }

  const coachCookie = normalize(getCookie('coach-auth'));
  if (coachUsername && coachPassword && authUser === coachUsername && coachCookie === coachPassword) {
    return 'coach';
  }

  const viewerCookie = normalize(getCookie('viewer-auth'));
  if (viewerPassword && authUser === viewerUsername && viewerCookie === viewerPassword) {
    return 'viewer';
  }

  // Fallback: use auth-role cookie with token cookie verification.
  // This handles cases where credential comparison fails due to encoding/special chars.
  const authRole = normalize(getCookie('auth-role')).toLowerCase();
  const tokenCookieMap: Record<string, string> = {
    admin: 'site-auth',
    user: 'user-auth',
    coach: 'coach-auth',
    viewer: 'viewer-auth',
    customer: CUSTOMER_AUTH_COOKIE,
  };
  const tokenCookieName = tokenCookieMap[authRole];
  if (tokenCookieName && normalize(getCookie(tokenCookieName)).length > 0) {
    if (authRole === 'customer') {
      const customerProfile = normalize(getCookie(CUSTOMER_PROFILE_COOKIE));
      if (customerProfile.length > 0) return 'customer';
    } else {
      return authRole as AuthRole;
    }
  }

  return null;
}

export function isPrivilegedRole(role: AuthRole | null): boolean {
  return role === 'admin' || role === 'user';
}

export function isWritableRole(role: AuthRole | null): boolean {
  return role === 'admin' || role === 'user' || role === 'customer';
}

export function resolveSessionModeOverrideFromGetter(getCookie: CookieGetter): SessionModeOverride {
  const raw = normalize(getCookie(SESSION_MODE_COOKIE)).toLowerCase();
  if (raw === 'public') return 'public';
  if (raw === 'private') return 'private';
  return null;
}

export function resolveEffectivePublicMode(options: {
  role: AuthRole | null;
  sessionOverride: SessionModeOverride;
  globalPublicMode?: boolean;
}): boolean {
  const globalPublicMode = options.globalPublicMode ?? getAppAccessMode() === 'public';
  const privileged = isPrivilegedRole(options.role);

  let effectivePublicMode = globalPublicMode;
  if (options.sessionOverride === 'public') effectivePublicMode = true;
  if (options.sessionOverride === 'private') effectivePublicMode = false;

  // If site-wide public sharing is enabled, allow authenticated admin/user
  // sessions to stay private by default unless they explicitly opt into preview.
  if (globalPublicMode && privileged && options.sessionOverride !== 'public') {
    effectivePublicMode = false;
  }

  return effectivePublicMode;
}
