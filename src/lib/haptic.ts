/**
 * Haptic feedback utility for mobile interactions
 * Uses the Vibration API when available
 */

export type HapticPattern = 'tap' | 'success' | 'warning' | 'error' | 'select';

const patterns: Record<HapticPattern, number | number[]> = {
  tap: 10,           // Micro pulse for selections
  select: 15,        // Slightly longer for confirmations
  success: [50, 50, 50], // Double pulse for success
  warning: 30,       // Single pulse for warnings
  error: [50, 100, 50],  // Distinct pattern for errors
};

/**
 * Trigger haptic feedback
 * Safe to call on any platform - will no-op if vibration not supported
 */
export function haptic(pattern: HapticPattern = 'tap'): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return;
  }

  try {
    navigator.vibrate(patterns[pattern]);
  } catch {
    // Silently fail if vibration is blocked or unavailable
  }
}

/**
 * Check if haptic feedback is supported
 */
export function isHapticSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}
