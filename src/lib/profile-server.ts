import { cookies } from 'next/headers';
import { getPublicProfileId, isPublicAccessMode } from '@/lib/access-mode';
import {
  CUSTOMER_PROFILE_COOKIE,
  resolveAuthRoleFromGetter,
  resolveEffectivePublicMode,
  resolveSessionModeOverrideFromGetter,
} from '@/lib/auth-access';

const ACTIVE_PROFILE_KEY = 'stride_active_profile';

/**
 * Get the active profile ID from cookies (server-side)
 * Returns the profile ID or undefined if not set
 */
export async function getActiveProfileId(): Promise<number | undefined> {
  const cookieStore = await cookies();
  const getCookie = (name: string) => cookieStore.get(name)?.value;
  const role = resolveAuthRoleFromGetter(getCookie);
  const publicModeEnabled = resolveEffectivePublicMode({
    role,
    sessionOverride: resolveSessionModeOverrideFromGetter(getCookie),
    globalPublicMode: isPublicAccessMode(),
  });

  if (role === 'customer') {
    const customerProfile = cookieStore.get(CUSTOMER_PROFILE_COOKIE)?.value;
    const customerProfileId = parseInt(customerProfile || '', 10);
    if (!isNaN(customerProfileId) && customerProfileId > 0) {
      return customerProfileId;
    }
  }

  // In public mode we always pin server actions/pages to one profile.
  if (publicModeEnabled) {
    const pinned = getPublicProfileId(1);
    if (!isNaN(pinned)) {
      return pinned;
    }
  }

  const profileCookie = cookieStore.get(ACTIVE_PROFILE_KEY);

  if (profileCookie?.value) {
    const id = parseInt(profileCookie.value, 10);
    if (!isNaN(id)) {
      return id;
    }
  }

  // Legacy guest fallback for backward compatibility.
  if (publicModeEnabled) {
    const fallback = getPublicProfileId(1);
    if (!isNaN(fallback)) {
      return fallback;
    }
  }

  return undefined;
}
