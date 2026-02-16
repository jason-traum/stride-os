import { getActiveProfileId } from '@/lib/profile-server';

/**
 * Standardized result type for server actions.
 * Replaces inconsistent patterns: raw throws, try/catch returning null, ad-hoc result objects.
 */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Wraps a server action that requires an active profile.
 * Handles profileId lookup, try/catch, and error formatting.
 *
 * Usage:
 *   export const getWeather = createProfileAction(
 *     async (profileId) => { ... return data; },
 *     'getWeather'
 *   );
 */
export function createProfileAction<TArgs extends unknown[], TResult>(
  fn: (profileId: number, ...args: TArgs) => Promise<TResult>,
  actionName?: string
): (...args: TArgs) => Promise<ActionResult<TResult>> {
  return async (...args: TArgs) => {
    try {
      const profileId = await getActiveProfileId();
      if (!profileId) {
        return { success: false, error: 'No active profile' };
      }
      const data = await fn(profileId, ...args);
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      if (actionName) {
        console.error(`[${actionName}] Error:`, error);
      }
      return { success: false, error: message };
    }
  };
}

/**
 * Wraps a server action that does NOT require a profile.
 * Handles try/catch and error formatting only.
 *
 * Usage:
 *   export const getFunFacts = createAction(
 *     async () => { ... return data; },
 *     'getFunFacts'
 *   );
 */
export function createAction<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  actionName?: string
): (...args: TArgs) => Promise<ActionResult<TResult>> {
  return async (...args: TArgs) => {
    try {
      const data = await fn(...args);
      return { success: true, data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      if (actionName) {
        console.error(`[${actionName}] Error:`, error);
      }
      return { success: false, error: message };
    }
  };
}
