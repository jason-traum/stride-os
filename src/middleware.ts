import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/gate', '/api/gate', '/api/strava', '/welcome', '/support', '/privacy', '/terms', '/guide'];
const READ_ONLY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const READ_ONLY_BLOCKED_PATH_PREFIXES = [
  '/today',
  '/coach',
  '/plan',
  '/log',
  '/import',
  '/settings',
  '/setup-strava',
  '/strava-sync',
  '/strava-fix',
  '/strava-manual-setup',
  '/strava-setup-test',
  '/api/chat',
  '/api/admin',
  '/api/seed-demo',
];

type AuthRole = 'admin' | 'user' | 'viewer' | 'coach';

function getRoleFromCookies(request: NextRequest): AuthRole | null {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || process.env.SITE_PASSWORD;
  const userUsername = process.env.USER_USERNAME || '';
  const userPassword = process.env.USER_PASSWORD || '';
  const viewerUsername = process.env.VIEWER_USERNAME || 'viewer';
  const viewerPassword = process.env.VIEWER_PASSWORD || '';
  const coachUsername = process.env.COACH_USERNAME || '';
  const coachPassword = process.env.COACH_PASSWORD || '';

  const authUser = request.cookies.get('auth-user')?.value;
  const adminCookie = request.cookies.get('site-auth')?.value;
  if (adminPassword && authUser === adminUsername && adminCookie === adminPassword) {
    return 'admin';
  }

  const userCookie = request.cookies.get('user-auth')?.value;
  if (userUsername && userPassword && authUser === userUsername && userCookie === userPassword) {
    return 'user';
  }

  const coachCookie = request.cookies.get('coach-auth')?.value;
  if (coachUsername && coachPassword && authUser === coachUsername && coachCookie === coachPassword) {
    return 'coach';
  }

  const viewerCookie = request.cookies.get('viewer-auth')?.value;
  if (viewerPassword && authUser === viewerUsername && viewerCookie === viewerPassword) {
    return 'viewer';
  }

  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip gate if auth is not configured or on localhost
  const authConfigured = !!(process.env.ADMIN_PASSWORD || process.env.SITE_PASSWORD);
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

  const role = getRoleFromCookies(request);
  if (!role) {
    // Redirect to gate
    const url = request.nextUrl.clone();
    url.pathname = '/gate';
    return NextResponse.redirect(url);
  }

  if (role === 'viewer' || role === 'coach') {
    const isBlockedPath = READ_ONLY_BLOCKED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    if (isBlockedPath) {
      const url = request.nextUrl.clone();
      url.pathname = '/history';
      return NextResponse.redirect(url);
    }

    // Read-only roles can browse but cannot mutate.
    if (!READ_ONLY_METHODS.has(request.method.toUpperCase())) {
      return new NextResponse('Read-only mode cannot modify data', { status: 403 });
    }
  }

  // Admin-only surfaces
  if (pathname.startsWith('/api/admin') && role !== 'admin') {
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
