import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/gate', '/api/gate', '/api/strava', '/welcome'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip if no password is configured or on localhost
  if (!process.env.SITE_PASSWORD) return NextResponse.next();
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

  // Check auth cookie
  const authed = request.cookies.get('site-auth')?.value;
  if (authed === process.env.SITE_PASSWORD) {
    return NextResponse.next();
  }

  // Redirect to gate
  const url = request.nextUrl.clone();
  url.pathname = '/gate';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
