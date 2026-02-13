'use server';

import { analyzePerformanceTrends } from '@/lib/performance-trends';
import { PerformanceTrendsCard } from '@/components/PerformanceTrendsCard';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, Info } from 'lucide-react';

export default async function PerformanceTrendsPage() {
  const [weekTrends, monthTrends, quarterTrends] = await Promise.all([
    analyzePerformanceTrends('week'),
    analyzePerformanceTrends('month'),
    analyzePerformanceTrends('quarter')
  ]);

  return (
    <div className="min-h-screen bg-bgTertiary py-6">
      <div className="max-w-4xl mx-auto px-4">
        <Link
          href="/tools"
          className="inline-flex items-center gap-2 text-textSecondary hover:text-primary mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Tools
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Performance Trends</h1>
          <p className="text-textSecondary">
            Track your running progress over time and identify patterns in your training.
          </p>
        </div>

        {/* Time Period Cards */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-primary mb-3">Weekly Overview</h2>
            <PerformanceTrendsCard data={weekTrends} />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-primary mb-3">Monthly Progress</h2>
            <PerformanceTrendsCard data={monthTrends} />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-primary mb-3">Quarterly Analysis</h2>
            <PerformanceTrendsCard data={quarterTrends} />
          </div>
        </div>

        {/* Educational Content */}
        <div className="mt-8 bg-surface-1 rounded-xl border border-default p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-indigo-600" />
            Understanding Your Trends
          </h2>

          <div className="space-y-4 text-textSecondary">
            <section>
              <h3 className="font-medium text-primary mb-2">Key Metrics Explained</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <strong>Mileage:</strong> Total distance covered. Gradual increases (10-20% per period) indicate safe progression.
                </li>
                <li>
                  <strong>Average Pace:</strong> Your typical running speed. Improvements indicate growing fitness.
                </li>
                <li>
                  <strong>Consistency:</strong> Percentage of days with workouts. 50-70% is sustainable for most runners.
                </li>
                <li>
                  <strong>Intensity:</strong> Percentage of hard workouts. Should stay around 20% for balanced training.
                </li>
                <li>
                  <strong>Average Distance:</strong> Typical run length. Increases suggest building endurance.
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-medium text-primary mb-2">Reading the Trends</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600 mt-0.5" />
                  <div>
                    <span className="font-medium">Green/Up Arrows:</span> Generally positive for mileage, pace improvement, and consistency.
                    Be cautious of rapid mileage increases (>30%).
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-4 h-4 text-red-600 mt-0.5 rotate-180" />
                  <div>
                    <span className="font-medium">Red/Down Arrows:</span> May indicate decreased training. Not always negative -
                    could be planned recovery or taper.
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="font-medium text-primary mb-2">Common Patterns</h3>
              <ul className="space-y-1 text-sm">
                <li>• <strong>Building Phase:</strong> Increasing mileage + maintaining pace = building base fitness</li>
                <li>• <strong>Peaking:</strong> High mileage + improving pace + increased intensity = race preparation</li>
                <li>• <strong>Recovery:</strong> Decreased mileage + slower pace = necessary adaptation period</li>
                <li>• <strong>Maintenance:</strong> Stable metrics across periods = consistent training</li>
              </ul>
            </section>

            <section className="bg-indigo-50 p-4 rounded-lg">
              <h3 className="font-medium text-indigo-900 mb-2">Actionable Tips</h3>
              <ul className="space-y-1 text-sm text-indigo-800">
                <li>• Review monthly trends to adjust your training plan</li>
                <li>• Use weekly data to catch overtraining early</li>
                <li>• Quarterly views show seasonal patterns and long-term progress</li>
                <li>• Celebrate achievements - they mark real progress!</li>
                <li>• Don't chase every metric - focus on 2-3 key improvements</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}