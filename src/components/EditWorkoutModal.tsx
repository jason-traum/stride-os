'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateWorkout } from '@/actions/workouts';
import { getShoes } from '@/actions/shoes';
import { workoutTypes } from '@/lib/schema';
import { getWorkoutTypeLabel, cn } from '@/lib/utils';
import { useToast } from './Toast';
import { AssessmentModal } from './AssessmentModal';
import { X } from 'lucide-react';
import { useModalBodyLock } from '@/hooks/useModalBodyLock';
import type { Workout, Shoe, Assessment } from '@/lib/schema';

interface EditWorkoutModalProps {
  workout: Workout & { shoe?: Shoe | null; assessment?: Assessment | null };
  onClose: () => void;
}

export function EditWorkoutModal({ workout, onClose }: EditWorkoutModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [shoes, setShoes] = useState<Shoe[]>([]);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);

  // Prevent body scrolling when modal is open
  useModalBodyLock(true);

  // Parse duration to hours/minutes/seconds
  const totalMinutes = workout.durationMinutes || 0;
  const initialHours = Math.floor(totalMinutes / 60);
  const initialMinutes = totalMinutes % 60;

  // Form state
  const [date, setDate] = useState(workout.date);
  const [distance, setDistance] = useState(workout.distanceMiles?.toString() || '');
  const [hours, setHours] = useState(initialHours > 0 ? initialHours.toString() : '');
  const [minutes, setMinutes] = useState(initialMinutes > 0 ? initialMinutes.toString() : '');
  const [seconds, setSeconds] = useState('');
  const [workoutType, setWorkoutType] = useState(workout.workoutType);
  const [routeName, setRouteName] = useState(workout.routeName || '');
  const [shoeId, setShoeId] = useState<number | ''>(workout.shoeId || '');
  const [notes, setNotes] = useState(workout.notes || '');

  useEffect(() => {
    getShoes().then(setShoes);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const distanceMiles = parseFloat(distance) || undefined;
    const totalMins =
      (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0) + (parseInt(seconds) || 0) / 60;
    const durationMinutes = totalMins > 0 ? Math.round(totalMins) : undefined;

    startTransition(async () => {
      await updateWorkout(workout.id, {
        date,
        distanceMiles,
        durationMinutes,
        workoutType,
        routeName: routeName || undefined,
        shoeId: shoeId ? Number(shoeId) : undefined,
        notes: notes || undefined,
      });

      showToast('Workout updated!', 'success');
      router.refresh();
      onClose();
    });
  };

  const calculatedPace = () => {
    const dist = parseFloat(distance);
    const totalSeconds =
      (parseInt(hours) || 0) * 3600 + (parseInt(minutes) || 0) * 60 + (parseInt(seconds) || 0);
    if (!dist || !totalSeconds) return null;
    const paceSeconds = totalSeconds / dist;
    const paceMin = Math.floor(paceSeconds / 60);
    const paceSec = Math.round(paceSeconds % 60);
    return `${paceMin}:${paceSec.toString().padStart(2, '0')} /mi`;
  };

  const handleEditAssessment = () => {
    setShowAssessmentModal(true);
  };

  if (showAssessmentModal) {
    return (
      <AssessmentModal
        workoutId={workout.id}
        onClose={() => {
          setShowAssessmentModal(false);
          onClose();
        }}
        existingAssessment={workout.assessment}
        isEdit={true}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bgSecondary rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-bgSecondary border-b border-borderPrimary px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-primary">Edit Workout</h2>
            <button onClick={onClose} className="text-tertiary hover:text-textSecondary">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-textSecondary mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              required
            />
          </div>

          {/* Distance */}
          <div>
            <label className="block text-sm font-medium text-textSecondary mb-1">Distance (miles)</label>
            <input
              type="number"
              step="0.01"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-textSecondary mb-1">Duration</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  type="number"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <span className="text-xs text-textTertiary mt-1 block">hours</span>
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="0"
                  min="0"
                  max="59"
                  className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <span className="text-xs text-textTertiary mt-1 block">min</span>
              </div>
              <div className="flex-1">
                <input
                  type="number"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                  placeholder="0"
                  min="0"
                  max="59"
                  className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
                <span className="text-xs text-textTertiary mt-1 block">sec</span>
              </div>
            </div>
            {calculatedPace() && (
              <p className="text-sm text-teal-600 mt-2">Pace: {calculatedPace()}</p>
            )}
          </div>

          {/* Workout Type */}
          <div>
            <label className="block text-sm font-medium text-textSecondary mb-2">Workout Type</label>
            <div className="flex flex-wrap gap-2">
              {workoutTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setWorkoutType(type)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    workoutType === type
                      ? 'bg-teal-600 text-white'
                      : 'bg-stone-100 text-textSecondary hover:bg-stone-200'
                  )}
                >
                  {getWorkoutTypeLabel(type)}
                </button>
              ))}
            </div>
          </div>

          {/* Route Name */}
          <div>
            <label className="block text-sm font-medium text-textSecondary mb-1">
              Route Name (optional)
            </label>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="e.g., Neighborhood loop, Park trail"
              className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          {/* Shoe Selection */}
          <div>
            <label className="block text-sm font-medium text-textSecondary mb-1">Shoe</label>
            <select
              value={shoeId}
              onChange={(e) => setShoeId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="">No shoe selected</option>
              {shoes.map((shoe) => (
                <option key={shoe.id} value={shoe.id}>
                  {shoe.name} ({shoe.totalMiles.toFixed(0)} mi)
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-textSecondary mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it go? Any observations?"
              rows={3}
              className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
            />
          </div>

          {/* Edit Assessment Button */}
          {workout.assessment && (
            <div className="pt-4 border-t border-borderPrimary">
              <button
                type="button"
                onClick={handleEditAssessment}
                className="w-full py-2 px-4 border border-teal-600 text-teal-600 rounded-lg font-medium hover:bg-surface-1 transition-colors"
              >
                Edit Assessment
              </button>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className={cn(
              'w-full py-3 px-4 rounded-lg font-medium transition-colors',
              isPending
                ? 'bg-stone-300 dark:bg-surface-3 text-textTertiary cursor-not-allowed'
                : 'bg-accentTeal text-white hover:bg-accentTeal-hover shadow-sm hover:shadow-md'
            )}
          >
            {isPending ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
