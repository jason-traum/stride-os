// Beginner-Friendly and Simplified Workout Templates
// For runners who want effective training without complexity

import { WorkoutTemplate } from './comprehensive-library';

export const BEGINNER_FRIENDLY_WORKOUTS: Record<string, WorkoutTemplate[]> = {
  // ===== SIMPLE LONG RUNS =====
  simple_long_runs: [
    {
      id: 'basic_long_run',
      name: 'Basic Long Run',
      category: 'long_run',
      description: 'Just run longer than usual at a comfortable pace',
      structure: 'Run for 60-90+ minutes at a pace where you can chat',
      targetPace: 'Conversational pace',
      purpose: ['Build endurance', 'Mental confidence'],
      physiologicalTarget: 'Aerobic base',
      example: '8-12 miles at a comfortable pace',
      difficulty: 'beginner',
      coachingNote: 'This is your weekly "time on feet" run. Don\'t worry about pace.'
    },
    {
      id: 'easy_progression_long',
      name: 'Simple Progression Long Run',
      category: 'long_run',
      description: 'Start slow, finish slightly faster',
      structure: 'First 2/3 easy, last 1/3 pick it up a bit',
      targetPace: 'Easy → "Feeling good" pace',
      purpose: ['Learn to pace yourself', 'Build confidence'],
      physiologicalTarget: 'Aerobic endurance',
      example: '10 miles: 7 miles easy, 3 miles slightly faster',
      difficulty: 'beginner',
      coachingNote: 'Don\'t force the progression - let it happen naturally'
    },
    {
      id: 'social_long_run',
      name: 'Social Long Run',
      category: 'long_run',
      description: 'Long run with friends at conversational pace',
      structure: 'Meet up with friends and run at talking pace',
      targetPace: 'Whatever pace allows conversation',
      purpose: ['Make long runs enjoyable', 'Build community'],
      physiologicalTarget: 'Aerobic base + mental health',
      difficulty: 'beginner',
      coachingNote: 'The best pace is one where everyone can talk'
    }
  ],

  // ===== SIMPLE TEMPO RUNS =====
  simple_tempo: [
    {
      id: 'basic_tempo',
      name: 'Basic Tempo Run',
      category: 'tempo',
      description: 'Steady, "comfortably hard" effort',
      structure: '20-30 minutes at a pace that feels challenging but sustainable',
      targetPace: 'Comfortably hard - you can speak in short sentences',
      purpose: ['Get comfortable being uncomfortable', 'Build mental strength'],
      physiologicalTarget: 'Lactate threshold',
      example: '10min warmup + 20min tempo + 10min cooldown',
      difficulty: 'beginner',
      coachingNote: 'If you can chat easily, speed up. If you can\'t speak at all, slow down.'
    },
    {
      id: 'tempo_sandwich',
      name: 'Tempo Sandwich',
      category: 'tempo',
      description: 'Tempo run broken into manageable chunks',
      structure: '3 x 10 minutes tempo with 2 minutes easy between',
      targetPace: 'Same effort as continuous tempo',
      purpose: ['Makes tempo less intimidating', 'Same benefits as continuous'],
      physiologicalTarget: 'Lactate threshold',
      example: '10min easy + 3x10min tempo/2min easy + 10min easy',
      difficulty: 'beginner',
      coachingNote: 'Breaking it up makes 30 minutes of tempo feel easier'
    },
    {
      id: 'feel_good_tempo',
      name: 'Feel-Good Tempo',
      category: 'tempo',
      description: 'Tempo at the slower end of the range',
      structure: '15-25 minutes at "smooth and controlled" effort',
      targetPace: 'Fast but relaxed - could hold for an hour',
      purpose: ['Build confidence at faster paces', 'Improve efficiency'],
      physiologicalTarget: 'Aerobic threshold',
      difficulty: 'beginner',
      coachingNote: 'Should finish feeling like you could do more'
    }
  ],

  // ===== SIMPLE SPEED WORK =====
  simple_speed: [
    {
      id: 'basic_intervals',
      name: 'Basic Track Intervals',
      category: 'speed',
      description: 'Simple repeats at "hard" effort',
      structure: '4-6 x 2-3 minutes hard with equal rest',
      targetPace: 'Hard but controlled - not sprinting',
      purpose: ['Get comfortable running fast', 'Build speed'],
      physiologicalTarget: 'VO2max',
      example: '6 x 800m with 2-3min rest',
      difficulty: 'beginner',
      coachingNote: 'First one should feel too easy, last one challenging'
    },
    {
      id: 'simple_fartlek',
      name: 'Simple Fartlek',
      category: 'fartlek',
      description: 'Speed play - fast/slow as you feel',
      structure: '30-40 minutes with random fast surges when you feel good',
      targetPace: 'Mix of easy and "fun fast" surges',
      purpose: ['Make speed work fun', 'Listen to your body'],
      physiologicalTarget: 'Mixed energy systems',
      example: 'Run to the next lamp post fast, then easy to the corner',
      difficulty: 'beginner',
      coachingNote: 'No rules - surge when you feel like it'
    },
    {
      id: 'starter_strides',
      name: 'Strides Workout',
      category: 'speed',
      description: 'Short, relaxed fast runs',
      structure: 'Easy run + 4-6 x 20-30 second strides',
      targetPace: 'Build to fast but relaxed - not sprinting',
      purpose: ['Improve form', 'Add speed without stress'],
      physiologicalTarget: 'Neuromuscular',
      example: '30min easy + 6 x 100m strides with walk back',
      difficulty: 'beginner',
      coachingNote: 'Think "fast and smooth" not "hard"'
    }
  ],

  // ===== EASY/RECOVERY RUNS =====
  easy_runs: [
    {
      id: 'true_easy_run',
      name: 'True Easy Run',
      category: 'easy',
      description: 'Genuinely easy effort throughout',
      structure: '30-60 minutes at conversational pace',
      targetPace: 'Easy enough to have a full conversation',
      purpose: ['Recovery', 'Build aerobic base', 'Enjoy running'],
      physiologicalTarget: 'Aerobic development',
      difficulty: 'beginner',
      coachingNote: 'Easy days easy, hard days hard - this is an EASY day'
    },
    {
      id: 'recovery_shuffle',
      name: 'Recovery Shuffle',
      category: 'recovery',
      description: 'Super easy recovery jog',
      structure: '20-40 minutes barely faster than walking',
      targetPace: 'Embarrassingly slow',
      purpose: ['Promote recovery', 'Add volume safely'],
      physiologicalTarget: 'Active recovery',
      difficulty: 'beginner',
      coachingNote: 'If it feels too slow, you\'re doing it right'
    },
    {
      id: 'coffee_run',
      name: 'Coffee Run',
      category: 'easy',
      description: 'Easy run to/from your favorite coffee shop',
      structure: 'Easy run with a coffee stop in the middle',
      targetPace: 'Social pace',
      purpose: ['Make running part of life', 'Enjoy the process'],
      physiologicalTarget: 'Aerobic base + lifestyle integration',
      difficulty: 'beginner',
      coachingNote: 'Running doesn\'t always have to be "training"'
    }
  ],

  // ===== BEGINNER RACE PREP =====
  race_prep: [
    {
      id: 'race_pace_practice',
      name: 'Race Pace Practice',
      category: 'race_specific',
      description: 'Practice running at your goal race pace',
      structure: '2-4 miles at goal race pace',
      targetPace: 'The pace you want to run on race day',
      purpose: ['Get familiar with race pace', 'Build confidence'],
      physiologicalTarget: 'Race specific systems',
      example: 'For a 10K: 2mi warmup + 3mi at goal 10K pace + 1mi cooldown',
      difficulty: 'beginner',
      coachingNote: 'Should feel "comfortably hard" - sustainable for the race distance'
    },
    {
      id: 'mini_time_trial',
      name: 'Mini Time Trial',
      category: 'race_specific',
      description: 'Short race effort to gauge fitness',
      structure: 'Warmup + 2-3 miles at hard effort + cooldown',
      targetPace: 'Race effort but not all-out',
      purpose: ['Test fitness', 'Practice racing'],
      physiologicalTarget: 'Race simulation',
      example: '2mi warmup + 3mi time trial + 2mi cooldown',
      difficulty: 'beginner',
      coachingNote: 'Go out conservatively - finish strong'
    }
  ],

  // ===== FUN VARIATIONS =====
  fun_workouts: [
    {
      id: 'explore_run',
      name: 'Exploration Run',
      category: 'easy',
      description: 'Run somewhere new without worrying about pace',
      structure: 'Pick a new route and just explore',
      targetPace: 'Whatever feels good',
      purpose: ['Keep running fresh', 'Mental health'],
      physiologicalTarget: 'Aerobic base + mental refresh',
      difficulty: 'beginner',
      coachingNote: 'Take your phone for navigation - get a little lost!'
    },
    {
      id: 'podcast_run',
      name: 'Podcast Long Run',
      category: 'long_run',
      description: 'Easy run for the length of a podcast/audiobook',
      structure: 'Run easy for 45-90 minutes while listening',
      targetPace: 'Zone out pace',
      purpose: ['Make time pass', 'Multitask'],
      physiologicalTarget: 'Aerobic base',
      difficulty: 'beginner',
      coachingNote: 'Pick something engaging - time will fly'
    },
    {
      id: 'destination_run',
      name: 'Destination Run',
      category: 'easy',
      description: 'Run to a specific place for a reason',
      structure: 'Run to brunch, the gym, or a friend\'s house',
      targetPace: 'Easy to moderate',
      purpose: ['Make running practical', 'Save on transport'],
      physiologicalTarget: 'Aerobic base',
      difficulty: 'beginner',
      coachingNote: 'Pack a change of clothes if needed!'
    }
  ]
};