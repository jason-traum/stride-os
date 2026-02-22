/**
 * Push Notification Client Library
 *
 * Foundation for web push notifications in Dreamy.
 * Handles service worker registration, permission requests,
 * push subscription creation, and server-side subscription storage.
 *
 * Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY environment variable for push subscriptions.
 * The web-push npm package and VAPID private key are needed server-side for
 * actually sending notifications (not yet implemented).
 */

export type NotificationCategory = 'workoutReminders' | 'achievementAlerts' | 'coachMessages' | 'weeklySummary';

export interface NotificationPreferences {
  workoutReminders: boolean;
  achievementAlerts: boolean;
  coachMessages: boolean;
  weeklySummary: boolean;
}

export type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

/**
 * Check if the browser supports push notifications
 */
export function isPushSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get the current notification permission state
 */
export function getPermissionState(): PermissionState {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission as PermissionState;
}

/**
 * Register the service worker (if not already registered).
 * Returns the ServiceWorkerRegistration on success, null on failure.
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;
    return registration;
  } catch (error) {
    console.error('[Push] Service worker registration failed:', error);
    return null;
  }
}

/**
 * Request notification permission from the user.
 * Returns the resulting permission state.
 */
export async function requestNotificationPermission(): Promise<PermissionState> {
  if (!isPushSupported()) return 'unsupported';

  try {
    const result = await Notification.requestPermission();
    return result as PermissionState;
  } catch (error) {
    console.error('[Push] Permission request failed:', error);
    return 'denied';
  }
}

/**
 * Convert a base64 VAPID key to Uint8Array for the subscribe call.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe to push notifications using the given service worker registration.
 * Returns the PushSubscription on success, null on failure.
 *
 * Requires NEXT_PUBLIC_VAPID_PUBLIC_KEY to be set.
 */
export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<globalThis.PushSubscription | null> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    console.warn('[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set. Push subscriptions disabled.');
    return null;
  }

  try {
    // Check for existing subscription first
    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      return existingSubscription;
    }

    // Create new subscription
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    return subscription;
  } catch (error) {
    console.error('[Push] Subscription failed:', error);
    return null;
  }
}

/**
 * Get the existing push subscription (if any) without creating a new one.
 */
export async function getExistingSubscription(): Promise<globalThis.PushSubscription | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Unsubscribe from push notifications.
 * Also removes the subscription from the server.
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const subscription = await getExistingSubscription();
    if (!subscription) return true;

    // Remove from server first
    await removeSubscriptionFromServer(subscription.endpoint);

    // Then unsubscribe locally
    return await subscription.unsubscribe();
  } catch (error) {
    console.error('[Push] Unsubscribe failed:', error);
    return false;
  }
}

/**
 * Save a push subscription to the server.
 */
export async function saveSubscriptionToServer(
  subscription: globalThis.PushSubscription,
  profileId: number,
  preferences?: Partial<NotificationPreferences>
): Promise<boolean> {
  try {
    const subscriptionJSON = subscription.toJSON();
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profileId,
        endpoint: subscriptionJSON.endpoint,
        p256dh: subscriptionJSON.keys?.p256dh,
        auth: subscriptionJSON.keys?.auth,
        preferences: preferences ?? {
          workoutReminders: true,
          achievementAlerts: true,
          coachMessages: true,
          weeklySummary: true,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[Push] Server save failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Push] Server save failed:', error);
    return false;
  }
}

/**
 * Update notification preferences on the server for the current subscription.
 */
export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreferences>
): Promise<boolean> {
  try {
    const subscription = await getExistingSubscription();
    if (!subscription) return false;

    const response = await fetch('/api/push/subscribe', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        preferences,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('[Push] Preference update failed:', error);
    return false;
  }
}

/**
 * Remove a subscription from the server by endpoint.
 */
async function removeSubscriptionFromServer(endpoint: string): Promise<boolean> {
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });

    return response.ok;
  } catch (error) {
    console.error('[Push] Server removal failed:', error);
    return false;
  }
}

/**
 * Full setup flow: register SW -> request permission -> subscribe -> save to server.
 * Returns true if the full flow succeeded.
 */
export async function enablePushNotifications(
  profileId: number,
  preferences?: Partial<NotificationPreferences>
): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications are not supported in this browser.' };
  }

  // Step 1: Register service worker
  const registration = await registerServiceWorker();
  if (!registration) {
    return { success: false, error: 'Failed to register service worker.' };
  }

  // Step 2: Request permission
  const permission = await requestNotificationPermission();
  if (permission === 'denied') {
    return { success: false, error: 'Notification permission was denied. You can enable it in your browser settings.' };
  }
  if (permission !== 'granted') {
    return { success: false, error: 'Notification permission was not granted.' };
  }

  // Step 3: Subscribe to push
  const subscription = await subscribeToPush(registration);
  if (!subscription) {
    return { success: false, error: 'Failed to create push subscription. VAPID key may not be configured.' };
  }

  // Step 4: Save to server
  const saved = await saveSubscriptionToServer(subscription, profileId, preferences);
  if (!saved) {
    return { success: false, error: 'Failed to save subscription to server.' };
  }

  return { success: true };
}
