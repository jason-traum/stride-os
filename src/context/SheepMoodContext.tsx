'use client';

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import type { SheepMood } from '@/components/DreamySheep';

interface SheepMoodState {
  mood: SheepMood;
  message: string | null;
}

interface SheepMoodContextValue {
  mood: SheepMood;
  message: string | null;
  setMood: (mood: SheepMood) => void;
  showCoachMessage: (message: string, mood: SheepMood, duration?: number) => void;
}

const SheepMoodContext = createContext<SheepMoodContextValue | null>(null);

export function SheepMoodProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SheepMoodState>({ mood: 'idle', message: null });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setMood = useCallback((mood: SheepMood) => {
    setState(prev => ({ ...prev, mood }));
  }, []);

  const showCoachMessage = useCallback((message: string, mood: SheepMood, duration = 5000) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    setState({ mood, message });

    timerRef.current = setTimeout(() => {
      setState({ mood: 'idle', message: null });
      timerRef.current = null;
    }, duration);
  }, []);

  return (
    <SheepMoodContext.Provider value={{ mood: state.mood, message: state.message, setMood, showCoachMessage }}>
      {children}
    </SheepMoodContext.Provider>
  );
}

export function useSheepMood() {
  const ctx = useContext(SheepMoodContext);
  if (!ctx) throw new Error('useSheepMood must be used within SheepMoodProvider');
  return ctx;
}
