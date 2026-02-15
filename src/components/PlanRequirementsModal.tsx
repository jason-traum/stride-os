'use client';

import { useRouter } from 'next/navigation';
import { X, AlertCircle, User, Target, Calendar, Activity } from 'lucide-react';

interface MissingField {
  field: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value?: any;
}

interface PlanRequirementsModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingFields: MissingField[];
  onComplete?: () => void;
}

export function PlanRequirementsModal({
  isOpen,
  onClose,
  missingFields,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onComplete
}: PlanRequirementsModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleGoToProfile = () => {
    router.push('/profile');
    onClose();
  };

  const handleAskCoach = () => {
    const message = encodeURIComponent(
      "I'd like to set up my training plan. Can you help me fill in the missing information?"
    );
    router.push(`/coach?message=${message}`);
    onClose();
  };

  const getFieldIcon = (field: string) => {
    switch (field) {
      case 'raceGoal': return Target;
      case 'raceDate': return Calendar;
      case 'weeklyMileage': return Activity;
      case 'age': return User;
      default: return AlertCircle;
    }
  };

  const getFieldDescription = (field: string) => {
    switch (field) {
      case 'raceGoal':
        return 'What race distance are you training for? (5K, 10K, Half Marathon, Marathon)';
      case 'raceDate':
        return 'When is your target race? This helps build a proper training timeline.';
      case 'weeklyMileage':
        return 'How many miles are you currently running per week? We\'ll build from there.';
      case 'age':
        return 'Your age helps determine appropriate heart rate zones and recovery needs.';
      default:
        return 'This information helps create a personalized plan.';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bgSecondary rounded-2xl max-w-md w-full shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-borderPrimary">
          <h2 className="text-lg font-semibold text-primary">Complete Your Profile for a Training Plan</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface-interactive-hover rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-textTertiary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3 text-sm text-textSecondary">
            <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
            <p>
              To create a personalized training plan, I need a few key pieces of information:
            </p>
          </div>

          {/* Missing Fields */}
          <div className="space-y-3">
            {missingFields.map((field) => {
              const Icon = getFieldIcon(field.field);
              return (
                <div
                  key={field.field}
                  className="flex items-start gap-3 p-3 bg-bgTertiary rounded-lg"
                >
                  <div className="w-8 h-8 bg-bgSecondary rounded-lg flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-textSecondary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-primary text-sm">{field.label}</p>
                    <p className="text-xs text-textSecondary mt-0.5">
                      {getFieldDescription(field.field)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Options */}
          <div className="space-y-3 pt-2">
            <button
              onClick={handleGoToProfile}
              className="btn-primary w-full py-3 px-4 rounded-xl"
            >
              Complete Profile Now
            </button>

            <button
              onClick={handleAskCoach}
              className="btn-secondary w-full py-3 px-4 rounded-xl"
            >
              Let Coach Help Me
            </button>

            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-textTertiary hover:text-textSecondary transition-colors"
            >
              I&apos;ll do this later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}