'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

// Storage keys
const ACTIVE_PROFILE_KEY = 'stride_active_profile';
const DEMO_OVERLAY_PREFIX = 'stride_demo_overlay_';

export interface Profile {
  id: number;
  name: string;
  type: 'personal' | 'demo';
  avatarColor: string;
  isProtected: boolean;
  workoutCount?: number;
  totalMiles?: number;
}

// Entity with an ID for demo overlay storage
export interface DemoEntity {
  id?: number;
  _isDemo?: boolean;
  [key: string]: unknown;
}

export interface DemoEntityOverlay {
  created: DemoEntity[];
  updated: Record<number, Partial<DemoEntity>>;
  deleted: number[];
}

export interface DemoOverlay {
  workouts: DemoEntityOverlay;
  settings: Record<string, unknown>;
  assessments: DemoEntityOverlay;
  shoes: DemoEntityOverlay;
}

export interface ProfileContextValue {
  activeProfile: Profile | null;
  profiles: Profile[];
  isLoading: boolean;
  isDemo: boolean;
  switchProfile: (profileId: number) => void;
  refreshProfiles: () => Promise<void>;
  showPicker: boolean;
  setShowPicker: (show: boolean) => void;
  // Demo overlay methods
  getDemoOverlay: () => DemoOverlay | null;
  updateDemoOverlay: (updates: Partial<DemoOverlay>) => void;
  clearDemoOverlay: () => void;
}

const defaultOverlay: DemoOverlay = {
  workouts: { created: [], updated: {}, deleted: [] },
  settings: {},
  assessments: { created: [], updated: {}, deleted: [] },
  shoes: { created: [], updated: {}, deleted: [] },
};

const ProfileContext = createContext<ProfileContextValue>({
  activeProfile: null,
  profiles: [],
  isLoading: true,
  isDemo: false,
  switchProfile: () => {},
  refreshProfiles: async () => {},
  showPicker: false,
  setShowPicker: () => {},
  getDemoOverlay: () => null,
  updateDemoOverlay: () => {},
  clearDemoOverlay: () => {},
});

export function useProfile() {
  return useContext(ProfileContext);
}

interface ProfileProviderProps {
  children: ReactNode;
  initialProfiles?: Profile[];
}

export function ProfileProvider({ children, initialProfiles = [] }: ProfileProviderProps) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  // Load active profile from localStorage on mount
  useEffect(() => {
    const loadActiveProfile = async () => {
      const storedId = localStorage.getItem(ACTIVE_PROFILE_KEY);

      // Fetch profiles from server
      try {
        const response = await fetch('/api/profiles');
        if (response.ok) {
          const data = await response.json();
          setProfiles(data.profiles);

          if (storedId) {
            const profile = data.profiles.find((p: Profile) => p.id === parseInt(storedId));
            if (profile) {
              setActiveProfile(profile);
              // Ensure cookie is set
              document.cookie = `${ACTIVE_PROFILE_KEY}=${profile.id}; path=/; max-age=31536000; samesite=lax`;
            } else if (data.profiles.length > 0) {
              // Stored profile no longer exists, use first profile
              const defaultProfile = data.profiles[0];
              setActiveProfile(defaultProfile);
              localStorage.setItem(ACTIVE_PROFILE_KEY, String(defaultProfile.id));
              document.cookie = `${ACTIVE_PROFILE_KEY}=${defaultProfile.id}; path=/; max-age=31536000; samesite=lax`;
            }
          } else if (data.profiles.length === 0) {
            // No profiles exist yet, show picker to create one
            setShowPicker(true);
          } else if (data.profiles.length === 1) {
            // Only one profile, auto-select it
            const defaultProfile = data.profiles[0];
            setActiveProfile(defaultProfile);
            localStorage.setItem(ACTIVE_PROFILE_KEY, String(defaultProfile.id));
            document.cookie = `${ACTIVE_PROFILE_KEY}=${defaultProfile.id}; path=/; max-age=31536000; samesite=lax`;
          } else {
            // Multiple profiles but none selected, show picker
            setShowPicker(true);
          }
        }
      } catch (error) {
        console.error('Failed to load profiles:', error);
      }

      setIsLoading(false);
    };

    loadActiveProfile();
  }, []);

  const switchProfile = useCallback((profileId: number) => {
    const profile = profiles.find(p => p.id === profileId);
    if (profile) {
      setActiveProfile(profile);
      localStorage.setItem(ACTIVE_PROFILE_KEY, String(profileId));
      // Also set a cookie for server-side access
      document.cookie = `${ACTIVE_PROFILE_KEY}=${profileId}; path=/; max-age=31536000; samesite=lax`;
      setShowPicker(false);
      // Reload to refresh data for new profile
      window.location.reload();
    }
  }, [profiles]);

  const refreshProfiles = useCallback(async () => {
    try {
      const response = await fetch('/api/profiles');
      if (response.ok) {
        const data = await response.json();
        setProfiles(data.profiles);

        // Update activeProfile if it exists in new data
        if (activeProfile) {
          const updated = data.profiles.find((p: Profile) => p.id === activeProfile.id);
          if (updated) {
            setActiveProfile(updated);
          }
        }
      }
    } catch (error) {
      console.error('Failed to refresh profiles:', error);
    }
  }, [activeProfile]);

  // Demo overlay methods
  const getDemoOverlay = useCallback((): DemoOverlay | null => {
    if (!activeProfile || activeProfile.type !== 'demo') return null;

    const key = `${DEMO_OVERLAY_PREFIX}${activeProfile.id}`;
    const stored = localStorage.getItem(key);
    if (!stored) return { ...defaultOverlay };

    try {
      return JSON.parse(stored);
    } catch {
      return { ...defaultOverlay };
    }
  }, [activeProfile]);

  const updateDemoOverlay = useCallback((updates: Partial<DemoOverlay>) => {
    if (!activeProfile || activeProfile.type !== 'demo') return;

    const current = getDemoOverlay() || { ...defaultOverlay };
    const updated = {
      ...current,
      ...updates,
      workouts: updates.workouts ? { ...current.workouts, ...updates.workouts } : current.workouts,
      settings: updates.settings ? { ...current.settings, ...updates.settings } : current.settings,
      assessments: updates.assessments ? { ...current.assessments, ...updates.assessments } : current.assessments,
      shoes: updates.shoes ? { ...current.shoes, ...updates.shoes } : current.shoes,
    };

    const key = `${DEMO_OVERLAY_PREFIX}${activeProfile.id}`;
    localStorage.setItem(key, JSON.stringify(updated));
  }, [activeProfile, getDemoOverlay]);

  const clearDemoOverlay = useCallback(() => {
    if (!activeProfile) return;

    const key = `${DEMO_OVERLAY_PREFIX}${activeProfile.id}`;
    localStorage.removeItem(key);
  }, [activeProfile]);

  const isDemo = activeProfile?.type === 'demo';

  return (
    <ProfileContext.Provider
      value={{
        activeProfile,
        profiles,
        isLoading,
        isDemo,
        switchProfile,
        refreshProfiles,
        showPicker,
        setShowPicker,
        getDemoOverlay,
        updateDemoOverlay,
        clearDemoOverlay,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}
