import { ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

interface StepNavigationProps {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  /** Override next button color. Default is dream-600/dream-700. */
  nextColor?: 'dream' | 'green';
  /** Show CheckCircle2 icon instead of ChevronRight */
  showCheck?: boolean;
  /** Only show forward button (step 1 has no back) */
  hideBack?: boolean;
}

export function StepNavigation({
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled = false,
  loading = false,
  loadingLabel = 'Setting up...',
  nextColor = 'dream',
  showCheck = false,
  hideBack = false,
}: StepNavigationProps) {
  const colorClasses = nextColor === 'green'
    ? 'bg-green-600 hover:bg-green-700'
    : 'bg-dream-600 hover:bg-dream-700';

  const disabledVisual = nextDisabled && !loading
    ? 'opacity-60 cursor-not-allowed'
    : '';

  if (hideBack) {
    return (
      <button
        onClick={onNext}
        disabled={loading}
        className={`w-full flex items-center justify-center space-x-2 btn-primary py-3 px-4 rounded-lg disabled:bg-surface-2 disabled:cursor-not-allowed ${disabledVisual}`}
      >
        {loading ? (
          <span>{loadingLabel}</span>
        ) : (
          <>
            <span>{nextLabel}</span>
            {showCheck ? <CheckCircle2 className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </>
        )}
      </button>
    );
  }

  return (
    <div className="flex space-x-3">
      <button
        onClick={onBack}
        className="flex-1 flex items-center justify-center space-x-2 bg-surface-2 hover:bg-surface-3 text-primary font-medium py-3 px-4 rounded-lg transition-colors"
      >
        <ChevronLeft className="w-5 h-5" />
        <span>Back</span>
      </button>
      <button
        onClick={onNext}
        disabled={loading}
        className={`flex-1 flex items-center justify-center space-x-2 ${colorClasses} disabled:bg-surface-2 text-white font-semibold py-3 px-4 rounded-lg transition-all shadow-sm ${disabledVisual}`}
      >
        {loading ? (
          <span>{loadingLabel}</span>
        ) : (
          <>
            <span>{nextLabel}</span>
            {showCheck ? <CheckCircle2 className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </>
        )}
      </button>
    </div>
  );
}
