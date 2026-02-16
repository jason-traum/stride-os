'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveOnboardingData, type OnboardingData } from '@/actions/onboarding';
import { saveDemoOnboardingData, generateDemoTrainingPlan, getDemoRaces } from '@/lib/demo-actions';
import type { RunnerPersona } from '@/lib/schema';
import { Footprints } from 'lucide-react';
import {
  BasicInfoStep,
  TrainingPrefsStep,
  RecentRaceStep,
  GoalRaceStep,
  ReviewStep,
  AthleticBackgroundStep,
  TrainingPhilosophyStep,
  InjuryRecoveryStep,
  ScheduleLifestyleStep,
  RacePRsStep,
} from '@/components/onboarding';
import { useDemoMode } from '@/components/DemoModeProvider';

export default function OnboardingPage() {
  const router = useRouter();
  const { isDemo, updateSettings } = useDemoMode();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Basic Info
  const [name, setName] = useState('');
  const [runnerPersona, setRunnerPersona] = useState<RunnerPersona | ''>('');
  const [runnerPersonaNotes, setRunnerPersonaNotes] = useState('');
  const [currentWeeklyMileage, setCurrentWeeklyMileage] = useState<number>(20);
  const [runsPerWeekCurrent, setRunsPerWeekCurrent] = useState<number>(4);
  const [currentLongRunMax, setCurrentLongRunMax] = useState<number>(8);

  // Step 2: Training Goals
  const [peakWeeklyMileageTarget, setPeakWeeklyMileageTarget] = useState<number>(40);
  const [preferredLongRunDay, setPreferredLongRunDay] = useState('sunday');
  const [requiredRestDays, setRequiredRestDays] = useState<string[]>(['friday']);
  const [planAggressiveness, setPlanAggressiveness] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [qualitySessionsPerWeek, setQualitySessionsPerWeek] = useState<number>(2);

  // Step 3: Recent Race (Recommended)
  const [hasRecentRace, setHasRecentRace] = useState(false);
  const [raceDistance, setRaceDistance] = useState('5K');
  const [raceTimeHours, setRaceTimeHours] = useState<number>(0);
  const [raceTimeMinutes, setRaceTimeMinutes] = useState<number>(25);
  const [raceTimeSeconds, setRaceTimeSeconds] = useState<number>(0);
  const [raceDate, setRaceDate] = useState(new Date().toISOString().split('T')[0]);

  // Step 4: Goal Race (Required)
  const [goalRaceName, setGoalRaceName] = useState('');
  const [goalRaceDate, setGoalRaceDate] = useState('');
  const [goalRaceDistance, setGoalRaceDistance] = useState('half_marathon');
  const [hasTargetTime, setHasTargetTime] = useState(false);
  const [targetTimeHours, setTargetTimeHours] = useState<number>(1);
  const [targetTimeMinutes, setTargetTimeMinutes] = useState<number>(45);
  const [targetTimeSeconds, setTargetTimeSeconds] = useState<number>(0);

  // Step 6: Athletic Background
  const [yearsRunning, setYearsRunning] = useState<number>(2);
  const [athleticBackground, setAthleticBackground] = useState<string[]>([]);
  const [highestWeeklyMileageEver, setHighestWeeklyMileageEver] = useState<number>(30);
  const [weeksAtHighestMileage, setWeeksAtHighestMileage] = useState<number>(4);
  const [timeSincePeakFitness, setTimeSincePeakFitness] = useState<string>('6_months');

  // Step 7: Training Preferences
  const [preferredQualityDays, setPreferredQualityDays] = useState<string[]>(['tuesday', 'thursday']);
  const [comfortVO2max, setComfortVO2max] = useState<number | null>(null);
  const [comfortTempo, setComfortTempo] = useState<number | null>(null);
  const [comfortHills, setComfortHills] = useState<number | null>(null);
  const [comfortLongRuns, setComfortLongRuns] = useState<number | null>(null);
  const [comfortTrackWork, setComfortTrackWork] = useState<number | null>(null);
  const [openToDoubles, setOpenToDoubles] = useState(false);
  const [trainBy, setTrainBy] = useState<string>('pace');

  // Step 7b: Training Philosophy
  const [trainingPhilosophy, setTrainingPhilosophy] = useState<string>('balanced');
  const [downWeekFrequency, setDownWeekFrequency] = useState<string>('every_4_weeks');
  const [longRunMaxStyle, setLongRunMaxStyle] = useState<string>('traditional');
  const [fatigueManagementStyle, setFatigueManagementStyle] = useState<string>('balanced');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [workoutVarietyPref, _setWorkoutVarietyPref] = useState<string>('moderate');
  const [mlrPreference, setMlrPreference] = useState<boolean>(true);
  const [progressiveLongRunsOk, setProgressiveLongRunsOk] = useState<boolean>(true);

  // Step 8: Injury & Recovery
  const [commonInjuries, setCommonInjuries] = useState<string[]>([]);
  const [currentInjuries, setCurrentInjuries] = useState('');
  const [needsExtraRest, setNeedsExtraRest] = useState(false);
  const [typicalSleepHours, setTypicalSleepHours] = useState<number>(7);
  const [sleepQuality, setSleepQuality] = useState<string>('good');
  const [stressLevel, setStressLevel] = useState<string>('moderate');

  // Step 9: Schedule & Lifestyle
  const [preferredRunTime, setPreferredRunTime] = useState<string>('morning');
  const [weekdayAvailabilityMinutes, setWeekdayAvailabilityMinutes] = useState<number>(60);
  const [weekendAvailabilityMinutes, setWeekendAvailabilityMinutes] = useState<number>(120);
  const [heatSensitivity, setHeatSensitivity] = useState<number>(3);
  const [coldSensitivity, setColdSensitivity] = useState<number>(3);
  const [surfacePreference, setSurfacePreference] = useState<string>('road');
  const [groupVsSolo, setGroupVsSolo] = useState<string>('either');

  // Step 10: Race PRs
  const [hasMarathonPR, setHasMarathonPR] = useState(false);
  const [marathonPRHours, setMarathonPRHours] = useState<number>(3);
  const [marathonPRMinutes, setMarathonPRMinutes] = useState<number>(30);
  const [marathonPRSeconds, setMarathonPRSeconds] = useState<number>(0);
  const [hasHalfMarathonPR, setHasHalfMarathonPR] = useState(false);
  const [halfMarathonPRHours, setHalfMarathonPRHours] = useState<number>(1);
  const [halfMarathonPRMinutes, setHalfMarathonPRMinutes] = useState<number>(45);
  const [halfMarathonPRSeconds, setHalfMarathonPRSeconds] = useState<number>(0);
  const [hasTenKPR, setHasTenKPR] = useState(false);
  const [tenKPRMinutes, setTenKPRMinutes] = useState<number>(50);
  const [tenKPRSeconds, setTenKPRSeconds] = useState<number>(0);
  const [hasFiveKPR, setHasFiveKPR] = useState(false);
  const [fiveKPRMinutes, setFiveKPRMinutes] = useState<number>(25);
  const [fiveKPRSeconds, setFiveKPRSeconds] = useState<number>(0);

  const toggleRestDay = (day: string) => {
    if (requiredRestDays.includes(day)) {
      setRequiredRestDays(requiredRestDays.filter(d => d !== day));
    } else {
      setRequiredRestDays([...requiredRestDays, day]);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return name.trim().length > 0 && runnerPersona !== '';
      case 2:
        return peakWeeklyMileageTarget >= currentWeeklyMileage && requiredRestDays.length <= 3;
      case 3:
        return true; // Optional step
      case 4:
        return goalRaceName.trim().length > 0 && goalRaceDate.length > 0;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    const data: OnboardingData = {
      name,
      runnerPersona: runnerPersona || undefined,
      runnerPersonaNotes: runnerPersonaNotes || undefined,
      currentWeeklyMileage,
      runsPerWeekCurrent,
      currentLongRunMax,
      peakWeeklyMileageTarget,
      preferredLongRunDay,
      requiredRestDays,
      planAggressiveness,
      qualitySessionsPerWeek,
      goalRace: {
        name: goalRaceName,
        date: goalRaceDate,
        distanceLabel: goalRaceDistance,
        priority: 'A',
        targetTimeSeconds: hasTargetTime
          ? targetTimeHours * 3600 + targetTimeMinutes * 60 + targetTimeSeconds
          : undefined,
      },
      // Extended profile fields
      yearsRunning,
      athleticBackground: athleticBackground.length > 0 ? athleticBackground : undefined,
      highestWeeklyMileageEver,
      weeksAtHighestMileage,
      timeSincePeakFitness: timeSincePeakFitness as OnboardingData['timeSincePeakFitness'],
      preferredQualityDays,
      comfortVO2max: comfortVO2max ?? undefined,
      comfortTempo: comfortTempo ?? undefined,
      comfortHills: comfortHills ?? undefined,
      comfortLongRuns: comfortLongRuns ?? undefined,
      comfortTrackWork: comfortTrackWork ?? undefined,
      openToDoubles,
      trainBy: trainBy as OnboardingData['trainBy'],
      // Training Philosophy
      trainingPhilosophy: trainingPhilosophy as OnboardingData['trainingPhilosophy'],
      downWeekFrequency: downWeekFrequency as OnboardingData['downWeekFrequency'],
      longRunMaxStyle: longRunMaxStyle as OnboardingData['longRunMaxStyle'],
      fatigueManagementStyle: fatigueManagementStyle as OnboardingData['fatigueManagementStyle'],
      workoutVarietyPref: workoutVarietyPref as OnboardingData['workoutVarietyPref'],
      mlrPreference,
      progressiveLongRunsOk,
      commonInjuries: commonInjuries.length > 0 ? commonInjuries : undefined,
      currentInjuries: currentInjuries || undefined,
      needsExtraRest,
      typicalSleepHours,
      sleepQuality: sleepQuality as OnboardingData['sleepQuality'],
      stressLevel: stressLevel as OnboardingData['stressLevel'],
      preferredRunTime: preferredRunTime as OnboardingData['preferredRunTime'],
      weekdayAvailabilityMinutes,
      weekendAvailabilityMinutes,
      heatSensitivity,
      coldSensitivity,
      surfacePreference: surfacePreference as OnboardingData['surfacePreference'],
      groupVsSolo: groupVsSolo as OnboardingData['groupVsSolo'],
      // Race PRs
      marathonPR: hasMarathonPR ? { hours: marathonPRHours, minutes: marathonPRMinutes, seconds: marathonPRSeconds } : null,
      halfMarathonPR: hasHalfMarathonPR ? { hours: halfMarathonPRHours, minutes: halfMarathonPRMinutes, seconds: halfMarathonPRSeconds } : null,
      tenKPR: hasTenKPR ? { minutes: tenKPRMinutes, seconds: tenKPRSeconds } : null,
      fiveKPR: hasFiveKPR ? { minutes: fiveKPRMinutes, seconds: fiveKPRSeconds } : null,
    };

    if (hasRecentRace) {
      data.recentRace = {
        distanceLabel: raceDistance,
        finishTimeSeconds: raceTimeHours * 3600 + raceTimeMinutes * 60 + raceTimeSeconds,
        date: raceDate,
      };
    }

    try {
      if (isDemo) {
        // Demo mode: save to localStorage instead of database
        const demoData = {
          name,
          runnerPersona: runnerPersona || undefined,
          currentWeeklyMileage,
          runsPerWeekCurrent,
          currentLongRunMax,
          peakWeeklyMileageTarget,
          preferredLongRunDay,
          requiredRestDays,
          planAggressiveness,
          qualitySessionsPerWeek,
          goalRace: {
            name: goalRaceName,
            date: goalRaceDate,
            distanceLabel: goalRaceDistance,
            priority: 'A' as const,
            targetTimeSeconds: hasTargetTime
              ? targetTimeHours * 3600 + targetTimeMinutes * 60 + targetTimeSeconds
              : undefined,
          },
          recentRace: hasRecentRace ? {
            distanceLabel: raceDistance,
            finishTimeSeconds: raceTimeHours * 3600 + raceTimeMinutes * 60 + raceTimeSeconds,
            date: raceDate,
          } : undefined,
          yearsRunning,
          comfortVO2max: comfortVO2max ?? undefined,
          comfortTempo: comfortTempo ?? undefined,
          comfortHills: comfortHills ?? undefined,
          comfortLongRuns: comfortLongRuns ?? undefined,
          trainBy,
          typicalSleepHours,
          stressLevel,
        };

        saveDemoOnboardingData(demoData);

        const races = getDemoRaces();
        if (races.length > 0) {
          generateDemoTrainingPlan(races[0].id);
        }

        updateSettings({
          name,
          onboardingCompleted: true,
          onboardingStep: 10,
        });

        router.push('/today');
      } else {
        await saveOnboardingData(data);
        router.push('/coach?onboarding=true');
      }
    } catch (error) {
      console.error('Error saving onboarding data:', error);
    } finally {
      setLoading(false);
    }
  };

  const weeksUntilRace = goalRaceDate
    ? Math.ceil((new Date(goalRaceDate).getTime() - new Date().getTime()) / (7 * 24 * 60 * 60 * 1000))
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface-0 to-surface-1 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-dream-600 mb-4">
            <Footprints className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-primary">Welcome to Dreamy</h1>
          <p className="text-tertiary mt-2">Your AI-powered running coach</p>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center mb-8">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center space-x-1.5">
              {/* Basics: steps 1-2 */}
              {[1, 2].map((s) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all ${
                    s === step ? 'w-6 bg-dream-500' : s < step ? 'w-2.5 bg-dream-400/60' : 'w-2.5 bg-surface-2'
                  }`}
                />
              ))}
              <div className="w-1.5 h-0.5 bg-surface-2" />
              {/* Races: steps 3-5 */}
              {[3, 4, 5].map((s) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all ${
                    s === step ? 'w-6 bg-green-500' : s < step ? 'w-2.5 bg-green-400/60' : 'w-2.5 bg-surface-2'
                  }`}
                />
              ))}
              <div className="w-1.5 h-0.5 bg-surface-2" />
              {/* Deep Profile: steps 6-10 */}
              {[6, 7, 8, 9, 10].map((s) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all ${
                    s === step ? 'w-6 bg-dream-500' : s < step ? 'w-2.5 bg-dream-400/60' : 'w-2.5 bg-surface-2'
                  }`}
                />
              ))}
            </div>
            <div className="flex items-center gap-3 text-xs text-textTertiary">
              <span className={step <= 2 ? 'text-dream-400 font-medium' : ''}>Basics</span>
              <span className={step >= 3 && step <= 5 ? 'text-green-400 font-medium' : ''}>Races</span>
              <span className={step >= 6 ? 'text-dream-400 font-medium' : ''}>Deep Profile</span>
            </div>
          </div>
        </div>

        <div className="bg-surface-1 rounded-xl shadow-xl p-6 border border-default">
          {step === 1 && (
            <BasicInfoStep
              name={name} setName={setName}
              runnerPersona={runnerPersona} setRunnerPersona={setRunnerPersona}
              runnerPersonaNotes={runnerPersonaNotes} setRunnerPersonaNotes={setRunnerPersonaNotes}
              currentWeeklyMileage={currentWeeklyMileage} setCurrentWeeklyMileage={setCurrentWeeklyMileage}
              runsPerWeekCurrent={runsPerWeekCurrent} setRunsPerWeekCurrent={setRunsPerWeekCurrent}
              currentLongRunMax={currentLongRunMax} setCurrentLongRunMax={setCurrentLongRunMax}
              onNext={() => setStep(2)} canProceed={canProceed()}
            />
          )}

          {step === 2 && (
            <TrainingPrefsStep
              currentWeeklyMileage={currentWeeklyMileage}
              peakWeeklyMileageTarget={peakWeeklyMileageTarget} setPeakWeeklyMileageTarget={setPeakWeeklyMileageTarget}
              preferredLongRunDay={preferredLongRunDay} setPreferredLongRunDay={setPreferredLongRunDay}
              requiredRestDays={requiredRestDays} toggleRestDay={toggleRestDay}
              qualitySessionsPerWeek={qualitySessionsPerWeek} setQualitySessionsPerWeek={setQualitySessionsPerWeek}
              planAggressiveness={planAggressiveness} setPlanAggressiveness={setPlanAggressiveness}
              onBack={() => setStep(1)} onNext={() => setStep(3)} canProceed={canProceed()}
            />
          )}

          {step === 3 && (
            <RecentRaceStep
              hasRecentRace={hasRecentRace} setHasRecentRace={setHasRecentRace}
              raceDistance={raceDistance} setRaceDistance={setRaceDistance}
              raceTimeHours={raceTimeHours} setRaceTimeHours={setRaceTimeHours}
              raceTimeMinutes={raceTimeMinutes} setRaceTimeMinutes={setRaceTimeMinutes}
              raceTimeSeconds={raceTimeSeconds} setRaceTimeSeconds={setRaceTimeSeconds}
              raceDate={raceDate} setRaceDate={setRaceDate}
              onBack={() => setStep(2)} onNext={() => setStep(4)}
            />
          )}

          {step === 4 && (
            <GoalRaceStep
              goalRaceName={goalRaceName} setGoalRaceName={setGoalRaceName}
              goalRaceDistance={goalRaceDistance} setGoalRaceDistance={setGoalRaceDistance}
              goalRaceDate={goalRaceDate} setGoalRaceDate={setGoalRaceDate}
              hasTargetTime={hasTargetTime} setHasTargetTime={setHasTargetTime}
              targetTimeHours={targetTimeHours} setTargetTimeHours={setTargetTimeHours}
              targetTimeMinutes={targetTimeMinutes} setTargetTimeMinutes={setTargetTimeMinutes}
              targetTimeSeconds={targetTimeSeconds} setTargetTimeSeconds={setTargetTimeSeconds}
              weeksUntilRace={weeksUntilRace}
              onBack={() => setStep(3)} onNext={() => setStep(5)} canProceed={canProceed()}
            />
          )}

          {step === 5 && (
            <ReviewStep
              name={name} currentWeeklyMileage={currentWeeklyMileage}
              runsPerWeekCurrent={runsPerWeekCurrent} currentLongRunMax={currentLongRunMax}
              peakWeeklyMileageTarget={peakWeeklyMileageTarget} preferredLongRunDay={preferredLongRunDay}
              requiredRestDays={requiredRestDays} planAggressiveness={planAggressiveness}
              hasRecentRace={hasRecentRace} raceDistance={raceDistance}
              raceTimeHours={raceTimeHours} raceTimeMinutes={raceTimeMinutes} raceTimeSeconds={raceTimeSeconds}
              goalRaceName={goalRaceName} goalRaceDistance={goalRaceDistance} goalRaceDate={goalRaceDate}
              hasTargetTime={hasTargetTime} targetTimeHours={targetTimeHours}
              targetTimeMinutes={targetTimeMinutes} targetTimeSeconds={targetTimeSeconds}
              weeksUntilRace={weeksUntilRace}
              goToStep={setStep} onContinueDeepProfile={() => setStep(6)}
              onSubmit={handleSubmit} loading={loading}
            />
          )}

          {step === 6 && (
            <AthleticBackgroundStep
              yearsRunning={yearsRunning} setYearsRunning={setYearsRunning}
              athleticBackground={athleticBackground} setAthleticBackground={setAthleticBackground}
              highestWeeklyMileageEver={highestWeeklyMileageEver} setHighestWeeklyMileageEver={setHighestWeeklyMileageEver}
              weeksAtHighestMileage={weeksAtHighestMileage} setWeeksAtHighestMileage={setWeeksAtHighestMileage}
              timeSincePeakFitness={timeSincePeakFitness} setTimeSincePeakFitness={setTimeSincePeakFitness}
              onBack={() => setStep(5)} onNext={() => setStep(7)}
            />
          )}

          {step === 7 && (
            <TrainingPhilosophyStep
              preferredQualityDays={preferredQualityDays} setPreferredQualityDays={setPreferredQualityDays}
              comfortVO2max={comfortVO2max} setComfortVO2max={setComfortVO2max}
              comfortTempo={comfortTempo} setComfortTempo={setComfortTempo}
              comfortHills={comfortHills} setComfortHills={setComfortHills}
              comfortLongRuns={comfortLongRuns} setComfortLongRuns={setComfortLongRuns}
              comfortTrackWork={comfortTrackWork} setComfortTrackWork={setComfortTrackWork}
              openToDoubles={openToDoubles} setOpenToDoubles={setOpenToDoubles}
              trainBy={trainBy} setTrainBy={setTrainBy}
              trainingPhilosophy={trainingPhilosophy} setTrainingPhilosophy={setTrainingPhilosophy}
              downWeekFrequency={downWeekFrequency} setDownWeekFrequency={setDownWeekFrequency}
              longRunMaxStyle={longRunMaxStyle} setLongRunMaxStyle={setLongRunMaxStyle}
              fatigueManagementStyle={fatigueManagementStyle} setFatigueManagementStyle={setFatigueManagementStyle}
              mlrPreference={mlrPreference} setMlrPreference={setMlrPreference}
              progressiveLongRunsOk={progressiveLongRunsOk} setProgressiveLongRunsOk={setProgressiveLongRunsOk}
              onBack={() => setStep(6)} onNext={() => setStep(8)}
            />
          )}

          {step === 8 && (
            <InjuryRecoveryStep
              commonInjuries={commonInjuries} setCommonInjuries={setCommonInjuries}
              currentInjuries={currentInjuries} setCurrentInjuries={setCurrentInjuries}
              needsExtraRest={needsExtraRest} setNeedsExtraRest={setNeedsExtraRest}
              typicalSleepHours={typicalSleepHours} setTypicalSleepHours={setTypicalSleepHours}
              sleepQuality={sleepQuality} setSleepQuality={setSleepQuality}
              stressLevel={stressLevel} setStressLevel={setStressLevel}
              onBack={() => setStep(7)} onNext={() => setStep(9)}
            />
          )}

          {step === 9 && (
            <ScheduleLifestyleStep
              preferredRunTime={preferredRunTime} setPreferredRunTime={setPreferredRunTime}
              weekdayAvailabilityMinutes={weekdayAvailabilityMinutes} setWeekdayAvailabilityMinutes={setWeekdayAvailabilityMinutes}
              weekendAvailabilityMinutes={weekendAvailabilityMinutes} setWeekendAvailabilityMinutes={setWeekendAvailabilityMinutes}
              heatSensitivity={heatSensitivity} setHeatSensitivity={setHeatSensitivity}
              coldSensitivity={coldSensitivity} setColdSensitivity={setColdSensitivity}
              surfacePreference={surfacePreference} setSurfacePreference={setSurfacePreference}
              groupVsSolo={groupVsSolo} setGroupVsSolo={setGroupVsSolo}
              onBack={() => setStep(8)} onNext={() => setStep(10)}
            />
          )}

          {step === 10 && (
            <RacePRsStep
              hasMarathonPR={hasMarathonPR} setHasMarathonPR={setHasMarathonPR}
              marathonPRHours={marathonPRHours} setMarathonPRHours={setMarathonPRHours}
              marathonPRMinutes={marathonPRMinutes} setMarathonPRMinutes={setMarathonPRMinutes}
              marathonPRSeconds={marathonPRSeconds} setMarathonPRSeconds={setMarathonPRSeconds}
              hasHalfMarathonPR={hasHalfMarathonPR} setHasHalfMarathonPR={setHasHalfMarathonPR}
              halfMarathonPRHours={halfMarathonPRHours} setHalfMarathonPRHours={setHalfMarathonPRHours}
              halfMarathonPRMinutes={halfMarathonPRMinutes} setHalfMarathonPRMinutes={setHalfMarathonPRMinutes}
              halfMarathonPRSeconds={halfMarathonPRSeconds} setHalfMarathonPRSeconds={setHalfMarathonPRSeconds}
              hasTenKPR={hasTenKPR} setHasTenKPR={setHasTenKPR}
              tenKPRMinutes={tenKPRMinutes} setTenKPRMinutes={setTenKPRMinutes}
              tenKPRSeconds={tenKPRSeconds} setTenKPRSeconds={setTenKPRSeconds}
              hasFiveKPR={hasFiveKPR} setHasFiveKPR={setHasFiveKPR}
              fiveKPRMinutes={fiveKPRMinutes} setFiveKPRMinutes={setFiveKPRMinutes}
              fiveKPRSeconds={fiveKPRSeconds} setFiveKPRSeconds={setFiveKPRSeconds}
              onBack={() => setStep(9)} onSubmit={handleSubmit} loading={loading}
            />
          )}
        </div>

        {/* Skip option */}
        {step === 1 && (
          <p className="text-center text-textTertiary text-sm mt-4">
            Already have an account?{' '}
            <button
              onClick={() => router.push('/today')}
              className="text-dream-400 hover:text-tertiary"
            >
              Skip setup
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
