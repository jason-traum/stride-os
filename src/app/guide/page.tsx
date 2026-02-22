'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  MessageCircle,
  Sun,
  Calendar,
  PlusCircle,
  Flag,
  Footprints,
  Shirt,
  BarChart2,
  Settings,
  Timer,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
  Brain,
  Zap,
  Heart,
  CloudSun,
  Activity,
  Thermometer,
  ShieldAlert,
  TrendingUp,
  Layers,
  Wrench,
  MessageSquare,
  BookOpen,
  Rocket,
  LineChart,
  Trophy,
  ArrowRight,
  Map,
  Utensils,
  History,
  Eye,
  Gauge,
  RefreshCw,
  Lightbulb,
  Star,
  ChevronRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SectionDef {
  id: string;
  title: string;
  icon: React.ElementType;
  group: string;
  defaultOpen?: boolean;
  content: React.ReactNode;
  link?: string;
}

// ---------------------------------------------------------------------------
// ExpandableSection (enhanced)
// ---------------------------------------------------------------------------

function ExpandableSection({
  id,
  title,
  icon: Icon,
  defaultOpen = false,
  content,
  link,
}: {
  id: string;
  title: string;
  icon: React.ElementType;
  defaultOpen?: boolean;
  content: React.ReactNode;
  link?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div id={id} className="bg-surface-1 rounded-xl border border-default overflow-hidden scroll-mt-24">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-bgTertiary transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-dream-500/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-dream-600" />
          </div>
          <h3 className="font-semibold text-primary text-left">{title}</h3>
        </div>
        {open ? (
          <ChevronUp className="w-5 h-5 text-tertiary flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-tertiary flex-shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-5 border-t border-subtle">
          <div className="pt-4 space-y-4 text-sm leading-relaxed">
            {content}
            {link && (
              <Link
                href={link}
                className="inline-flex items-center gap-2 text-dream-600 hover:text-dream-700 font-medium mt-2"
              >
                Open {title} <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small reusable pieces for rich content
// ---------------------------------------------------------------------------

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-dream-500/5 border border-dream-500/20 rounded-lg p-3 mt-2">
      <Lightbulb className="w-4 h-4 text-dream-600 flex-shrink-0 mt-0.5" />
      <p className="text-textSecondary">{children}</p>
    </div>
  );
}

function CoachPrompt({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-textTertiary italic pl-4 border-l-2 border-dream-500/30">{children}</p>
  );
}

function SubSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="pl-4 border-l-2 border-default space-y-2">
      <h4 className="font-medium text-primary">{title}</h4>
      {children}
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 ml-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 text-textSecondary">
          <span className="text-dream-400 mt-1">&#8226;</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Table of Contents
// ---------------------------------------------------------------------------

const TOC_GROUPS = [
  {
    label: 'Getting Started',
    items: [
      { id: 'getting-started', title: 'Getting Started' },
      { id: 'making-most-of-data', title: 'Making the Most of Your Data' },
    ],
  },
  {
    label: 'Daily Use',
    items: [
      { id: 'today-dashboard', title: 'Today Dashboard' },
      { id: 'ai-coach', title: 'AI Coach' },
      { id: 'quick-log', title: 'Log a Run' },
      { id: 'post-run-reflections', title: 'Post-Run Reflections' },
      { id: 'weekly-insights', title: 'Weekly Insights & Recaps' },
      { id: 'proactive-coach', title: 'Proactive Coach Prompts' },
      { id: 'coach-history', title: 'Coach History' },
    ],
  },
  {
    label: 'Training',
    items: [
      { id: 'training-plan', title: 'Training Plan' },
      { id: 'races', title: 'Races & Goals' },
      { id: 'race-predictions', title: 'Race Predictions Engine' },
      { id: 'training-load', title: 'Training Load (CTL/ATL/TSB)' },
      { id: 'recovery-model', title: 'Recovery Model' },
      { id: 'workout-audibles', title: 'Workout Audibles' },
      { id: 'injury-risk', title: 'Injury Risk Monitoring' },
    ],
  },
  {
    label: 'Analysis',
    items: [
      { id: 'analytics', title: 'Analytics Hub' },
      { id: 'workout-detail', title: 'Workout Detail Pages' },
      { id: 'performance-trends', title: 'Performance Trends' },
      { id: 'threshold-detection', title: 'Threshold Detection' },
      { id: 'interval-analysis', title: 'Interval Analysis' },
      { id: 'prs-best-efforts', title: 'PRs & Best Efforts' },
      { id: 'running-economy', title: 'Running Economy' },
    ],
  },
  {
    label: 'Tools',
    items: [
      { id: 'pace-calculator', title: 'Pace Calculator' },
      { id: 'weather-performance', title: 'Weather Performance' },
      { id: 'heat-adaptation', title: 'Heat Adaptation' },
      { id: 'fueling', title: 'Fueling Guidance' },
    ],
  },
  {
    label: 'Equipment',
    items: [
      { id: 'shoes', title: 'Shoe Tracking' },
      { id: 'wardrobe', title: 'Wardrobe & Outfit Recs' },
    ],
  },
  {
    label: 'Settings & Integration',
    items: [
      { id: 'strava-sync', title: 'Strava Integration' },
      { id: 'activity-cleanup', title: 'Activity Cleanup' },
      { id: 'profile-settings', title: 'Profile & Settings' },
    ],
  },
  {
    label: 'Advanced',
    items: [
      { id: 'bq-chasers', title: 'For BQ Chasers' },
    ],
  },
];

function TableOfContents() {
  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <div className="bg-surface-1 rounded-xl border border-default p-5">
      <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-dream-600" />
        Table of Contents
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        {TOC_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-semibold text-dream-600 uppercase tracking-wide mb-1.5">
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => scrollTo(item.id)}
                    className="text-sm text-textSecondary hover:text-dream-600 transition-colors text-left"
                  >
                    {item.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Group Header
// ---------------------------------------------------------------------------

function SectionGroupHeader({
  icon: Icon,
  title,
  id,
}: {
  icon: React.ElementType;
  title: string;
  id?: string;
}) {
  return (
    <div id={id} className="flex items-center gap-3 pt-6 pb-2 scroll-mt-20">
      <div className="w-8 h-8 rounded-lg bg-dream-500/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-dream-600" />
      </div>
      <h2 className="text-xl font-bold text-primary">{title}</h2>
      <div className="flex-1 border-t border-subtle ml-2" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function GuidePage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* ----------------------------------------------------------------- */}
      {/* Hero Header */}
      {/* ----------------------------------------------------------------- */}
      <div className="text-center pt-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-dream-500 to-dream-800 mb-4">
          <BookOpen className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-primary">The Dreamy Guide</h1>
        <p className="text-textSecondary mt-2 max-w-2xl mx-auto">
          Everything you need to know about your AI running coach. This is the complete reference for every feature, tool, and insight in Dreamy &mdash; from your first run to race day.
        </p>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Value Proposition Banner */}
      {/* ----------------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-dream-600 to-dream-900 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5" />
          <span className="text-sm font-medium text-dream-200 uppercase tracking-wide">
            Adaptive Training
          </span>
        </div>
        <h2 className="text-2xl font-bold mb-3">Training That Evolves With You</h2>
        <p className="text-dream-100 mb-4">
          Dreamy builds a personalized training plan around your goal race, adapts it based on how your body responds, and gives you daily guidance adjusted for weather, fatigue, and life. Think of it as a coach who is always watching, always learning, and always available.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div className="bg-white/10 rounded-lg p-3">
            <p className="font-medium">Personalized Plans</p>
            <p className="text-sm text-dream-100">
              Periodized training built around your goal race, current fitness, and available time
            </p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="font-medium">Multi-Signal Predictions</p>
            <p className="text-sm text-dream-100">
              6 independent estimation signals blended into race predictions with confidence bands
            </p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="font-medium">Daily Guidance</p>
            <p className="text-sm text-dream-100">
              Weather-adjusted paces, outfit recommendations, recovery checks, and workout audibles
            </p>
          </div>
        </div>
        <Link
          href="/coach"
          className="inline-flex items-center gap-2 bg-surface-1 text-dream-600 px-4 py-2 rounded-lg font-medium mt-4 hover:bg-dream-500/10 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Talk to Your Coach
        </Link>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Table of Contents */}
      {/* ----------------------------------------------------------------- */}
      <TableOfContents />

      {/* ================================================================= */}
      {/* GETTING STARTED */}
      {/* ================================================================= */}
      <SectionGroupHeader icon={Rocket} title="Getting Started" />

      <ExpandableSection
        id="getting-started"
        title="Getting Started: Your First Week"
        icon={Rocket}
        defaultOpen={true}
        content={
          <>
            <p className="text-textSecondary">
              Dreamy is designed to feel like texting a knowledgeable running buddy. Here is how to get up and running (pun intended) in the first few days.
            </p>

            <SubSection title="Step 1: Connect Strava">
              <p className="text-textSecondary">
                Go to{' '}
                <Link href="/settings/integrations" className="text-dream-600 underline">
                  Settings &rarr; Integrations
                </Link>{' '}
                and connect your Strava account. This lets Dreamy automatically import new activities after every run. The more historical data Dreamy has, the better your predictions, training load model, and threshold detection will be.
              </p>
              <Tip>
                If you have years of Strava data, ask about bulk import. This brings in your full history so predictions and fitness modeling start accurate from day one.
              </Tip>
            </SubSection>

            <SubSection title="Step 2: Complete Your Profile">
              <p className="text-textSecondary">
                Visit{' '}
                <Link href="/profile" className="text-dream-600 underline">
                  your profile
                </Link>{' '}
                and fill in your running background: weekly mileage, experience level, age, resting heart rate, and max heart rate. This calibrates your heart rate zones, VDOT pacing, and recovery model. The more Dreamy knows about you, the more personalized every recommendation becomes.
              </p>
            </SubSection>

            <SubSection title="Step 3: Set a Goal Race">
              <p className="text-textSecondary">
                Head to{' '}
                <Link href="/races" className="text-dream-600 underline">
                  Races
                </Link>{' '}
                and add your target race. Pick a goal time if you have one, or let Dreamy suggest one based on your current fitness. Everything in the app &mdash; your training plan, weekly volume progression, taper timing, and workout intensities &mdash; is built backward from this race date.
              </p>
              <CoachPrompt>&ldquo;I&apos;m running the Boston Marathon on April 21. My goal is 3:05.&rdquo;</CoachPrompt>
            </SubSection>

            <SubSection title="Step 4: Get Your Training Plan">
              <p className="text-textSecondary">
                Once your goal race is set, Dreamy generates a periodized training plan. Visit{' '}
                <Link href="/plan" className="text-dream-600 underline">
                  the plan page
                </Link>{' '}
                to see it laid out week by week. The plan includes easy days, workouts, long runs, and rest days &mdash; all calibrated to your current fitness and building toward peak fitness on race day.
              </p>
            </SubSection>

            <SubSection title="Step 5: Start Your Daily Routine">
              <p className="text-textSecondary">
                Each day, your flow looks like this:
              </p>
              <BulletList
                items={[
                  'Open the Today page to see your workout, weather, readiness, and any alerts',
                  'Before heading out, check the pre-run briefing for conditions-adjusted paces and what to wear',
                  'Run your workout. If it syncs from Strava, Dreamy picks it up automatically.',
                  'After your run, fill out the post-run reflection (RPE + quick notes) while it is fresh',
                  'Ask the coach anything: "How did that go?", "Am I on track?", "What should I do tomorrow?"',
                ]}
              />
            </SubSection>

            <SubSection title="Step 6: Check Analytics Weekly">
              <p className="text-textSecondary">
                At least once a week, spend a few minutes in{' '}
                <Link href="/analytics" className="text-dream-600 underline">
                  Analytics
                </Link>{' '}
                reviewing your training load, volume trends, and performance charts. On Mondays, check the weekly recap that appears on the Today page for a summary of the prior week.
              </p>
            </SubSection>

            <Tip>
              The single most important habit: talk to your coach every day. Even a quick &ldquo;ready to run&rdquo; before heading out makes a difference because the coach can give you conditions-adjusted guidance and flag anything you should know.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="making-most-of-data"
        title="Making the Most of Your Data"
        icon={LineChart}
        defaultOpen={true}
        content={
          <>
            <p className="text-textSecondary">
              Dreamy gets smarter with more data. Every feature improves when you give it richer inputs. Here is what matters and why.
            </p>

            <SubSection title="Heart Rate Data">
              <p className="text-textSecondary">
                Running with a heart rate monitor (chest strap or optical) unlocks the most powerful features. Heart rate data is used for:
              </p>
              <BulletList
                items={[
                  'Training load calculations (TRIMP-based stress scores)',
                  'Recovery model predictions (how hard was the session really?)',
                  'Threshold detection (finding your lactate threshold from workout data)',
                  'Running economy trends (pace vs heart rate over time)',
                  'Race prediction signals (heart rate drift patterns indicate fitness)',
                  'Zone distribution analysis (are you running easy enough?)',
                ]}
              />
              <Tip>
                A chest strap (Polar H10, Garmin HRM-Pro) is significantly more accurate than a wrist-based optical sensor, especially during intervals. If you are serious about training, the chest strap is the single best investment.
              </Tip>
            </SubSection>

            <SubSection title="Historical Data Depth">
              <p className="text-textSecondary">
                The fitness model (CTL/ATL/TSB) needs about 6 weeks of data before it is reliable, and it works best with 3-6 months. If you connect Strava and bulk-import your history, Dreamy starts with an accurate fitness baseline on day one instead of building from zero.
              </p>
              <BulletList
                items={[
                  '1-2 weeks: Basic pacing, simple predictions',
                  '4-6 weeks: Training load model stabilizes, recovery predictions start',
                  '3+ months: Threshold detection, performance trends, running economy analysis kick in',
                  '6+ months: Multi-signal race predictions become highly accurate',
                  '1+ year: Seasonal patterns, year-over-year progress tracking',
                ]}
              />
            </SubSection>

            <SubSection title="RPE and Reflections">
              <p className="text-textSecondary">
                Rating your perceived exertion after every run may seem small, but it has an outsized impact. RPE lets Dreamy understand the gap between what the data shows and how you actually felt. A 7-mile easy run at 8:30 pace might feel effortless one day and miserable the next &mdash; RPE captures that difference, which helps the coach calibrate intensity and spot early signs of overtraining or accumulated fatigue.
              </p>
            </SubSection>

            <SubSection title="Race Results">
              <p className="text-textSecondary">
                Adding race results (even old ones) is one of the highest-leverage things you can do. A single race result calibrates your VDOT, which sets every training pace. The prediction engine uses race results as its strongest signal. Go to{' '}
                <Link href="/races" className="text-dream-600 underline">
                  Races
                </Link>{' '}
                and add any race from the past year &mdash; even a casual 5K or 10K.
              </p>
            </SubSection>

            <SubSection title="Consistency Over Perfection">
              <p className="text-textSecondary">
                You do not need a perfect Garmin with every metric. The most important thing is consistency: log every run, rate RPE regularly, and let Strava sync handle the details. Even basic distance + time data is enough for the plan and coach to work well. Heart rate and GPS data just add extra depth.
              </p>
            </SubSection>
          </>
        }
      />

      {/* ================================================================= */}
      {/* DAILY USE */}
      {/* ================================================================= */}
      <SectionGroupHeader icon={Sun} title="Daily Use" />

      <ExpandableSection
        id="today-dashboard"
        title="Today Dashboard"
        icon={Sun}
        defaultOpen={true}
        link="/today"
        content={
          <>
            <p className="text-textSecondary">
              The Today page is your daily home base. It shows everything you need to know at a glance: what to run, how ready you are, what the weather looks like, and any alerts or celebrations worth noting.
            </p>

            <SubSection title="Today's Workout">
              <p className="text-textSecondary">
                The top card shows your planned workout for the day, pulled from your training plan. It includes the workout type (easy, tempo, intervals, long run, rest), target distance, and pace targets adjusted for current weather conditions. If the weather is hot, you will see slower pace targets. If you are fatigued, the coach might suggest an audible.
              </p>
            </SubSection>

            <SubSection title="Readiness Score">
              <p className="text-textSecondary">
                Your readiness score is a composite number reflecting how prepared your body is for today&apos;s training. It factors in recent training load, recovery time since your last hard effort, cumulative fatigue, and sleep/stress indicators. A high readiness means you are fresh and can handle quality work. A low readiness is a signal to back off or swap to an easier session.
              </p>
            </SubSection>

            <SubSection title="Weather Card">
              <p className="text-textSecondary">
                Real-time weather for your location with running-specific context. It does not just show temperature &mdash; it shows heat index, wind chill, humidity, and how those conditions affect your expected running performance. You will see a suggested pace adjustment (e.g., &ldquo;+15 sec/mile for heat&rdquo;) and what to wear.
              </p>
            </SubSection>

            <SubSection title="Recovery Card">
              <p className="text-textSecondary">
                A personalized recovery status based on your recent training. It shows estimated recovery percentage, time until fully recovered, and the factors influencing recovery (training load, intensity of recent workouts, back-to-back hard days). This is not generic &mdash; it learns your individual recovery patterns over time.
              </p>
            </SubSection>

            <SubSection title="Smart Training Cues">
              <p className="text-textSecondary">
                Contextual nudges that appear when relevant. Examples: &ldquo;Your long run tomorrow is 18 miles &mdash; consider extra hydration today&rdquo;, &ldquo;You have run 4 days in a row &mdash; consider taking tomorrow easy&rdquo;, or &ldquo;Your training load is building well this week.&rdquo; These are generated from your actual training data, not generic tips.
              </p>
            </SubSection>

            <SubSection title="Post-Run Reflection Cards">
              <p className="text-textSecondary">
                After a recent workout that hasn&apos;t been reflected on, a card appears on the Today page prompting you to rate RPE and add quick notes. This card auto-detects unreflected workouts and surfaces the most recent one.
              </p>
            </SubSection>

            <SubSection title="PR Celebrations">
              <p className="text-textSecondary">
                When you set a personal record (fastest 5K, longest run, best mile split, etc.), a celebration card appears on your Today page. Dreamy tracks PRs across multiple distances and effort types automatically.
              </p>
            </SubSection>

            <SubSection title="Weekly Recap (Mondays)">
              <p className="text-textSecondary">
                On Mondays, a weekly recap card appears summarizing the previous week: total mileage, number of runs, key workouts completed, training load change, and how it compared to the plan. It is the equivalent of a weekly check-in with your coach.
              </p>
            </SubSection>

            <SubSection title="Workout Audibles">
              <p className="text-textSecondary">
                When conditions suggest the planned workout should be modified &mdash; extreme heat, accumulated fatigue, illness, or travel &mdash; audible options appear on the Today page. You can accept the planned workout, swap to an alternative, or skip. This is how the plan stays adaptive on a daily basis.
              </p>
            </SubSection>

            <SubSection title="Quick Coach Input">
              <p className="text-textSecondary">
                A quick-access text field on the Today page lets you send a message to your coach without navigating away. Great for quick updates like &ldquo;legs are tired today&rdquo; or &ldquo;ready to run.&rdquo;
              </p>
            </SubSection>

            <SubSection title="Running Streaks">
              <p className="text-textSecondary">
                Your current running streak (consecutive days with a run) is displayed with a badge. Streaks are tracked automatically and celebrate consistency without encouraging overtraining &mdash; rest days are part of good training.
              </p>
            </SubSection>

            <Tip>
              Make the Today page your daily starting point. Open it before every run to get the full picture: what to do, how you should feel, what to wear, and whether to push or pull back.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="ai-coach"
        title="AI Coach"
        icon={MessageCircle}
        defaultOpen={true}
        link="/coach"
        content={
          <>
            <p className="text-textSecondary">
              The AI coach is the heart of Dreamy. It is a conversational interface that knows your training history, current fitness, goal race, recovery state, and preferences. You can talk to it like you would a real coach &mdash; no menus, no forms, just natural language.
            </p>

            <SubSection title="Log Runs Conversationally">
              <p className="text-textSecondary">
                Describe your run naturally and the coach parses everything &mdash; distance, time, pace, type, shoes, conditions, and how it felt. You do not need to fill out a form. If you forget a detail, the coach will ask.
              </p>
              <CoachPrompt>&ldquo;Just did 8 miles easy in 1:04, felt smooth, wore my Pegasus 40s&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;10 miler this morning, started at 8:30 and negative split to 7:45. Humid but manageable.&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;5x1000 at the track, averaged 3:42 with 90 second jogs. Total was about 8 miles with warmup.&rdquo;</CoachPrompt>
            </SubSection>

            <SubSection title="Pre-Run Briefings">
              <p className="text-textSecondary">
                Before heading out, ask the coach for a briefing. You will get: today&apos;s planned workout with pace targets adjusted for weather, what to wear, any relevant alerts (fatigue, heat, etc.), and a motivational note about where this workout fits in your training arc.
              </p>
              <CoachPrompt>&ldquo;Ready to run&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;What should I do today?&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;Briefing for my long run tomorrow&rdquo;</CoachPrompt>
            </SubSection>

            <SubSection title="Plan Modifications">
              <p className="text-textSecondary">
                Life happens. Tell your coach and they will help you adjust the plan intelligently without derailing your overall training arc. The coach understands training periodization and will redistribute workouts, adjust volume, or insert rest days as needed.
              </p>
              <CoachPrompt>&ldquo;I only have 30 minutes today&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;I&apos;m traveling Tuesday through Thursday, no access to trails&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;My knee is a little sore after yesterday&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;Can we make this a down week? I&apos;m exhausted.&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;Swap my tempo to tomorrow and do easy today&rdquo;</CoachPrompt>
            </SubSection>

            <SubSection title="Training Analysis">
              <p className="text-textSecondary">
                Ask the coach to analyze any aspect of your training. It has access to your full workout history, training load model, threshold data, and performance trends.
              </p>
              <CoachPrompt>&ldquo;Why did that run feel so hard?&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;How did my week go?&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;Am I training too hard? My easy runs feel harder than usual.&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;What does my training load look like right now?&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;Compare this month to last month&rdquo;</CoachPrompt>
            </SubSection>

            <SubSection title="Race Strategy">
              <p className="text-textSecondary">
                As your race approaches, the coach can help with pacing strategy, taper planning, race-day logistics, and mental preparation. It knows your predicted times and will give honest, data-backed advice.
              </p>
              <CoachPrompt>&ldquo;Am I ready for my marathon?&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;What pace should I go out at?&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;It is supposed to be 75F and humid on race day. How does that change my plan?&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;Walk me through my race day strategy&rdquo;</CoachPrompt>
            </SubSection>

            <SubSection title="Threshold-Aware Pacing">
              <p className="text-textSecondary">
                All pace recommendations from the coach are informed by your auto-detected lactate threshold pace, not just generic VDOT tables. This means your tempo, threshold, and interval paces reflect your actual current fitness, not a theoretical estimate.
              </p>
            </SubSection>

            <SubSection title="Condition-Adjusted Recommendations">
              <p className="text-textSecondary">
                The coach automatically factors in heat, humidity, altitude, wind, and your heat adaptation level when suggesting paces. A &ldquo;7:30 tempo&rdquo; in January at sea level and a &ldquo;7:30 tempo&rdquo; in August at altitude are not the same effort &mdash; the coach adjusts accordingly.
              </p>
            </SubSection>

            <SubSection title="What the Coach Knows About You">
              <BulletList
                items={[
                  'Your complete workout history (every run, with splits and HR data)',
                  'Your current fitness level (CTL/ATL/TSB training load model)',
                  'Your recovery state (personalized recovery predictions)',
                  'Your goal race and training plan',
                  'Your detected lactate threshold pace',
                  'Your heart rate zones (Tanaka formula or custom)',
                  'Current weather and forecast for your location',
                  'Your shoe rotation and mileage',
                  'Your RPE history and subjective feedback patterns',
                  'Your race history and prediction signals',
                  'Your profile: age, experience, weekly mileage, preferred days',
                ]}
              />
            </SubSection>

            <Tip>
              The coach is not a chatbot that gives generic advice. It has deep access to your data and gives specific, quantitative answers. Ask specific questions and you will get specific answers.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="quick-log"
        title="Log a Run"
        icon={PlusCircle}
        link="/log"
        content={
          <>
            <p className="text-textSecondary">
              While most runners log through Strava auto-sync or by telling the coach, the manual log page is useful for quick entries or runs without GPS.
            </p>

            <SubSection title="Quick Entry Fields">
              <p className="text-textSecondary">
                Enter distance, time, and workout type. Pace is calculated automatically. You can optionally add shoe, RPE, and notes. For treadmill runs or GPS-free sessions, this is the fastest way to get data into the system.
              </p>
            </SubSection>

            <SubSection title="Post-Run Assessment">
              <p className="text-textSecondary">
                Rate how the run felt on a 1-10 RPE scale and add any context. Was it windy? Were your legs heavy from yesterday&apos;s workout? Did you feel great? This subjective data helps the coach and recovery model understand the full picture beyond just pace and heart rate.
              </p>
            </SubSection>

            <SubSection title="Shoe Selection">
              <p className="text-textSecondary">
                Select which shoes you wore from your active rotation. Mileage is tracked automatically. If you always use the same pair, you can set a default shoe in your profile.
              </p>
            </SubSection>

            <Tip>
              For most runners, the best workflow is: run with your watch, let Strava sync, then fill out the post-run reflection on the Today page. Only use manual log for runs without watch data.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="post-run-reflections"
        title="Post-Run Reflections"
        icon={MessageSquare}
        content={
          <>
            <p className="text-textSecondary">
              Post-run reflections are short check-ins after each workout. They capture how the run felt subjectively &mdash; information that GPS data alone cannot provide.
            </p>

            <SubSection title="Why Reflections Matter">
              <p className="text-textSecondary">
                Two runs can have identical pace and heart rate profiles but feel completely different. One might feel effortless while the other is a grind. RPE and context notes capture this gap. The coach uses this data to:
              </p>
              <BulletList
                items={[
                  'Detect early signs of overreaching (RPE trending up while pace stays the same)',
                  'Calibrate future workout difficulty',
                  'Understand which workouts energize you vs. drain you',
                  'Adjust recovery estimates (a "hard" easy run takes more recovery)',
                  'Give you better weekly summaries',
                ]}
              />
            </SubSection>

            <SubSection title="How to Reflect">
              <p className="text-textSecondary">
                After a Strava sync or manual log, a reflection card appears on the Today page. Tap it to rate RPE (1-10 scale) and optionally add a quick note. Takes less than 10 seconds. You can also tell the coach: &ldquo;That run was a 6 RPE, legs were heavy.&rdquo;
              </p>
            </SubSection>

            <SubSection title="RPE Scale Reference">
              <BulletList
                items={[
                  '1-2: Extremely easy, could do this all day',
                  '3-4: Easy, conversational pace, typical recovery/easy run',
                  '5-6: Moderate, comfortably hard, steady-state or tempo feel',
                  '7-8: Hard, threshold to VO2max effort, intervals and races',
                  '9-10: All-out, maximum effort, race finish or sprint',
                ]}
              />
            </SubSection>

            <Tip>
              Aim to reflect on every run within an hour while the feeling is fresh. Consistency here compounds &mdash; after a month of RPE data, the coach&apos;s understanding of your training becomes dramatically more nuanced.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="weekly-insights"
        title="Weekly Insights & Recaps"
        icon={Star}
        content={
          <>
            <p className="text-textSecondary">
              Dreamy generates two types of weekly summaries to keep you informed about the bigger picture of your training.
            </p>

            <SubSection title="Weekly Insights">
              <p className="text-textSecondary">
                Appear mid-week on the Today page. These are data-driven observations about patterns in your training: &ldquo;Your easy pace has improved 10 sec/mile over the past month&rdquo;, &ldquo;You are running 85% of your miles in Zone 2 &mdash; great aerobic base work&rdquo;, or &ldquo;Your training load is at a 3-month high &mdash; watch for fatigue.&rdquo;
              </p>
            </SubSection>

            <SubSection title="Weekly Recaps">
              <p className="text-textSecondary">
                Appear on Mondays. A structured summary of the previous week covering:
              </p>
              <BulletList
                items={[
                  'Total mileage and how it compares to plan',
                  'Number of runs and workout types completed',
                  'Key workout results (tempo splits, interval consistency, long run pace)',
                  'Training load trend (building, maintaining, or recovering)',
                  'Notable achievements or PRs',
                  'Areas for improvement or attention',
                ]}
              />
            </SubSection>

            <SubSection title="Asking the Coach for a Review">
              <p className="text-textSecondary">
                You can request a weekly review at any time by asking the coach:
              </p>
              <CoachPrompt>&ldquo;How did my week go?&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;Give me a training summary for this week&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;How am I trending over the past month?&rdquo;</CoachPrompt>
            </SubSection>
          </>
        }
      />

      <ExpandableSection
        id="proactive-coach"
        title="Proactive Coach Prompts"
        icon={Sparkles}
        content={
          <>
            <p className="text-textSecondary">
              The coach does not just wait for you to ask. It proactively surfaces prompts on your Today page when it notices something worth addressing. These are context-aware suggestions generated from your actual training data.
            </p>

            <SubSection title="Types of Proactive Prompts">
              <BulletList
                items={[
                  'Pre-run prompts: "Ready for today\'s tempo? Here\'s your briefing."',
                  'Recovery warnings: "You\'ve run hard 3 days in a row. Consider an easy day."',
                  'Milestone celebrations: "You just crossed 1,000 miles this year!"',
                  'Plan adherence: "You\'ve missed two planned workouts this week. Want to adjust?"',
                  'Performance observations: "Your easy pace is trending 15 sec/mile faster than 2 months ago."',
                  'Race prep: "Your goal race is 3 weeks away. Time to start thinking about taper."',
                  'Equipment alerts: "Your Pegasus 40s have 487 miles. Time to start breaking in new shoes."',
                ]}
              />
            </SubSection>

            <SubSection title="How They Work">
              <p className="text-textSecondary">
                Proactive prompts are not random tips. They are generated by analyzing your training data against a set of rules and thresholds. Each prompt includes a direct action you can tap to engage the coach on that topic.
              </p>
            </SubSection>
          </>
        }
      />

      <ExpandableSection
        id="coach-history"
        title="Coach History"
        icon={History}
        link="/coach-history"
        content={
          <>
            <p className="text-textSecondary">
              Every conversation you have with the coach is saved and accessible at{' '}
              <Link href="/coach-history" className="text-dream-600 underline">
                /coach-history
              </Link>
              . You can browse past conversations, search for specific topics, and revisit advice the coach has given you.
            </p>

            <SubSection title="Why This Matters">
              <p className="text-textSecondary">
                Over weeks and months, your coach conversations become a training journal. You can look back and see what the coach recommended before a great race, how you adjusted when you were injured, or what your training looked like during a breakthrough phase.
              </p>
            </SubSection>

            <Tip>
              Before a race, review your coach conversations from your last taper period and race. The patterns and advice from previous cycles are valuable.
            </Tip>
          </>
        }
      />

      {/* ================================================================= */}
      {/* TRAINING */}
      {/* ================================================================= */}
      <SectionGroupHeader icon={Calendar} title="Training" />

      <ExpandableSection
        id="training-plan"
        title="Training Plan"
        icon={Calendar}
        link="/plan"
        content={
          <>
            <p className="text-textSecondary">
              Your training plan is a periodized schedule built backward from your goal race. It is not a static PDF &mdash; it is a living plan that adapts as you train.
            </p>

            <SubSection title="Periodized Structure">
              <p className="text-textSecondary">
                The plan follows classic periodization phases:
              </p>
              <BulletList
                items={[
                  'Base phase: Building aerobic volume with mostly easy running. Establishing mileage foundation.',
                  'Build phase: Introducing and increasing workout intensity. Tempo runs, threshold work, and interval sessions appear.',
                  'Peak phase: Highest training load with race-specific workouts. Long runs at goal pace, marathon-pace tempos.',
                  'Taper phase: Reducing volume while maintaining intensity to arrive at the start line fresh and sharp.',
                ]}
              />
            </SubSection>

            <SubSection title="Weekly View">
              <p className="text-textSecondary">
                The plan page shows your current week and upcoming weeks. Each day shows the workout type, target distance, and key details. Completed workouts show actual results vs. planned targets so you can see adherence at a glance.
              </p>
            </SubSection>

            <SubSection title="Workout Types">
              <BulletList
                items={[
                  'Easy: Conversational pace, the foundation of your training (should be 75-80% of weekly mileage)',
                  'Long Run: Extended steady effort building endurance. Pace varies from easy to progressive.',
                  'Tempo: Sustained effort at or near lactate threshold. Typically 20-40 minutes at threshold pace.',
                  'Intervals: Repeated hard efforts with recovery (e.g., 6x800 at 5K pace). Builds VO2max and speed.',
                  'Recovery: Very easy, short run to promote blood flow without adding stress.',
                  'Rest: No running. Just as important as the hard days.',
                  'Race: Tune-up or goal race day.',
                ]}
              />
            </SubSection>

            <SubSection title="Plan Adaptations">
              <p className="text-textSecondary">
                The plan adjusts based on:
              </p>
              <BulletList
                items={[
                  'Your actual training load vs. planned (if you are consistently over/under, the plan recalibrates)',
                  'Coach conversations (when you tell the coach about schedule changes)',
                  'Recovery state (if the recovery model shows you are fatigued, workouts may be modified)',
                  'Missed workouts (the plan redistributes key sessions rather than just skipping them)',
                  'Tune-up race results (a strong race performance may upgrade your goal pace)',
                ]}
              />
            </SubSection>

            <Tip>
              Trust the easy days. The biggest mistake serious recreational runners make is running easy days too fast. Your plan has easy days for a reason &mdash; they let you absorb the hard work. If your easy run RPE is above 4, you are probably going too hard.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="races"
        title="Races & Goals"
        icon={Flag}
        link="/races"
        content={
          <>
            <p className="text-textSecondary">
              The Races page is where you manage your race calendar and see predictions. Everything in Dreamy revolves around your goal race.
            </p>

            <SubSection title="Race Priorities">
              <BulletList
                items={[
                  'A Race (Goal): Your primary target. The training plan is built around this race date and distance. You should have exactly one A race at a time.',
                  'B Race (Tune-up): Important but secondary. Great for practicing race execution, testing fitness, and generating prediction data. The plan accounts for these.',
                  'C Race (Fun): Low priority races that fit into training. Run them as workouts, not all-out efforts.',
                ]}
              />
            </SubSection>

            <SubSection title="Adding Races">
              <p className="text-textSecondary">
                Add races directly on the{' '}
                <Link href="/races" className="text-dream-600 underline">
                  Races page
                </Link>{' '}
                or tell the coach:
              </p>
              <CoachPrompt>&ldquo;I signed up for a half marathon on March 15th&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;Add a 10K tune-up race in 4 weeks as a B race&rdquo;</CoachPrompt>
            </SubSection>

            <SubSection title="Race Results">
              <p className="text-textSecondary">
                After a race, log the result. This is the highest-value data point in the entire system. A single race result recalibrates your VDOT, updates prediction signals, and validates or adjusts your training paces.
              </p>
              <CoachPrompt>&ldquo;I ran 1:28:30 in the half marathon today&rdquo;</CoachPrompt>
            </SubSection>

            <SubSection title="Race Predictions">
              <p className="text-textSecondary">
                Each race shows predicted finish times based on the multi-signal prediction engine (see the dedicated section below). Predictions include a range (optimistic to conservative) and confidence level.
              </p>
            </SubSection>
          </>
        }
      />

      <ExpandableSection
        id="race-predictions"
        title="Race Predictions Engine"
        icon={Target}
        link="/predictions"
        content={
          <>
            <p className="text-textSecondary">
              Dreamy&apos;s race prediction engine is not a simple calculator that takes your 5K time and applies a formula. It blends 6 independent signals, weights them by confidence, and produces predictions with honest confidence bands.
            </p>

            <SubSection title="The 6 Prediction Signals">
              <BulletList
                items={[
                  'VDOT from race results: Your most recent race times converted to VDOT equivalents and projected to the target distance. This is the strongest signal when you have a recent race.',
                  'VDOT from workouts: Threshold, tempo, and interval paces analyzed for implied VDOT. This catches fitness changes between races.',
                  'Training load fitness (CTL): Your chronic training load indicates aerobic capacity. Higher CTL generally supports faster endurance performances.',
                  'Long run performance: Pace and heart rate data from long runs, especially at race-relevant distances. A 20-miler at 8:00 pace with low HR drift says a lot about marathon fitness.',
                  'Heart rate analysis: Cardiac drift patterns, heart rate at given paces over time, and aerobic efficiency trends.',
                  'Workout progression: How your interval and tempo paces have trended over the training cycle. Improving workout paces predict race improvement.',
                ]}
              />
            </SubSection>

            <SubSection title="How Signals Are Blended">
              <p className="text-textSecondary">
                Each signal produces an independent estimate, along with a confidence score based on data recency and quality. The final prediction is a weighted average where higher-confidence signals carry more weight. If signals agree, confidence is high. If they disagree significantly, the prediction shows wider bands and lower overall confidence.
              </p>
            </SubSection>

            <SubSection title="Agreement Scoring">
              <p className="text-textSecondary">
                The predictions page shows an agreement score: how closely the 6 signals converge. High agreement (signals within 1-2% of each other) means the prediction is reliable. Low agreement means something is off &mdash; perhaps your race fitness is ahead of your workout fitness, or vice versa. This is valuable information on its own.
              </p>
            </SubSection>

            <SubSection title="The Predictions Page (/predictions)">
              <p className="text-textSecondary">
                The dedicated{' '}
                <Link href="/predictions" className="text-dream-600 underline">
                  Predictions page
                </Link>{' '}
                provides a deep dive into your race predictions with:
              </p>
              <BulletList
                items={[
                  'Charts showing how each signal has trended over time',
                  'Signal-by-signal breakdown showing the estimate and confidence from each',
                  'Prediction history: how your projected time has changed week-over-week',
                  'Confidence bands showing optimistic, expected, and conservative estimates',
                  'Comparison against your goal time (are you on track?)',
                ]}
              />
            </SubSection>

            <SubSection title="Making Predictions More Accurate">
              <BulletList
                items={[
                  'Run a tune-up race: A recent race result is the single most impactful data point',
                  'Run with heart rate: Enables cardiac drift analysis and better workout-to-VDOT conversion',
                  'Do race-specific workouts: Marathon-pace long runs, threshold tempos, and goal-pace intervals all feed signals',
                  'Log RPE consistently: Helps calibrate effort vs. pace relationships',
                  'More data = better: 3+ months of consistent training data enables all 6 signals',
                ]}
              />
            </SubSection>

            <Tip>
              Do not just look at the final predicted time. Study the signal breakdown. If your workout VDOT is much faster than your race VDOT, you might be racing conservatively. If your training load is high but workout paces are stagnant, you might need more quality over quantity.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="training-load"
        title="Training Load (CTL/ATL/TSB)"
        icon={Activity}
        link="/analytics/load"
        content={
          <>
            <p className="text-textSecondary">
              The training load dashboard at{' '}
              <Link href="/analytics/load" className="text-dream-600 underline">
                /analytics/load
              </Link>{' '}
              is your window into how training stress is accumulating and how your body is adapting. It uses the same model used by elite coaches worldwide.
            </p>

            <SubSection title="Understanding the Three Numbers">
              <p className="text-textSecondary">
                <strong className="text-primary">Fitness (CTL - Chronic Training Load):</strong> A 42-day exponentially-weighted moving average of daily training stress. Think of it as your aerobic &ldquo;bank account&rdquo; &mdash; the cumulative fitness you have built over weeks and months. Higher CTL = more training absorbed = more capacity. CTL rises slowly and falls slowly.
              </p>
              <p className="text-textSecondary mt-2">
                <strong className="text-primary">Fatigue (ATL - Acute Training Load):</strong> A 7-day exponentially-weighted moving average. This represents recent stress and short-term fatigue. ATL spikes after hard training blocks and drops quickly during recovery. High ATL is not bad &mdash; it means you are training hard. It only becomes a problem if it stays elevated without recovery.
              </p>
              <p className="text-textSecondary mt-2">
                <strong className="text-primary">Form (TSB - Training Stress Balance):</strong> Fitness minus Fatigue (CTL - ATL). This is the key number for race readiness:
              </p>
              <BulletList
                items={[
                  'Positive TSB (5 to 25): You are fresh. Good for racing or quality workouts. A TSB of 15-25 on race day is the sweet spot.',
                  'Slightly negative TSB (-10 to 0): Normal training state. You are absorbing training but not overly fatigued.',
                  'Negative TSB (-10 to -30): You are building load. This is expected during build and peak phases.',
                  'Very negative TSB (below -30): Overreaching territory. Sustained time here risks overtraining. Back off.',
                ]}
              />
            </SubSection>

            <SubSection title="Training Stress Scores">
              <p className="text-textSecondary">
                Each workout gets a stress score based on TRIMP (Training Impulse), which uses heart rate data to calculate the physiological load. If heart rate data is not available, stress is estimated from pace and duration. This is why running with a heart rate monitor makes the model more accurate.
              </p>
            </SubSection>

            <SubSection title="Ramp Rate">
              <p className="text-textSecondary">
                The ramp rate shows how quickly your CTL (fitness) is changing. A ramp rate of 3-7 per week is generally safe and productive. Above 7 increases injury risk. Below 0 means fitness is declining. The dashboard shows ramp rate and flags when it is in a risky range.
              </p>
            </SubSection>

            <SubSection title="The Dashboard">
              <p className="text-textSecondary">
                The load dashboard at /analytics/load includes:
              </p>
              <BulletList
                items={[
                  'Current CTL, ATL, and TSB values with status cards',
                  'CTL/ATL/TSB trend chart over time',
                  'Daily TRIMP chart showing individual workout stress',
                  'Weekly mileage ramp table',
                  'Recovery model card with current recovery analysis',
                  'Ramp rate with risk assessment',
                ]}
              />
            </SubSection>

            <SubSection title="How to Use Training Load for Racing">
              <p className="text-textSecondary">
                The classic taper pattern: build CTL as high as possible during peak training, then reduce volume (dropping ATL) in the 2-3 weeks before the race while maintaining some intensity. This lets TSB rise into the positive range &mdash; you arrive at the start line with all that fitness but fresh legs. The coach helps time this automatically.
              </p>
            </SubSection>

            <Tip>
              Check CTL/ATL/TSB weekly, not daily. Daily fluctuations are noise. The trends over 2-4 weeks are what matter. If CTL is climbing steadily and TSB is not chronically below -20, you are in a good place.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="recovery-model"
        title="Recovery Model"
        icon={Heart}
        content={
          <>
            <p className="text-textSecondary">
              Dreamy&apos;s recovery model goes beyond generic &ldquo;take a rest day&rdquo; advice. It provides personalized, adaptive recovery predictions that learn from your individual response to training.
            </p>

            <SubSection title="What It Tracks">
              <BulletList
                items={[
                  'Estimated recovery percentage (0-100%) based on time since last hard effort',
                  'Hours until fully recovered',
                  'Contributing factors: workout intensity, cumulative load, back-to-back hard days, sleep patterns',
                  'Historical recovery rate: how quickly you personally bounce back from different workout types',
                ]}
              />
            </SubSection>

            <SubSection title="Adaptive Learning">
              <p className="text-textSecondary">
                The model learns your individual recovery patterns over time. If you consistently run well the day after a tempo (some runners do), the model adjusts. If long runs take you 48 hours to recover from, it factors that in. This is not a one-size-fits-all formula &mdash; it adapts to you.
              </p>
            </SubSection>

            <SubSection title="Recovery Factors">
              <BulletList
                items={[
                  'Training load spike: Did you suddenly increase volume or intensity?',
                  'Consecutive hard days: Multiple quality sessions in a row accumulate fatigue non-linearly',
                  'Workout type: A 20-mile long run creates different fatigue than 6x800 at the track',
                  'RPE trends: If your perceived exertion is rising for the same paces, you need more recovery',
                  'Environmental stress: Heat adds recovery burden that pure pace/HR data does not capture',
                ]}
              />
            </SubSection>

            <SubSection title="Where to See It">
              <p className="text-textSecondary">
                Your recovery status appears on the Today page, in the training load dashboard, and the coach references it when making workout recommendations. You can also ask the coach directly:
              </p>
              <CoachPrompt>&ldquo;Am I recovered from yesterday?&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;How is my recovery looking this week?&rdquo;</CoachPrompt>
            </SubSection>
          </>
        }
      />

      <ExpandableSection
        id="workout-audibles"
        title="Workout Audibles"
        icon={RefreshCw}
        content={
          <>
            <p className="text-textSecondary">
              Workout audibles are day-of plan modifications that appear when conditions suggest the planned workout should change. This is one of the most important features for staying healthy and training consistently.
            </p>

            <SubSection title="When Audibles Trigger">
              <BulletList
                items={[
                  'High heat/humidity: Hard workout in 95F heat becomes a recovery run or moves to early morning',
                  'Accumulated fatigue: Your recovery model shows you are not recovered enough for the planned quality session',
                  'Recent hard effort: You raced or did an unplanned hard effort and need more recovery',
                  'Illness or minor injury: You told the coach about feeling off',
                  'Sleep deprivation or high stress: External factors affecting readiness',
                  'Travel or schedule disruption: You told the coach you are traveling',
                ]}
              />
            </SubSection>

            <SubSection title="How They Work">
              <p className="text-textSecondary">
                When an audible triggers, you see options on the Today page:
              </p>
              <BulletList
                items={[
                  'Do the planned workout as-is (if you are feeling good despite the flags)',
                  'Modified version (e.g., reduce interval reps, shorten the run, cut the tempo portion)',
                  'Swap to easy or recovery',
                  'Take a rest day',
                ]}
              />
              <p className="text-textSecondary mt-2">
                You choose. The coach is giving you options, not orders. But the options are informed by real data about your current state.
              </p>
            </SubSection>

            <Tip>
              The best runners are not the ones who never miss a workout &mdash; they are the ones who know when to pull back. Audibles help you make smart day-of decisions instead of blindly following a plan into injury or overtraining.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="injury-risk"
        title="Injury Risk Monitoring"
        icon={ShieldAlert}
        content={
          <>
            <p className="text-textSecondary">
              Dreamy monitors your training patterns for known injury risk factors and alerts you before problems develop.
            </p>

            <SubSection title="What Gets Monitored">
              <BulletList
                items={[
                  'Acute:Chronic Workload Ratio (ACWR): Your recent training load divided by your long-term average. Ratios above 1.5 are strongly associated with injury.',
                  'Weekly volume spikes: Increasing mileage more than 10% week-over-week when above your baseline.',
                  'Consecutive hard days: More than 2 quality sessions in a row without adequate recovery.',
                  'Ramp rate: How quickly your CTL is rising. Ramp rates above 7 per week increase risk.',
                  'Monotony: Too much of the same training without variety (all easy, or all hard). Some variation is protective.',
                ]}
              />
            </SubSection>

            <SubSection title="How Alerts Work">
              <p className="text-textSecondary">
                When risk factors are elevated, you see alerts on the Today page and the coach factors them into recommendations. Alerts are graduated:
              </p>
              <BulletList
                items={[
                  'Low risk (informational): "Your mileage is up 12% this week. Normal progression."',
                  'Moderate risk (cautionary): "Your ACWR is 1.4 and climbing. Consider an easy day."',
                  'High risk (warning): "You have run hard 4 days in a row with declining recovery. Strongly recommend rest."',
                ]}
              />
            </SubSection>

            <SubSection title="Prevention vs. Reaction">
              <p className="text-textSecondary">
                The goal is to catch risk patterns early, before you feel pain. Most running injuries have a 2-3 week warning window in the data before symptoms appear. Dreamy watches for these patterns so you can adjust proactively.
              </p>
            </SubSection>
          </>
        }
      />

      {/* ================================================================= */}
      {/* ANALYSIS */}
      {/* ================================================================= */}
      <SectionGroupHeader icon={BarChart2} title="Analysis" />

      <ExpandableSection
        id="analytics"
        title="Analytics Hub"
        icon={BarChart2}
        link="/analytics"
        content={
          <>
            <p className="text-textSecondary">
              The{' '}
              <Link href="/analytics" className="text-dream-600 underline">
                Analytics page
              </Link>{' '}
              is your training data command center with 6 tabbed sub-pages. Each tab offers a different lens on your training.
            </p>

            <SubSection title="Overview Tab">
              <p className="text-textSecondary">
                A high-level snapshot of your training. Key metrics at a glance: weekly mileage, number of runs, average pace, current training load, and recent trends. This is the tab to check for a quick pulse on how things are going.
              </p>
            </SubSection>

            <SubSection title="Training Tab">
              <p className="text-textSecondary">
                Deep dive into your training composition. Includes:
              </p>
              <BulletList
                items={[
                  'Weekly volume chart (mileage over time)',
                  'Workout type distribution (how much easy, tempo, interval, long run)',
                  'Easy vs. hard breakdown (80/20 rule compliance)',
                  'Time in heart rate zones',
                  'Run count and frequency trends',
                ]}
              />
              <Tip>
                Most runners run their easy days too fast and their hard days too easy. Check the Training tab to see your actual easy/hard split. Aim for 80% easy, 20% quality.
              </Tip>
            </SubSection>

            <SubSection title="Performance Tab">
              <p className="text-textSecondary">
                Tracks fitness and performance metrics over time:
              </p>
              <BulletList
                items={[
                  'Pace trends across workout types',
                  'Running economy (pace relative to heart rate)',
                  'Fitness trend (CTL over time)',
                  'Heart rate at given paces (improving? declining?)',
                  'VDOT trend (your overall running fitness number)',
                ]}
              />
            </SubSection>

            <SubSection title="Racing Tab">
              <p className="text-textSecondary">
                All things race-related:
              </p>
              <BulletList
                items={[
                  'Race results history with times and paces',
                  'Current predictions for target distances',
                  'Race fitness trend (are you getting faster?)',
                  'PR history and records',
                ]}
              />
            </SubSection>

            <SubSection title="History Tab">
              <p className="text-textSecondary">
                A searchable, filterable log of every workout. Filter by date range, workout type, distance range, or pace. Sort by any metric. Tap any workout to see its full detail page with splits, HR chart, and analysis.
              </p>
            </SubSection>

            <SubSection title="Progress Tab">
              <p className="text-textSecondary">
                Long-term progress tracking across key fitness indicators. This is where you see the multi-month and year-over-year trends: how your fitness, paces, and efficiency have changed over time.
              </p>
            </SubSection>
          </>
        }
      />

      <ExpandableSection
        id="workout-detail"
        title="Workout Detail Pages"
        icon={Eye}
        content={
          <>
            <p className="text-textSecondary">
              Every workout in Dreamy has a dedicated detail page that breaks down exactly what happened during the run. Tap any workout from the History page, Analytics, or Today page to see the full analysis.
            </p>

            <SubSection title="What You See">
              <BulletList
                items={[
                  'Summary stats: distance, time, pace, elevation gain/loss, calories',
                  'Split table: per-mile (or per-km) splits with pace, heart rate, and elevation for each',
                  'Heart rate zone chart: time spent in each zone with color-coded visualization',
                  'Activity stream charts: pace, heart rate, elevation, and cadence plotted over time or distance',
                  'Interval detection: automatically identified intervals with per-rep breakdown',
                  'Running power: estimated power output for the run (if supported)',
                  'Efficiency metrics: cadence, stride length, ground contact time (if available)',
                  'Shoe used and mileage on that shoe',
                  'Weather conditions during the run',
                  'RPE and post-run reflection notes',
                  'Workout classification (easy, tempo, interval, long run, etc.)',
                ]}
              />
            </SubSection>

            <SubSection title="Activity Stream Charts">
              <p className="text-textSecondary">
                The activity stream is a second-by-second (or point-by-point) recording of your run from Strava/GPS data. Dreamy renders interactive charts showing:
              </p>
              <BulletList
                items={[
                  'Pace over distance: see exactly where you sped up and slowed down',
                  'Heart rate over time: spot cardiac drift, warmup patterns, and effort distribution',
                  'Elevation profile: understand how hills affected your pace and effort',
                  'Combined overlays: pace + heart rate together to see effort vs. output relationships',
                ]}
              />
            </SubSection>

            <SubSection title="Split Tendency">
              <p className="text-textSecondary">
                Dreamy analyzes whether you tend to positive split (slow down), negative split (speed up), or even split your runs. This is tracked across all your runs and broken down by workout type. For races, this is critical &mdash; most PRs come from even or slight negative splits.
              </p>
            </SubSection>

            <Tip>
              After important workouts (long runs, tempo sessions, races), spend a minute on the detail page reviewing splits and heart rate. Patterns in your splits reveal a lot about your pacing discipline and fitness.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="performance-trends"
        title="Performance Trends"
        icon={TrendingUp}
        link="/performance-trends"
        content={
          <>
            <p className="text-textSecondary">
              The{' '}
              <Link href="/performance-trends" className="text-dream-600 underline">
                Performance Trends page
              </Link>{' '}
              tracks how key running metrics change over weeks and months. This is where you see real fitness improvement (or regression) happening.
            </p>

            <SubSection title="Running Economy">
              <p className="text-textSecondary">
                Running economy measures how efficiently you convert effort into pace. It is tracked as pace at a given heart rate. Improving running economy means you are running faster at the same effort &mdash; the holy grail of training. The trend chart shows this over time.
              </p>
            </SubSection>

            <SubSection title="Fatigue Resistance">
              <p className="text-textSecondary">
                How well you hold pace in the back half of runs. Dreamy calculates the pace difference between your first half and second half across long runs and tempos. Improving fatigue resistance is a key predictor of marathon success. This metric trends over time and should improve through a training cycle.
              </p>
            </SubSection>

            <SubSection title="Pace vs. Heart Rate Trends">
              <p className="text-textSecondary">
                Compares your pace at a given heart rate (or heart rate at a given pace) over months. As aerobic fitness improves, you run faster at the same heart rate. This is one of the most reliable indicators of aerobic development, and it works even for runners who do not race often.
              </p>
            </SubSection>

            <SubSection title="Split Tendency Tracking">
              <p className="text-textSecondary">
                Your overall tendency to positive split, negative split, or even split runs, tracked over time. Are you getting better at pacing? This is especially useful for marathon training where even splits are critical.
              </p>
            </SubSection>

            <Tip>
              Running economy improvement is the clearest sign that training is working, even when race results are not available. If your easy-run heart rate is dropping at the same pace, fitness is improving regardless of what the watch says.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="threshold-detection"
        title="Threshold Detection"
        icon={Gauge}
        content={
          <>
            <p className="text-textSecondary">
              Dreamy automatically detects your lactate threshold pace from your workout data. No lab test needed.
            </p>

            <SubSection title="What Is Lactate Threshold?">
              <p className="text-textSecondary">
                Your lactate threshold pace is the fastest pace you can sustain for roughly 45-60 minutes. Above this pace, lactate accumulates faster than your body can clear it, and you fatigue rapidly. Below it, you can run for extended periods. Threshold pace is the most important number for setting training paces because it anchors your entire training spectrum.
              </p>
            </SubSection>

            <SubSection title="How Detection Works">
              <p className="text-textSecondary">
                Dreamy analyzes your workout history for sessions that contain threshold-relevant data:
              </p>
              <BulletList
                items={[
                  'Tempo runs at sustained effort (20-40 minutes at comfortably hard pace)',
                  'Threshold intervals (e.g., 3x10 minutes at threshold)',
                  'Race efforts from 10K to half marathon distance',
                  'Hard long run segments where pace and heart rate are both elevated and stable',
                ]}
              />
              <p className="text-textSecondary mt-2">
                From these data points, the system estimates your current threshold pace using the relationship between pace, heart rate, and duration.
              </p>
            </SubSection>

            <SubSection title="Confidence Level">
              <p className="text-textSecondary">
                Not all threshold estimates are equal. The confidence score reflects:
              </p>
              <BulletList
                items={[
                  'How many qualifying workouts were used (more = higher confidence)',
                  'How recent the data is (last 4-6 weeks weighted most heavily)',
                  'How consistent the data points are (tight clustering = higher confidence)',
                  'Whether heart rate data was available (heart rate makes the estimate much more reliable)',
                ]}
              />
            </SubSection>

            <SubSection title="Trend Direction">
              <p className="text-textSecondary">
                The system tracks whether your threshold is improving, holding steady, or declining. This trend is one of the best indicators of whether your training is working. A rising threshold means your body is adapting to higher intensities.
              </p>
            </SubSection>

            <SubSection title="Why This Matters for Your Training">
              <p className="text-textSecondary">
                All your training paces &mdash; easy, tempo, threshold, interval, and race pace &mdash; are anchored to your detected threshold pace. When your threshold improves, all your paces update automatically. This means your easy days stay truly easy and your hard days are calibrated to the right intensity for your current fitness, not an outdated race result.
              </p>
            </SubSection>
          </>
        }
      />

      <ExpandableSection
        id="interval-analysis"
        title="Interval Analysis"
        icon={Layers}
        content={
          <>
            <p className="text-textSecondary">
              Dreamy automatically detects interval structures in your workouts and provides detailed rep-by-rep analysis.
            </p>

            <SubSection title="Automatic Pattern Detection">
              <p className="text-textSecondary">
                When you run intervals (at the track, on the road, or by feel), Dreamy identifies the pattern from your GPS/pace data: 8x800m, 6x1K, ladders, pyramids, fartleks, etc. You do not need to tag them &mdash; the detection happens automatically during activity processing.
              </p>
            </SubSection>

            <SubSection title="Consistency Scoring">
              <p className="text-textSecondary">
                For each interval session, you get a consistency score measuring how evenly you ran across reps. Tight splits (e.g., 3:40, 3:42, 3:41, 3:39) earn a high score. Wildly variable splits indicate pacing issues. Consistency scoring helps you develop the pacing discipline that translates directly to better racing.
              </p>
            </SubSection>

            <SubSection title="Rep-by-Rep Breakdown">
              <p className="text-textSecondary">
                On the workout detail page, each interval rep shows:
              </p>
              <BulletList
                items={[
                  'Pace for the rep',
                  'Heart rate (average and peak)',
                  'Recovery time between reps',
                  'Heart rate recovery (how quickly HR drops during rest)',
                  'Comparison to target pace',
                  'Trend across reps (did you speed up, slow down, or hold steady?)',
                ]}
              />
            </SubSection>

            <SubSection title="What Good Intervals Look Like">
              <p className="text-textSecondary">
                For most interval sessions, you want: consistent paces across reps (no more than 2-3 seconds variation), heart rate that rises progressively but does not spike, and adequate recovery between reps (heart rate should drop below 75% max before the next rep). The analysis helps you identify and fix patterns like going out too fast on the first rep or fading on the last few.
              </p>
            </SubSection>

            <Tip>
              Track your consistency score over time. As you develop better pace sense and discipline, this score should improve. Runners who are consistent in training tend to race more consistently too.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="prs-best-efforts"
        title="PRs & Best Efforts"
        icon={Trophy}
        content={
          <>
            <p className="text-textSecondary">
              Dreamy automatically tracks your personal records and best efforts across multiple distances and time periods.
            </p>

            <SubSection title="What Gets Tracked">
              <BulletList
                items={[
                  'Race PRs: Fastest times at standard race distances (5K, 10K, half marathon, marathon, etc.)',
                  'Best efforts: Fastest segments within any run (fastest mile, fastest 5K within a longer run, etc.)',
                  'All-time records vs. recent records (last 90 days)',
                  'Longest run by distance',
                  'Highest weekly mileage',
                ]}
              />
            </SubSection>

            <SubSection title="PR Celebrations">
              <p className="text-textSecondary">
                When you set a new PR, a celebration card appears on your Today page. This is automatic &mdash; Dreamy compares every new activity against your historical bests and surfaces any records. Even &ldquo;hidden PRs&rdquo; like your fastest mile within a long run are detected.
              </p>
            </SubSection>

            <SubSection title="Best Efforts Timeline">
              <p className="text-textSecondary">
                A chronological view of when your best efforts occurred. This helps you understand which training phases and conditions produced your best performances. If your fastest long runs all happened during a specific training block, that tells you something about what works for you.
              </p>
            </SubSection>

            <Tip>
              Some of your most meaningful fitness indicators are not race PRs but training PRs &mdash; like your fastest tempo segment or most consistent interval session. Dreamy tracks these too.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="running-economy"
        title="Running Economy Analysis"
        icon={Gauge}
        content={
          <>
            <p className="text-textSecondary">
              Running economy is how much energy it costs you to run at a given pace. Better economy means less effort for the same speed &mdash; it is one of the three pillars of distance running performance alongside VO2max and lactate threshold.
            </p>

            <SubSection title="How Dreamy Measures It">
              <p className="text-textSecondary">
                Without a lab, we approximate running economy by comparing pace to heart rate across similar conditions. If you run 8:00/mile at 150 BPM today and 8:00/mile at 145 BPM a month later (same conditions), your running economy improved. Dreamy tracks this relationship over time and plots the trend.
              </p>
            </SubSection>

            <SubSection title="What Improves Running Economy">
              <BulletList
                items={[
                  'Consistent easy mileage (the single biggest factor)',
                  'Strides and short speed work',
                  'Improved running form',
                  'Strength training (particularly hips and core)',
                  'Running at altitude (temporarily reduces economy but improves it upon return to sea level)',
                  'Racing lighter shoes (removes weight but does not change economy directly)',
                ]}
              />
            </SubSection>

            <SubSection title="Where to Find It">
              <p className="text-textSecondary">
                Running economy trends appear on the{' '}
                <Link href="/performance-trends" className="text-dream-600 underline">
                  Performance Trends page
                </Link>{' '}
                and the Performance tab of Analytics. The coach also references running economy when analyzing your training:
              </p>
              <CoachPrompt>&ldquo;Is my running economy improving?&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;How does my heart rate at easy pace compare to 3 months ago?&rdquo;</CoachPrompt>
            </SubSection>
          </>
        }
      />

      {/* ================================================================= */}
      {/* TOOLS */}
      {/* ================================================================= */}
      <SectionGroupHeader icon={Wrench} title="Tools" />

      <ExpandableSection
        id="pace-calculator"
        title="Pace Calculator"
        icon={Timer}
        link="/pace-calculator"
        content={
          <>
            <p className="text-textSecondary">
              The{' '}
              <Link href="/pace-calculator" className="text-dream-600 underline">
                Pace Calculator
              </Link>{' '}
              converts race results into training paces using the VDOT system developed by Jack Daniels.
            </p>

            <SubSection title="VDOT Score">
              <p className="text-textSecondary">
                VDOT is a single number that represents your current running fitness. It is calculated from a race result (distance + time). A higher VDOT means greater fitness. For reference: a 20-minute 5K is approximately VDOT 42, a sub-3 marathon is approximately VDOT 54, and elite marathoners are VDOT 75+.
              </p>
            </SubSection>

            <SubSection title="Training Paces">
              <p className="text-textSecondary">
                From your VDOT, the calculator generates recommended paces for each training zone:
              </p>
              <BulletList
                items={[
                  'Easy (E) pace: For daily easy runs and long runs. Should feel conversational.',
                  'Marathon (M) pace: Your projected marathon race pace. Used for marathon-pace long runs.',
                  'Threshold (T) pace: Comfortably hard. Sustainable for ~45-60 minutes. Used for tempo runs.',
                  'Interval (I) pace: Hard. VO2max-stimulating effort. Used for 3-5 minute repeats.',
                  'Repetition (R) pace: Very fast, short efforts for speed and form. Used for 200-400m reps.',
                ]}
              />
            </SubSection>

            <SubSection title="Race Predictions">
              <p className="text-textSecondary">
                Enter a race result at any distance, and the calculator predicts your equivalent performance at other distances. These are generic VDOT predictions &mdash; for personalized multi-signal predictions, use the{' '}
                <Link href="/predictions" className="text-dream-600 underline">
                  Predictions page
                </Link>.
              </p>
            </SubSection>

            <Tip>
              VDOT paces are starting points, not gospel. If your easy pace feels hard, slow down. If your intervals feel too easy, your VDOT may be conservative. The coach adjusts paces based on your actual data and feedback, which is more nuanced than a single VDOT number.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="weather-performance"
        title="Weather Performance"
        icon={CloudSun}
        link="/weather-preferences"
        content={
          <>
            <p className="text-textSecondary">
              Dreamy tracks how weather conditions affect your running performance and uses this to adjust paces and recommendations.
            </p>

            <SubSection title="What Gets Tracked">
              <BulletList
                items={[
                  'Temperature impact on pace (how much you slow down in heat)',
                  'Humidity effects on heart rate and effort',
                  'Wind impact on pacing',
                  'Your personal weather preferences (do you run hot? cold?)',
                  'Seasonal performance patterns',
                ]}
              />
            </SubSection>

            <SubSection title="Weather-Adjusted Paces">
              <p className="text-textSecondary">
                When conditions are outside your comfortable range, Dreamy adjusts pace targets. A tempo run at 7:15/mile in 50F becomes 7:30-7:40 in 85F with high humidity. These adjustments are based on established research on heat/cold performance effects, personalized to your individual sensitivity.
              </p>
            </SubSection>

            <SubSection title="Weather Preferences Page">
              <p className="text-textSecondary">
                The{' '}
                <Link href="/weather-preferences" className="text-dream-600 underline">
                  Weather Performance page
                </Link>{' '}
                lets you see your historical performance across different conditions and set your personal temperature preferences (whether you run hot or cold). This calibrates the adjustment formulas.
              </p>
            </SubSection>

            <Tip>
              Do not fight the weather. If it is hot and your pace is slow, check the adjusted targets. A &ldquo;slow&rdquo; run in 90F heat may be the same effort as your normal pace in 55F. Trust effort over pace in challenging conditions.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="heat-adaptation"
        title="Heat Adaptation"
        icon={Thermometer}
        link="/heat-adaptation"
        content={
          <>
            <p className="text-textSecondary">
              The human body adapts to heat with consistent exposure, and Dreamy tracks this adaptation process.
            </p>

            <SubSection title="How Heat Adaptation Works">
              <p className="text-textSecondary">
                When you run in hot conditions repeatedly, your body makes physiological changes: increased plasma volume, earlier onset of sweating, lower core temperature at a given effort, and improved cardiovascular efficiency in heat. Full adaptation takes 10-14 days of consistent heat exposure.
              </p>
            </SubSection>

            <SubSection title="What Dreamy Tracks">
              <BulletList
                items={[
                  'Heat exposure days (consecutive and recent hot-weather runs)',
                  'Adaptation level (estimated percentage of full adaptation)',
                  'Pace adjustment based on current adaptation (fully adapted runners need less adjustment)',
                  'Heat acclimation decay (adaptation fades within 1-2 weeks without exposure)',
                ]}
              />
            </SubSection>

            <SubSection title="Why This Matters">
              <p className="text-textSecondary">
                If you are training through summer for a fall marathon, understanding your heat adaptation helps you:
              </p>
              <BulletList
                items={[
                  'Know when pace adjustments are needed vs. when you are adapted enough to push through',
                  'Time your taper and race-specific work with realistic expectations',
                  'Avoid overtraining in early summer before adaptation kicks in',
                  'Understand the fitness you are building that is masked by heat (summer training often produces big fall breakthroughs)',
                ]}
              />
            </SubSection>

            <Tip>
              Summer miles are fall speed. Running in heat builds fitness that is masked by slow splits. When the weather cools down and you see your pace drop 15-30 seconds per mile at the same effort, that is the adaptation paying off.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="fueling"
        title="Fueling Guidance"
        icon={Utensils}
        link="/fueling"
        content={
          <>
            <p className="text-textSecondary">
              The{' '}
              <Link href="/fueling" className="text-dream-600 underline">
                Fueling page
              </Link>{' '}
              provides guidance on nutrition and hydration for training and racing.
            </p>

            <SubSection title="What It Covers">
              <BulletList
                items={[
                  'Pre-run fueling recommendations based on workout type and duration',
                  'During-run fueling for long runs and races (when to take gels, how many carbs per hour)',
                  'Post-run recovery nutrition windows',
                  'Hydration guidance adjusted for weather conditions',
                  'Race-day fueling strategy',
                ]}
              />
            </SubSection>

            <SubSection title="Race-Day Fueling">
              <p className="text-textSecondary">
                For marathons, proper fueling can be worth 5-10 minutes on your finish time. The general recommendation is 60-90 grams of carbohydrate per hour during a marathon, starting early. Dreamy helps you plan this out and practice it during long runs.
              </p>
              <CoachPrompt>&ldquo;What should my fueling plan be for the marathon?&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;How many gels should I take during my 20-miler?&rdquo;</CoachPrompt>
            </SubSection>
          </>
        }
      />

      {/* ================================================================= */}
      {/* EQUIPMENT */}
      {/* ================================================================= */}
      <SectionGroupHeader icon={Footprints} title="Equipment" />

      <ExpandableSection
        id="shoes"
        title="Shoe Tracking"
        icon={Footprints}
        link="/shoes"
        content={
          <>
            <p className="text-textSecondary">
              The{' '}
              <Link href="/shoes" className="text-dream-600 underline">
                Shoes page
              </Link>{' '}
              tracks your shoe rotation, mileage, and lifespan.
            </p>

            <SubSection title="Why Track Shoes?">
              <p className="text-textSecondary">
                Running shoes lose their cushioning and support as they accumulate miles. Most shoes last 300-500 miles, depending on the model, your weight, and running surface. Tracking mileage helps you rotate shoes strategically and retire them before they contribute to injury.
              </p>
            </SubSection>

            <SubSection title="Features">
              <BulletList
                items={[
                  'Automatic mileage tracking when you log runs with a shoe',
                  'Retirement alerts when shoes approach their mileage limit (configurable, typically 300-500 miles)',
                  'Shoe categories: daily trainers, race flats, trail shoes, recovery shoes, etc.',
                  'Active/retired status so old shoes do not clutter your rotation',
                  'Strava sync brings shoe assignments automatically (if configured in Strava)',
                ]}
              />
            </SubSection>

            <SubSection title="Building a Rotation">
              <p className="text-textSecondary">
                Most serious runners benefit from rotating 2-3 pairs of shoes:
              </p>
              <BulletList
                items={[
                  'Daily trainer: Your workhorse for easy and moderate runs (e.g., Nike Pegasus, Brooks Ghost, Asics Nimbus)',
                  'Workout/race shoe: Lighter, faster shoe for tempos, intervals, and races (e.g., Nike Vaporfly, Saucony Endorphin Speed)',
                  'Recovery shoe: Extra-cushioned shoe for easy/recovery days (e.g., Hoka Bondi, New Balance Fresh Foam More)',
                ]}
              />
            </SubSection>

            <Tip>
              Alternating between different shoes changes the forces on your legs slightly, which may help prevent overuse injuries. Even rotating between two pairs of the same model gives foam time to decompress between runs.
            </Tip>
          </>
        }
      />

      <ExpandableSection
        id="wardrobe"
        title="Wardrobe & Outfit Recommendations"
        icon={Shirt}
        link="/wardrobe"
        content={
          <>
            <p className="text-textSecondary">
              The{' '}
              <Link href="/wardrobe" className="text-dream-600 underline">
                Wardrobe page
              </Link>{' '}
              manages your running clothing inventory and generates weather-based outfit recommendations.
            </p>

            <SubSection title="How It Works">
              <p className="text-textSecondary">
                Add your running clothes to your wardrobe (tops, bottoms, layers, accessories, etc.). When you check the weather or ask the coach &ldquo;what should I wear?&rdquo;, Dreamy recommends an outfit from your actual wardrobe based on:
              </p>
              <BulletList
                items={[
                  'Current temperature and feels-like temperature',
                  'Wind, rain, and precipitation forecast',
                  'Workout type and intensity (you generate more heat on a tempo than an easy run)',
                  'Your personal temperature sensitivity (run hot or cold)',
                  'Time of day (morning vs. afternoon temperatures)',
                ]}
              />
            </SubSection>

            <SubSection title="Personal Calibration">
              <p className="text-textSecondary">
                Everyone has different cold tolerance. Some runners wear shorts down to 30F, others need tights at 50F. The wardrobe system lets you set your temperature sensitivity so recommendations match your preferences, not some generic chart.
              </p>
            </SubSection>

            <SubSection title="Coach Integration">
              <CoachPrompt>&ldquo;What should I wear for my run today?&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;It is 35F and windy &mdash; what do I need?&rdquo;</CoachPrompt>
              <CoachPrompt>&ldquo;Outfit for a long run in the rain?&rdquo;</CoachPrompt>
            </SubSection>

            <Tip>
              The general rule: dress for 15-20 degrees warmer than the actual temperature, because your body generates significant heat while running. If it is 40F, dress as if it is 55-60F.
            </Tip>
          </>
        }
      />

      {/* ================================================================= */}
      {/* SETTINGS & INTEGRATION */}
      {/* ================================================================= */}
      <SectionGroupHeader icon={Settings} title="Settings & Integration" />

      <ExpandableSection
        id="strava-sync"
        title="Strava Integration"
        icon={Zap}
        link="/settings/integrations"
        content={
          <>
            <p className="text-textSecondary">
              Strava is the primary way most runners get workout data into Dreamy. The integration supports both automatic sync and manual import.
            </p>

            <SubSection title="Connecting Strava">
              <p className="text-textSecondary">
                Go to{' '}
                <Link href="/settings/integrations" className="text-dream-600 underline">
                  Settings &rarr; Integrations
                </Link>{' '}
                and click &ldquo;Connect Strava.&rdquo; This uses official Strava OAuth &mdash; you log in with your Strava credentials and authorize Dreamy to read your activities. Your Strava password is never shared with Dreamy.
              </p>
            </SubSection>

            <SubSection title="Auto-Sync (Webhooks)">
              <p className="text-textSecondary">
                Once connected, new Strava activities are automatically imported via webhooks. When you finish a run and it uploads to Strava, Dreamy receives it within minutes. The activity is processed (classified, stress scored, zones calculated, intervals detected) and appears in your history.
              </p>
            </SubSection>

            <SubSection title="Manual Sync">
              <p className="text-textSecondary">
                If auto-sync misses an activity (rare), you can trigger a manual sync from the Sync Center. This pulls recent activities from Strava and processes any that are missing.
              </p>
            </SubSection>

            <SubSection title="Bulk Import">
              <p className="text-textSecondary">
                For importing your full Strava history (hundreds or thousands of activities), Dreamy supports bulk import from a Strava data export. Request your data export from Strava (takes about 5 minutes), download the ZIP file, and use the import process to bring in your complete history. This is the best way to get accurate historical fitness modeling from day one.
              </p>
            </SubSection>

            <SubSection title="What Gets Imported">
              <BulletList
                items={[
                  'Distance, time, and pace',
                  'GPS route data (for route/elevation analysis)',
                  'Heart rate data (if recorded)',
                  'Elevation gain/loss',
                  'Cadence and power (if available)',
                  'Activity type and title',
                  'Gear/shoe assignments',
                  'Laps and splits',
                ]}
              />
            </SubSection>

            <SubSection title="Troubleshooting">
              <BulletList
                items={[
                  'Missing activities: Check that your Strava connection is active in the Sync Center. Try manual sync.',
                  'Wrong data: Use Activity Cleanup at /setup/cleanup to fix data quality issues.',
                  'Duplicate activities: The cleanup tool detects and helps resolve duplicates from overlapping sync sources.',
                  'Strava disconnected: Re-authorize from Settings → Integrations. Your data is retained.',
                ]}
              />
            </SubSection>
          </>
        }
      />

      <ExpandableSection
        id="activity-cleanup"
        title="Activity Cleanup"
        icon={Wrench}
        link="/setup/cleanup"
        content={
          <>
            <p className="text-textSecondary">
              The{' '}
              <Link href="/setup/cleanup" className="text-dream-600 underline">
                Activity Cleanup tool
              </Link>{' '}
              scans your workout history for data quality issues and helps you fix them. Clean data means better predictions, more accurate training load, and smarter coaching.
            </p>

            <SubSection title="What It Detects">
              <BulletList
                items={[
                  'Duplicate activities: Same run imported from multiple sources (Strava + manual log)',
                  'GPS anomalies: Impossible distances, pace spikes from GPS drift, tunnels or buildings causing errors',
                  'Missing data: Workouts without heart rate that should have it, incomplete records',
                  'Suspicious paces: Runs with sections at implausible paces (GPS errors logged as sprints or ultra-slow segments)',
                  'Wrong activity type: A walk logged as a run, or cycling data mixed in',
                ]}
              />
            </SubSection>

            <SubSection title="When to Use It">
              <p className="text-textSecondary">
                Run the cleanup tool after your initial Strava bulk import, and periodically (monthly) to catch any new issues. Cleaning up bad data has an immediate positive effect on your training load model and predictions.
              </p>
            </SubSection>
          </>
        }
      />

      <ExpandableSection
        id="profile-settings"
        title="Profile & Settings"
        icon={Settings}
        link="/settings"
        content={
          <>
            <p className="text-textSecondary">
              Your{' '}
              <Link href="/profile" className="text-dream-600 underline">
                Profile
              </Link>{' '}
              and{' '}
              <Link href="/settings" className="text-dream-600 underline">
                Settings
              </Link>{' '}
              configure how Dreamy personalizes everything.
            </p>

            <SubSection title="Profile Information">
              <BulletList
                items={[
                  'Age and gender: Used for heart rate zone calculation (Tanaka formula) and age-graded performance',
                  'Running experience: Years running, typical weekly mileage, longest race completed',
                  'Resting heart rate and max heart rate: Critical for accurate zone calculations. If unknown, Dreamy estimates from age but measured values are much better.',
                  'Preferred units: Miles/km, Fahrenheit/Celsius',
                  'Location: For weather data and recommendations',
                ]}
              />
            </SubSection>

            <SubSection title="Training Preferences">
              <BulletList
                items={[
                  'Preferred running days: Which days of the week you typically run',
                  'Long run day: Usually Saturday or Sunday',
                  'Workout comfort: How experienced you are with different workout types',
                  'Available time: How much time you can dedicate to training',
                ]}
              />
            </SubSection>

            <SubSection title="Heart Rate Zones">
              <p className="text-textSecondary">
                Dreamy calculates 5 heart rate zones using the Tanaka formula (208 - 0.7 x age) for max heart rate, unless you provide a measured max HR. Zones are:
              </p>
              <BulletList
                items={[
                  'Zone 1: Recovery (very easy, active recovery)',
                  'Zone 2: Aerobic (easy running, long runs, conversational pace)',
                  'Zone 3: Tempo (comfortably hard, moderate effort)',
                  'Zone 4: Threshold (hard, sustainable for 30-60 minutes)',
                  'Zone 5: VO2max+ (very hard, interval and race effort)',
                ]}
              />
              <Tip>
                If you know your actual max heart rate from a field test or lab, enter it in your profile. Calculated max HR can be off by 10-15 BPM, which makes zone calculations inaccurate. A simple field test: after a thorough warmup, run 3x3 minutes hard up a hill with jogging recovery. Your peak HR on the last rep is close to your max.
              </Tip>
            </SubSection>
          </>
        }
      />

      {/* ================================================================= */}
      {/* ADVANCED */}
      {/* ================================================================= */}
      <SectionGroupHeader icon={Trophy} title="Advanced" />

      <ExpandableSection
        id="bq-chasers"
        title="For BQ Chasers"
        icon={Trophy}
        defaultOpen={false}
        content={
          <>
            <p className="text-textSecondary">
              If you are training for a Boston qualifier, Dreamy is built for you. Here are specific tips and features for the BQ chase.
            </p>

            <SubSection title="Set Your BQ Time as the Goal">
              <p className="text-textSecondary">
                When setting up your goal race, enter your exact BQ time (for your age group, with a few minutes of buffer for registration cutoffs). The entire training plan, pacing, and predictions will be calibrated to this specific target.
              </p>
              <CoachPrompt>&ldquo;My goal is to run 3:05 at the Chicago Marathon to BQ with buffer&rdquo;</CoachPrompt>
            </SubSection>

            <SubSection title="Use Tune-Up Races Strategically">
              <p className="text-textSecondary">
                Schedule a half marathon 6-8 weeks before your marathon. This serves triple duty: race execution practice, prediction calibration (a half marathon result is the best predictor of marathon fitness), and a confidence check. Your half marathon time should be about 46-47% of your marathon time. If you run 1:28 in the half, a 3:05 marathon is realistic.
              </p>
            </SubSection>

            <SubSection title="Monitor the Right Metrics">
              <p className="text-textSecondary">
                For BQ chasers, focus on these Dreamy features:
              </p>
              <BulletList
                items={[
                  'Predictions page: Watch your marathon prediction trend. You want to see it converge toward or below your BQ time as the training cycle progresses.',
                  'Fatigue resistance: This is the #1 predictor of marathon success. If you can hold pace in the back half of your long runs, you can hold pace on race day.',
                  'Training load: CTL should peak 3-4 weeks before the race, then TSB should climb to +15-25 by race day.',
                  'Threshold detection: Your threshold pace should support your goal marathon pace. Marathon pace should feel ~15-20 seconds/mile slower than threshold.',
                  'Long run analysis: Review your long run detail pages. Are you even-splitting? Is cardiac drift manageable? Can you run the last 4 miles at goal pace?',
                ]}
              />
            </SubSection>

            <SubSection title="The 16-20 Week Training Arc">
              <BulletList
                items={[
                  'Weeks 1-4 (Base): Build to your target weekly mileage. All easy running with strides. Establish the volume foundation.',
                  'Weeks 5-8 (Early Build): Introduce tempo runs and threshold work. One quality session per week plus long run. Start marathon-pace segments in long runs.',
                  'Weeks 9-12 (Build): Two quality sessions per week. Tempo runs extend to 30-40 minutes. Long runs reach 18-20 miles with marathon-pace finishes.',
                  'Weeks 13-15 (Peak): Highest training load. Long runs of 20-22 miles, some with significant marathon-pace work. Key workouts that simulate race demands.',
                  'Weeks 16-17 (Taper): Volume drops 40-60% while keeping some intensity. Two short, sharp sessions to stay sharp. Rest and recover.',
                  'Week 18 (Race): Easy running early in the week, rest days before the race. Execute your plan.',
                ]}
              />
            </SubSection>

            <SubSection title="Race Day Tips">
              <BulletList
                items={[
                  'Start 5-10 seconds/mile slower than goal pace for the first 5K. The adrenaline will make it feel easy; resist the urge to bank time.',
                  'Run your own race through the half. At 13.1 miles, you should feel comfortable and controlled.',
                  'Miles 16-20 is where the marathon happens. If you have trained fatigue resistance, you will hold pace here while others fade.',
                  'Practice fueling in long runs exactly as you will on race day. Take your first gel at mile 4-5 and every 30-40 minutes after.',
                  'Know the weather forecast and adjust your goal accordingly. A 3:05 in cool conditions might be 3:10-3:15 in 75F heat.',
                ]}
              />
              <CoachPrompt>&ldquo;It is race week. Walk me through my strategy for Sunday.&rdquo;</CoachPrompt>
            </SubSection>

            <Tip>
              The BQ cutoff fluctuates year to year. In recent years, runners have needed 5-6 minutes faster than the qualifying standard to actually get in. Build that buffer into your goal time. If your BQ standard is 3:10, train for 3:04-3:05.
            </Tip>
          </>
        }
      />

      {/* ================================================================= */}
      {/* WHAT THE COACH CAN DO (reference grid) */}
      {/* ================================================================= */}
      <SectionGroupHeader icon={Brain} title="Coach Capabilities Reference" />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          {
            category: 'Training & Planning',
            icon: Target,
            items: [
              'Log runs through conversation',
              'Get pre-run briefings with adjusted paces',
              'Modify or swap workouts',
              'Skip workouts when needed',
              'Make a week a down week',
              'Insert rest days',
              'Adjust plan for travel or schedule changes',
              'Race day pacing strategy',
            ],
          },
          {
            category: 'Analysis & Insights',
            icon: Brain,
            items: [
              'Fitness trend analysis',
              'Recovery pattern insights',
              'Fatigue indicators and warnings',
              'Training load monitoring (CTL/ATL/TSB)',
              'Workout quality assessment',
              'Pattern recognition across weeks',
              'Auto-detected threshold pace',
              'Interval consistency scoring',
              'Running economy trends',
              'Week-over-week comparison',
            ],
          },
          {
            category: 'Race & Goals',
            icon: Flag,
            items: [
              'Multi-signal race predictions',
              'Add and manage races',
              'Goal pace calculations',
              'Taper guidance and timing',
              'Race day strategy and pacing',
              'Post-race analysis',
              'Tune-up race planning',
            ],
          },
          {
            category: 'Health & Recovery',
            icon: Heart,
            items: [
              'Injury risk monitoring',
              'Personalized recovery predictions',
              'RPE trend analysis',
              'Sleep and stress impact assessment',
              'When to push vs. rest decisions',
              'Load spike warnings',
              'Overtraining indicators',
            ],
          },
          {
            category: 'Environment',
            icon: CloudSun,
            items: [
              'Weather-adjusted pace targets',
              'Heat adaptation tracking',
              'Cold weather guidance',
              'Altitude adjustments',
              'Outfit recommendations from your wardrobe',
              'Race-day weather strategy',
            ],
          },
          {
            category: 'Equipment & Logistics',
            icon: Footprints,
            items: [
              'Shoe rotation recommendations',
              'Shoe retirement alerts',
              'Fueling guidance for long runs and races',
              'Warm-up and cool-down protocols',
              'Cross-training suggestions',
            ],
          },
        ].map((cap) => {
          const Icon = cap.icon;
          return (
            <div
              key={cap.category}
              className="bg-surface-1 rounded-xl border border-default p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-5 h-5 text-dream-600" />
                <h3 className="font-semibold text-primary">{cap.category}</h3>
              </div>
              <ul className="space-y-1">
                {cap.items.map((item, idx) => (
                  <li
                    key={idx}
                    className="text-sm text-textSecondary flex items-start gap-2"
                  >
                    <span className="text-dream-400 mt-1">&#8226;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* ================================================================= */}
      {/* QUICK REFERENCE: ALL PAGES */}
      {/* ================================================================= */}
      <div className="bg-surface-1 rounded-xl border border-default p-5">
        <h2 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
          <Map className="w-5 h-5 text-dream-600" />
          Quick Reference: All Pages
        </h2>
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
          {[
            { path: '/today', label: 'Today Dashboard', desc: 'Daily overview and workout' },
            { path: '/coach', label: 'AI Coach', desc: 'Chat with your running coach' },
            { path: '/plan', label: 'Training Plan', desc: 'Weekly plan and schedule' },
            { path: '/races', label: 'Races', desc: 'Race calendar and goals' },
            { path: '/predictions', label: 'Predictions', desc: 'Multi-signal race predictions' },
            { path: '/analytics', label: 'Analytics', desc: '6-tab training data hub' },
            { path: '/analytics/load', label: 'Training Load', desc: 'CTL/ATL/TSB dashboard' },
            { path: '/history', label: 'History', desc: 'Full workout log' },
            { path: '/performance-trends', label: 'Performance Trends', desc: 'Economy, fatigue resistance, trends' },
            { path: '/shoes', label: 'Shoes', desc: 'Shoe tracking and rotation' },
            { path: '/wardrobe', label: 'Wardrobe', desc: 'Outfit recommendations' },
            { path: '/pace-calculator', label: 'Pace Calculator', desc: 'VDOT paces and predictions' },
            { path: '/weather-preferences', label: 'Weather Performance', desc: 'Weather impact analysis' },
            { path: '/heat-adaptation', label: 'Heat Adaptation', desc: 'Heat acclimation tracking' },
            { path: '/fueling', label: 'Fueling', desc: 'Nutrition guidance' },
            { path: '/tools', label: 'Tools Hub', desc: 'All tools in one place' },
            { path: '/coach-history', label: 'Coach History', desc: 'Past conversations' },
            { path: '/settings', label: 'Settings', desc: 'Preferences and config' },
            { path: '/settings/integrations', label: 'Integrations', desc: 'Strava connection' },
            { path: '/profile', label: 'Profile', desc: 'Your running profile' },
            { path: '/setup/cleanup', label: 'Activity Cleanup', desc: 'Fix data quality issues' },
            { path: '/log', label: 'Log Run', desc: 'Manual run entry' },
          ].map((page) => (
            <Link
              key={page.path}
              href={page.path}
              className="flex items-center gap-3 py-1.5 group"
            >
              <ChevronRight className="w-3.5 h-3.5 text-dream-500 opacity-50 group-hover:opacity-100 transition-opacity" />
              <div>
                <span className="text-sm font-medium text-primary group-hover:text-dream-600 transition-colors">
                  {page.label}
                </span>
                <span className="text-xs text-textTertiary ml-2">{page.desc}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ================================================================= */}
      {/* QUICK TIPS */}
      {/* ================================================================= */}
      <div className="bg-surface-1 border border-default rounded-xl p-6">
        <h2 className="text-lg font-bold text-primary mb-3">Quick Tips for Power Users</h2>
        <ul className="space-y-2 text-sm text-textSecondary">
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">1.</span>
            <span>
              Start every day by opening the Today page. It is your daily briefing with everything you need at a glance.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">2.</span>
            <span>
              Talk to the coach before every run. Even just &ldquo;ready to run&rdquo; gets you adjusted paces, weather guidance, and outfit suggestions.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">3.</span>
            <span>
              Rate RPE after every run. It takes 5 seconds and dramatically improves the coach&apos;s understanding of your training.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">4.</span>
            <span>
              Ask &ldquo;How did my week go?&rdquo; on Sundays for a comprehensive weekly review.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">5.</span>
            <span>
              When life gets in the way, tell the coach immediately. Early adjustments are always better than retroactive fixes.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">6.</span>
            <span>
              Add race results as soon as you finish. A single race result recalibrates everything.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">7.</span>
            <span>
              Check the Predictions page periodically (every 2-3 weeks) to see how your projected race time is trending.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">8.</span>
            <span>
              Use the training load dashboard before and during taper to verify you are peaking at the right time.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">9.</span>
            <span>
              Run with a heart rate monitor. It unlocks the deepest features: training load, recovery model, threshold detection, and running economy analysis.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">10.</span>
            <span>
              Viewer or coach logins are read-only and meant for observation, not editing or syncing.
            </span>
          </li>
        </ul>
      </div>

      {/* ================================================================= */}
      {/* SUPPORT */}
      {/* ================================================================= */}
      <div className="bg-bgTertiary border border-default rounded-xl p-6">
        <h2 className="text-lg font-bold text-primary mb-2">Support & Data Requests</h2>
        <p className="text-sm text-textSecondary mb-3">
          Need help, account support, or data/account deletion? Email{' '}
          <a
            className="text-dream-600 underline"
            href="mailto:jason@getdreamy.run"
          >
            jason@getdreamy.run
          </a>
          .
        </p>
        <div className="text-sm text-textSecondary">
          <Link href="/privacy" className="text-dream-600 underline mr-4">
            Privacy Policy
          </Link>
          <Link href="/terms" className="text-dream-600 underline">
            Terms of Service
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-textTertiary text-sm pb-8">
        <p>Built by a runner, for runners.</p>
      </div>
    </div>
  );
}
