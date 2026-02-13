// Force dynamic rendering for real-time data
export const dynamic = 'force-dynamic';

import { getBestEffortsAnalysis } from '@/actions/best-efforts';
import { Trophy, TrendingUp, Calendar, AlertCircle, Zap } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default async function BestEffortsPage() {
  const analysis = await getBestEffortsAnalysis();

  if (!analysis) {
    return (
      <div className="min-h-screen bg-bgTertiary p-4">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-primary mb-8">Best Efforts</h1>
          <div className="bg-surface-1 rounded-xl border border-default p-8 text-center">
            <AlertCircle className="w-12 h-12 text-tertiary mx-auto mb-3" />
            <p className="text-textTertiary">Unable to load best efforts. Please try again.</p>
          </div>
        </div>
      </div>
    );
  }

  // Group efforts by distance
  const effortsByDistance = new Map<string, typeof analysis.bestEfforts>();
  analysis.bestEfforts.forEach(effort => {
    const efforts = effortsByDistance.get(effort.distance) || [];
    efforts.push(effort);
    effortsByDistance.set(effort.distance, efforts);
  });

  // Sort distances by standard order
  const distanceOrder = ['400m', '800m', '1K', '1mi', '5K', '10K', '10mi', 'Half Marathon', 'Marathon'];
  const sortedDistances = Array.from(effortsByDistance.keys()).sort((a, b) => {
    const aIndex = distanceOrder.indexOf(a);
    const bIndex = distanceOrder.indexOf(b);
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return (
    <div className="min-h-screen bg-bgTertiary">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Best Efforts</h1>
          <p className="text-textSecondary">
            Automatically detected personal records from your runs
          </p>
        </div>

        {/* Notifications */}
        {analysis.notifications.length > 0 && (
          <div className="mb-6 space-y-2">
            {analysis.notifications.map((notification, idx) => (
              <div key={idx} className="bg-teal-50 text-teal-800 p-3 rounded-lg text-sm flex items-start gap-2">
                <Zap className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{notification}</span>
              </div>
            ))}
          </div>
        )}

        {/* Recent PRs */}
        {analysis.recentPRs.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-primary mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Recent Personal Records
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {analysis.recentPRs.slice(0, 6).map((pr, idx) => (
                <Link
                  key={idx}
                  href={`/workout/${pr.workoutId}`}
                  className="bg-surface-1 rounded-lg border border-default p-4 hover:border-teal-300 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-primary">{pr.distance}</p>
                      <p className="text-2xl font-bold text-teal-600">{pr.timeFormatted}</p>
                    </div>
                    <Trophy className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div className="text-sm text-textTertiary space-y-0.5">
                    <p>{pr.pace}/mi</p>
                    <p>{new Date(pr.workoutDate).toLocaleDateString()}</p>
                    {pr.improvementSeconds && pr.improvementSeconds > 0 && (
                      <p className="text-green-600 font-medium">
                        {Math.round(pr.improvementSeconds)}s faster!
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* All-Time Bests by Distance */}
        <div>
          <h2 className="text-xl font-semibold text-primary mb-4">All-Time Records</h2>

          {sortedDistances.length === 0 ? (
            <div className="bg-surface-1 rounded-xl border border-default p-8 text-center">
              <Trophy className="w-12 h-12 text-tertiary mx-auto mb-3" />
              <p className="text-textTertiary mb-2">No efforts detected yet</p>
              <p className="text-sm text-tertiary">
                Best efforts are automatically found when you run standard distances
              </p>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              {sortedDistances.map(distance => {
                const efforts = effortsByDistance.get(distance) || [];
                const best = efforts.find(e => e.rankAllTime === 1);
                const topEfforts = efforts.slice(0, 5);

                if (!best) return null;

                return (
                  <div key={distance} className="bg-surface-1 rounded-xl border border-default overflow-hidden">
                    {/* Distance Header */}
                    <div className="bg-gradient-to-r from-slate-50 to-teal-50 p-4 border-b border-default">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-primary">{distance}</h3>
                        {best.equivalentVDOT && (
                          <span className="text-sm text-textTertiary">VDOT {best.equivalentVDOT}</span>
                        )}
                      </div>
                      <div className="mt-2">
                        <p className="text-2xl font-bold text-teal-600">{best.timeFormatted}</p>
                        <p className="text-sm text-textSecondary">{best.pace}/mi • {new Date(best.workoutDate).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Top Performances */}
                    {topEfforts.length > 1 && (
                      <div className="p-4">
                        <p className="text-xs font-medium text-textTertiary uppercase tracking-wide mb-2">Top Performances</p>
                        <div className="space-y-2">
                          {topEfforts.map((effort, idx) => (
                            <Link
                              key={idx}
                              href={`/workout/${effort.workoutId}`}
                              className={cn(
                                'flex items-center justify-between p-2 rounded-lg hover:bg-bgTertiary transition-colors text-sm',
                                idx === 0 && 'bg-yellow-50'
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <span className={cn(
                                  'font-medium',
                                  idx === 0 ? 'text-yellow-600' : 'text-textTertiary'
                                )}>
                                  #{effort.rankAllTime}
                                </span>
                                <span className="font-medium text-primary">{effort.timeFormatted}</span>
                              </div>
                              <span className="text-textTertiary">{new Date(effort.workoutDate).toLocaleDateString()}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Insights */}
        {analysis.bestEfforts.length > 0 && (
          <div className="mt-8 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6">
            <h3 className="font-semibold text-primary mb-3 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              Performance Insights
            </h3>
            <div className="space-y-2 text-sm text-secondary">
              <p>• You have {analysis.bestEfforts.filter(e => e.rankAllTime === 1).length} distance records</p>
              <p>• Most recent PR: {analysis.recentPRs[0]?.distance} on {analysis.recentPRs[0] && new Date(analysis.recentPRs[0].workoutDate).toLocaleDateString()}</p>
              {analysis.recentPRs.length >= 3 && (
                <p className="text-purple-700 font-medium">• 🔥 Hot streak! {analysis.recentPRs.length} PRs in the last 30 days!</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}