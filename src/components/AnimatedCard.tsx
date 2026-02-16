'use client';

import { ReactNode } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
}

export function AnimatedCard({ children, className }: AnimatedCardProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
