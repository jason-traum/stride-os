'use client';

import { useEffect } from 'react';

/**
 * Custom hook to prevent body scrolling when a modal is open
 * @param isOpen - Whether the modal is currently open
 */
export function useModalBodyLock(isOpen: boolean) {
  useEffect(() => {
    if (isOpen) {
      // Store the original body overflow style
      const originalStyle = window.getComputedStyle(document.body).overflow;

      // Prevent body from scrolling
      document.body.style.overflow = 'hidden';

      // Cleanup function to restore original overflow style
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);
}