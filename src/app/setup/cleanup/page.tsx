'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  AlertTriangle,
  Info,
  Trash2,
  Check,
  X,
  Loader2,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useToast } from '@/components/Toast';
import {
  scanWorkoutActivities,
  excludeWorkout,
  bulkExcludeWorkouts,
  includeWorkout,
} from '@/actions/activity-scanner';
import type { ScanResult, FlaggedActivity, FlagSeverity } from '@/lib/training/activity-scanner';
import { formatPace, formatDistance } from '@/lib/utils';

const SEVERITY_CONFIG: Record<FlagSeverity, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: typeof AlertTriangle;
  description: string;
}> = {
  auto_exclude: {
    label: 'Auto-Exclude',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    icon: Trash2,
    description: 'Obvious junk that should be excluded from training metrics',
  },
  review: {
    label: 'Needs Review',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    icon: AlertTriangle,
    description: 'Borderline activities that may need manual review',
  },
  info: {
    label: 'Info',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/20',
    icon: Info,
    description: 'Minor notes for your awareness',
  },
};

const REASON_LABELS: Record<string, string> = {
  micro: 'Micro Activity',
  gps_glitch: 'GPS Glitch',
  walk_tagged_run: 'Walk Tagged as Run',
  suspicious_distance: 'Suspicious Distance',
  duplicate: 'Possible Duplicate',
  zero_distance: 'Zero Distance',
  indoor_anomaly: 'Indoor Anomaly',
};

export default function CleanupPage() {
  const router = useRouter();
  const { showToast } = useToast();

  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [excluding, setExcluding] = useState<Set<number>>(new Set());
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [bulkExcluding, setBulkExcluding] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<FlagSeverity>>(
    () => new Set<FlagSeverity>(['auto_exclude', 'review'])
  );

  const runScan = useCallback(async () => {
    setLoading(true);
    try {
      const result = await scanWorkoutActivities();
      setScanResult(result);
    } catch (error) {
      console.error('Scan failed:', error);
      showToast('Failed to scan activities', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    runScan();
  }, [runScan]);

  const handleExclude = async (flag: FlaggedActivity) => {
    setExcluding(prev => new Set(prev).add(flag.workoutId));
    try {
      await excludeWorkout(flag.workoutId, `${REASON_LABELS[flag.reason]}: ${flag.recommendation}`);
      setExcluded(prev => new Set(prev).add(flag.workoutId));
      showToast('Activity excluded', 'success');
    } catch (error) {
      console.error('Exclude failed:', error);
      showToast('Failed to exclude activity', 'error');
    } finally {
      setExcluding(prev => {
        const next = new Set(prev);
        next.delete(flag.workoutId);
        return next;
      });
    }
  };

  const handleKeep = async (flag: FlaggedActivity) => {
    // If it was already excluded, re-include it
    if (excluded.has(flag.workoutId)) {
      setExcluding(prev => new Set(prev).add(flag.workoutId));
      try {
        await includeWorkout(flag.workoutId);
        setExcluded(prev => {
          const next = new Set(prev);
          next.delete(flag.workoutId);
          return next;
        });
        showToast('Activity restored', 'success');
      } catch (error) {
        console.error('Include failed:', error);
        showToast('Failed to restore activity', 'error');
      } finally {
        setExcluding(prev => {
          const next = new Set(prev);
          next.delete(flag.workoutId);
          return next;
        });
      }
    } else {
      setKept(prev => new Set(prev).add(flag.workoutId));
    }
  };

  const handleAutoExcludeAll = async () => {
    if (!scanResult) return;

    const autoExcludeIds = scanResult.flagged
      .filter(f => f.severity === 'auto_exclude')
      .filter(f => !excluded.has(f.workoutId) && !kept.has(f.workoutId))
      .map(f => f.workoutId);

    if (autoExcludeIds.length === 0) {
      showToast('Nothing to auto-exclude', 'info');
      return;
    }

    setBulkExcluding(true);
    try {
      await bulkExcludeWorkouts(autoExcludeIds, 'Auto-excluded by data quality scanner');
      setExcluded(prev => {
        const next = new Set(prev);
        autoExcludeIds.forEach(id => next.add(id));
        return next;
      });
      showToast(`Excluded ${autoExcludeIds.length} activities`, 'success');
    } catch (error) {
      console.error('Bulk exclude failed:', error);
      showToast('Failed to exclude activities', 'error');
    } finally {
      setBulkExcluding(false);
    }
  };

  const toggleSection = (severity: FlagSeverity) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  };

  const flagsBySeverity = (severity: FlagSeverity) =>
    scanResult?.flagged.filter(f => f.severity === severity) ?? [];

  const unresolvedCount = scanResult
    ? scanResult.flagged.filter(f => !excluded.has(f.workoutId) && !kept.has(f.workoutId)).length
    : 0;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
        <div>
          <h1 className="text-2xl font-display font-semibold text-textPrimary">Data Cleanup</h1>
          <p className="text-textSecondary mt-1">Scanning your activities for issues...</p>
        </div>
        <div className="bg-surface-1 rounded-lg border border-default p-12 text-center">
          <Loader2 className="w-10 h-10 mx-auto text-dream-500 animate-spin mb-4" />
          <p className="text-textSecondary">Analyzing all workouts...</p>
        </div>
      </div>
    );
  }

  if (!scanResult) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pb-20">
        <div>
          <h1 className="text-2xl font-display font-semibold text-textPrimary">Data Cleanup</h1>
        </div>
        <div className="bg-surface-1 rounded-lg border border-default p-8 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto text-amber-400 mb-4" />
          <p className="text-textPrimary font-medium">Scan failed</p>
          <p className="text-textSecondary text-sm mt-1">Could not analyze your workouts.</p>
          <button
            onClick={runScan}
            className="mt-4 btn-primary text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const isAllClean = scanResult.flaggedCount === 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-semibold text-textPrimary">Data Cleanup</h1>
        <p className="text-textSecondary mt-1">
          Review flagged activities to keep your training data clean
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-surface-1 rounded-lg border border-default p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg ${isAllClean ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
            {isAllClean ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <Shield className="w-5 h-5 text-amber-400" />
            )}
          </div>
          <div>
            <p className="text-textPrimary font-medium">
              {isAllClean
                ? 'Your data looks clean!'
                : `${scanResult.flaggedCount} of ${scanResult.totalWorkouts} activities flagged`}
            </p>
            <p className="text-textTertiary text-sm">
              {isAllClean
                ? `Scanned ${scanResult.totalWorkouts} activities with no issues found.`
                : `${excluded.size} excluded, ${kept.size} kept, ${unresolvedCount} remaining`}
            </p>
          </div>
        </div>

        {!isAllClean && (
          <div className="grid grid-cols-3 gap-3">
            {(['auto_exclude', 'review', 'info'] as FlagSeverity[]).map(severity => {
              const config = SEVERITY_CONFIG[severity];
              const count = flagsBySeverity(severity).length;
              if (count === 0) return null;
              return (
                <div
                  key={severity}
                  className={`rounded-lg ${config.bgColor} border ${config.borderColor} p-3 text-center`}
                >
                  <p className={`text-lg font-semibold ${config.color}`}>{count}</p>
                  <p className="text-textTertiary text-xs">{config.label}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Auto-Exclude All Button */}
      {scanResult.autoExcludeCount > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-textPrimary font-medium text-sm">
                {scanResult.autoExcludeCount} obvious junk {scanResult.autoExcludeCount === 1 ? 'activity' : 'activities'}
              </p>
              <p className="text-textTertiary text-xs mt-0.5">
                Micro activities, zero distance, and other clear errors
              </p>
            </div>
            <button
              onClick={handleAutoExcludeAll}
              disabled={bulkExcluding || flagsBySeverity('auto_exclude').every(f => excluded.has(f.workoutId))}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-400
                         hover:bg-red-500/30 transition-colors text-sm font-medium
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkExcluding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Exclude All Junk
            </button>
          </div>
        </div>
      )}

      {/* Flagged Activities by Severity */}
      {(['auto_exclude', 'review', 'info'] as FlagSeverity[]).map(severity => {
        const flags = flagsBySeverity(severity);
        if (flags.length === 0) return null;
        const config = SEVERITY_CONFIG[severity];
        const Icon = config.icon;
        const isExpanded = expandedSections.has(severity);

        return (
          <div key={severity} className="bg-surface-1 rounded-lg border border-default overflow-hidden">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(severity)}
              className="w-full flex items-center justify-between p-4 hover:bg-surface-2/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${config.bgColor}`}>
                  <Icon className={`w-4 h-4 ${config.color}`} />
                </div>
                <div className="text-left">
                  <p className="text-textPrimary font-medium text-sm">
                    {config.label} ({flags.length})
                  </p>
                  <p className="text-textTertiary text-xs">{config.description}</p>
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-textTertiary" />
              ) : (
                <ChevronDown className="w-4 h-4 text-textTertiary" />
              )}
            </button>

            {/* Activity List */}
            {isExpanded && (
              <div className="border-t border-default divide-y divide-default">
                {flags.map(flag => {
                  const isExcluded = excluded.has(flag.workoutId);
                  const isKept = kept.has(flag.workoutId);
                  const isProcessing = excluding.has(flag.workoutId);
                  const resolved = isExcluded || isKept;

                  return (
                    <div
                      key={flag.workoutId}
                      className={`p-4 transition-colors ${resolved ? 'opacity-60' : ''}`}
                    >
                      {/* Activity Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} ${config.color} font-medium`}>
                              {REASON_LABELS[flag.reason]}
                            </span>
                            {isExcluded && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">
                                Excluded
                              </span>
                            )}
                            {isKept && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 font-medium">
                                Kept
                              </span>
                            )}
                          </div>
                          <p className="text-textPrimary text-sm font-medium truncate">
                            {flag.name || formatDateLabel(flag.date)}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-textTertiary">
                            <span>{formatDateLabel(flag.date)}</span>
                            <span>{formatDistance(flag.distanceMiles ?? 0)} mi</span>
                            <span>{formatDurationLabel(flag.durationMinutes)}</span>
                            <span>{formatPace(flag.paceSeconds)}/mi</span>
                          </div>
                          <p className="text-textSecondary text-xs mt-2 leading-relaxed">
                            {flag.recommendation}
                          </p>
                        </div>

                        {/* Action Buttons */}
                        {!resolved && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleKeep(flag)}
                              disabled={isProcessing}
                              className="p-2 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20
                                         transition-colors disabled:opacity-50"
                              title="Keep this activity"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleExclude(flag)}
                              disabled={isProcessing}
                              className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20
                                         transition-colors disabled:opacity-50"
                              title="Exclude this activity"
                            >
                              {isProcessing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        )}

                        {/* Undo for resolved */}
                        {resolved && (
                          <button
                            onClick={() => {
                              if (isExcluded) handleKeep(flag);
                              else {
                                setKept(prev => {
                                  const next = new Set(prev);
                                  next.delete(flag.workoutId);
                                  return next;
                                });
                              }
                            }}
                            disabled={isProcessing}
                            className="text-xs text-textTertiary hover:text-textSecondary transition-colors
                                       disabled:opacity-50"
                          >
                            Undo
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Continue Button */}
      <div className="pt-2">
        <button
          onClick={() => router.push('/history')}
          className="w-full btn-primary py-3 text-center font-medium"
        >
          {isAllClean
            ? 'Looks Good, Continue'
            : unresolvedCount > 0
              ? `Continue with ${unresolvedCount} Unresolved`
              : 'All Done, Continue'}
        </button>
        {unresolvedCount > 0 && !isAllClean && (
          <p className="text-textTertiary text-xs text-center mt-2">
            You can always come back to review flagged activities later
          </p>
        )}
      </div>
    </div>
  );
}

// ── Local Helpers ──────────────────────────────────────────────────────

function formatDateLabel(dateString: string): string {
  try {
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function formatDurationLabel(minutes: number | null): string {
  if (!minutes) return '0m';
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }
  return `${minutes}m`;
}
