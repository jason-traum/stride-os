import { cookies } from 'next/headers';

const ACTIVE_PROFILE_KEY = 'stride_active_profile';

/**
 * Get the active profile ID from cookies (server-side)
 * Returns the profile ID or undefined if not set
 */
export async function getActiveProfileId(): Promise<number | undefined> {
  const cookieStore = await cookies();
  const profileCookie = cookieStore.get(ACTIVE_PROFILE_KEY);

  if (profileCookie?.value) {
    const id = parseInt(profileCookie.value, 10);
    if (!isNaN(id)) {
      return id;
    }
  }

  return undefined;
}
