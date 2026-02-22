'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

const altMap: Record<string, string> = {
  encouraging: 'Dreamy mascot giving a thumbs up',
  coach: 'Dreamy mascot reviewing your training on a tablet',
  confused: 'Dreamy mascot thinking deeply',
  idle: 'Dreamy mascot standing attentively',
  champion: 'Dreamy mascot celebrating on a podium with trophy',
  forward: 'Dreamy mascot facing forward',
};

interface SheepImageProps {
  mood: string;
  size: number;
  className?: string;
  priority?: boolean;
  /** Entrance animation style */
  entrance?: 'fade' | 'bounce';
  delay?: number;
  /** Flip horizontally so sheep faces the other direction */
  flip?: boolean;
}

export function SheepImage({ mood, size, className = '', priority = false, entrance = 'fade', delay = 0, flip = false }: SheepImageProps) {
  const entranceProps = entrance === 'bounce'
    ? {
        initial: { opacity: 0, scale: 0.6, y: 20 },
        whileInView: { opacity: 1, scale: 1, y: 0 },
        transition: { type: 'spring' as const, stiffness: 200, damping: 20, delay },
      }
    : {
        initial: { opacity: 0, y: 20 },
        whileInView: { opacity: 1, y: 0 },
        transition: { duration: 0.7, delay, ease: [0.25, 0.1, 0.25, 1] as const },
      };

  return (
    <motion.div
      {...entranceProps}
      viewport={{ once: true, margin: '-60px' }}
      className={className}
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Image
          src={`/sheep/${mood}.png`}
          alt={altMap[mood] || `Dreamy mascot — ${mood}`}
          width={size}
          height={size}
          className={`object-contain w-full h-auto${flip ? ' -scale-x-100' : ''}`}
          priority={priority}
        />
      </motion.div>
    </motion.div>
  );
}
