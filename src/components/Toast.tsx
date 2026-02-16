'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { haptic } from '@/lib/haptic';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = 'success', duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    // Haptic feedback based on toast type
    if (type === 'success') {
      haptic('success');
    } else if (type === 'error') {
      haptic('error');
    } else {
      haptic('tap');
    }

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose, type]);

  const bgColor = {
    success: 'bg-accentTeal',
    error: 'bg-color-error',
    info: 'bg-surface-3',
  }[type];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50"
        >
          <div className={cn('px-6 py-3 rounded-xl shadow-lg text-white font-medium', bgColor)}>
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Toast context for app-wide toast management
import { createContext, useContext, useCallback, ReactNode } from 'react';

interface ToastContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }>>([]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
