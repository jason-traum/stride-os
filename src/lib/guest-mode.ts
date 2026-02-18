/**
 * Guest Mode Detection
 *
 * Detects when a user is logged in via Vercel's password protection
 * with the "guest" username. Guest users can view all data but cannot
 * perform destructive actions or access certain features.
 */

import { headers } from 'next/headers';

// Guest credentials (Vercel password protection)
const GUEST_USERNAME = 'guest';

/**
 * Check if the current request is from a guest user (server-side)
 * This reads the Authorization header set by Vercel's password protection
 */
export async function isGuestUser(): Promise<boolean> {
  try {
    const headersList = await headers();
    const authorization = headersList.get('authorization');

    if (!authorization || !authorization.startsWith('Basic ')) {
      return false;
    }

    // Decode the base64 credentials
    const base64Credentials = authorization.slice(6);
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username] = credentials.split(':');

    return username === GUEST_USERNAME;
  } catch {
    // If headers() fails (e.g., in client component), return false
    return false;
  }
}

/**
 * Features that are restricted for guest users
 */
export const GUEST_RESTRICTIONS = {
  // Cannot access AI chat/coach
  chat: true,
  // Cannot access admin/settings that could modify data
  adminSettings: true,
  // Cannot unsync or disconnect Strava
  stravaDisconnect: true,
  // Cannot delete workouts
  deleteWorkouts: true,
  // Cannot delete races or race results
  deleteRaces: true,
  // Cannot modify training plan
  modifyPlan: true,
  // Cannot log new workouts manually
  logWorkouts: true,
  // Cannot modify profile settings
  modifyProfile: true,
  // Cannot add/remove shoes
  modifyShoes: true,
} as const;

export type GuestRestriction = keyof typeof GUEST_RESTRICTIONS;

/**
 * Check if a specific action is restricted for guests
 */
export function isRestrictedForGuest(action: GuestRestriction): boolean {
  return GUEST_RESTRICTIONS[action] === true;
}
