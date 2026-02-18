'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { GUEST_RESTRICTIONS, type GuestRestriction } from '@/lib/guest-mode';

interface GuestModeContextType {
  isGuest: boolean;
  isLoading: boolean;
  isRestricted: (action: GuestRestriction) => boolean;
}

const GuestModeContext = createContext<GuestModeContextType>({
  isGuest: false,
  isLoading: true,
  isRestricted: () => false,
});

export function useGuestMode() {
  return useContext(GuestModeContext);
}

export function GuestModeProvider({ children }: { children: ReactNode }) {
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in as guest
    fetch('/api/guest-check')
      .then(res => res.json())
      .then(data => {
        setIsGuest(data.isGuest);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  const isRestricted = (action: GuestRestriction): boolean => {
    if (!isGuest) return false;
    return GUEST_RESTRICTIONS[action] === true;
  };

  return (
    <GuestModeContext.Provider value={{ isGuest, isLoading, isRestricted }}>
      {children}
    </GuestModeContext.Provider>
  );
}
