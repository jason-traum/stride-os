import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  SESSION_MODE_COOKIE,
  isPrivilegedRole,
  resolveAuthRoleFromGetter,
  resolveEffectivePublicMode,
  resolveSessionModeOverrideFromGetter,
  type SessionModeOverride,
} from '@/lib/auth-access';
import { isPublicAccessMode } from '@/lib/access-mode';

type AccessMode = 'public' | 'private';
type AccessModeUpdate = AccessMode | 'default';

function parseRequestedMode(value: unknown): AccessModeUpdate | null {
  if (value === 'public' || value === 'private' || value === 'default') return value;
  return null;
}

function buildStatusPayload(params: {
  role: ReturnType<typeof resolveAuthRoleFromGetter>;
  sessionOverride: SessionModeOverride;
}) {
  const globalPublicMode = isPublicAccessMode();
  const effectivePublicMode = resolveEffectivePublicMode({
    role: params.role,
    sessionOverride: params.sessionOverride,
    globalPublicMode,
  });

  return {
    globalMode: globalPublicMode ? 'public' : 'private',
    sessionMode: effectivePublicMode ? 'public' : 'private',
    sessionOverride: params.sessionOverride,
    role: params.role,
    canEdit: isPrivilegedRole(params.role) && !effectivePublicMode,
  };
}

export async function GET() {
  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;
  const role = resolveAuthRoleFromGetter(getCookie);
  const sessionOverride = resolveSessionModeOverrideFromGetter(getCookie);

  return NextResponse.json(buildStatusPayload({ role, sessionOverride }));
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;
  const role = resolveAuthRoleFromGetter(getCookie);

  if (!isPrivilegedRole(role)) {
    return NextResponse.json({ error: 'Admin or user role required' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const requestedMode = parseRequestedMode(body?.mode);
  if (!requestedMode) {
    return NextResponse.json({ error: 'mode must be public, private, or default' }, { status: 400 });
  }

  const response = NextResponse.json(
    buildStatusPayload({
      role,
      sessionOverride: requestedMode === 'default' ? null : requestedMode,
    })
  );

  if (requestedMode === 'default') {
    response.cookies.set(SESSION_MODE_COOKIE, '', {
      maxAge: 0,
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
  } else {
    response.cookies.set(SESSION_MODE_COOKIE, requestedMode, {
      maxAge: 60 * 60 * 24 * 14,
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });
  }

  return response;
}
