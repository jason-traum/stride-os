import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/gate', '/api/gate', '/api/strava'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip if no password is configured
  if (!process.env.SITE_PASSWORD) return NextResponse.next();

  // Allow public paths, static assets, and Next.js internals
  if (
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
