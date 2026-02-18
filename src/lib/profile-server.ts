import { cookies } from 'next/headers';

const ACTIVE_PROFILE_KEY = 'stride_active_profile';

/**
 * Get the active profile ID from cookies (server-side)
 * Returns the profile ID or undefined if not set
 */
export async function getActiveProfileId(): Promise<number | undefined> {
  const accessMode = (process.env.APP_ACCESS_MODE || 'private').toLowerCase();
  const publicModeEnabled = accessMode === 'public' || process.env.ENABLE_GUEST_FULL_ACCESS === 'true';

  // In public mode we always pin server actions/pages to one profile.
  if (publicModeEnabled) {
    const pinned = parseInt(process.env.PUBLIC_PROFILE_ID || process.env.GUEST_PROFILE_ID || '1', 10);
    if (!isNaN(pinned)) {
      return pinned;
    }
  }

  const cookieStore = await cookies();
  const profileCookie = cookieStore.get(ACTIVE_PROFILE_KEY);

  if (profileCookie?.value) {
    const id = parseInt(profileCookie.value, 10);
    if (!isNaN(id)) {
      return id;
    }
  }

  // Legacy guest fallback for backward compatibility.
  if (process.env.ENABLE_GUEST_FULL_ACCESS === 'true') {
    const fallback = parseInt(process.env.GUEST_PROFILE_ID || '1', 10);
    if (!isNaN(fallback)) {
      return fallback;
    }
  }

  return undefined;
}
