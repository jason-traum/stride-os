'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { DreamySheep, type SheepMood } from './DreamySheep';
import { useSheepMood } from '@/context/SheepMoodContext';

const runningTips = [
  "Easy runs should feel easy. If you can't hold a conversation, slow down!",
  "Consistency beats intensity. Show up every day, even if it's just a short jog.",
  "Hydrate before you're thirsty. Aim for water throughout the day, not just before runs.",
  "Your rest days are when the magic happens. Don't skip them!",
  "Cadence over stride length. Quick, light steps reduce impact forces.",
  "Hills are speedwork in disguise. Embrace the climb!",
  "Listen to your body. A twinge today could be an injury tomorrow.",
  "Sleep is your #1 performance enhancer. Aim for 7-9 hours.",
  "Mix up your routes. New terrain challenges different muscles.",
  "The best run is the one you enjoy. Have fun out there!",
];

export function DashboardSheep() {
  const { mood, message } = useSheepMood();
  const prefersReducedMotion = useReducedMotion();
  const [tip, setTip] = useState<string | null>(null);
  const [showTip, setShowTip] = useState(false);

  const handleClick = useCallback(() => {
    if (message) return; // Don't override an active coach message
    const randomTip = runningTips[Math.floor(Math.random() * runningTips.length)];
    setTip(randomTip);
    setShowTip(true);
  }, [message]);

  useEffect(() => {
    if (!showTip) return;
    const timer = setTimeout(() => setShowTip(false), 5000);
    return () => clearTimeout(timer);
  }, [showTip]);

  const displayMessage = message || (showTip ? tip : null);

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25, delay: 0.5 }}
      className="cursor-pointer"
      onClick={handleClick}
      title="Click for a running tip!"
    >
      <DreamySheep
        mood={mood}
        size="sm"
        withSpeechBubble={displayMessage ?? undefined}
      />
    </motion.div>
  );
}
