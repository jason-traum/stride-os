import { getCoachHistory, getCoachStats } from '@/lib/coach-history';
import { CoachHistoryView } from '@/components/CoachHistoryView';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default async function CoachHistoryPage() {
  const [history, stats] = await Promise.all([
    getCoachHistory(100), // Get last 100 interactions
    getCoachStats(),
  ]);

  return (
    <div className="min-h-screen bg-bgTertiary">
      <div className="mx-auto max-w-4xl p-4 sm:p-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/today"
            className="inline-flex items-center text-sm text-textSecondary hover:text-teal-600 mb-4"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Today
          </Link>
          <h1 className="text-3xl font-bold text-primary mb-2">Coach History</h1>
          <p className="text-textSecondary">
            Your conversation history with your AI running coach
          </p>
        </div>

        {/* History View */}
        <CoachHistoryView groupedHistory={history} stats={stats} />

        {/* Tips */}
        <div className="mt-8 bg-surface-1 rounded-xl border border-default p-6">
          <h3 className="text-lg font-semibold text-primary mb-3">Getting the Most from Your Coach</h3>
          <div className="space-y-2 text-sm text-textSecondary">
            <p>• Be specific about your goals and current fitness level</p>
            <p>• Share details about how workouts felt and any concerns</p>
            <p>• Ask follow-up questions to dive deeper into topics</p>
            <p>• Reference previous conversations for continuity</p>
            <p>• Your coach learns from your feedback and adapts over time</p>
          </div>
        </div>
      </div>
    </div>
  );
}