'use client';

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { type ReactNode } from 'react';

interface AnimatedButtonProps extends HTMLMotionProps<'button'> {
  children: ReactNode;
}

export function AnimatedButton({ children, className, ...props }: AnimatedButtonProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <button className={className} {...props as React.ButtonHTMLAttributes<HTMLButtonElement>}>{children}</button>;
  }

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={className}
      {...props}
    >
      {children}
    </motion.button>
  );
}
