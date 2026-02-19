import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getPublicProfileId, isPublicAccessMode, isPublishAccessMode } from '@/lib/access-mode';
import {
  CUSTOMER_PROFILE_COOKIE,
  isPrivilegedRole,
  resolveAuthRoleFromGetter,
  resolveEffectivePublicMode,
  resolveSessionModeOverrideFromGetter,
} from '@/lib/auth-access';

const PUBLIC_PATHS = ['/gate', '/api/gate', '/api/strava', '/welcome', '/support', '/privacy', '/terms', '/guide'];
const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const READ_ONLY_ROLE_MUTATION_API_ALLOWLIST = ['/api/chat', '/api/gate'];

const ACTIVE_PROFILE_KEY = 'stride_active_profile';
const PUBLIC_MODE_MUTATION_API_ALLOWLIST = ['/api/chat', '/api/gate', '/api/access-mode'];
const PUBLIC_MODE_BLOCKED_SERVER_ACTION_PATH_PREFIXES = [
  '/today',
  '/coach',
  '/plan',
  '/log',
  '/import',
  '/settings',
  '/profile',
  '/shoes',
  '/wardrobe',
  '/workout',
  '/onboarding',
];
const PUBLIC_MODE_READ_ONLY_ERROR = "Oops, can't do that in guest mode! Public mode is read-only.";
const GUEST_BLOCKED_PATH_PREFIXES = [
  '/admin',
  '/api/admin',
  '/api/debug',
  '/api/debug-',
  '/api/test',
  '/api/chat/test',
  '/api/strava/authorize',
  '/api/strava/callback',
  '/debug',
  '/env-check',
  '/setup-strava',
  '/strava-auth',
  '/strava-manual-setup',
  '/strava-simple',
  '/strava-fix',
  '/strava-sync',
  '/strava-setup-test',
  '/strava-test-direct',
  '/test-',
];
const CUSTOMER_BLOCKED_PATH_PREFIXES = [
  '/admin',
  '/api/admin',
  '/api/access-mode',
  '/api/debug',
  '/api/debug-',
  '/api/test',
  '/api/chat/test',
  '/debug',
  '/env-check',
  '/setup-strava',
  '/strava-auth',
  '/strava-manual-setup',
  '/strava-simple',
  '/strava-fix',
  '/strava-sync',
  '/strava-setup-test',
  '/strava-test-direct',
  '/test-',
];
const READ_ONLY_ROLE_BLOCKED_PATH_PREFIXES = [...GUEST_BLOCKED_PATH_PREFIXES, '/api/access-mode'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const globalPublicMode = isPublicAccessMode();
  const publicProfileId = `${getPublicProfileId(1)}`;
  const role = resolveAuthRoleFromGetter((name) => request.cookies.get(name)?.value);
  const sessionOverride = resolveSessionModeOverrideFromGetter((name) => request.cookies.get(name)?.value);
  const publicModeEnabled = resolveEffectivePublicMode({
    role,
    sessionOverride,
    globalPublicMode,
  });
  const privilegedRole = isPrivilegedRole(role);

  // Allow /api/admin requests with valid x-admin-secret header to bypass public mode restrictions
  const adminSecret = request.headers.get('x-admin-secret');
  const hasValidAdminSecret = adminSecret && adminSecret === process.env.ADMIN_SECRET;
  if (hasValidAdminSecret && pathname.startsWith('/api/admin')) {
    return NextResponse.next();
  }

  // Public mode: guests can browse everything read-only and use chat; admin/user keep full access.
  if (publicModeEnabled) {
    const isGuestRestrictedPath = GUEST_BLOCKED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    if (!privilegedRole && isGuestRestrictedPath) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Not available in guest view' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const url = request.nextUrl.clone();
      url.pathname = '/today';
      return NextResponse.redirect(url);
    }

    const method = request.method.toUpperCase();
    const isReadOnlyMethod = READ_ONLY_METHODS.has(method);
    const isWhitelistedApiMutation = PUBLIC_MODE_MUTATION_API_ALLOWLIST.some((prefix) => pathname.startsWith(prefix));
    const isServerAction = request.headers.has('next-action');
    const isBlockedServerActionPath = PUBLIC_MODE_BLOCKED_SERVER_ACTION_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    const isApiMutation = !isReadOnlyMethod && pathname.startsWith('/api/') && !isWhitelistedApiMutation;

    const shouldBlockMutation = !isReadOnlyMethod && !(
      isWhitelistedApiMutation ||
      (isServerAction && !isBlockedServerActionPath && !pathname.startsWith('/api/'))
    );

    if (shouldBlockMutation || isApiMutation) {
      const isApi = pathname.startsWith('/api/');
      const body = JSON.stringify({
        error: PUBLIC_MODE_READ_ONLY_ERROR,
      });
      return new NextResponse(
        isApi ? body : PUBLIC_MODE_READ_ONLY_ERROR,
        {
          status: 403,
          headers: isApi ? { 'Content-Type': 'application/json' } : undefined,
        }
      );
    }

    const response = NextResponse.next();
    if (!privilegedRole || sessionOverride === 'public') {
      response.cookies.set(ACTIVE_PROFILE_KEY, publicProfileId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
        sameSite: 'lax',
      });
    }
    return response;
  }

  // Skip gate if auth is not configured or on localhost
  const authConfigured = !!(process.env.ADMIN_PASSWORD || process.env.SITE_PASSWORD || isPublishAccessMode());
  if (!authConfigured) return NextResponse.next();
  const host = request.headers.get('host') || '';
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return NextResponse.next();

  // Allow public paths, static assets, and Next.js internals
  if (
    pathname === '/' ||
    PUBLIC_PATHS.some(p => pathname.startsWith(p)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/manifest') ||
    pathname.startsWith('/apple-touch') ||
    pathname.startsWith('/og-image') ||
    pathname.match(/\.(ico|png|jpg|svg|woff|woff2|js|css)$/)
  ) {
    return NextResponse.next();
  }

  if (!role) {
    // Redirect to gate
    const url = request.nextUrl.clone();
    url.pathname = '/gate';
    return NextResponse.redirect(url);
  }

  if (role === 'viewer' || role === 'coach') {
    const isBlockedPath = READ_ONLY_ROLE_BLOCKED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    if (isBlockedPath) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Not available in read-only mode' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const url = request.nextUrl.clone();
      url.pathname = '/today';
      return NextResponse.redirect(url);
    }

    if (!READ_ONLY_METHODS.has(request.method.toUpperCase())) {
      const isApi = pathname.startsWith('/api/');
      const allowedApiMutation = READ_ONLY_ROLE_MUTATION_API_ALLOWLIST.some((prefix) => pathname.startsWith(prefix));
      const isServerAction = request.headers.has('next-action');
      const allowReadOnlyServerAction = isServerAction && pathname.startsWith('/races');
      if (!allowReadOnlyServerAction && (!isApi || !allowedApiMutation)) {
        const body = JSON.stringify({ error: PUBLIC_MODE_READ_ONLY_ERROR });
        return new NextResponse(
          isApi ? body : PUBLIC_MODE_READ_ONLY_ERROR,
          {
            status: 403,
            headers: isApi ? { 'Content-Type': 'application/json' } : undefined,
          }
        );
      }
    }
  }

  if (role === 'customer') {
    const customerProfileRaw = request.cookies.get(CUSTOMER_PROFILE_COOKIE)?.value;
    const customerProfileId = parseInt(customerProfileRaw || '', 10);
    if (!Number.isFinite(customerProfileId) || customerProfileId <= 0) {
      const url = request.nextUrl.clone();
      url.pathname = '/gate';
      return NextResponse.redirect(url);
    }

    const isBlockedPath = CUSTOMER_BLOCKED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    if (isBlockedPath) {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(JSON.stringify({ error: 'Not available for customer accounts' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const url = request.nextUrl.clone();
      url.pathname = '/today';
      return NextResponse.redirect(url);
    }

    const response = NextResponse.next();
    response.cookies.set(ACTIVE_PROFILE_KEY, String(customerProfileId), {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
    });
    return response;
  }

  // Admin-only surfaces (x-admin-secret already handled above)
  if (pathname.startsWith('/api/admin') && role !== 'admin' && !hasValidAdminSecret) {
    return new NextResponse('Admin role required', { status: 403 });
  }
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return new NextResponse('Admin role required', { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
