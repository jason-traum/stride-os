'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createAssessment, updateAssessment } from '@/actions/workouts';
import { cn } from '@/lib/utils';
import { useToast } from './Toast';
import { X, ChevronDown } from 'lucide-react';
import { useModalBodyLock } from '@/hooks/useModalBodyLock';
import {
  verdicts,
  wasIntendedOptions,
  issueOptions,
  breathingFeels,
  perceivedHeats,
  caffeineOptions,
  feltTempOptions,
  surfaceOptions,
  legsTagOptions,
  lifeTagOptions,
  hydrationTagOptions,
  timeOfRunOptions,
  mentalEnergyOptions,
  outfitRatings,
  extremityRatings,
} from '@/lib/schema';
import type { Assessment } from '@/lib/schema';

interface AssessmentModalProps {
  workoutId: number;
  onClose: () => void;
  existingAssessment?: Assessment | null;
  isEdit?: boolean;
  workoutDistance?: number;
  workoutType?: string;
}

function buildPostRunCoachPrompt(distance: number | undefined, type: string | undefined, verdict: string): string {
  const distStr = distance?.toFixed(1) || '?';
  const typeStr = type || 'run';

  if (verdict === 'great' || verdict === 'good') {
    return `Nice ${typeStr} — ${distStr} miles and you rated it "${verdict}"! What made it click today?`;
  } else if (verdict === 'rough' || verdict === 'awful') {
    return `I see you logged ${distStr} miles and it was a ${verdict} one. What happened out there? Let's figure out what we can adjust.`;
  }
  return `${distStr} miles logged — a "${verdict}" ${typeStr}. Anything you want to talk through about that run?`;
}

type SectionKey = 'verdict' | 'effort' | 'recovery' | 'nutrition' | 'environment' | 'outfit' | 'notes';

// Helper to check if today is a weekday
function isWeekday(): boolean {
  const day = new Date().getDay();
  return day >= 1 && day <= 5;
}

export function AssessmentModal({ workoutId, onClose, existingAssessment, isEdit, workoutDistance, workoutType: workoutTypeProp }: AssessmentModalProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Prevent body scrolling when modal is open
  useModalBodyLock(true);

  // Parse existing data if in edit mode
  const existingIssues = existingAssessment ? JSON.parse(existingAssessment.issues || '[]') : [];
  const existingLegsTags = existingAssessment ? JSON.parse(existingAssessment.legsTags || '[]') : [];
  const existingLifeTags = existingAssessment ? JSON.parse(existingAssessment.lifeTags || '[]') : [];
  const existingHydrationTags = existingAssessment ? JSON.parse(existingAssessment.hydrationTags || '[]') : [];

  // Section expand state
  const [expandedSections, setExpandedSections] = useState<Set<SectionKey>>(
    () => new Set<SectionKey>(['verdict', 'effort'])
  );

  // Form state with updated defaults
  const [verdict, setVerdict] = useState<string>(existingAssessment?.verdict || '');
  const [wasIntended, setWasIntended] = useState<string>(existingAssessment?.wasIntendedWorkout || 'yes');
  const [issues, setIssues] = useState<string[]>(existingIssues);
  const [rpe, setRpe] = useState<number>(existingAssessment?.rpe ?? 5);
  const [legsFeel, setLegsFeel] = useState<number>(existingAssessment?.legsFeel ?? 5);
  const [legsTags, setLegsTags] = useState<string[]>(existingLegsTags);
  const [breathingFeel, setBreathingFeel] = useState<string>(existingAssessment?.breathingFeel || '');
  const [perceivedHeat, setPerceivedHeat] = useState<string>(existingAssessment?.perceivedHeat || '');

  // Updated defaults: sleepQuality=7, stress=4, soreness=3
  const [sleepQuality, setSleepQuality] = useState<number>(existingAssessment?.sleepQuality ?? 7);
  const [sleepHours, setSleepHours] = useState<number>(existingAssessment?.sleepHours ?? 7);
  const [stress, setStress] = useState<number>(existingAssessment?.stress ?? 4);
  const [soreness, setSoreness] = useState<number>(existingAssessment?.soreness ?? 3);
  const [mood, setMood] = useState<number>(existingAssessment?.mood ?? 5);
  const [lifeTags, setLifeTags] = useState<string[]>(existingLifeTags);

  // Updated defaults: hydration=7, fueling=7
  const [hydration, setHydration] = useState<number>(existingAssessment?.hydration ?? 7);
  const [hydrationTags, setHydrationTags] = useState<string[]>(existingHydrationTags);
  const [fueling, setFueling] = useState<number>(existingAssessment?.fueling ?? 7);
  const [underfueled, setUnderfueled] = useState(existingAssessment?.underfueled ?? false);
  const [caffeine, setCaffeine] = useState<string>(existingAssessment?.caffeine || '');
  const [alcohol24h, setAlcohol24h] = useState<number>(existingAssessment?.alcohol24h ?? 0);
  const [illness, setIllness] = useState<number>(existingAssessment?.illness ?? 0);
  const [stomach, setStomach] = useState<number>(existingAssessment?.stomach ?? 0);
  const [forgotElectrolytes, setForgotElectrolytes] = useState(existingAssessment?.forgotElectrolytes ?? false);
  const [windHillsDifficulty, setWindHillsDifficulty] = useState<number>(existingAssessment?.windHillsDifficulty ?? 3);
  const [feltTemp, setFeltTemp] = useState<string>(existingAssessment?.feltTemp || '');
  const [surface, setSurface] = useState<string>(existingAssessment?.surface || '');
  const [note, setNote] = useState(existingAssessment?.note || '');

  // New schedule context fields
  const [timeOfRun, setTimeOfRun] = useState<string>(existingAssessment?.timeOfRun || '');
  const [wasWorkday, setWasWorkday] = useState<boolean>(existingAssessment?.wasWorkday ?? isWeekday());
  const [hoursWorkedBefore, setHoursWorkedBefore] = useState<number>(existingAssessment?.hoursWorkedBefore ?? 0);
  const [workStress, setWorkStress] = useState<number>(existingAssessment?.workStress ?? 4);
  const [mentalEnergyPreRun, setMentalEnergyPreRun] = useState<string>(existingAssessment?.mentalEnergyPreRun || '');

  // Outfit feedback fields
  const [outfitRating, setOutfitRating] = useState<string>(existingAssessment?.outfitRating || '');
  const [handsRating, setHandsRating] = useState<string>(existingAssessment?.handsRating || '');
  const [faceRating, setFaceRating] = useState<string>(existingAssessment?.faceRating || '');
  const [removedLayers, setRemovedLayers] = useState<string>(existingAssessment?.removedLayers || '');

  const toggleSection = (section: SectionKey) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const toggleArrayItem = (
    arr: string[],
    setArr: (val: string[]) => void,
    item: string
  ) => {
    if (arr.includes(item)) {
      setArr(arr.filter((i) => i !== item));
    } else {
      setArr([...arr, item]);
    }
  };

  const handleSubmit = () => {
    if (!verdict) {
      showToast('Please select a verdict', 'error');
      return;
    }

    const assessmentData = {
      verdict,
      wasIntendedWorkout: wasIntended,
      issues,
      rpe,
      legsFeel,
      legsTags,
      breathingFeel: breathingFeel || undefined,
      perceivedHeat: perceivedHeat || undefined,
      sleepQuality,
      sleepHours,
      stress,
      soreness,
      mood,
      lifeTags,
      hydration,
      hydrationTags,
      fueling,
      underfueled,
      caffeine: caffeine || undefined,
      alcohol24h,
      illness,
      stomach,
      forgotElectrolytes,
      windHillsDifficulty,
      feltTemp: feltTemp || undefined,
      surface: surface || undefined,
      note: note || undefined,
      // New schedule context fields
      timeOfRun: timeOfRun || undefined,
      wasWorkday,
      hoursWorkedBefore: wasWorkday ? hoursWorkedBefore : undefined,
      workStress: wasWorkday ? workStress : undefined,
      mentalEnergyPreRun: wasWorkday ? mentalEnergyPreRun || undefined : undefined,
      // Outfit feedback
      outfitRating: outfitRating || undefined,
      handsRating: handsRating || undefined,
      faceRating: faceRating || undefined,
      removedLayers: removedLayers || undefined,
    };

    startTransition(async () => {
      if (isEdit && existingAssessment) {
        await updateAssessment(existingAssessment.id, workoutId, assessmentData);
        showToast('Assessment updated!', 'success');
        router.push(`/workout/${workoutId}`);
        router.refresh();
      } else {
        await createAssessment(workoutId, assessmentData);
        showToast('Assessment saved!', 'success');
        // Redirect to coach with contextual prompt
        const coachMsg = buildPostRunCoachPrompt(workoutDistance, workoutTypeProp, verdict);
        router.push(`/coach?message=${encodeURIComponent(coachMsg)}&type=assistant`);
      }
    });
  };

  const verdictLabels: Record<string, string> = {
    great: 'Great',
    good: 'Good',
    fine: 'Fine',
    rough: 'Rough',
    awful: 'Awful',
  };

  const verdictColors: Record<string, string> = {
    great: 'bg-green-500 hover:bg-green-600 text-white',
    good: 'bg-green-400 hover:bg-green-500 text-white',
    fine: 'bg-surface-2 hover:bg-surface-3 text-primary',
    rough: 'bg-rose-300 hover:bg-rose-400 text-white',
    awful: 'bg-red-500 hover:bg-red-600 text-white',
  };

  const timeOfRunLabels: Record<string, string> = {
    early_morning: 'Early AM (5-7)',
    morning: 'Morning (7-11)',
    lunch: 'Lunch (11-1)',
    afternoon: 'Afternoon (1-5)',
    evening: 'Evening (5-8)',
    night: 'Night (8+)',
  };

  const mentalEnergyLabels: Record<string, string> = {
    fresh: 'Fresh',
    okay: 'Okay',
    drained: 'Drained',
    fried: 'Fried',
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-bgSecondary rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-bgSecondary border-b border-borderPrimary px-6 py-4 rounded-t-xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-primary">
              {isEdit ? 'Edit Assessment' : 'How did it go?'}
            </h2>
            <button
              onClick={onClose}
              className="text-tertiary hover:text-textSecondary"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Section A: Quick Verdict - Always expanded */}
          <Section
            title="Quick Verdict"
            isExpanded={expandedSections.has('verdict')}
            onToggle={() => toggleSection('verdict')}
            alwaysExpanded
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-2">
                  Overall verdict *
                </label>
                <div className="flex flex-wrap gap-2">
                  {verdicts.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVerdict(v)}
                      className={cn(
                        'px-4 py-2 rounded-lg font-medium transition-all',
                        verdict === v
                          ? verdictColors[v]
                          : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                      )}
                    >
                      {verdictLabels[v]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-textSecondary mb-2">
                  Was this your intended workout?
                </label>
                <div className="flex gap-2">
                  {wasIntendedOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setWasIntended(opt)}
                      className={cn(
                        'px-4 py-2 rounded-lg font-medium transition-all capitalize',
                        wasIntended === opt
                          ? 'bg-dream-600 text-white'
                          : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-textSecondary mb-2">
                  Any issues?
                </label>
                <div className="flex flex-wrap gap-2">
                  {issueOptions.map((issue) => (
                    <Chip
                      key={issue}
                      label={formatLabel(issue)}
                      selected={issues.includes(issue)}
                      onClick={() => toggleArrayItem(issues, setIssues, issue)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Section B: Effort & Feel */}
          <Section
            title="Effort & Feel"
            isExpanded={expandedSections.has('effort')}
            onToggle={() => toggleSection('effort')}
          >
            <div className="space-y-4">
              <Slider
                label="RPE (Rate of Perceived Exertion)"
                value={rpe}
                onChange={setRpe}
                min={1}
                max={10}
                markers={['Easy', '', '', '', '', '', '', '', '', 'Max']}
              />

              <Slider
                label="How did your legs feel?"
                value={legsFeel}
                onChange={setLegsFeel}
                min={0}
                max={10}
                markers={['Dead', '', '', '', '', 'Normal', '', '', '', '', 'Fresh']}
              />

              <div>
                <label className="block text-sm font-medium text-textSecondary mb-2">
                  Legs tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {legsTagOptions.map((tag) => (
                    <Chip
                      key={tag}
                      label={formatLabel(tag)}
                      selected={legsTags.includes(tag)}
                      onClick={() => toggleArrayItem(legsTags, setLegsTags, tag)}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-textSecondary mb-2">
                  Breathing
                </label>
                <div className="flex flex-wrap gap-2">
                  {breathingFeels.map((feel) => (
                    <button
                      key={feel}
                      type="button"
                      onClick={() => setBreathingFeel(breathingFeel === feel ? '' : feel)}
                      className={cn(
                        'px-4 py-2 rounded-lg font-medium transition-all capitalize',
                        breathingFeel === feel
                          ? 'bg-dream-600 text-white'
                          : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                      )}
                    >
                      {feel}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Section C: Recovery & Life Context (includes Schedule Context) */}
          <Section
            title="Recovery & Life Context"
            isExpanded={expandedSections.has('recovery')}
            onToggle={() => toggleSection('recovery')}
          >
            <div className="space-y-4">
              {/* Schedule Context subsection */}
              <div className="pb-4 border-b border-borderSecondary">
                <h4 className="text-sm font-medium text-primary mb-3">Schedule Context</h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-textSecondary mb-2">
                      Time of run
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {timeOfRunOptions.map((time) => (
                        <button
                          key={time}
                          type="button"
                          onClick={() => setTimeOfRun(timeOfRun === time ? '' : time)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                            timeOfRun === time
                              ? 'bg-dream-600 text-white'
                              : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                          )}
                        >
                          {timeOfRunLabels[time]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-textSecondary">Workday?</label>
                    <button
                      type="button"
                      onClick={() => setWasWorkday(!wasWorkday)}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        wasWorkday ? 'bg-dream-600' : 'bg-bgTertiary'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                          wasWorkday ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                    <span className="text-sm text-textTertiary">{wasWorkday ? 'Yes' : 'No'}</span>
                  </div>

                  {wasWorkday && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-textSecondary mb-2">
                          Hours worked before run: {hoursWorkedBefore}
                        </label>
                        <input
                          type="range"
                          min={0}
                          max={12}
                          value={hoursWorkedBefore}
                          onChange={(e) => setHoursWorkedBefore(parseInt(e.target.value))}
                          className="w-full h-2 bg-bgTertiary rounded-lg appearance-none cursor-pointer accent-dream-500"
                        />
                        <div className="flex justify-between text-xs text-tertiary mt-1">
                          <span>0h</span>
                          <span>12h</span>
                        </div>
                      </div>

                      <Slider
                        label="Work stress level"
                        value={workStress}
                        onChange={setWorkStress}
                        min={0}
                        max={10}
                      />

                      <div>
                        <label className="block text-sm font-medium text-textSecondary mb-2">
                          Mental energy pre-run
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {mentalEnergyOptions.map((energy) => (
                            <button
                              key={energy}
                              type="button"
                              onClick={() => setMentalEnergyPreRun(mentalEnergyPreRun === energy ? '' : energy)}
                              className={cn(
                                'px-4 py-2 rounded-lg font-medium transition-all',
                                mentalEnergyPreRun === energy
                                  ? 'bg-dream-600 text-white'
                                  : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                              )}
                            >
                              {mentalEnergyLabels[energy]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Original Recovery fields */}
              <Slider
                label="Sleep quality last night"
                value={sleepQuality}
                onChange={setSleepQuality}
                min={0}
                max={10}
              />

              <div>
                <label className="block text-sm font-medium text-textSecondary mb-2">
                  Hours of sleep: {sleepHours.toFixed(1)}
                </label>
                <input
                  type="range"
                  min={3}
                  max={12}
                  step={0.5}
                  value={sleepHours}
                  onChange={(e) => setSleepHours(parseFloat(e.target.value))}
                  className="w-full h-2 bg-bgTertiary rounded-lg appearance-none cursor-pointer accent-dream-500"
                />
              </div>

              <Slider
                label="Stress level"
                value={stress}
                onChange={setStress}
                min={0}
                max={10}
              />

              <Slider
                label="Soreness"
                value={soreness}
                onChange={setSoreness}
                min={0}
                max={10}
              />

              <Slider
                label="Mood"
                value={mood}
                onChange={setMood}
                min={0}
                max={10}
              />

              <div>
                <label className="block text-sm font-medium text-textSecondary mb-2">
                  Life context
                </label>
                <div className="flex flex-wrap gap-2">
                  {lifeTagOptions.map((tag) => (
                    <Chip
                      key={tag}
                      label={formatLabel(tag)}
                      selected={lifeTags.includes(tag)}
                      onClick={() => toggleArrayItem(lifeTags, setLifeTags, tag)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Section D: Nutrition & Hydration */}
          <Section
            title="Nutrition & Hydration"
            isExpanded={expandedSections.has('nutrition')}
            onToggle={() => toggleSection('nutrition')}
          >
            <div className="space-y-4">
              <Slider
                label="Hydration"
                value={hydration}
                onChange={setHydration}
                min={0}
                max={10}
              />

              <div>
                <label className="block text-sm font-medium text-textSecondary mb-2">
                  Hydration issues
                </label>
                <div className="flex flex-wrap gap-2">
                  {hydrationTagOptions.map((tag) => (
                    <Chip
                      key={tag}
                      label={formatLabel(tag)}
                      selected={hydrationTags.includes(tag)}
                      onClick={() => toggleArrayItem(hydrationTags, setHydrationTags, tag)}
                    />
                  ))}
                </div>
              </div>

              <Slider
                label="Pre-run fueling"
                value={fueling}
                onChange={setFueling}
                min={0}
                max={10}
              />

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="underfueled"
                  checked={underfueled}
                  onChange={(e) => setUnderfueled(e.target.checked)}
                  className="h-4 w-4 rounded border-strong text-dream-500 focus:ring-dream-500"
                />
                <label htmlFor="underfueled" className="text-sm text-textSecondary">
                  Felt underfueled
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="forgotElectrolytes"
                  checked={forgotElectrolytes}
                  onChange={(e) => setForgotElectrolytes(e.target.checked)}
                  className="h-4 w-4 rounded border-strong text-dream-500 focus:ring-dream-500"
                />
                <label htmlFor="forgotElectrolytes" className="text-sm text-textSecondary">
                  Forgot electrolytes
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-textSecondary mb-2">
                  Caffeine before run
                </label>
                <div className="flex flex-wrap gap-2">
                  {caffeineOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setCaffeine(caffeine === opt ? '' : opt)}
                      className={cn(
                        'px-4 py-2 rounded-lg font-medium transition-all capitalize',
                        caffeine === opt
                          ? 'bg-dream-600 text-white'
                          : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              <Slider
                label="Alcohol in last 24h"
                value={alcohol24h}
                onChange={setAlcohol24h}
                min={0}
                max={10}
              />

              <Slider
                label="Illness/sickness"
                value={illness}
                onChange={setIllness}
                min={0}
                max={10}
              />

              <Slider
                label="Stomach issues"
                value={stomach}
                onChange={setStomach}
                min={0}
                max={10}
              />
            </div>
          </Section>

          {/* Section E: Environment */}
          <Section
            title="Environment"
            isExpanded={expandedSections.has('environment')}
            onToggle={() => toggleSection('environment')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-2">
                  Perceived heat
                </label>
                <div className="flex flex-wrap gap-2">
                  {perceivedHeats.map((heat) => (
                    <button
                      key={heat}
                      type="button"
                      onClick={() => setPerceivedHeat(perceivedHeat === heat ? '' : heat)}
                      className={cn(
                        'px-4 py-2 rounded-lg font-medium transition-all capitalize',
                        perceivedHeat === heat
                          ? 'bg-dream-600 text-white'
                          : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                      )}
                    >
                      {heat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-textSecondary mb-2">
                  Temperature vs expected
                </label>
                <div className="flex flex-wrap gap-2">
                  {feltTempOptions.map((temp) => (
                    <button
                      key={temp}
                      type="button"
                      onClick={() => setFeltTemp(feltTemp === temp ? '' : temp)}
                      className={cn(
                        'px-4 py-2 rounded-lg font-medium transition-all capitalize',
                        feltTemp === temp
                          ? 'bg-dream-600 text-white'
                          : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                      )}
                    >
                      {temp}
                    </button>
                  ))}
                </div>
              </div>

              <Slider
                label="Wind/hills difficulty"
                value={windHillsDifficulty}
                onChange={setWindHillsDifficulty}
                min={0}
                max={10}
              />

              <div>
                <label className="block text-sm font-medium text-textSecondary mb-2">
                  Surface conditions
                </label>
                <div className="flex flex-wrap gap-2">
                  {surfaceOptions.map((surf) => (
                    <button
                      key={surf}
                      type="button"
                      onClick={() => setSurface(surface === surf ? '' : surf)}
                      className={cn(
                        'px-4 py-2 rounded-lg font-medium transition-all capitalize',
                        surface === surf
                          ? 'bg-dream-600 text-white'
                          : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                      )}
                    >
                      {surf}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          {/* Section F: Outfit Feedback */}
          <Section
            title="Outfit Feedback"
            isExpanded={expandedSections.has('outfit')}
            onToggle={() => toggleSection('outfit')}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-2">
                  How did your outfit feel overall?
                </label>
                <div className="flex flex-wrap gap-2">
                  {outfitRatings.map((rating) => {
                    const labels: Record<string, string> = {
                      too_cold: 'Too Cold',
                      slightly_cold: 'Slightly Cold',
                      perfect: 'Perfect',
                      slightly_warm: 'Slightly Warm',
                      too_warm: 'Too Warm',
                    };
                    const colors: Record<string, string> = {
                      too_cold: outfitRating === rating ? 'bg-dream-600 text-white' : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover',
                      slightly_cold: outfitRating === rating ? 'bg-dream-400 text-white' : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover',
                      perfect: outfitRating === rating ? 'bg-green-500 text-white' : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover',
                      slightly_warm: outfitRating === rating ? 'bg-rose-300 text-white' : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover',
                      too_warm: outfitRating === rating ? 'bg-red-500 text-white' : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover',
                    };
                    return (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setOutfitRating(outfitRating === rating ? '' : rating)}
                        className={cn(
                          'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                          colors[rating]
                        )}
                      >
                        {labels[rating]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-textSecondary mb-2">
                    Hands
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {extremityRatings.map((rating) => {
                      const labels: Record<string, string> = {
                        fine: 'Fine',
                        cold: 'Cold',
                        painful: 'Painful',
                      };
                      return (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setHandsRating(handsRating === rating ? '' : rating)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                            handsRating === rating
                              ? rating === 'fine' ? 'bg-green-500 text-white' : rating === 'cold' ? 'bg-dream-500 text-white' : 'bg-red-500 text-white'
                              : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                          )}
                        >
                          {labels[rating]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-textSecondary mb-2">
                    Face/Ears
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {extremityRatings.map((rating) => {
                      const labels: Record<string, string> = {
                        fine: 'Fine',
                        cold: 'Cold',
                        painful: 'Painful',
                      };
                      return (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setFaceRating(faceRating === rating ? '' : rating)}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                            faceRating === rating
                              ? rating === 'fine' ? 'bg-green-500 text-white' : rating === 'cold' ? 'bg-dream-500 text-white' : 'bg-red-500 text-white'
                              : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
                          )}
                        >
                          {labels[rating]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-textSecondary mb-2">
                  Removed layers mid-run?
                </label>
                <textarea
                  value={removedLayers}
                  onChange={(e) => setRemovedLayers(e.target.value)}
                  placeholder="e.g., Took off gloves after 2 miles..."
                  className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500 resize-none text-sm"
                  rows={2}
                />
              </div>
            </div>
          </Section>

          {/* Section G: Notes */}
          <Section
            title="Notes"
            isExpanded={expandedSections.has('notes')}
            onToggle={() => toggleSection('notes')}
          >
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any additional notes about this run..."
              className="w-full px-3 py-2 border border-strong rounded-lg focus:ring-2 focus:ring-dream-500 focus:border-dream-500 resize-none"
              rows={3}
            />
          </Section>
        </div>

        <div className="sticky bottom-0 bg-bgSecondary border-t px-6 py-4 rounded-b-xl">
          <button
            onClick={handleSubmit}
            disabled={isPending || !verdict}
            className={cn(
              'w-full py-3 px-4 rounded-lg font-medium transition-colors',
              isPending || !verdict
                ? 'bg-surface-3 text-textTertiary cursor-not-allowed'
                : 'bg-accentTeal text-white hover:bg-accentTeal-hover shadow-sm hover:shadow-md'
            )}
          >
            {isPending ? 'Saving...' : isEdit ? 'Update Assessment' : 'Save Assessment'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  isExpanded,
  onToggle,
  children,
  alwaysExpanded,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  alwaysExpanded?: boolean;
}) {
  return (
    <div className="border border-borderPrimary rounded-lg">
      <button
        type="button"
        onClick={alwaysExpanded ? undefined : onToggle}
        className={cn(
          'w-full px-4 py-3 flex items-center justify-between text-left font-medium text-primary',
          !alwaysExpanded && 'hover:bg-bgTertiary'
        )}
      >
        <span>{title}</span>
        {!alwaysExpanded && (
          <ChevronDown
            className={cn(
              'w-5 h-5 text-tertiary transition-transform',
              isExpanded && 'rotate-180'
            )}
          />
        )}
      </button>
      {isExpanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
  min,
  max,
  markers,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  min: number;
  max: number;
  markers?: string[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-textSecondary mb-2">
        {label}: {value}
      </label>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-bgTertiary rounded-lg appearance-none cursor-pointer accent-dream-500"
      />
      {markers && (
        <div className="flex justify-between text-xs text-tertiary mt-1">
          <span>{markers[0]}</span>
          <span>{markers[markers.length - 1]}</span>
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
        selected
          ? 'bg-dream-600 text-white'
          : 'bg-bgTertiary text-textSecondary hover:bg-bgInteractive-hover'
      )}
    >
      {label}
    </button>
  );
}

function formatLabel(str: string): string {
  return str
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
