'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteWorkout } from '@/actions/workouts';

export function DeleteWorkoutButton({ workoutId }: { workoutId: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this workout?')) {
      return;
    }

    startTransition(async () => {
      await deleteWorkout(workoutId);
      router.push('/history');
    });
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-red-500 hover:text-red-600 text-sm font-medium disabled:opacity-50"
    >
      {isPending ? 'Deleting...' : 'Delete'}
    </button>
  );
}
