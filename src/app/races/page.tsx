'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  getRaces,
  getRaceResults,
  createRace,
  createRaceResult,
  deleteRace,
  deleteRaceResult,
  getUserPaceZones,
} from '@/actions/races';
import { getDaysUntilRace, formatRaceTime, parseRaceTimeWithDistance, getTimeInputPlaceholder, getTimeInputExample } from '@/lib/race-utils';
import { RACE_DISTANCES, formatPace, getDistanceLabel } from '@/lib/training';
import { cn } from '@/lib/utils';
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
  Zap,
} from 'lucide-react';
import { useDemoMode } from '@/components/DemoModeProvider';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';
import { getDemoRaces, addDemoRace, getDemoRaceResults, type DemoRace } from '@/lib/demo-actions';
import { getDemoSettings } from '@/lib/demo-mode';
import { useProfile } from '@/lib/profile-context';
import type { Race, RaceResult, RacePriority } from '@/lib/schema';
import type { PaceZones } from '@/lib/training';

export default function RacesPage() {
  const { isDemo, settings: demoSettings } = useDemoMode();
  const { activeProfile } = useProfile();
  const { showToast } = useToast();
  const [races, setRaces] = useState<Race[]>([]);
  const [raceResults, setRaceResults] = useState<RaceResult[]>([]);
  const [paceZones, setPaceZones] = useState<PaceZones | null>(null);
  const [showAddRace, setShowAddRace] = useState(false);
  const [showAddResult, setShowAddResult] = useState(false);
  const [showPastResults, setShowPastResults] = useState(false);
  const [, startTransition] = useTransition();

  // Confirmation modal state
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'race' | 'result'; id: number } | null>(null);

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
  }, [isDemo, demoSettings]);

  const loadData = async () => {
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
        createdAt: new Date().toISOString(),
      })) as RaceResult[]);

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
      const [racesData, resultsData, zones] = await Promise.all([
        getRaces(profileId),
        getRaceResults(profileId),
        getUserPaceZones(),
      ]);
      setRaces(racesData);
      setRaceResults(resultsData);
      setPaceZones(zones);
    }
  };

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

  // Filter races into upcoming
  const today = new Date().toISOString().split('T')[0];
  const upcomingRaces = races.filter(r => r.date >= today);

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
        <h1 className="text-2xl font-display font-semibold text-slate-900">Races</h1>
        <div className="flex gap-2">
          {!isDemo && (
            <button
              onClick={() => setShowAddResult(true)}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-green-600 text-white rounded-xl hover:bg-green-700"
            >
              <Trophy className="w-4 h-4" />
              Log Result
            </button>
          )}
          <button
            onClick={() => setShowAddRace(true)}
            className="flex items-center gap-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Race
          </button>
        </div>
      </div>

      {/* Current VDOT */}
      {paceZones && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-slate-900">Current Fitness</span>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-3xl font-bold text-blue-600">{paceZones.vdot}</p>
              <p className="text-sm text-slate-500">VDOT</p>
            </div>
            <div className="h-12 w-px bg-blue-200" />
            <div className="flex gap-4 text-sm">
              <div>
                <p className="text-slate-500">Easy</p>
                <p className="font-medium">{formatPace(paceZones.easy)}</p>
              </div>
              <div>
                <p className="text-slate-500">Marathon</p>
                <p className="font-medium">{formatPace(paceZones.marathon)}</p>
              </div>
              <div>
                <p className="text-slate-500">Threshold</p>
                <p className="font-medium">{formatPace(paceZones.threshold)}</p>
              </div>
              <div>
                <p className="text-slate-500">Interval</p>
                <p className="font-medium">{formatPace(paceZones.interval)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Races */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Flag className="w-5 h-5 text-orange-500" />
          Upcoming Races
        </h2>

        {upcomingRaces.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
            <p className="text-slate-500">No upcoming races scheduled.</p>
            <button
              onClick={() => setShowAddRace(true)}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
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
                onDelete={() => handleDeleteRace(race.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Race Results - Only show in non-demo mode */}
      {!isDemo && (
        <div>
          <button
            onClick={() => setShowPastResults(!showPastResults)}
            className="flex items-center gap-2 text-lg font-semibold text-slate-900 mb-3 hover:text-slate-700"
          >
            <Trophy className="w-5 h-5 text-yellow-500" />
            Race Results ({raceResults.length})
            {showPastResults ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>

          {showPastResults && (
            <div className="space-y-3">
              {raceResults.length === 0 ? (
                <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
                  <p className="text-slate-500">No race results logged yet.</p>
                  <button
                    onClick={() => setShowAddResult(true)}
                    className="mt-2 text-green-600 hover:text-green-700 text-sm font-medium"
                  >
                    Log your first result
                  </button>
                </div>
              ) : (
                raceResults.map((result) => (
                  <RaceResultCard
                    key={result.id}
                    result={result}
                    onDelete={() => handleDeleteResult(result.id)}
                  />
                ))
              )}
            </div>
          )}
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
              await createRace(data);
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
            await createRaceResult(data);
            await loadData();
            setShowAddResult(false);
          }}
        />
      )}

      {isDemo && (
        <p className="text-center text-sm text-slate-400 mt-6">
          Demo Mode - Data stored locally in your browser
        </p>
      )}
    </div>
  );
}

// ==================== Race Card ====================

function RaceCard({ race, onDelete }: { race: Race; onDelete: () => void }) {
  const daysUntil = getDaysUntilRace(race.date);
  const weeksUntil = Math.ceil(daysUntil / 7);

  const priorityColors: Record<string, string> = {
    A: 'bg-red-100 text-red-700 border-red-200',
    B: 'bg-orange-100 text-orange-700 border-orange-200',
    C: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900">{race.name}</h3>
            <span
              className={cn(
                'px-2 py-0.5 text-xs font-medium rounded border',
                priorityColors[race.priority]
              )}
            >
              {race.priority} Race
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(race.date).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
            <span className="font-medium text-slate-900">{getDistanceLabel(race.distanceLabel)}</span>
            {race.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {race.location}
              </span>
            )}
          </div>

          {race.targetTimeSeconds && (
            <div className="mt-2 flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-blue-600">
                <Target className="w-4 h-4" />
                Goal: {formatRaceTime(race.targetTimeSeconds)}
              </span>
              {race.targetPaceSecondsPerMile && (
                <span className="text-slate-500">
                  ({formatPace(race.targetPaceSecondsPerMile)} /mi)
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600">{daysUntil}</p>
            <p className="text-xs text-slate-500">days ({weeksUntil} weeks)</p>
          </div>
          <button
            onClick={onDelete}
            className="p-1 text-slate-400 hover:text-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Race Result Card ====================

function RaceResultCard({
  result,
  onDelete,
}: {
  result: RaceResult;
  onDelete: () => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {result.raceName && (
              <h3 className="font-semibold text-slate-900">{result.raceName}</h3>
            )}
            <span className="px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 text-yellow-700 border border-yellow-200">
              {getDistanceLabel(result.distanceLabel)}
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(result.date).toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1 font-medium text-slate-900">
              <Clock className="w-4 h-4" />
              {formatRaceTime(result.finishTimeSeconds)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {result.calculatedVdot && (
            <div className="text-right">
              <p className="text-xl font-bold text-green-600">
                {result.calculatedVdot.toFixed(1)}
              </p>
              <p className="text-xs text-slate-500">VDOT</p>
            </div>
          )}
          <button
            onClick={onDelete}
            className="p-1 text-slate-400 hover:text-red-500"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
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
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Add Race</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Race Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., NYC Marathon"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Distance
              </label>
              <select
                value={distanceLabel}
                onChange={(e) => setDistanceLabel(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-slate-700 mb-1">
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
                        ? 'bg-red-500 text-white'
                        : p === 'B'
                        ? 'bg-orange-500 text-white'
                        : 'bg-slate-500 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  {p} Race
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              A = Goal race, B = Important, C = Tune-up
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Goal Time (optional)
              </label>
              <input
                type="text"
                value={targetTime}
                onChange={(e) => setTargetTime(e.target.value)}
                placeholder={getTimeInputPlaceholder(distanceLabel)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">
                {getTimeInputExample(distanceLabel)}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Location (optional)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City, State"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || !name || !date}
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
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
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">Log Race Result</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Race Name (optional)
            </label>
            <input
              type="text"
              value={raceName}
              onChange={(e) => setRaceName(e.target.value)}
              placeholder="e.g., Local 5K"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Distance
              </label>
              <select
                value={distanceLabel}
                onChange={(e) => setDistanceLabel(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
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
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Finish Time *
            </label>
            <input
              type="text"
              value={finishTime}
              onChange={(e) => setFinishTime(e.target.value)}
              placeholder={getTimeInputPlaceholder(distanceLabel)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              {getTimeInputExample(distanceLabel)}
            </p>
            {validationError && (
              <p className="text-xs text-red-600 mt-1">{validationError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
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
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  {level.replace('_', ' ')}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              VDOT calculation is most accurate for all-out efforts
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-slate-300 rounded-xl text-slate-700 hover:bg-slate-50"
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
