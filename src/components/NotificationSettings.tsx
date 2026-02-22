'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Check, AlertTriangle, Dumbbell, Trophy, MessageSquare, BarChart3 } from 'lucide-react';
import { useProfile } from '@/lib/profile-context';
import { AnimatedButton } from '@/components/AnimatedButton';
import {
  isPushSupported,
  getPermissionState,
  enablePushNotifications,
  unsubscribeFromPush,
  getExistingSubscription,
  updateNotificationPreferences,
  type PermissionState,
  type NotificationPreferences,
} from '@/lib/push-notifications';

const NOTIFICATION_CATEGORIES: {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  icon: typeof Bell;
}[] = [
  {
    key: 'workoutReminders',
    label: 'Workout Reminders',
    description: 'Reminders for scheduled workouts',
    icon: Dumbbell,
  },
  {
    key: 'achievementAlerts',
    label: 'Achievement Alerts',
    description: 'PRs, milestones, and best efforts',
    icon: Trophy,
  },
  {
    key: 'coachMessages',
    label: 'Coach Messages',
    description: 'Tips and insights from Coach Dreamy',
    icon: MessageSquare,
  },
  {
    key: 'weeklySummary',
    label: 'Weekly Summary',
    description: 'Your weekly training recap',
    icon: BarChart3,
  },
];

export function NotificationSettings() {
  const { activeProfile } = useProfile();
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState<PermissionState>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    workoutReminders: true,
    achievementAlerts: true,
    coachMessages: true,
    weeklySummary: true,
  });

  // Check initial state
  useEffect(() => {
    const checkState = async () => {
      const pushSupported = isPushSupported();
      setSupported(pushSupported);

      if (!pushSupported) {
        setPermission('unsupported');
        return;
      }

      setPermission(getPermissionState());

      // Check for existing subscription
      const existing = await getExistingSubscription();
      setIsSubscribed(!!existing);
    };

    checkState();
  }, []);

  const handleEnable = useCallback(async () => {
    if (!activeProfile?.id) return;

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const result = await enablePushNotifications(activeProfile.id, preferences);

    if (result.success) {
      setIsSubscribed(true);
      setPermission('granted');
      setSuccessMessage('Notifications enabled!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } else {
      setError(result.error || 'Failed to enable notifications.');
    }

    setLoading(false);
  }, [activeProfile?.id, preferences]);

  const handleDisable = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    const success = await unsubscribeFromPush();

    if (success) {
      setIsSubscribed(false);
      setSuccessMessage('Notifications disabled.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } else {
      setError('Failed to disable notifications.');
    }

    setLoading(false);
  }, []);

  const handleToggleCategory = useCallback(async (key: keyof NotificationPreferences) => {
    const newPreferences = { ...preferences, [key]: !preferences[key] };
    setPreferences(newPreferences);

    // If subscribed, update preferences on the server
    if (isSubscribed) {
      const success = await updateNotificationPreferences({ [key]: newPreferences[key] });
      if (!success) {
        // Revert on failure
        setPreferences(preferences);
        setError('Failed to update preference.');
        setTimeout(() => setError(null), 3000);
      }
    }
  }, [preferences, isSubscribed]);

  // Unsupported browser
  if (!supported) {
    return (
      <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <BellOff className="w-5 h-5 text-textSecondary" />
          <h2 className="font-semibold text-primary">Notifications</h2>
        </div>
        <p className="text-sm text-textTertiary">
          Push notifications are not supported in this browser. Try using Chrome, Edge, or Firefox for notification support.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-5 h-5 text-dream-500" />
        <h2 className="font-semibold text-primary">Notifications</h2>
      </div>

      {/* Permission status */}
      <div className="mb-4">
        {permission === 'denied' ? (
          <div className="flex items-center gap-2 p-3 bg-rose-950 rounded-lg border border-rose-800">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <p className="text-sm text-rose-200">
              Notifications are blocked. Enable them in your browser settings to receive updates from Dreamy.
            </p>
          </div>
        ) : isSubscribed ? (
          <div className="flex items-center gap-2 p-3 bg-green-950 rounded-lg border border-green-800">
            <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-200">
              Notifications are enabled on this device.
            </p>
          </div>
        ) : (
          <p className="text-sm text-textTertiary">
            Get notified about upcoming workouts, achievements, and coach insights.
          </p>
        )}
      </div>

      {/* Enable/Disable button */}
      <div className="mb-5">
        {isSubscribed ? (
          <button
            onClick={handleDisable}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-strong text-secondary rounded-xl text-sm font-medium hover:bg-bgTertiary transition-colors disabled:opacity-50"
          >
            <BellOff className="w-4 h-4" />
            {loading ? 'Disabling...' : 'Disable Notifications'}
          </button>
        ) : permission !== 'denied' ? (
          <AnimatedButton
            onClick={handleEnable}
            disabled={loading || !activeProfile?.id}
            className="flex items-center gap-2 px-4 py-2 bg-dream-600 text-white rounded-xl text-sm font-semibold hover:bg-dream-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50"
          >
            <Bell className="w-4 h-4" />
            {loading ? 'Enabling...' : 'Enable Notifications'}
          </AnimatedButton>
        ) : null}
      </div>

      {/* Category toggles */}
      {(isSubscribed || permission !== 'denied') && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-secondary">Notification Categories</h3>
          {NOTIFICATION_CATEGORIES.map(({ key, label, description, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleToggleCategory(key)}
              disabled={!isSubscribed}
              className="w-full flex items-center justify-between p-3 rounded-lg border border-default hover:bg-bgTertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-textSecondary flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-primary">{label}</p>
                  <p className="text-xs text-textTertiary">{description}</p>
                </div>
              </div>
              <div
                className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${
                  preferences[key] && isSubscribed
                    ? 'bg-dream-600 justify-end'
                    : 'bg-bgTertiary justify-start'
                }`}
              >
                <div className="w-5 h-5 bg-white rounded-full shadow-sm transition-transform" />
              </div>
            </button>
          ))}
          {!isSubscribed && (
            <p className="text-xs text-textTertiary">
              Enable notifications to customize which updates you receive.
            </p>
          )}
        </div>
      )}

      {/* Status messages */}
      {error && (
        <p className="mt-3 text-sm text-rose-400">{error}</p>
      )}
      {successMessage && (
        <p className="mt-3 text-sm text-green-500 font-medium">{successMessage}</p>
      )}
    </div>
  );
}
