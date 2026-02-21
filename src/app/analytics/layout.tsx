import { AnalyticsNav } from '@/components/AnalyticsNav';
import { RecategorizeButton } from '@/components/RecategorizeButton';

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-semibold text-textPrimary">Analytics</h1>
          <p className="text-sm text-textTertiary mt-1">Your running stats from the last 90 days</p>
        </div>
        <RecategorizeButton />
      </div>
      <AnalyticsNav />
      {children}
    </div>
  );
}
