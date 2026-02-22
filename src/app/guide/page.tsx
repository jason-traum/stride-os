'use client';

import { useState } from 'react';
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
  Clock,
  Settings,
  Timer,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
  Brain,
  Zap,
  Heart,
  CloudSun
} from 'lucide-react';

interface GuideSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  features: {
    title: string;
    description: string;
    examples?: string[];
  }[];
  link?: string;
}

const guideSections: GuideSection[] = [
  {
    id: 'coach',
    title: 'AI Coach',
    icon: MessageCircle,
    description: 'Your primary interface. Talk to your coach about anything running-related.',
    link: '/coach',
    features: [
      {
        title: 'Log runs conversationally',
        description: 'Just describe your run naturally. The coach will parse everything and log it for you.',
        examples: [
          '"Just did 6 miles easy, felt great, wore my Pegasus"',
          '"10 miler this morning, started at 8:30 pace and finished around 7:00. Legs were heavy but it was smooth."',
        ],
      },
      {
        title: 'Get personalized advice',
        description: 'The coach knows your training history, goals, and current fitness. Ask anything.',
        examples: [
          '"Why did that run feel so hard?"',
          '"Am I ready for my race?"',
          '"What should I do tomorrow?"',
        ],
      },
      {
        title: 'Modify your plan',
        description: 'Life happens. Tell your coach and they\'ll help adjust.',
        examples: [
          '"I only have 30 minutes today"',
          '"I\'m traveling next week"',
          '"My knee is a bit sore"',
        ],
      },
      {
        title: 'Pre-run briefings',
        description: 'Get everything you need before heading out.',
        examples: [
          '"Ready to run" or "I\'m about to head out"',
        ],
      },
      {
        title: 'Weekly reviews',
        description: 'Understand how your training is going.',
        examples: [
          '"How did my week go?"',
          '"What\'s my training load looking like?"',
        ],
      },
    ],
  },
  {
    id: 'today',
    title: 'Today',
    icon: Sun,
    description: 'Your daily dashboard. See what\'s planned and your current readiness.',
    link: '/today',
    features: [
      {
        title: 'Today\'s workout',
        description: 'See exactly what you should do today, with paces adjusted for conditions.',
      },
      {
        title: 'Weather conditions',
        description: 'Current weather and how it affects your running.',
      },
      {
        title: 'Quick actions',
        description: 'One-tap access to common actions like logging a run or asking the coach.',
      },
    ],
  },
  {
    id: 'plan',
    title: 'Training Plan',
    icon: Calendar,
    description: 'Your personalized training plan, built around your goal race.',
    link: '/plan',
    features: [
      {
        title: 'Weekly view',
        description: 'See your entire week at a glance with planned workouts.',
      },
      {
        title: 'Phase awareness',
        description: 'Know whether you\'re in base, build, peak, or taper phase.',
      },
      {
        title: 'Workout details',
        description: 'Tap any workout to see full details including target paces.',
      },
    ],
  },
  {
    id: 'log',
    title: 'Log Run',
    icon: PlusCircle,
    description: 'Manual run logging when you want to enter details directly.',
    link: '/log',
    features: [
      {
        title: 'Quick entry',
        description: 'Enter distance, time, and type. Pace is calculated automatically.',
      },
      {
        title: 'Post-run assessment',
        description: 'Rate how it felt, log RPE, and note conditions.',
      },
      {
        title: 'Shoe tracking',
        description: 'Select which shoes you wore to track mileage.',
      },
    ],
  },
  {
    id: 'races',
    title: 'Races',
    icon: Flag,
    description: 'Manage your goal races and view predictions.',
    link: '/races',
    features: [
      {
        title: 'Goal race',
        description: 'Your A race that the training plan is built around.',
      },
      {
        title: 'Tune-up races',
        description: 'B and C priority races that fit into your training.',
      },
      {
        title: 'Race predictions',
        description: 'See predicted finish times based on your current fitness.',
      },
    ],
  },
  {
    id: 'shoes',
    title: 'Shoes',
    icon: Footprints,
    description: 'Track your shoe rotation and mileage.',
    link: '/shoes',
    features: [
      {
        title: 'Mileage tracking',
        description: 'Automatically updated when you log runs with a shoe.',
      },
      {
        title: 'Retirement alerts',
        description: 'Know when shoes are getting worn out (typically 300-500 miles).',
      },
      {
        title: 'Shoe categories',
        description: 'Daily trainers, race flats, trail shoes, etc.',
      },
    ],
  },
  {
    id: 'wardrobe',
    title: 'Wardrobe',
    icon: Shirt,
    description: 'Your running clothing inventory for outfit recommendations.',
    link: '/wardrobe',
    features: [
      {
        title: 'Outfit recommendations',
        description: 'Based on weather, workout type, and your preferences.',
      },
      {
        title: 'Personal calibration',
        description: 'Tell us if you run hot or cold for better recommendations.',
      },
    ],
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: BarChart2,
    description: 'Deep dive into your training data and trends.',
    link: '/analytics',
    features: [
      {
        title: 'Training load',
        description: 'Acute vs chronic load to prevent overtraining.',
      },
      {
        title: 'Fitness trends',
        description: 'Track your progress over weeks and months.',
      },
      {
        title: 'Workout distribution',
        description: 'Are you following 80/20? See your easy vs hard breakdown.',
      },
    ],
  },
  {
    id: 'history',
    title: 'History',
    icon: Clock,
    description: 'Browse all your past runs and workouts.',
    link: '/history',
    features: [
      {
        title: 'Full workout log',
        description: 'Every run you\'ve logged with all details.',
      },
      {
        title: 'Filter and search',
        description: 'Find specific workouts by type, date, or distance.',
      },
    ],
  },
  {
    id: 'pace-calc',
    title: 'Pace Calculator',
    icon: Timer,
    description: 'Calculate training paces from race results.',
    link: '/pace-calculator',
    features: [
      {
        title: 'VDOT calculation',
        description: 'Enter a race result to get your VDOT score.',
      },
      {
        title: 'Training paces',
        description: 'Get recommended paces for easy, tempo, threshold, and interval runs.',
      },
      {
        title: 'Race predictions',
        description: 'Predict finish times for other distances.',
      },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    description: 'Configure your profile and preferences.',
    link: '/settings',
    features: [
      {
        title: 'Profile',
        description: 'Your running background and experience level.',
      },
      {
        title: 'Training preferences',
        description: 'Preferred days, comfort with workout types, etc.',
      },
      {
        title: 'Location',
        description: 'For weather-based recommendations.',
      },
    ],
  },
  {
    id: 'strava-sync',
    title: 'Strava Sync',
    icon: Zap,
    description: 'Connect Strava and sync workouts automatically.',
    link: '/settings/integrations',
    features: [
      {
        title: 'One-click OAuth connect',
        description: 'Connect your Strava account from Settings/Sync Center using official Strava OAuth.',
      },
      {
        title: 'Auto-sync',
        description: 'New Strava activities can auto-import through webhook events and manual sync remains available.',
      },
      {
        title: 'Troubleshooting',
        description: 'If sync is missing, check active profile and Strava connection status in the Sync Center.',
      },
    ],
  },
];

const coachCapabilities = [
  {
    category: 'Training & Planning',
    icon: Target,
    items: [
      'Log runs through conversation',
      'Get pre-run briefings',
      'Modify today\'s workout',
      'Swap or reschedule workouts',
      'Skip workouts when needed',
      'Make a week a down week',
      'Insert rest days',
    ],
  },
  {
    category: 'Analysis & Insights',
    icon: Brain,
    items: [
      'Fitness trend analysis',
      'Recovery pattern insights',
      'Fatigue indicators',
      'Training load monitoring',
      'Workout quality assessment',
      'Pattern recognition',
    ],
  },
  {
    category: 'Race & Goals',
    icon: Flag,
    items: [
      'Race time predictions',
      'Add and update races',
      'Goal pace calculations',
      'Taper guidance',
      'Race day strategy',
    ],
  },
  {
    category: 'Health & Recovery',
    icon: Heart,
    items: [
      'Injury tracking and restrictions',
      'Recovery recommendations',
      'Sleep and stress impact',
      'When to push vs rest',
    ],
  },
  {
    category: 'Environment',
    icon: CloudSun,
    items: [
      'Weather-adjusted paces',
      'Heat and cold guidance',
      'Altitude adjustments',
      'What to wear recommendations',
    ],
  },
];

function ExpandableSection({ section }: { section: GuideSection }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const Icon = section.icon;

  return (
    <div className="bg-surface-1 rounded-xl border border-default overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-bgTertiary transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-dream-50 flex items-center justify-center">
            <Icon className="w-5 h-5 text-dream-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-primary">{section.title}</h3>
            <p className="text-sm text-textTertiary">{section.description}</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-tertiary" />
        ) : (
          <ChevronDown className="w-5 h-5 text-tertiary" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-subtle">
          <div className="pt-4 space-y-4">
            {section.features.map((feature, idx) => (
              <div key={idx} className="pl-4 border-l-2 border-default">
                <h4 className="font-medium text-primary">{feature.title}</h4>
                <p className="text-sm text-textSecondary mt-1">{feature.description}</p>
                {feature.examples && (
                  <div className="mt-2 space-y-1">
                    {feature.examples.map((example, i) => (
                      <p key={i} className="text-sm text-textTertiary italic">
                        {example}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {section.link && (
              <Link
                href={section.link}
                className="inline-flex items-center gap-2 text-dream-600 hover:text-dream-700 text-sm font-medium mt-2"
              >
                Go to {section.title}
                <Zap className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GuidePage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-dream-500 to-dream-800 mb-4">
          <Target className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-primary">Your Personal Running Coach</h1>
        <p className="text-textSecondary mt-2 max-w-xl mx-auto">
          An AI coach that builds and adapts your training plan to help you achieve your race goals.
        </p>
      </div>

      {/* The Core Value Prop - Adaptive Training */}
      <div className="bg-gradient-to-r from-dream-600 to-dream-900 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5" />
          <span className="text-sm font-medium text-dream-200 uppercase tracking-wide">Adaptive Training</span>
        </div>
        <h2 className="text-2xl font-bold mb-3">Training That Evolves With You</h2>
        <p className="text-dream-100 mb-4">
          Tell us your goal race and current fitness. We build a personalized training plan that adapts based on how you&apos;re responding to training, life circumstances, and conditions.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div className="bg-white/10 rounded-lg p-3">
            <p className="font-medium">Personalized Plans</p>
            <p className="text-sm text-dream-100">Built around your goal race and current fitness level</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="font-medium">Smart Adjustments</p>
            <p className="text-sm text-dream-100">Adapts when life happens &mdash; travel, fatigue, injury</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="font-medium">Daily Guidance</p>
            <p className="text-sm text-dream-100">Weather-adjusted paces and outfit recommendations</p>
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

      {/* How It Works */}
      <div className="bg-bgTertiary rounded-2xl p-6 border border-default">
        <h2 className="text-xl font-bold text-primary mb-4">How It Works</h2>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-dream-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
            <div>
              <h3 className="font-semibold text-primary">Set Your Goal</h3>
              <p className="text-sm text-textSecondary">Tell us your goal race &mdash; marathon, half, 10K, whatever. This becomes your North Star.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-dream-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
            <div>
              <h3 className="font-semibold text-primary">Get Your Plan</h3>
              <p className="text-sm text-textSecondary">We generate a training plan with the right mix of easy runs, workouts, and long runs for your fitness level.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-dream-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
            <div>
              <h3 className="font-semibold text-primary">Train Smart</h3>
              <p className="text-sm text-textSecondary">Each day, see exactly what to do with paces adjusted for conditions. Log runs naturally by chatting with your coach.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-dream-600 text-white rounded-full flex items-center justify-center font-bold">4</div>
            <div>
              <h3 className="font-semibold text-primary">Adapt & Improve</h3>
              <p className="text-sm text-textSecondary">Your coach tracks your progress, notices patterns, and adjusts the plan when life happens.</p>
            </div>
          </div>
        </div>
      </div>

      {/* The AI Coach */}
      <div className="bg-gradient-to-r from-dream-500 to-dream-800 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold mb-3">Your Coach, Always Available</h2>
        <p className="text-dream-100 mb-4">
          <strong className="text-white">Just talk naturally.</strong> No menus, no forms. Ask questions, log runs, adjust plans &mdash; all through conversation.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div className="bg-white/10 rounded-lg p-3">
            <p className="font-medium">Log runs</p>
            <p className="text-sm text-dream-100">&ldquo;Just did 5 easy miles&rdquo;</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="font-medium">Get advice</p>
            <p className="text-sm text-dream-100">&ldquo;Why did that feel so hard?&rdquo;</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="font-medium">Adjust plans</p>
            <p className="text-sm text-dream-100">&ldquo;I&apos;m traveling next week&rdquo;</p>
          </div>
        </div>
      </div>

      {/* What the Coach Can Do */}
      <div>
        <h2 className="text-xl font-bold text-primary mb-4">What Your Coach Can Do</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {coachCapabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <div key={cap.category} className="bg-surface-1 rounded-xl border border-default p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-5 h-5 text-dream-600" />
                  <h3 className="font-semibold text-primary">{cap.category}</h3>
                </div>
                <ul className="space-y-1">
                  {cap.items.map((item, idx) => (
                    <li key={idx} className="text-sm text-textSecondary flex items-start gap-2">
                      <span className="text-dream-400 mt-1">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* App Sections */}
      <div>
        <h2 className="text-xl font-bold text-primary mb-4">App Sections</h2>
        <div className="space-y-3">
          {guideSections.map((section) => (
            <ExpandableSection key={section.id} section={section} />
          ))}
        </div>
      </div>

      {/* Quick Tips */}
      <div className="bg-surface-1 border border-default rounded-xl p-6">
        <h2 className="text-lg font-bold text-primary mb-3">Quick Tips</h2>
        <ul className="space-y-2 text-secondary">
          <li className="flex items-start gap-2">
            <span className="font-bold">1.</span>
            <span>Start every session by asking the coach &ldquo;What should I do today?&rdquo; or &ldquo;Ready to run&rdquo;</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">2.</span>
            <span>Log runs conversationally - just describe what you did naturally</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">3.</span>
            <span>When life gets in the way, tell your coach - they&apos;ll help you adjust</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">4.</span>
            <span>Check &ldquo;How did my week go?&rdquo; for weekly training reviews</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">5.</span>
            <span>The coach knows your goal race and frames everything around it</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">6.</span>
            <span>Viewer/coach logins are read-only and are meant for observation, not editing or syncing.</span>
          </li>
        </ul>
      </div>

      {/* Support */}
      <div className="bg-bgTertiary border border-default rounded-xl p-6">
        <h2 className="text-lg font-bold text-primary mb-2">Support & Data Requests</h2>
        <p className="text-sm text-textSecondary mb-3">
          Need help, account support, or data/account deletion? Email{' '}
          <a className="text-dream-600 underline" href="mailto:jasontraum8@gmail.com">jasontraum8@gmail.com</a>.
        </p>
        <div className="text-sm text-textSecondary">
          <Link href="/privacy" className="text-dream-600 underline mr-4">Privacy Policy</Link>
          <Link href="/terms" className="text-dream-600 underline">Terms of Service</Link>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-textTertiary text-sm pb-8">
        <p>Built by a runner, for runners.</p>
      </div>
    </div>
  );
}
