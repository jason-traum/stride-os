'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, X } from 'lucide-react';
import { haptic } from '@/lib/haptic';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on escape key and haptic on open
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      haptic('warning');
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Close when clicking outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: 'text-red-500',
      button: 'bg-red-600 hover:bg-red-700',
    },
    warning: {
      icon: 'text-teal-500',
      button: 'bg-teal-600 hover:bg-teal-700',
    },
    info: {
      icon: 'text-teal-500',
      button: 'bg-teal-600 hover:bg-teal-700',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-bgSecondary rounded-xl shadow-xl max-w-md w-full animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={cn('flex-shrink-0 p-2 rounded-full bg-stone-100', styles.icon)}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 id="confirm-title" className="text-lg font-semibold text-primary">
                {title}
              </h3>
              <p className="mt-2 text-sm text-textSecondary">{message}</p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 p-1 rounded-full hover:bg-surface-interactive-hover transition-colors"
            >
              <X className="w-5 h-5 text-tertiary" />
            </button>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 bg-bgTertiary rounded-b-xl">
          <button
            onClick={onClose}
            className="btn-secondary flex-1 text-sm"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              haptic('tap');
              onConfirm();
              onClose();
            }}
            className={cn(
              'flex-1 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors',
              styles.button
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
