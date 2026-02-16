'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface SheepSpeechBubbleProps {
  message: string;
  side?: 'left' | 'right';
  className?: string;
}

export function SheepSpeechBubble({ message, side = 'right', className = '' }: SheepSpeechBubbleProps) {
  const prefersReducedMotion = useReducedMotion();
  const [displayedText, setDisplayedText] = useState(prefersReducedMotion ? message : '');

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayedText(message);
      return;
    }

    setDisplayedText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayedText(message.slice(0, i));
      if (i >= message.length) clearInterval(interval);
    }, 30);

    return () => clearInterval(interval);
  }, [message, prefersReducedMotion]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 4 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        className={`relative max-w-[250px] px-4 py-3 rounded-2xl bg-dream-950/80 border border-dream-800/50 text-dream-100 text-sm shadow-lg backdrop-blur-sm ${className}`}
      >
        <span className="leading-relaxed">{displayedText}</span>
        {displayedText.length < message.length && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="inline-block w-[2px] h-[14px] bg-dream-400 ml-0.5 align-middle"
          />
        )}
        {/* Pointer triangle */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-0 h-0 ${
            side === 'right'
              ? '-left-2 border-t-[6px] border-t-transparent border-r-[8px] border-r-dream-950/80 border-b-[6px] border-b-transparent'
              : '-right-2 border-t-[6px] border-t-transparent border-l-[8px] border-l-dream-950/80 border-b-[6px] border-b-transparent'
          }`}
        />
      </motion.div>
    </AnimatePresence>
  );
}
