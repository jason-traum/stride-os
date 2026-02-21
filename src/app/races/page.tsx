'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import {
  getRaces,
  getRaceResultsWithContext,
  createRace,
  createRaceResult,
  updateRace,
  updateRaceResult,
  deleteRace,
  deleteRaceResult,
  getUserPaceZones,
  getWorkoutsForRaceLinking,
} from '@/actions/races';
import { getDaysUntilRace, formatRaceTime, parseRaceTimeWithDistance, getTimeInputPlaceholder, getTimeInputExample } from '@/lib/race-utils';
import { RACE_DISTANCES, getDistanceLabel } from '@/lib/training';
import { cn, parseLocalDate, formatPace } from '@/lib/utils';
import Link from 'next/link';
import {
  Flag,
  Plus,
  Trophy,
  Calendar,
  MapPin,
  Clock,
  Target,
  ChevronDown,
  ChevronUp,
  Trash2,
  Pencil,
  ExternalLink,
  Zap,
  Timer,
  Info,
  Activity,
  BarChart3,
  Shield,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';
import {
  getComprehensiveRacePredictions,
  type MultiSignalPrediction,
} from '@/actions/race-predictor';
import { RaceHistoryTimeline } from '@/components/RaceHistoryTimeline';
import { getBestEffortPRs, type BestEffortTimelineEntry } from '@/actions/personal-records';
import { useDemoMode } from '@/components/DemoModeProvider';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';
import { getDemoRaces, addDemoRace, getDemoRaceResults } from '@/lib/demo-actions';
import { getDemoSettings } from '@/lib/demo-mode';
import { useProfile } from '@/lib/profile-context';
import type { Race, RaceResult, RacePriority } from '@/lib/schema';
import type { PaceZones } from '@/lib/training';
import type { RaceResultWithContext } from '@/actions/races';

export default function RacesPage() {
  const { isDemo, settings: demoSettings } = useDemoMode();
  const { activeProfile } = useProfile();
  const { showToast } = useToast();
  const [races, setRaces] = useState<Race[]>([]);
  const [raceResults, setRaceResults] = useState<RaceResultWithContext[]>([]);
  const [paceZones, setPaceZones] = useState<PaceZones | null>(null);
  const [multiSignalPredictions, setMultiSignalPredictions] = useState<MultiSignalPrediction | null>(null);
  const [bestEfforts, setBestEfforts] = useState<BestEffortTimelineEntry[]>([]);
  const [showAddRace, setShowAddRace] = useState(false);
  const [showAddResult, setShowAddResult] = useState(false);
  const [, startTransition] = useTransition();

  // Edit modal state
  const [editingRace, setEditingRace] = useState<Race | null>(null);
  const [editingResult, setEditingResult] = useState<RaceResult | null>(null);

  // Confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'race' | 'result'; id: number } | null>(null);

  const loadData = useCallback(async () => {
    if (isDemo) {
      // Demo mode: Load from localStorage
      const demoRaces = getDemoRaces();
      const settings = getDemoSettings();

      // Convert DemoRace to Race type
      setRaces(demoRaces.map(r => ({
        id: r.id,
        name: r.name,
        date: r.date,
        distanceMeters: r.distanceMeters,
        distanceLabel: r.distanceLabel,
        priority: r.priority,
        targetTimeSeconds: r.targetTimeSeconds,
        trainingPlanGenerated: r.trainingPlanGenerated,
        targetPaceSecondsPerMile: null,
        location: null,
        notes: null,
        profileId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })) as Race[]);

      // Load demo race results
      const demoResults = getDemoRaceResults();
      setRaceResults(demoResults.map(r => ({
        id: r.id,
        date: r.date,
        distanceMeters: r.distanceMeters,
        distanceLabel: r.distanceLabel,
        finishTimeSeconds: r.finishTimeSeconds,
        raceName: r.raceName || null,
        effortLevel: r.effortLevel || null,
        conditions: r.conditions || null,
        notes: r.notes || null,
        calculatedVdot: r.vdotAtTime || null,
        profileId: null,
        workoutId: null,
        createdAt: new Date().toISOString(),
        effectiveEffortLevel: (r.effortLevel as 'all_out' | 'hard' | 'moderate' | 'easy') || 'all_out',
        linkedWorkout: null,
        normalization: {
          equivalentTimeSeconds: r.finishTimeSeconds,
          equivalentVdot: r.vdotAtTime || 0,
          weatherAdjustmentSecPerMile: 0,
          elevationAdjustmentSecPerMile: 0,
          effortMultiplier: 1,
          confidenceWeight: 1,
          confidence: 'high',
        },
      })) as RaceResultWithContext[]);

      // Build pace zones from demo settings if VDOT exists
      if (settings?.vdot && settings?.easyPaceSeconds) {
        const easy = settings.easyPaceSeconds;
        const threshold = settings.thresholdPaceSeconds || Math.round(easy * 0.82);
        const interval = settings.intervalPaceSeconds || Math.round(easy * 0.72);
        setPaceZones({
          vdot: settings.vdot,
          recovery: Math.round(easy * 1.1),
          easy: easy,
          generalAerobic: Math.round(easy * 0.95),
          marathon: settings.marathonPaceSeconds || Math.round(easy * 0.88),
          halfMarathon: settings.halfMarathonPaceSeconds || Math.round(easy * 0.85),
          tempo: settings.tempoPaceSeconds || Math.round(easy * 0.84),
          threshold: threshold,
          vo2max: Math.round(interval * 1.03),
          interval: interval,
          repetition: Math.round(interval * 0.95),
        });
      }
    } else {
      // Normal mode: Load from server
      const profileId = activeProfile?.id;
      const [racesData, resultsData, zones, comprehensivePredictions, effortsData] = await Promise.all([
        getRaces(profileId),
        getRaceResultsWithContext(profileId),
        getUserPaceZones(),
        getComprehensiveRacePredictions(profileId),
        getBestEffortPRs(profileId),
      ]);
      setRaces(racesData);
      setRaceResults(resultsData);
      setPaceZones(zones);
      setMultiSignalPredictions(comprehensivePredictions);
      setBestEfforts(effortsData);
    }
  }, [isDemo, activeProfile?.id]);

  useEffect(() => {
    loadData();

    // Listen for demo data changes from coach chat
    const handleDemoDataChange = () => {
      if (isDemo) {
        loadData();
      }
    };

    window.addEventListener('demo-data-changed', handleDemoDataChange);
    return () => {
      window.removeEventListener('demo-data-changed', handleDemoDataChange);
    };
  }, [isDemo, demoSettings, loadData]);

  const handleDeleteRace = (id: number) => {
    setDeleteConfirm({ type: 'race', id });
  };

  const handleDeleteResult = (id: number) => {
    setDeleteConfirm({ type: 'result', id });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;

    if (deleteConfirm.type === 'race') {
      if (isDemo) {
        // Demo mode: Remove from localStorage
        const demoRaces = getDemoRaces();
        const updatedRaces = demoRaces.filter(r => r.id !== deleteConfirm.id);
        localStorage.setItem('dreamy_demo_races', JSON.stringify(updatedRaces));
        loadData();
        showToast('Race deleted', 'info');
      } else {
        startTransition(async () => {
          await deleteRace(deleteConfirm.id);
          await loadData();
          showToast('Race deleted', 'info');
        });
      }
    } else {
      startTransition(async () => {
        await deleteRaceResult(deleteConfirm.id);
        await loadData();
        showToast('Race result deleted', 'info');
      });
    }
    setDeleteConfirm(null);
  };

  // Filter races into upcoming (exclude past and completed)
  const today = new Date().toISOString().split('T')[0];
  const upcomingRaces = races.filter(r => r.date >= today && r.status !== 'completed');

  return (
    <div className="space-y-6">
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title={deleteConfirm?.type === 'race' ? 'Delete Race?' : 'Delete Race Result?'}
        message={deleteConfirm?.type === 'race'
          ? 'This will permanently delete this race and cannot be undone.'
          : 'This will permanently delete this race result and cannot be undone.'}
        confirmText="Delete"
        cancelText="Keep"
        variant="danger"
      />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-semibold text-primary">Racing</h1>
        <div className="flex gap-2">
          {!isDemo && (
            <button
              onClick={() => setShowAddResult(true)}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700 font-medium transition-all shadow-sm"
            >
              <Trophy className="w-4 h-4" />
              Log Result
            </button>
          )}
          <button
            onClick={() => setShowAddRace(true)}
            className="btn-primary flex items-center gap-1 text-sm rounded-xl"
          >
            <Plus className="w-4 h-4" />
            Add Race
          </button>
        </div>
      </div>

      {/* Current VDOT */}
      {paceZones && (
        <div className="bg-gradient-to-r from-surface-2 to-surface-2 rounded-xl p-4 border border-default">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-dream-600" />
            <span className="font-medium text-primary">Current Fitness</span>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-3xl font-bold text-dream-600">{paceZones.vdot}</p>
              <p className="text-sm text-textTertiary">VDOT</p>
            </div>
            <div className="h-12 w-px bg-surface-2" />
            <div className="flex gap-4 text-sm">
              <div>
                <p className="text-textTertiary">Easy</p>
                <p className="font-medium">{formatPace(paceZones.easy)}</p>
              </div>
              <div>
                <p className="text-textTertiary">Marathon</p>
                <p className="font-medium">{formatPace(paceZones.marathon)}</p>
              </div>
              <div>
                <p className="text-textTertiary">Threshold</p>
                <p className="font-medium">{formatPace(paceZones.threshold)}</p>
              </div>
              <div>
                <p className="text-textTertiary">Interval</p>
                <p className="font-medium">{formatPace(paceZones.interval)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Race Predictions */}
      {multiSignalPredictions && !isDemo ? (
        <MultiSignalPredictionsSection predictions={multiSignalPredictions} upcomingRaces={upcomingRaces} />
      ) : !isDemo ? (
        <Link
          href="/analytics/racing"
          className="block bg-surface-1 rounded-xl border border-default p-4 shadow-sm hover:border-dream-400 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-dream-500" />
              <span className="font-semibold text-primary">Race Predictions</span>
            </div>
            <ArrowRight className="w-4 h-4 text-dream-500" />
          </div>
          <p className="text-sm text-textTertiary mt-1">
            View your predicted race times based on multi-signal analysis
          </p>
        </Link>
      ) : null}

      {/* Upcoming Races */}
      <div>
        <h2 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
          <Flag className="w-5 h-5 text-rose-500" />
          Upcoming Races
        </h2>

        {upcomingRaces.length === 0 ? (
          <div className="bg-surface-1 rounded-xl border border-default p-6 text-center">
            <p className="text-textTertiary">No upcoming races scheduled.</p>
            <button
              onClick={() => setShowAddRace(true)}
              className="link-primary mt-2 text-sm"
            >
              Add your first race
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingRaces.map((race) => (
              <RaceCard
                key={race.id}
                race={race}
                onEdit={() => setEditingRace(race)}
                onDelete={() => handleDeleteRace(race.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Race History Timeline - Always visible in non-demo mode */}
      {!isDemo && (
        <div>
          <h2 className="text-lg font-semibold text-primary mb-3 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-secondary" />
            Best Times
            {(raceResults.length > 0 || bestEfforts.length > 0) && (
              <span className="text-sm font-normal text-textTertiary">({raceResults.length} race{raceResults.length !== 1 ? 's' : ''}{bestEfforts.length > 0 ? ` + workout PRs` : ''})</span>
            )}
          </h2>
          <RaceHistoryTimeline
            results={raceResults}
            bestEfforts={bestEfforts}
            onEditResult={(result) => setEditingResult(result)}
            onDeleteResult={(id) => handleDeleteResult(id)}
          />
        </div>
      )}

      {/* Add Race Modal */}
      {showAddRace && (
        <AddRaceModal
          onClose={() => setShowAddRace(false)}
          onSave={async (data) => {
            if (isDemo) {
              // Demo mode: Save to localStorage
              const distanceInfo = RACE_DISTANCES[data.distanceLabel];
              addDemoRace({
                name: data.name,
                date: data.date,
                distanceMeters: distanceInfo?.meters || 21097, // Default to half marathon
                distanceLabel: data.distanceLabel,
                priority: data.priority,
                targetTimeSeconds: data.targetTimeSeconds || null,
                trainingPlanGenerated: false,
              });
              await loadData();
              setShowAddRace(false);
            } else {
              await createRace({ ...data, profileId: activeProfile?.id });
              await loadData();
              setShowAddRace(false);
            }
          }}
        />
      )}

      {/* Add Race Result Modal */}
      {showAddResult && !isDemo && (
        <AddRaceResultModal
          onClose={() => setShowAddResult(false)}
          onSave={async (data) => {
            const result = await createRaceResult({ ...data, profileId: activeProfile?.id });
            await loadData();
            setShowAddResult(false);
            if (result?.calculatedVdot) {
              showToast(`Race logged — VDOT ${result.calculatedVdot}`, 'success');
            }
          }}
        />
      )}

      {/* Edit Race Modal */}
      {editingRace && (
        <EditRaceModal
          race={editingRace}
          onClose={() => setEditingRace(null)}
          onSave={async (data) => {
            await updateRace(editingRace.id, data);
            await loadData();
            setEditingRace(null);
            showToast('Race updated', 'success');
          }}
        />
      )}

      {/* Edit Race Result Modal */}
      {editingResult && !isDemo && (
        <EditRaceResultModal
          result={editingResult}
          profileId={activeProfile?.id}
          onClose={() => setEditingResult(null)}
          onSave={async (data) => {
            const result = await updateRaceResult(editingResult.id, data);
            await loadData();
            setEditingResult(null);
            if (result?.calculatedVdot) {
              showToast(`Result updated — VDOT ${result.calculatedVdot}`, 'success');
            } else {
              showToast('Result updated', 'success');
            }
          }}
        />
      )}

      {isDemo && (
        <p className="text-center text-sm text-tertiary mt-6">
          Demo Mode - Data stored locally in your browser
        </p>
      )}
    </div>
  );
}

// ==================== Race Card ====================

function RaceCard({ race, onEdit, onDelete }: { race: Race; onEdit: () => void; onDelete: () => void }) {
  const daysUntil = getDaysUntilRace(race.date);
  const weeksUntil = Math.ceil(daysUntil / 7);

  const priorityColors: Record<string, string> = {
    A: 'bg-purple-900/40 text-purple-300 border-purple-800',
    B: 'bg-rose-900/30 text-rose-300 border-rose-800',
    C: 'bg-bgTertiary text-textSecondary border-borderPrimary',
  };

  return (
    <div className="bg-surface-1 rounded-xl border border-default p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-primary">{race.name}</h3>
            <span
              className={cn(
                'px-2 py-0.5 text-xs font-medium rounded border',
                priorityColors[race.priority]
              )}
            >
              {race.priority} Race
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-textSecondary">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {parseLocalDate(race.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className="font-medium text-primary">{getDistanceLabel(race.distanceLabel)}</span>
            {race.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {race.location}
              </span>
            )}
          </div>

          {race.targetTimeSeconds && (
            <div className="mt-2 flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-dream-600">
                <Target className="w-4 h-4" />
                Goal: {formatRaceTime(race.targetTimeSeconds)}
              </span>
              {race.targetPaceSecondsPerMile && (
                <span className="text-textTertiary">
                  ({formatPace(race.targetPaceSecondsPerMile)} /mi)
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          {race.status === 'completed' ? (
            <div className="flex items-center gap-1.5 text-green-600">
              <CheckCircle className="w-5 h-5" />
              <span className="text-sm font-semibold">Completed</span>
            </div>
          ) : (
            <div className="text-right">
              <p className="text-2xl font-bold text-purple-400">{daysUntil} days</p>
              <p className="text-xs text-textTertiary">({weeksUntil} weeks)</p>
            </div>
          )}
          <div className="flex gap-1">
            <button
              onClick={onEdit}
              className="p-1 text-tertiary hover:text-dream-500"
              title="Edit race"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 text-tertiary hover:text-red-500"
              title="Delete race"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== Race Result Card ====================

function RaceResultCard({
  result,
  onEdit,
  onDelete,
}: {
  result: RaceResultWithContext;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Calculate pace per mile from finish time and distance
  const distanceInfo = RACE_DISTANCES[result.distanceLabel];
  const miles = distanceInfo ? distanceInfo.meters / 1609.34 : null;
  const paceSeconds = miles && miles > 0 ? Math.round(result.finishTimeSeconds / miles) : null;

  const equivalent = result.normalization;
  const hasEquivalentDelta = Math.abs(equivalent.equivalentTimeSeconds - result.finishTimeSeconds) >= 5;
  const confidencePill =
    equivalent.confidence === 'high'
      ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/25'
      : equivalent.confidence === 'medium'
        ? 'bg-amber-500/15 text-amber-600 border-amber-500/25'
        : 'bg-surface-2 text-textTertiary border-borderSecondary';

  return (
    <div className="bg-surface-1 rounded-xl border border-default p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {result.raceName && (
              <h3 className="font-semibold text-primary">{result.raceName}</h3>
            )}
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-surface-2 text-primary border border-default">
              {getDistanceLabel(result.distanceLabel)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-textSecondary">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {parseLocalDate(result.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className="flex items-center gap-1 font-medium text-primary">
              <Clock className="w-4 h-4" />
              {formatRaceTime(result.finishTimeSeconds)}
            </span>
            {paceSeconds && (
              <span className="text-textTertiary">
                ({formatPace(paceSeconds)} /mi)
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={cn('px-2 py-0.5 rounded-full border font-medium', confidencePill)}>
              Signal weight {Math.round(equivalent.confidenceWeight * 100)}%
            </span>
            <span className="px-2 py-0.5 rounded-full border border-borderSecondary bg-surface-2 text-textSecondary">
              Effort: {result.effectiveEffortLevel.replace('_', ' ')}
            </span>
            {result.linkedWorkout?.weatherTempF != null && (
              <span className="text-textTertiary">
                {result.linkedWorkout.weatherTempF}°F
              </span>
            )}
            {result.linkedWorkout?.elevationGainFt != null && result.linkedWorkout.elevationGainFt > 0 && (
              <span className="text-textTertiary">
                +{Math.round(result.linkedWorkout.elevationGainFt)} ft
              </span>
            )}
          </div>

          {hasEquivalentDelta && (
            <p className="mt-1.5 text-xs text-textSecondary">
              Equivalent flat/ideal: <span className="font-mono text-primary">{formatRaceTime(equivalent.equivalentTimeSeconds)}</span>
              {' '}({equivalent.equivalentVdot.toFixed(1)} VDOT)
            </p>
          )}

          {/* Linked workout */}
          {result.workoutId && (
            <div className="mt-1">
              <Link
                href={`/workout/${result.workoutId}`}
                className="inline-flex items-center gap-1 text-xs text-dream-500 hover:text-dream-600 font-medium"
              >
                <ExternalLink className="w-3 h-3" />
                View workout
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {result.calculatedVdot && (
            <div className="text-right">
              <p className="text-xl font-bold text-green-600">
                {result.calculatedVdot.toFixed(1)}
              </p>
              <p className="text-xs text-textTertiary">VDOT</p>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <button
              onClick={onEdit}
              className="p-1 text-tertiary hover:text-dream-500"
              title="Edit result"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1 text-tertiary hover:text-red-500"
              title="Delete result"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== Multi-Signal Race Predictions ====================

function MultiSignalPredictionsSection({
  predictions,
  upcomingRaces,
}: {
  predictions: MultiSignalPrediction;
  upcomingRaces: Race[];
}) {
  const [showSignals, setShowSignals] = useState(false);
  const aRace = upcomingRaces.find(r => r.priority === 'A');

  const confidenceColor =
    predictions.confidence === 'high' ? 'bg-green-100 text-green-700'
      : predictions.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700'
        : 'bg-gray-100 text-gray-600';

  const agreementColor =
    predictions.agreementScore >= 0.7 ? 'text-green-600'
      : predictions.agreementScore >= 0.4 ? 'text-yellow-600'
        : 'text-red-500';

  return (
    <div className="bg-surface-1 rounded-xl border border-default p-4 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
          <Timer className="w-5 h-5 text-dream-500" />
          Race Predictions
        </h2>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1 text-sm font-medium ${agreementColor}`}>
            <Shield className="w-4 h-4" />
            {Math.round(predictions.agreementScore * 100)}% agreement
          </span>
          <span className={cn('px-2 py-0.5 text-xs font-medium rounded', confidenceColor)}>
            {predictions.confidence} confidence
          </span>
        </div>
      </div>

      {/* VDOT + Form */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-dream-600" />
          <span className="font-bold text-dream-600 text-lg">{predictions.vdot}</span>
          <span className="text-textTertiary">VDOT</span>
          <span className="text-textTertiary">({predictions.vdotRange.low}–{predictions.vdotRange.high})</span>
        </div>
        {predictions.formAdjustmentPct !== 0 && (
          <span className={cn(
            'text-xs px-2 py-0.5 rounded',
            predictions.formAdjustmentPct < 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          )}>
            {predictions.formDescription}
          </span>
        )}
      </div>

      {/* Predictions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {predictions.predictions.map((pred) => {
          const isARaceDistance = aRace && aRace.distanceLabel === pred.distance.toLowerCase().replace(' ', '_');
          const goalDiff = isARaceDistance && aRace.targetTimeSeconds
            ? pred.predictedSeconds - aRace.targetTimeSeconds
            : null;

          return (
            <div
              key={pred.distance}
              className={cn(
                'p-3 rounded-lg border',
                isARaceDistance
                  ? 'border-dream-400 bg-dream-100/40 dark:bg-dream-900/20'
                  : 'border-borderSecondary bg-surface-2'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-textTertiary font-medium">{pred.distance}</p>
                {pred.readiness < 0.7 && (
                  <span className="text-xs text-amber-500" title={`Readiness: ${Math.round(pred.readiness * 100)}%`}>
                    !
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-primary font-mono">
                {formatRaceTime(pred.predictedSeconds)}
              </p>
              <p className="text-xs text-textTertiary mb-1">
                {formatPace(pred.pacePerMile)}/mi
              </p>
              {/* Confidence range */}
              <p className="text-xs text-textTertiary">
                {formatRaceTime(pred.range.fast)} — {formatRaceTime(pred.range.slow)}
              </p>
              {/* Readiness bar */}
              <div className="mt-1.5 h-1 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    pred.readiness >= 0.7 ? 'bg-green-500'
                      : pred.readiness >= 0.5 ? 'bg-yellow-500'
                        : 'bg-red-400'
                  )}
                  style={{ width: `${Math.round(pred.readiness * 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-textTertiary mt-0.5">
                {Math.round(pred.readiness * 100)}% ready
              </p>
              {isARaceDistance && aRace.targetTimeSeconds && goalDiff !== null && (
                <p className={cn(
                  'text-xs font-medium mt-1',
                  goalDiff <= 0 ? 'text-green-600' : 'text-rose-500'
                )}>
                  {goalDiff <= 0
                    ? `${formatRaceTime(Math.abs(goalDiff))} under goal`
                    : `${formatRaceTime(goalDiff)} over goal`
                  }
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Signal Breakdown Toggle */}
      <div>
        <button
          onClick={() => setShowSignals(!showSignals)}
          className="flex items-center gap-1.5 text-sm text-secondary hover:text-primary transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          {showSignals ? 'Hide' : 'Show'} signal breakdown
          {showSignals ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {showSignals && (
          <div className="mt-3 space-y-2">
            {/* Agreement details */}
            <p className="text-xs text-textTertiary italic">{predictions.agreementDetails}</p>

            {/* Signal cards */}
            {predictions.signals.map((signal, i) => (
              <div key={i} className="bg-surface-2 rounded-lg p-3 border border-borderSecondary">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-primary">{signal.name}</span>
                  <div className="flex items-center gap-2">
                    {signal.name === 'Efficiency Factor Trend' ? (
                      <span className={cn(
                        'text-sm font-mono font-bold',
                        signal.estimatedVdot > 0 ? 'text-green-600' : signal.estimatedVdot < 0 ? 'text-red-500' : 'text-textTertiary'
                      )}>
                        {signal.estimatedVdot > 0 ? '+' : ''}{signal.estimatedVdot.toFixed(1)} VDOT
                      </span>
                    ) : (
                      <span className="text-sm font-mono font-bold text-primary">
                        {signal.estimatedVdot.toFixed(1)} VDOT
                      </span>
                    )}
                    <span className="text-xs text-textTertiary">
                      w={signal.weight.toFixed(2)} c={signal.confidence.toFixed(2)}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-textTertiary">{signal.description}</p>
                {/* Confidence bar */}
                <div className="mt-1.5 h-1 bg-bgTertiary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-dream-500 rounded-full"
                    style={{ width: `${Math.round(signal.confidence * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer methodology + link */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-textTertiary">
          Based on {predictions.dataQuality.signalsUsed} signal{predictions.dataQuality.signalsUsed !== 1 ? 's' : ''} from {predictions.dataQuality.workoutsUsed} workouts
          {predictions.dataQuality.hasHr && ' with HR'}
          {predictions.dataQuality.hasRaces && ' + races'}
          {' '}&middot; VDOT {predictions.vdot}
        </p>
        <Link
          href="/analytics/racing"
          className="flex items-center gap-1 text-xs text-dream-500 hover:text-dream-600 font-medium transition-colors flex-shrink-0"
        >
          Detailed analysis
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}


// ==================== Add Race Modal ====================

function AddRaceModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: {
    name: string;
    date: string;
    distanceLabel: string;
    priority: RacePriority;
    targetTimeSeconds?: number;
    location?: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [distanceLabel, setDistanceLabel] = useState('half_marathon');
  const [priority, setPriority] = useState<RacePriority>('A');
  const [targetTime, setTargetTime] = useState('');
  const [location, setLocation] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !date) return;

    startTransition(async () => {
      await onSave({
        name,
        date,
        distanceLabel,
        priority,
        targetTimeSeconds: targetTime ? parseRaceTimeWithDistance(targetTime, distanceLabel) : undefined,
        location: location || undefined,
      });
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-1 rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-primary mb-4">Add Race</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Race Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., NYC Marathon"
              className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Distance
              </label>
              <select
                value={distanceLabel}
                onChange={(e) => setDistanceLabel(e.target.value)}
                className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
              >
                {Object.entries(RACE_DISTANCES).map(([key, dist]) => (
                  <option key={key} value={key}>
                    {dist.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Priority
            </label>
            <div className="flex gap-2">
              {(['A', 'B', 'C'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    'flex-1 py-2 px-4 rounded-xl font-medium transition-colors',
                    priority === p
                      ? p === 'A'
                        ? 'bg-purple-600 text-white'
                        : p === 'B'
                        ? 'bg-rose-500 text-white'
                        : 'bg-gray-500 text-white'
                      : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                  )}
                >
                  {p} Race
                </button>
              ))}
            </div>
            <p className="text-xs text-textTertiary mt-1">
              A = Goal race, B = Important, C = Tune-up
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Goal Time (optional)
              </label>
              <input
                type="text"
                value={targetTime}
                onChange={(e) => setTargetTime(e.target.value)}
                placeholder={getTimeInputPlaceholder(distanceLabel)}
                className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
              />
              <p className="text-xs text-textTertiary mt-1">
                {getTimeInputExample(distanceLabel)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Location (optional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State"
                className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-strong rounded-xl text-secondary hover:bg-bgTertiary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name || !date}
              className="flex-1 py-2 px-4 bg-dream-600 text-white rounded-xl hover:bg-dream-700 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Add Race'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== Add Race Result Modal ====================

function AddRaceResultModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: {
    raceName?: string;
    date: string;
    distanceLabel: string;
    finishTimeSeconds: number;
    effortLevel?: 'all_out' | 'hard' | 'moderate' | 'easy';
    workoutId?: number | null;
  }) => Promise<void>;
}) {
  const [raceName, setRaceName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [distanceLabel, setDistanceLabel] = useState('5K');
  const [finishTime, setFinishTime] = useState('');
  const [effortLevel, setEffortLevel] = useState<'all_out' | 'hard' | 'moderate' | 'easy'>('all_out');
  const [isPending, startTransition] = useTransition();
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (!date || !finishTime) return;

    const finishTimeSeconds = parseRaceTimeWithDistance(finishTime, distanceLabel);
    if (finishTimeSeconds <= 0) {
      setValidationError('Please enter a valid finish time (e.g., 25:30 for 5K)');
      return;
    }

    startTransition(async () => {
      await onSave({
        raceName: raceName || undefined,
        date,
        distanceLabel,
        finishTimeSeconds,
        effortLevel,
      });
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-1 rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-primary mb-4">Log Race Result</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Race Name (optional)
            </label>
            <input
              type="text"
              value={raceName}
              onChange={(e) => setRaceName(e.target.value)}
              placeholder="e.g., Local 5K"
              className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Distance
              </label>
              <select
                value={distanceLabel}
                onChange={(e) => setDistanceLabel(e.target.value)}
                className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
              >
                {Object.entries(RACE_DISTANCES).map(([key, dist]) => (
                  <option key={key} value={key}>
                    {dist.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Finish Time *
            </label>
            <input
              type="text"
              value={finishTime}
              onChange={(e) => setFinishTime(e.target.value)}
              placeholder={getTimeInputPlaceholder(distanceLabel)}
              className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
              required
            />
            <p className="text-xs text-textTertiary mt-1">
              {getTimeInputExample(distanceLabel)}
            </p>
            {validationError && (
              <p className="text-xs text-red-600 mt-1">{validationError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Effort Level
            </label>
            <div className="flex gap-2">
              {(['all_out', 'hard', 'moderate', 'easy'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setEffortLevel(level)}
                  className={cn(
                    'flex-1 py-2 px-2 rounded-xl text-sm font-medium transition-colors capitalize',
                    effortLevel === level
                      ? 'bg-green-600 text-white'
                      : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                  )}
                >
                  {level.replace('_', ' ')}
                </button>
              ))}
            </div>
            <p className="text-xs text-textTertiary mt-1">
              VDOT calculation is most accurate for all-out efforts
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-strong rounded-xl text-secondary hover:bg-bgTertiary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !date || !finishTime}
              className="flex-1 py-2 px-4 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Log Result'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== Edit Race Modal ====================

function EditRaceModal({
  race,
  onClose,
  onSave,
}: {
  race: Race;
  onClose: () => void;
  onSave: (data: {
    name?: string;
    date?: string;
    distanceLabel?: string;
    priority?: RacePriority;
    targetTimeSeconds?: number | null;
    location?: string | null;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(race.name);
  const [date, setDate] = useState(race.date);
  const [distanceLabel, setDistanceLabel] = useState(race.distanceLabel);
  const [priority, setPriority] = useState<RacePriority>(race.priority);
  const [targetTime, setTargetTime] = useState(
    race.targetTimeSeconds ? formatRaceTime(race.targetTimeSeconds) : ''
  );
  const [location, setLocation] = useState(race.location || '');
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !date) return;

    startTransition(async () => {
      await onSave({
        name,
        date,
        distanceLabel,
        priority,
        targetTimeSeconds: targetTime ? parseRaceTimeWithDistance(targetTime, distanceLabel) : null,
        location: location || null,
      });
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-1 rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-primary mb-4">Edit Race</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Race Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., NYC Marathon"
              className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Distance
              </label>
              <select
                value={distanceLabel}
                onChange={(e) => setDistanceLabel(e.target.value)}
                className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
              >
                {Object.entries(RACE_DISTANCES).map(([key, dist]) => (
                  <option key={key} value={key}>
                    {dist.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Priority
            </label>
            <div className="flex gap-2">
              {(['A', 'B', 'C'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={cn(
                    'flex-1 py-2 px-4 rounded-xl font-medium transition-colors',
                    priority === p
                      ? p === 'A'
                        ? 'bg-purple-600 text-white'
                        : p === 'B'
                        ? 'bg-rose-500 text-white'
                        : 'bg-gray-500 text-white'
                      : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                  )}
                >
                  {p} Race
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Goal Time (optional)
              </label>
              <input
                type="text"
                value={targetTime}
                onChange={(e) => setTargetTime(e.target.value)}
                placeholder={getTimeInputPlaceholder(distanceLabel)}
                className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
              />
              <p className="text-xs text-textTertiary mt-1">
                {getTimeInputExample(distanceLabel)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Location (optional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State"
                className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-strong rounded-xl text-secondary hover:bg-bgTertiary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name || !date}
              className="flex-1 py-2 px-4 bg-dream-600 text-white rounded-xl hover:bg-dream-700 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== Edit Race Result Modal ====================

type LinkableWorkout = {
  id: number;
  date: string;
  distanceMiles: number | null;
  durationMinutes: number | null;
  stravaName: string | null;
  workoutType: string;
};

function EditRaceResultModal({
  result,
  profileId,
  onClose,
  onSave,
}: {
  result: RaceResult;
  profileId?: number;
  onClose: () => void;
  onSave: (data: {
    raceName?: string | null;
    date?: string;
    distanceLabel?: string;
    finishTimeSeconds?: number;
    effortLevel?: 'all_out' | 'hard' | 'moderate' | 'easy';
    workoutId?: number | null;
  }) => Promise<void>;
}) {
  const [raceName, setRaceName] = useState(result.raceName || '');
  const [date, setDate] = useState(result.date);
  const [distanceLabel, setDistanceLabel] = useState(result.distanceLabel);
  const [finishTime, setFinishTime] = useState(formatRaceTime(result.finishTimeSeconds));
  const [effortLevel, setEffortLevel] = useState<'all_out' | 'hard' | 'moderate' | 'easy'>(
    (result.effortLevel as 'all_out' | 'hard' | 'moderate' | 'easy') || 'all_out'
  );
  const [workoutId, setWorkoutId] = useState<number | null>(result.workoutId ?? null);
  const [nearbyWorkouts, setNearbyWorkouts] = useState<LinkableWorkout[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [validationError, setValidationError] = useState<string | null>(null);

  // Fetch nearby workouts when date changes
  useEffect(() => {
    if (!date) return;
    setLoadingWorkouts(true);
    getWorkoutsForRaceLinking(profileId, date)
      .then((w) => setNearbyWorkouts(w))
      .catch(() => setNearbyWorkouts([]))
      .finally(() => setLoadingWorkouts(false));
  }, [date, profileId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    if (!date || !finishTime) return;

    const finishTimeSeconds = parseRaceTimeWithDistance(finishTime, distanceLabel);
    if (finishTimeSeconds <= 0) {
      setValidationError('Please enter a valid finish time (e.g., 25:30 for 5K)');
      return;
    }

    startTransition(async () => {
      await onSave({
        raceName: raceName || null,
        date,
        distanceLabel,
        finishTimeSeconds,
        effortLevel,
        workoutId,
      });
    });
  };

  const formatWorkoutLabel = (w: LinkableWorkout) => {
    const parts: string[] = [];
    if (w.stravaName) parts.push(w.stravaName);
    parts.push(parseLocalDate(w.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    if (w.distanceMiles) parts.push(`${w.distanceMiles.toFixed(1)} mi`);
    if (w.workoutType === 'race') parts.push('[race]');
    return parts.join(' — ');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface-1 rounded-xl shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-semibold text-primary mb-4">Edit Race Result</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Race Name (optional)
            </label>
            <input
              type="text"
              value={raceName}
              onChange={(e) => setRaceName(e.target.value)}
              placeholder="e.g., Local 5K"
              className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Distance
              </label>
              <select
                value={distanceLabel}
                onChange={(e) => setDistanceLabel(e.target.value)}
                className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
              >
                {Object.entries(RACE_DISTANCES).map(([key, dist]) => (
                  <option key={key} value={key}>
                    {dist.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Finish Time *
            </label>
            <input
              type="text"
              value={finishTime}
              onChange={(e) => setFinishTime(e.target.value)}
              placeholder={getTimeInputPlaceholder(distanceLabel)}
              className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500"
              required
            />
            <p className="text-xs text-textTertiary mt-1">
              {getTimeInputExample(distanceLabel)}
            </p>
            {validationError && (
              <p className="text-xs text-red-600 mt-1">{validationError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Effort Level
            </label>
            <div className="flex gap-2">
              {(['all_out', 'hard', 'moderate', 'easy'] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setEffortLevel(level)}
                  className={cn(
                    'flex-1 py-2 px-2 rounded-xl text-sm font-medium transition-colors capitalize',
                    effortLevel === level
                      ? 'bg-green-600 text-white'
                      : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                  )}
                >
                  {level.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Link to workout */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Link to Workout (optional)
            </label>
            {loadingWorkouts ? (
              <p className="text-sm text-textTertiary">Loading nearby workouts...</p>
            ) : nearbyWorkouts.length === 0 ? (
              <p className="text-sm text-textTertiary">No workouts found within 7 days of this date</p>
            ) : (
              <select
                value={workoutId ?? ''}
                onChange={(e) => setWorkoutId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 text-sm"
              >
                <option value="">None</option>
                {nearbyWorkouts.map((w) => (
                  <option key={w.id} value={w.id}>
                    {formatWorkoutLabel(w)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-strong rounded-xl text-secondary hover:bg-bgTertiary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !date || !finishTime}
              className="flex-1 py-2 px-4 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
            >
              {isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
