'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { DreamySheep } from './DreamySheep';
import type { SheepMood } from './DreamySheep';

interface CoachIntroProps {
  onComplete: () => void;
}

export function CoachIntro({ onComplete }: CoachIntroProps) {
  const [mood, setMood] = useState<SheepMood>('encouraging');
  const [exiting, setExiting] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const handleStart = () => {
    setMood('champion');
    setExiting(true);
    setTimeout(onComplete, prefersReducedMotion ? 100 : 800);
  };

  return (
    <AnimatePresence>
      {!exiting ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -20, transition: { duration: 0.4 } }}
          className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4"
        >
          <DreamySheep
            mood={mood}
            size="xl"
            withSpeechBubble="Hey! I'm Dreamy, your AI running coach. I'll track your runs, analyze your performance, and help you crush your goals. Ready to get started?"
          />

          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.5, type: 'spring', stiffness: 300, damping: 25 }}
            onClick={handleStart}
            className="mt-8 btn-primary text-lg px-8 py-3 rounded-xl font-display"
          >
            Let&apos;s Go!
          </motion.button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex flex-col items-center justify-center min-h-[50vh]"
        >
          <DreamySheep mood="champion" size="xl" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
