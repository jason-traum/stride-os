'use client';

import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import Image from 'next/image';
import { SheepSpeechBubble } from './SheepSpeechBubble';

export type SheepMood =
  | 'idle'
  | 'running'
  | 'champion'
  | 'coach'
  | 'stretching'
  | 'thinking'
  | 'confused'
  | 'sleeping'
  | 'encouraging'
  | 'sad'
  | 'stopwatch'
  | 'angry';

interface DreamySheepProps {
  mood: SheepMood;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  withSpeechBubble?: string;
  animate?: boolean;
}

const sizeMap = { sm: 80, md: 140, lg: 220, xl: 320 };

// Some moods don't have their own image — fall back gracefully
const imageMap: Record<SheepMood, string> = {
  idle: '/sheep/idle.png',
  running: '/sheep/running.png',
  champion: '/sheep/champion.png',
  coach: '/sheep/coach.png',
  stretching: '/sheep/stretching.png',
  thinking: '/sheep/confused.png', // Uses confused pose for thinking
  confused: '/sheep/confused.png',
  sleeping: '/sheep/sleeping.png',
  encouraging: '/sheep/encouraging.png',
  sad: '/sheep/sad.png',
  stopwatch: '/sheep/stopwatch.png',
  angry: '/sheep/angry.png',
};

const altMap: Record<SheepMood, string> = {
  idle: 'Dreamy the sheep mascot standing relaxed',
  running: 'Dreamy the sheep mascot running energetically',
  champion: 'Dreamy the sheep mascot celebrating on a podium with a trophy',
  coach: 'Dreamy the sheep mascot sitting with a coaching tablet',
  stretching: 'Dreamy the sheep mascot stretching calmly',
  thinking: 'Dreamy the sheep mascot thinking deeply',
  confused: 'Dreamy the sheep mascot looking confused with a question mark',
  sleeping: 'Dreamy the sheep mascot sleeping peacefully on a cloud',
  encouraging: 'Dreamy the sheep mascot giving a thumbs up encouragingly',
  sad: 'Dreamy the sheep mascot looking empathetic',
  stopwatch: 'Dreamy the sheep mascot holding a stopwatch excitedly',
  angry: 'Dreamy the sheep mascot looking comedically furious',
};

const moodAnimations: Record<SheepMood, Variants> = {
  idle: {
    animate: {
      y: [0, -4, 0],
      transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  running: {
    animate: {
      x: [0, 2, 0, -2, 0],
      y: [0, -3, 0, -3, 0],
      transition: { duration: 0.6, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  champion: {
    initial: { scale: 0, rotate: -10 },
    animate: {
      scale: [0, 1.12, 1],
      rotate: [-10, 3, 0],
      y: [0, -6, 0],
      transition: {
        scale: { duration: 0.5, ease: [0.34, 1.56, 0.64, 1] },
        rotate: { duration: 0.5 },
        y: { duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 },
      },
    },
  },
  coach: {
    initial: { opacity: 0, y: 20 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 200, damping: 20 },
    },
  },
  stretching: {
    animate: {
      scale: [1, 1.02, 1],
      transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  thinking: {
    animate: {
      y: [0, -3, 0],
      rotate: [-1.5, 1.5, -1.5],
      transition: { duration: 2.5, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  confused: {
    initial: { rotate: 5 },
    animate: {
      rotate: [5, 0],
      transition: { type: 'spring', stiffness: 200, damping: 12 },
    },
  },
  sleeping: {
    animate: {
      scale: [1, 1.01, 1],
      transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  encouraging: {
    initial: { scale: 0.8, y: 10 },
    animate: {
      scale: 1,
      y: 0,
      transition: { type: 'spring', stiffness: 300, damping: 15 },
    },
  },
  sad: {
    initial: { opacity: 0, y: -5 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' },
    },
  },
  stopwatch: {
    animate: {
      rotate: [-3, 3, -3],
      transition: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  angry: {
    animate: {
      x: [-2, 2, -2, 2, 0],
      transition: { duration: 0.4, repeat: 2, ease: 'easeInOut' },
    },
  },
};

export function DreamySheep({
  mood,
  size = 'md',
  className = '',
  withSpeechBubble,
  animate: animateProp = true,
}: DreamySheepProps) {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = animateProp && !prefersReducedMotion;
  const px = sizeMap[size];
  const variants = moodAnimations[mood];

  return (
    <div
      className={`inline-flex items-center gap-3 ${className}`}
      role="img"
      aria-label={altMap[mood]}
    >
      {withSpeechBubble && (
        <SheepSpeechBubble message={withSpeechBubble} side="left" />
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={mood}
          initial={shouldAnimate ? (variants.initial ?? { opacity: 0 }) : false}
          animate={shouldAnimate ? variants.animate : undefined}
          exit={shouldAnimate ? { opacity: 0, transition: { duration: 0.15 } } : undefined}
          className="flex-shrink-0"
        >
          <Image
            src={imageMap[mood]}
            alt={altMap[mood]}
            width={px}
            height={px}
            className="object-contain"
            priority={size === 'xl' || size === 'lg'}
          />
        </motion.div>
      </AnimatePresence>
      {/* Speech bubble on right if no explicit side override needed */}
    </div>
  );
}
