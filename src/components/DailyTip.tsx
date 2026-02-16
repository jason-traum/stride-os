'use client';

import { Lightbulb } from 'lucide-react';

interface DailyTipProps {
  phase?: string | null;
  daysUntilRace?: number | null;
  hasRanToday?: boolean;
  currentStreak?: number;
}

const GENERAL_TIPS = [
  { title: "Easy days matter", tip: "80% of your running should be at an easy, conversational pace. The aerobic base you build makes everything else possible." },
  { title: "Sleep is training", tip: "Most adaptation happens during deep sleep. Aim for 7-9 hours, especially after hard efforts." },
  { title: "Consistency beats intensity", tip: "Running 5 days a week beats running 3 days hard. Show up regularly, even when motivation dips." },
  { title: "Trust the process", tip: "Fitness gains are invisible day-to-day but compound over weeks. Stay patient with the plan." },
  { title: "Listen to your body", tip: "Sharp pain is a warning. Fatigue is normal. Learn to distinguish between discomfort and injury signals." },
  { title: "Fuel your runs", tip: "Running on empty limits performance. Eat 2-3 hours before harder efforts, and refuel within 30 minutes after." },
  { title: "The long run is king", tip: "Your weekly long run builds endurance, mental toughness, and fat-burning efficiency. Protect this run." },
];

const RACE_WEEK_TIPS = [
  { title: "Trust your training", tip: "The hay is in the barn. This week is about freshening up, not getting fitter. Easy runs and rest." },
  { title: "Stick to routine", tip: "Race week isn't the time for new foods, new shoes, or new anything. Go with what works." },
  { title: "Visualize success", tip: "Spend time imagining your race going well. See yourself crossing the finish line strong." },
];

const RECOVERY_TIPS = [
  { title: "Active recovery works", tip: "Light movement like walking or easy jogging helps clear metabolic waste faster than complete rest." },
  { title: "Hydration matters", tip: "You're often more dehydrated than you think. Aim for pale yellow urine as your hydration guide." },
];

const STREAK_TIPS = [
  { title: "Keep the streak alive!", tip: "Even a short, easy run counts. Don't let perfect be the enemy of good." },
];

export function DailyTip({ phase, daysUntilRace, hasRanToday, currentStreak }: DailyTipProps) {
  // Select appropriate tip based on context
  let tipPool = GENERAL_TIPS;
  
  if (daysUntilRace !== null && daysUntilRace !== undefined && daysUntilRace <= 7 && daysUntilRace > 0) {
    tipPool = RACE_WEEK_TIPS;
  } else if (phase === 'recovery' || phase === 'taper') {
    tipPool = RECOVERY_TIPS;
  } else if (currentStreak && currentStreak >= 3 && !hasRanToday) {
    tipPool = STREAK_TIPS;
  }
  
  // Use date-based selection for consistent daily tips
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
  const tipIndex = dayOfYear % tipPool.length;
  const tip = tipPool[tipIndex];

  return (
    <div className="bg-bgTertiary rounded-xl border border-borderPrimary p-4">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 bg-dream-900/40 rounded-full flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-4 h-4 text-dream-400" />
        </div>
        <div>
          <h3 className="font-medium text-textPrimary text-sm">{tip.title}</h3>
          <p className="text-sm text-textSecondary mt-0.5">{tip.tip}</p>
        </div>
      </div>
    </div>
  );
}
