'use client';

import { useState, useEffect } from 'react';
import { Zap } from 'lucide-react';
import { QuickLogModal } from './QuickLogModal';
import { getQuickLogDefaults } from '@/actions/quick-log';

export function QuickLogButton() {
  const [showModal, setShowModal] = useState(false);
  const [defaults, setDefaults] = useState({
    distance: 5,
    duration: 45,
    type: 'easy',
  });

  // Load smart defaults based on recent workouts
  useEffect(() => {
    getQuickLogDefaults().then(result => {
      if (result.success) {
        setDefaults(result.data);
      }
    });
  }, []);

  const handleSuccess = () => {
    // Could show a success toast here
    window.location.reload(); // Simple reload to show the new workout
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="btn-primary flex items-center gap-2 text-sm"
      >
        <Zap className="w-4 h-4" />
        <span className="hidden sm:inline">Quick Log</span>
        <span className="sm:hidden">Log</span>
      </button>

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