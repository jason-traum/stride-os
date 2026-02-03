'use server';

import { detectAlerts, type Alert } from '@/lib/alerts';

/**
 * Get all active alerts for the current user
 */
export async function getActiveAlerts(): Promise<Alert[]> {
  try {
    return await detectAlerts();
  } catch (error) {
    console.error('Error detecting alerts:', error);
    return [];
  }
}
