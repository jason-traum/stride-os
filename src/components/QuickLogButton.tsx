'use client';

import { useState, useRef, useCallback } from 'react';
import { Zap } from 'lucide-react';
import { QuickLogModal } from './QuickLogModal';
import { getQuickLogDefaults } from '@/actions/quick-log';
import { AnimatedButton } from '@/components/AnimatedButton';

export function QuickLogButton() {
  const [showModal, setShowModal] = useState(false);
  const [defaults, setDefaults] = useState({
    distance: 5,
    duration: 45,
    type: 'easy',
  });
  const hasFetchedDefaults = useRef(false);

  // Lazy-load smart defaults only when the user first opens the modal
  const handleOpen = useCallback(() => {
    if (!hasFetchedDefaults.current) {
      hasFetchedDefaults.current = true;
      getQuickLogDefaults().then(result => {
        if (result.success) {
          setDefaults(result.data);
        }
      });
    }
    setShowModal(true);
  }, []);

  const handleSuccess = () => {
    // Could show a success toast here
    window.location.reload(); // Simple reload to show the new workout
  };

  return (
    <>
      <AnimatedButton
        onClick={handleOpen}
        className="btn-primary flex items-center gap-2 text-sm"
      >
        <Zap className="w-4 h-4" />
        <span className="hidden sm:inline">Quick Log</span>
        <span className="sm:hidden">Log</span>
      </AnimatedButton>

      <QuickLogModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
        defaultDistance={defaults.distance}
        defaultDuration={defaults.duration}
        defaultType={defaults.type}
      />
    </>
  );
}