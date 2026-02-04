'use client';

import { useState } from 'react';
import { EditWorkoutModal } from '@/components/EditWorkoutModal';
import type { Workout, Shoe, Assessment } from '@/lib/schema';

type WorkoutWithRelations = Workout & { shoe?: Shoe | null; assessment?: Assessment | null };

export function EditWorkoutButton({ workout }: { workout: WorkoutWithRelations }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 text-teal-600 border border-teal-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
      >
        Edit Workout
      </button>

      {showModal && (
        <EditWorkoutModal
          workout={workout}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
