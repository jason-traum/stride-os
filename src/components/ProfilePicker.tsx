'use client';

import { useState } from 'react';
import { useProfile, type Profile } from '@/lib/profile-context';
import { cn } from '@/lib/utils';
import { User, Plus, X, Check, Eye } from 'lucide-react';

interface ProfileCardProps {
  profile: Profile;
  isActive: boolean;
  onSelect: () => void;
}

function ProfileCard({ profile, isActive, onSelect }: ProfileCardProps) {
  const isDemo = profile.type === 'demo';

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full p-4 rounded-xl border-2 transition-all text-left',
        'hover:shadow-md hover:border-strong',
        isActive
          ? 'border-dream-500 bg-surface-1 shadow-md'
          : 'border-borderPrimary bg-bgSecondary'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
          style={
            profile.auraColorStart && profile.auraColorEnd
              ? { background: `linear-gradient(135deg, ${profile.auraColorStart}, ${profile.auraColorEnd})` }
              : { backgroundColor: profile.avatarColor }
          }
        >
          {isDemo ? (
            <Eye className="w-6 h-6 text-white" />
          ) : (
            <User className="w-6 h-6 text-white" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-primary truncate">
              {profile.name}
            </h3>
            {isActive && (
              <Check className="w-4 h-4 text-dream-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-sm text-textTertiary mt-0.5">
            {isDemo ? (
              'Try the app (read-only)'
            ) : (
              'Your personal training data'
            )}
          </p>
          {(profile.workoutCount !== undefined || profile.totalMiles !== undefined) && (
            <p className="text-xs text-tertiary mt-1">
              {profile.workoutCount ?? 0} workouts
              {profile.totalMiles ? ` · ${profile.totalMiles.toLocaleString()} miles` : ''}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export function ProfilePicker() {
  const {
    profiles,
    activeProfile,
    switchProfile,
    showPicker,
    setShowPicker,
  } = useProfile();

  const [showComingSoon, setShowComingSoon] = useState(false);

  if (!showPicker) return null;

  // Sort profiles: active first, then personal, then demo
  const sortedProfiles = [...profiles].sort((a, b) => {
    if (activeProfile) {
      if (a.id === activeProfile.id) return -1;
      if (b.id === activeProfile.id) return 1;
    }
    if (a.type === 'personal' && b.type === 'demo') return -1;
    if (a.type === 'demo' && b.type === 'personal') return 1;
    return 0;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-bgSecondary rounded-2xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-borderPrimary">
          <h2 className="text-xl font-semibold text-primary">
            {profiles.length === 0 ? 'Create Your Profile' : 'Choose Profile'}
          </h2>
          {profiles.length > 0 && activeProfile && (
            <button
              onClick={() => setShowPicker(false)}
              className="p-2 text-tertiary hover:text-textSecondary rounded-lg hover:bg-surface-interactive-hover"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Profile cards */}
          {sortedProfiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isActive={activeProfile?.id === profile.id}
              onSelect={() => switchProfile(profile.id)}
            />
          ))}

          {/* Create new profile button - disabled for now */}
          <button
            onClick={() => setShowComingSoon(true)}
            className={cn(
              'w-full p-4 rounded-xl border-2 border-dashed border-strong',
              'hover:border-strong hover:bg-bgTertiary transition-colors',
              'flex items-center justify-center gap-2 text-textSecondary'
            )}
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Create New Profile</span>
          </button>

          {/* Coming soon modal */}
          {showComingSoon && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
              <div className="w-full max-w-sm bg-bgSecondary rounded-2xl shadow-xl p-6 text-center">
                <p className="text-lg font-semibold text-primary mb-2">Coming soon!</p>
                <p className="text-sm text-textSecondary mb-4">
                  Feel free to play around in Jason&apos;s profile but please do not use the chatbot.
                </p>
                <button
                  onClick={() => setShowComingSoon(false)}
                  className="px-6 py-2 rounded-lg bg-accentTeal text-white font-medium hover:bg-accentTeal-hover transition-colors"
                >
                  Got it
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
