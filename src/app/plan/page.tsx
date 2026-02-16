'use client';

import { useState, useEffect, useTransition } from 'react';
import { WeekView } from '@/components/plan/WeekView';
import { WorkoutModifyModal } from '@/components/plan/WorkoutModifyModal';
import {
  getTrainingPlan,
  getCurrentWeekPlan,
  updatePlannedWorkoutStatus,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  generatePlanForRace,
  scaleDownPlannedWorkout,
  swapPlannedWorkout,
  movePlannedWorkout,
  deletePlannedWorkout,
  getWorkoutAlternatives,
} from '@/actions/training-plan';
import { getUpcomingRaces } from '@/actions/races';
import { getSettings } from '@/actions/settings';
import { getDaysUntilRace } from '@/lib/race-utils';
import type { UserPaceSettings } from '@/components/plan/WorkoutCard';
import { getDistanceLabel } from '@/lib/training';
import { isDemoMode } from '@/lib/demo-mode';
import { useToast } from '@/components/Toast';
import {
  getDemoRaces,
  getDemoPlannedWorkouts,
  generateDemoTrainingPlan,
  updateDemoWorkoutStatus,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type DemoRace,
  type DemoPlannedWorkout,
} from '@/lib/demo-actions';
import {
  Flag,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { PlanImportModal } from '@/components/PlanImportModal';
import { PlanRequirementsModal } from '@/components/PlanRequirementsModal';
import { generatePlanSafely } from '@/actions/generate-plan-safe';
import { DreamySheep } from '@/components/DreamySheep';
import { AnimatedButton } from '@/components/AnimatedButton';

interface PlannedWorkout {
  id: number;
  date: string;
  name: string;
  description: string;
  workoutType: string;
  targetDistanceMiles: number | null;
  targetDurationMinutes: number | null;
  targetPaceSecondsPerMile: number | null;
  rationale: string | null;
  isKeyWorkout: boolean | null;
  status: 'scheduled' | 'completed' | 'skipped' | 'modified' | null;
  structure: string | null;
  alternatives: string | null;
}

interface TrainingBlock {
  id: number;
  weekNumber: number;
  phase: string;
  startDate: string;
  endDate: string;
  targetMileage: number | null;
  longRunTarget: number | null;
  qualitySessionsTarget: number | null;
  isDownWeek: boolean | null;
  focus: string | null;
}

interface Race {
  id: number;
  name: string;
  date: string;
  distanceLabel: string;
  trainingPlanGenerated: boolean | null;
  priority?: 'A' | 'B' | 'C';
}

export default function PlanPage() {
  const { showToast } = useToast();
  const [isDemo, setIsDemo] = useState(false);
  const [races, setRaces] = useState<Race[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState<number | null>(null);
  const [blocks, setBlocks] = useState<TrainingBlock[]>([]);
  const [workoutsByBlock, setWorkoutsByBlock] = useState<Record<number, PlannedWorkout[]>>({});
  const [currentWeekStart, setCurrentWeekStart] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [, startTransition] = useTransition();

  // Demo mode workouts (flat list, we'll group them by week)
  const [demoWorkouts, setDemoWorkouts] = useState<DemoPlannedWorkout[]>([]);

  // Modify modal state
  const [modifyModalOpen, setModifyModalOpen] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<PlannedWorkout | null>(null);
  const [workoutAlternatives, setWorkoutAlternatives] = useState<Array<{ id: string; name: string; description: string }>>([]);

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Plan requirements modal state
  const [requirementsModalOpen, setRequirementsModalOpen] = useState(false);
  const [missingRequirements, setMissingRequirements] = useState<Array<{field: string; label: string}>>([]);

  // User pace settings for workout display
  const [paceSettings, setPaceSettings] = useState<UserPaceSettings | undefined>(undefined);

  useEffect(() => {
    const demoMode = isDemoMode();
    setIsDemo(demoMode);
    if (demoMode) {
      loadDemoData();
    } else {
      loadData();
    }

    // Listen for demo data changes from coach chat
    const handleDemoDataChange = () => {
      if (isDemoMode()) {
        loadDemoData();
      }
    };

    window.addEventListener('demo-data-changed', handleDemoDataChange);
    return () => {
      window.removeEventListener('demo-data-changed', handleDemoDataChange);
    };
  }, []);

  useEffect(() => {
    if (selectedRaceId && !isDemo) {
      loadPlan(selectedRaceId);
    }
  }, [selectedRaceId, isDemo]);

  const loadDemoData = () => {
    setLoading(true);
    try {
      const demoRaces = getDemoRaces();
      const demoPlannedWorkouts = getDemoPlannedWorkouts();

      // Convert demo races to the expected format
      const convertedRaces: Race[] = demoRaces.map(r => ({
        id: r.id,
        name: r.name,
        date: r.date,
        distanceLabel: r.distanceLabel,
        trainingPlanGenerated: r.trainingPlanGenerated,
      }));

      setRaces(convertedRaces);
      setDemoWorkouts(demoPlannedWorkouts);

      // Get current week start
      const today = new Date();
      const dayOfWeek = today.getDay();
      const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(today);
      monday.setDate(diff);
      setCurrentWeekStart(monday.toISOString().split('T')[0]);

      // Auto-select first race with a plan, or first race
      const raceWithPlan = convertedRaces.find(r => r.trainingPlanGenerated);
      if (raceWithPlan) {
        setSelectedRaceId(raceWithPlan.id);
      } else if (convertedRaces.length > 0) {
        setSelectedRaceId(convertedRaces[0].id);
      }
    } catch (error) {
      console.error('Error loading demo data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [upcomingRaces, weekPlan, settings] = await Promise.all([
        getUpcomingRaces(),
        getCurrentWeekPlan(),
        getSettings(),
      ]);

      setRaces(upcomingRaces);
      setCurrentWeekStart(weekPlan.weekStart);

      // Set pace settings for workout display
      if (settings) {
        setPaceSettings({
          easyPaceSeconds: settings.easyPaceSeconds,
          marathonPaceSeconds: settings.marathonPaceSeconds,
          tempoPaceSeconds: settings.tempoPaceSeconds,
          thresholdPaceSeconds: settings.thresholdPaceSeconds,
          intervalPaceSeconds: settings.intervalPaceSeconds,
          vdot: settings.vdot,
        });
      }

      // Auto-select first race with a plan, or first race
      const raceWithPlan = upcomingRaces.find(r => r.trainingPlanGenerated);
      if (raceWithPlan) {
        setSelectedRaceId(raceWithPlan.id);
      } else if (upcomingRaces.length > 0) {
        setSelectedRaceId(upcomingRaces[0].id);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlan = async (raceId: number) => {
    try {
      const plan = await getTrainingPlan(raceId);
      if (plan) {
        setBlocks(plan.blocks);
        setWorkoutsByBlock(plan.workoutsByBlock);
      } else {
        setBlocks([]);
        setWorkoutsByBlock({});
      }
    } catch (error) {
      console.error('Error loading plan:', error);
    }
  };

  const handleGeneratePlan = async () => {
    if (!selectedRaceId) return;

    setGenerating(true);
    try {
      if (isDemo) {
        // Demo mode: generate locally
        const result = generateDemoTrainingPlan(selectedRaceId);
        if (result.success) {
          // Reload demo data
          loadDemoData();
          showToast('Training plan generated!', 'success');
        } else {
          showToast('Error generating plan. Please try again.', 'error');
        }
      } else {
        // Use safe plan generation that checks requirements
        const result = await generatePlanSafely(selectedRaceId);

        if (result.success) {
          await loadPlan(selectedRaceId);
          // Refresh races to update trainingPlanGenerated flag
          const updatedRaces = await getUpcomingRaces();
          setRaces(updatedRaces);
          showToast('Training plan generated!', 'success');
        } else {
          // Check if it's missing fields
          if (result.missingFields && result.missingFields.length > 0) {
            setMissingRequirements(
              result.missingFields.map(field => ({
                field: field.toLowerCase().replace(/\s+/g, '_'),
                label: field
              }))
            );
            setRequirementsModalOpen(true);
          } else {
            // Show the error message
            showToast(result.error || 'Error generating plan. Please try again.', 'error');
          }
        }
      }
    } catch (error) {
      console.error('Error generating plan:', error);
      showToast('Unexpected error generating plan. Please try again.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleWorkoutStatusChange = (workoutId: number, status: 'completed' | 'skipped') => {
    if (isDemo) {
      updateDemoWorkoutStatus(workoutId, status);
      setDemoWorkouts(getDemoPlannedWorkouts());
    } else {
      startTransition(async () => {
        await updatePlannedWorkoutStatus(workoutId, status);
        if (selectedRaceId) {
          await loadPlan(selectedRaceId);
        }
      });
    }
  };

  const handleOpenModifyModal = async (workout: PlannedWorkout) => {
    setSelectedWorkout(workout);
    setModifyModalOpen(true);

    // Load alternatives
    try {
      const result = await getWorkoutAlternatives(workout.id);
      setWorkoutAlternatives(
        result.alternatives
          .filter((alt): alt is NonNullable<typeof alt> => alt !== undefined)
          .map(alt => ({
            id: alt.id,
            name: alt.name,
            description: alt.description,
          }))
      );
    } catch (error) {
      console.error('Error loading alternatives:', error);
      setWorkoutAlternatives([]);
    }
  };

  const handleCloseModifyModal = () => {
    setModifyModalOpen(false);
    setSelectedWorkout(null);
    setWorkoutAlternatives([]);
  };

  const handleScaleDown = async (factor: number) => {
    if (!selectedWorkout) return;
    await scaleDownPlannedWorkout(selectedWorkout.id, factor);
    if (selectedRaceId) {
      await loadPlan(selectedRaceId);
    }
  };

  const handleSwap = async (alternativeId: string) => {
    if (!selectedWorkout) return;
    await swapPlannedWorkout(selectedWorkout.id, alternativeId);
    if (selectedRaceId) {
      await loadPlan(selectedRaceId);
    }
  };

  const handleMove = async (newDate: string) => {
    if (!selectedWorkout) return;
    await movePlannedWorkout(selectedWorkout.id, newDate);
    if (selectedRaceId) {
      await loadPlan(selectedRaceId);
    }
  };

  const handleDelete = async () => {
    if (!selectedWorkout) return;
    await deletePlannedWorkout(selectedWorkout.id);
    if (selectedRaceId) {
      await loadPlan(selectedRaceId);
    }
  };

  const handleMarkComplete = async () => {
    if (!selectedWorkout) return;
    await updatePlannedWorkoutStatus(selectedWorkout.id, 'completed');
    if (selectedRaceId) {
      await loadPlan(selectedRaceId);
    }
  };

  const handleSkip = async () => {
    if (!selectedWorkout) return;
    await updatePlannedWorkoutStatus(selectedWorkout.id, 'skipped');
    if (selectedRaceId) {
      await loadPlan(selectedRaceId);
    }
  };

  const selectedRace = races.find(r => r.id === selectedRaceId);

  // For demo mode, check if workouts exist; for regular mode, check blocks
  const hasPlan = isDemo ? demoWorkouts.length > 0 : blocks.length > 0;

  // Get today's date for comparing weeks
  const todayDate = new Date().toISOString().split('T')[0];

  // Group blocks into weeks with their workouts
  let weeks: Array<{
    weekNumber: number;
    startDate: string;
    endDate: string;
    phase: string;
    targetMileage: number;
    longRunTarget: number | null;
    qualitySessionsTarget: number | null;
    focus: string;
    isDownWeek: boolean;
    workouts: PlannedWorkout[];
    isCurrentWeek: boolean;
    isPastWeek: boolean;
    hasDetailedWorkouts: boolean;
  }> = [];

  if (isDemo && demoWorkouts.length > 0) {
    // Group demo workouts by week number
    const weekMap = new Map<number, DemoPlannedWorkout[]>();
    for (const workout of demoWorkouts) {
      const weekNum = workout.weekNumber || 1;
      if (!weekMap.has(weekNum)) {
        weekMap.set(weekNum, []);
      }
      weekMap.get(weekNum)!.push(workout);
    }

    // Convert to weeks array
    weeks = Array.from(weekMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekNum, workouts]) => {
        // Sort workouts by date
        workouts.sort((a, b) => a.date.localeCompare(b.date));

        const startDate = workouts[0]?.date || '';
        const endDate = workouts[workouts.length - 1]?.date || '';
        const phase = workouts[0]?.phase || 'base';
        const totalMiles = workouts.reduce((sum, w) => sum + (w.targetDistanceMiles || 0), 0);

        // Convert DemoPlannedWorkout to PlannedWorkout format
        const convertedWorkouts: PlannedWorkout[] = workouts.map(w => ({
          id: w.id,
          date: w.date,
          name: w.name,
          description: w.description,
          workoutType: w.workoutType,
          targetDistanceMiles: w.targetDistanceMiles,
          targetDurationMinutes: w.targetDurationMinutes || null,
          targetPaceSecondsPerMile: w.targetPaceSecondsPerMile || null,
          rationale: w.rationale || null,
          isKeyWorkout: w.isKeyWorkout,
          status: w.status as 'scheduled' | 'completed' | 'skipped' | 'modified' | null,
          structure: null,
          alternatives: null,
        }));

        const isCurrentWeek = startDate <= currentWeekStart && endDate >= currentWeekStart;
        const isPastWeek = endDate < todayDate && !isCurrentWeek;

        return {
          weekNumber: weekNum,
          startDate,
          endDate,
          phase,
          targetMileage: Math.round(totalMiles),
          longRunTarget: null,
          qualitySessionsTarget: null,
          focus: `${phase.charAt(0).toUpperCase() + phase.slice(1)} phase training`,
          isDownWeek: false,
          workouts: convertedWorkouts,
          isCurrentWeek,
          isPastWeek,
          hasDetailedWorkouts: true,
        };
      });
  } else {
    weeks = blocks.map(block => {
      const isCurrentWeek = block.startDate <= currentWeekStart && block.endDate >= currentWeekStart;
      const isPastWeek = block.endDate < todayDate && !isCurrentWeek;
      const blockWorkouts = workoutsByBlock[block.id] || [];

      return {
        weekNumber: block.weekNumber,
        startDate: block.startDate,
        endDate: block.endDate,
        phase: block.phase,
        targetMileage: block.targetMileage || 0,
        longRunTarget: block.longRunTarget,
        qualitySessionsTarget: block.qualitySessionsTarget,
        focus: block.focus || '',
        isDownWeek: block.isDownWeek || false,
        workouts: blockWorkouts,
        isCurrentWeek,
        isPastWeek,
        hasDetailedWorkouts: blockWorkouts.length > 0,
      };
    });
  }

  // Calculate summary stats
  const totalMiles = weeks.reduce((sum, w) => sum + w.targetMileage, 0);
  const completedMiles = weeks.reduce(
    (sum, w) => sum + w.workouts.filter(wo => wo.status === 'completed').reduce((s, wo) => s + (wo.targetDistanceMiles || 0), 0),
    0
  );
  const peakWeek = weeks.reduce((max, w) => (w.targetMileage > max.targetMileage ? w : max), weeks[0]);

  // Calculate adherence stats
  const pastWorkouts = weeks.flatMap(w => w.workouts.filter(wo => wo.date <= todayDate));
  const completedWorkouts = pastWorkouts.filter(wo => wo.status === 'completed');
  const skippedWorkouts = pastWorkouts.filter(wo => wo.status === 'skipped');
  const adherenceRate = pastWorkouts.length > 0
    ? Math.round((completedWorkouts.length / pastWorkouts.length) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-dream-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DreamySheep mood="coach" size="sm" />
          <h1 className="text-2xl font-display font-semibold text-primary">Training Plan</h1>
        </div>

        {/* Race selector */}
        {races.length > 0 && (
          <select
            value={selectedRaceId || ''}
            onChange={(e) => setSelectedRaceId(Number(e.target.value))}
            className="px-3 py-2 border border-strong rounded-lg text-sm bg-surface-1 text-primary focus:ring-2 focus:ring-dream-500"
          >
            {races.map(race => (
              <option key={race.id} value={race.id}>
                {race.name} - {getDistanceLabel(race.distanceLabel)}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* No races */}
      {races.length === 0 && (
        <div className="text-center py-12 bg-bgTertiary rounded-xl">
          <div className="flex justify-center mb-4">
            <DreamySheep mood="encouraging" size="md" withSpeechBubble="Ready to build your training plan? Set a goal race and I'll map out the journey!" />
          </div>
          <h3 className="text-lg font-medium text-secondary mb-2">No upcoming races</h3>
          <p className="text-textTertiary mb-4">Add a race to generate a training plan.</p>
          <a
            href="/races"
            className="btn-primary inline-flex items-center"
          >
            Add Race
          </a>
        </div>
      )}

      {/* Selected race info */}
      {selectedRace && (
        <div className="bg-surface-2 rounded-xl p-4 border border-default">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Flag className="w-5 h-5 text-dream-600" />
                <h2 className="font-semibold text-primary">{selectedRace.name}</h2>
              </div>
              <p className="text-sm text-textSecondary mt-1">
                {getDistanceLabel(selectedRace.distanceLabel)} • {getDaysUntilRace(selectedRace.date)} days away
              </p>
            </div>

            {!hasPlan && selectedRace?.priority === 'A' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setImportModalOpen(true)}
                  disabled={isDemo}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  Import Plan
                </button>
                <AnimatedButton
                  onClick={handleGeneratePlan}
                  disabled={generating}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Generate Plan
                    </>
                  )}
                </AnimatedButton>
              </div>
            )}
            {!hasPlan && selectedRace?.priority !== 'A' && (
              <div className="text-sm text-textTertiary">
                B/C races are incorporated into your A race plan
              </div>
            )}
          </div>
        </div>
      )}

      {/* Plan summary */}
      {hasPlan && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-1 rounded-xl p-4 border border-default">
            <div className="text-sm text-textTertiary mb-1">Total Weeks</div>
            <div className="text-2xl font-semibold text-primary">{weeks.length}</div>
          </div>
          <div className="bg-surface-1 rounded-xl p-4 border border-default">
            <div className="text-sm text-textTertiary mb-1">Total Miles</div>
            <div className="text-2xl font-semibold text-primary">
              {completedMiles > 0 && <span className="text-green-600">{completedMiles}/</span>}
              {totalMiles}
            </div>
          </div>
          <div className="bg-surface-1 rounded-xl p-4 border border-default">
            <div className="text-sm text-textTertiary mb-1">Peak Week</div>
            <div className="text-2xl font-semibold text-primary">
              {peakWeek?.targetMileage || 0} mi
            </div>
            <div className="text-xs text-tertiary">Week {peakWeek?.weekNumber}</div>
          </div>
          <div className="bg-surface-1 rounded-xl p-4 border border-default">
            <div className="text-sm text-textTertiary mb-1">Current Phase</div>
            <div className="text-2xl font-semibold text-primary capitalize">
              {weeks.find(w => w.isCurrentWeek)?.phase || '-'}
            </div>
          </div>
        </div>
      )}

      {/* Adherence Tracking */}
      {hasPlan && pastWorkouts.length > 0 && (
        <div className="bg-surface-1 rounded-xl p-4 border border-default">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-secondary">Plan Adherence</h3>
            <span className={`text-2xl font-semibold ${
              adherenceRate >= 80 ? 'text-green-600' :
              adherenceRate >= 60 ? 'text-secondary' :
              'text-red-600'
            }`}>
              {adherenceRate}%
            </span>
          </div>
          <div className="w-full bg-bgTertiary rounded-full h-2.5 mb-3">
            <div
              className={`h-2.5 rounded-full transition-all ${
                adherenceRate >= 80 ? 'bg-green-500' :
                adherenceRate >= 60 ? 'bg-surface-3' :
                'bg-red-500'
              }`}
              style={{ width: `${adherenceRate}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-sm text-textTertiary">
            <span>{completedWorkouts.length} completed</span>
            <span>{skippedWorkouts.length} skipped</span>
            <span>{pastWorkouts.length - completedWorkouts.length - skippedWorkouts.length} pending</span>
          </div>
        </div>
      )}

      {/* No plan yet */}
      {selectedRace && !hasPlan && !generating && (
        <div className="text-center py-12 bg-bgTertiary rounded-xl">
          <div className="flex justify-center mb-4">
            <DreamySheep
              mood="encouraging"
              size="md"
              withSpeechBubble={
                selectedRace.priority === 'A'
                  ? "Ready to build your training plan? Set a goal race and I'll map out the journey!"
                  : undefined
              }
            />
          </div>
          <h3 className="text-lg font-medium text-secondary mb-2">
            {selectedRace.priority === 'A' ? 'No training plan yet' : 'This is a tune-up race'}
          </h3>
          <p className="text-textTertiary mb-4">
            {selectedRace.priority === 'A'
              ? 'Generate a personalized training plan for this race. B and C races will be incorporated as tune-ups.'
              : `This ${selectedRace.priority} race will be incorporated into your A race training plan.`}
          </p>
          {selectedRace.priority !== 'A' && races.filter(r => r.priority === 'A').length > 0 && (
            <button
              onClick={() => {
                const aRace = races.find(r => r.priority === 'A');
                if (aRace) setSelectedRaceId(aRace.id);
              }}
              className="text-dream-600 hover:text-dream-700 font-medium"
            >
              View A race plan →
            </button>
          )}
        </div>
      )}

      {/* Week list */}
      {hasPlan && (
        <div className="space-y-4">
          <h3 className="font-medium text-secondary">Training Schedule</h3>
          {weeks.map(week => week.hasDetailedWorkouts ? (
            <WeekView
              key={week.weekNumber}
              weekNumber={week.weekNumber}
              startDate={week.startDate}
              endDate={week.endDate}
              phase={week.phase}
              targetMileage={week.targetMileage}
              focus={week.focus}
              isDownWeek={week.isDownWeek}
              workouts={week.workouts}
              isCurrentWeek={week.isCurrentWeek}
              isPastWeek={week.isPastWeek}
              paceSettings={paceSettings}
              onWorkoutStatusChange={handleWorkoutStatusChange}
              onWorkoutModify={handleOpenModifyModal}
            />
          ) : (
            /* Condensed macro view for weeks without detailed workouts */
            <div
              key={week.weekNumber}
              className={`rounded-xl border p-4 ${
                week.isDownWeek
                  ? 'bg-blue-900/10 border-blue-800'
                  : 'bg-surface-1 border-default'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium text-tertiary">Wk {week.weekNumber}</div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      week.phase === 'base' ? 'bg-green-900/30 text-green-400' :
                      week.phase === 'build' ? 'bg-orange-900/30 text-orange-400' :
                      week.phase === 'peak' ? 'bg-red-900/30 text-red-400' :
                      'bg-purple-900/30 text-purple-400'
                    }`}>
                      {week.phase}
                    </span>
                    {week.isDownWeek && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-400 font-medium">
                        recovery
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="text-right">
                    <span className="font-semibold text-primary">{week.targetMileage} mi</span>
                  </div>
                  {week.longRunTarget && (
                    <div className="text-right text-textSecondary">
                      LR: <span className="font-medium">{week.longRunTarget} mi</span>
                    </div>
                  )}
                  {week.qualitySessionsTarget != null && (
                    <div className="text-right text-textSecondary">
                      {week.qualitySessionsTarget} quality
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-2 text-xs text-textTertiary">
                {new Date(week.startDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(week.endDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                <span className="ml-2">• Detailed workouts generated as you approach this week</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Workout Modify Modal */}
      {selectedWorkout && (
        <WorkoutModifyModal
          workout={selectedWorkout}
          isOpen={modifyModalOpen}
          onClose={handleCloseModifyModal}
          onScaleDown={handleScaleDown}
          onSwap={handleSwap}
          onMove={handleMove}
          onDelete={handleDelete}
          onMarkComplete={handleMarkComplete}
          onSkip={handleSkip}
          alternatives={workoutAlternatives}
        />
      )}

      {/* Plan Import Modal */}
      <PlanImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        raceId={selectedRaceId || undefined}
        onSuccess={() => {
          if (selectedRaceId) {
            loadPlan(selectedRaceId);
          }
          showToast('Training plan imported successfully!', 'success');
        }}
      />

      {/* Plan Requirements Modal */}
      <PlanRequirementsModal
        isOpen={requirementsModalOpen}
        onClose={() => setRequirementsModalOpen(false)}
        missingFields={missingRequirements}
        onComplete={() => {
          setRequirementsModalOpen(false);
          // Optionally refresh the page or navigate to profile
        }}
      />
    </div>
  );
}
