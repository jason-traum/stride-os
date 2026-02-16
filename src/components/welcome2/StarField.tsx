'use client';

import { motion, type MotionValue, useTransform } from 'framer-motion';
import { useMemo } from 'react';

interface StarFieldProps {
  scrollProgress: MotionValue<number>;
}

export function StarField({ scrollProgress }: StarFieldProps) {
  const opacity = useTransform(scrollProgress, [0, 0.20, 0.35], [1, 0.4, 0]);

  const stars = useMemo(
    () =>
      Array.from({ length: 35 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: `${1 + Math.random() * 2}px`,
        duration: `${2.5 + Math.random() * 3}s`,
        delay: `${Math.random() * 4}s`,
        maxOpacity: (0.3 + Math.random() * 0.6).toFixed(2),
      })),
    []
  );

  return (
    <motion.div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity }}>
      {stars.map((star) => (
        <div
          key={star.id}
          className="w2-star"
          style={
            {
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              '--duration': star.duration,
              '--delay': star.delay,
              '--max-opacity': star.maxOpacity,
            } as React.CSSProperties
          }
        />
      ))}
    </motion.div>
  );
}
