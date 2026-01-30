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
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-slate-900">{section.title}</h3>
            <p className="text-sm text-slate-500">{section.description}</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <div className="pt-4 space-y-4">
            {section.features.map((feature, idx) => (
              <div key={idx} className="pl-4 border-l-2 border-blue-200">
                <h4 className="font-medium text-slate-800">{feature.title}</h4>
                <p className="text-sm text-slate-600 mt-1">{feature.description}</p>
                {feature.examples && (
                  <div className="mt-2 space-y-1">
                    {feature.examples.map((example, i) => (
                      <p key={i} className="text-sm text-slate-500 italic">
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
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium mt-2"
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
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
          <Target className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900">Your Personal Running Coach</h1>
        <p className="text-slate-600 mt-2 max-w-xl mx-auto">
          An AI coach that builds and adapts your training plan to help you achieve your race goals.
        </p>
      </div>

      {/* The Core Value Prop - Adaptive Training */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5" />
          <span className="text-sm font-medium text-indigo-200 uppercase tracking-wide">Adaptive Training</span>
        </div>
        <h2 className="text-2xl font-bold mb-3">Training That Evolves With You</h2>
        <p className="text-indigo-100 mb-4">
          Tell us your goal race and current fitness. We build a personalized training plan that adapts based on how you&apos;re responding to training, life circumstances, and conditions.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div className="bg-white/10 rounded-lg p-3">
            <p className="font-medium">Personalized Plans</p>
            <p className="text-sm text-indigo-100">Built around your goal race and current fitness level</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="font-medium">Smart Adjustments</p>
            <p className="text-sm text-indigo-100">Adapts when life happens &mdash; travel, fatigue, injury</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="font-medium">Daily Guidance</p>
            <p className="text-sm text-indigo-100">Weather-adjusted paces and outfit recommendations</p>
          </div>
        </div>
        <Link
          href="/coach"
          className="inline-flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-lg font-medium mt-4 hover:bg-indigo-50 transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          Talk to Your Coach
        </Link>
      </div>

      {/* How It Works */}
      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
        <h2 className="text-xl font-bold text-slate-900 mb-4">How It Works</h2>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">1</div>
            <div>
              <h3 className="font-semibold text-slate-900">Set Your Goal</h3>
              <p className="text-sm text-slate-600">Tell us your goal race &mdash; marathon, half, 10K, whatever. This becomes your North Star.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">2</div>
            <div>
              <h3 className="font-semibold text-slate-900">Get Your Plan</h3>
              <p className="text-sm text-slate-600">We generate a training plan with the right mix of easy runs, workouts, and long runs for your fitness level.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">3</div>
            <div>
              <h3 className="font-semibold text-slate-900">Train Smart</h3>
              <p className="text-sm text-slate-600">Each day, see exactly what to do with paces adjusted for conditions. Log runs naturally by chatting with your coach.</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">4</div>
            <div>
              <h3 className="font-semibold text-slate-900">Adapt & Improve</h3>
              <p className="text-sm text-slate-600">Your coach tracks your progress, notices patterns, and adjusts the plan when life happens.</p>
            </div>
          </div>
        </div>
      </div>

      {/* The AI Coach */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold mb-3">Your Coach, Always Available</h2>
        <p className="text-orange-100 mb-4">
          <strong className="text-white">Just talk naturally.</strong> No menus, no forms. Ask questions, log runs, adjust plans &mdash; all through conversation.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div className="bg-white/10 rounded-lg p-3">
            <p className="font-medium">Log runs</p>
            <p className="text-sm text-orange-100">&ldquo;Just did 5 easy miles&rdquo;</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="font-medium">Get advice</p>
            <p className="text-sm text-orange-100">&ldquo;Why did that feel so hard?&rdquo;</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3">
            <p className="font-medium">Adjust plans</p>
            <p className="text-sm text-orange-100">&ldquo;I&apos;m traveling next week&rdquo;</p>
          </div>
        </div>
      </div>

      {/* What the Coach Can Do */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 mb-4">What Your Coach Can Do</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {coachCapabilities.map((cap) => {
            const Icon = cap.icon;
            return (
              <div key={cap.category} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-slate-900">{cap.category}</h3>
                </div>
                <ul className="space-y-1">
                  {cap.items.map((item, idx) => (
                    <li key={idx} className="text-sm text-slate-600 flex items-start gap-2">
                      <span className="text-blue-400 mt-1">•</span>
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
        <h2 className="text-xl font-bold text-slate-900 mb-4">App Sections</h2>
        <div className="space-y-3">
          {guideSections.map((section) => (
            <ExpandableSection key={section.id} section={section} />
          ))}
        </div>
      </div>

      {/* Quick Tips */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
        <h2 className="text-lg font-bold text-amber-900 mb-3">Quick Tips</h2>
        <ul className="space-y-2 text-amber-800">
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
        </ul>
      </div>

      {/* Footer */}
      <div className="text-center text-slate-500 text-sm pb-8">
        <p>Built by a runner, for runners.</p>
      </div>
    </div>
  );
}
