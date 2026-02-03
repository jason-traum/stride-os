'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteWorkout } from '@/actions/workouts';
import { ConfirmModal } from '@/components/ConfirmModal';

export function DeleteWorkoutButton({ workoutId }: { workoutId: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      await deleteWorkout(workoutId);
      router.push('/history');
    });
  };

  return (
    <>
      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Workout?"
        message="Are you sure you want to delete this workout? This action cannot be undone."
        confirmText="Delete"
        cancelText="Keep"
        variant="danger"
      />
      <button
        onClick={() => setShowConfirm(true)}
        disabled={isPending}
        className="text-red-500 hover:text-red-600 text-sm font-medium disabled:opacity-50"
      >
        {isPending ? 'Deleting...' : 'Delete'}
      </button>
    </>
  );
}
