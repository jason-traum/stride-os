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
          ? 'border-teal-500 bg-surface-1 shadow-md'
          : 'border-borderPrimary bg-bgSecondary'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: profile.avatarColor }}
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
              <Check className="w-4 h-4 text-teal-500 flex-shrink-0" />
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

interface CreateProfileFormProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateProfileForm({ onClose, onCreated }: CreateProfileFormProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const colors = [
    '#3b82f6', // Blue
    '#10b981', // Green
    '#8b5cf6', // Purple
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#6366f1', // Indigo
  ];
  const [selectedColor, setSelectedColor] = useState(colors[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter a name');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type: 'personal',
          avatarColor: selectedColor,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create profile');
      }

      onCreated();
    } catch (err) {
      setError('Failed to create profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-primary">Create New Profile</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-tertiary hover:text-textSecondary"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div>
        <label htmlFor="profile-name" className="block text-sm font-medium text-textSecondary mb-1">
          Name
        </label>
        <input
          id="profile-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          className="w-full px-3 py-2 border border-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          autoFocus
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-textSecondary mb-2">
          Avatar Color
        </label>
        <div className="flex gap-2 flex-wrap">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setSelectedColor(color)}
              className={cn(
                'w-8 h-8 rounded-full transition-transform',
                selectedColor === color && 'ring-2 ring-offset-2 ring-stone-400 scale-110'
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          'w-full py-2.5 px-4 rounded-lg font-medium transition-colors',
          'bg-accentTeal text-white hover:bg-accentTeal-hover shadow-sm hover:shadow-md',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {isSubmitting ? 'Creating...' : 'Create Profile'}
      </button>
    </form>
  );
}

export function ProfilePicker() {
  const {
    profiles,
    activeProfile,
    switchProfile,
    showPicker,
    setShowPicker,
    refreshProfiles,
  } = useProfile();

  const [showCreateForm, setShowCreateForm] = useState(false);

  if (!showPicker) return null;

  const handleCreated = async () => {
    await refreshProfiles();
    setShowCreateForm(false);
  };

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
          {showCreateForm ? (
            <CreateProfileForm
              onClose={() => setShowCreateForm(false)}
              onCreated={handleCreated}
            />
          ) : (
            <>
              {/* Profile cards */}
              {sortedProfiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  isActive={activeProfile?.id === profile.id}
                  onSelect={() => switchProfile(profile.id)}
                />
              ))}

              {/* Create new profile button */}
              <button
                onClick={() => setShowCreateForm(true)}
                className={cn(
                  'w-full p-4 rounded-xl border-2 border-dashed border-strong',
                  'hover:border-strong hover:bg-bgTertiary transition-colors',
                  'flex items-center justify-center gap-2 text-textSecondary'
                )}
              >
                <Plus className="w-5 h-5" />
                <span className="font-medium">Create New Profile</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
