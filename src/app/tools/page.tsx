import Link from 'next/link';
import {
  Calculator,
  Activity,
  Gauge,
  TrendingDown,
  TrendingUp,
  MessageCircle,
  Sun,
  Shield,
  Cloud,
  Zap,
  Wrench,
} from 'lucide-react';

const tools = [
  {
    id: 'fueling',
    title: 'Race Fueling Planner',
    description: 'Calculate carbs, fluids, and electrolytes needed for race day with a mile-by-mile timeline',
    icon: Zap,
    href: '/fueling',
    color: 'text-[#ffab40]',
    bgColor: 'bg-[#ffab40]/10',
  },
  {
    id: 'pace-calculator',
    title: 'Pace Calculator',
    description: 'Convert between pace, time, and distance. Calculate race predictions.',
    icon: Calculator,
    href: '/pace-calculator',
    color: 'text-[#7b68ee]',
    bgColor: 'bg-[#7b68ee]/10',
  },
  {
    id: 'readiness',
    title: 'Readiness Analysis',
    description: 'Detailed breakdown of your readiness score with actionable insights',
    icon: Activity,
    href: '/readiness',
    color: 'text-[#00e676]',
    bgColor: 'bg-[#00e676]/10',
  },
  {
    id: 'workout-confidence',
    title: 'Workout Confidence',
    description: 'Get a confidence score for today\'s workout based on your current state',
    icon: Gauge,
    href: '/workout-confidence',
    color: 'text-[#ffd740]',
    bgColor: 'bg-[#ffd740]/10',
  },
  {
    id: 'pace-decay',
    title: 'Pace Decay Analysis',
    description: 'Analyze how your pace changes throughout runs to improve pacing strategy',
    icon: TrendingDown,
    href: '/pace-decay',
    color: 'text-[#b388ff]',
    bgColor: 'bg-[#b388ff]/10',
  },
  {
    id: 'coach-history',
    title: 'Coach History',
    description: 'View your conversation history with your AI running coach',
    icon: MessageCircle,
    href: '/coach-history',
    color: 'text-[#ff4081]',
    bgColor: 'bg-[#ff4081]/10',
  },
  {
    id: 'heat-adaptation',
    title: 'Heat Adaptation',
    description: 'Track your body\'s adaptation to running in hot weather',
    icon: Sun,
    href: '/heat-adaptation',
    color: 'text-[#ff6d00]',
    bgColor: 'bg-[#ff6d00]/10',
  },
  {
    id: 'injury-risk',
    title: 'Injury Risk Assessment',
    description: 'Monitor training patterns to identify and prevent potential injury risks',
    icon: Shield,
    href: '/injury-risk',
    color: 'text-[#ff1744]',
    bgColor: 'bg-[#ff1744]/10',
  },
  {
    id: 'weather-preferences',
    title: 'Weather Preferences',
    description: 'Discover how weather affects your performance and find optimal conditions',
    icon: Cloud,
    href: '/weather-preferences',
    color: 'text-[#40c4ff]',
    bgColor: 'bg-[#40c4ff]/10',
  },
  {
    id: 'performance-trends',
    title: 'Performance Trends',
    description: 'Track your progress over time with detailed metrics and insights',
    icon: TrendingUp,
    href: '/performance-trends',
    color: 'text-[#b2ff59]',
    bgColor: 'bg-[#b2ff59]/10',
  },
  {
    id: 'activity-cleanup',
    title: 'Activity Cleanup',
    description: 'Scan for and fix data quality issues like GPS glitches and duplicates',
    icon: Wrench,
    href: '/setup/cleanup',
    color: 'text-[#78909c]',
    bgColor: 'bg-[#78909c]/10',
  },
  // Performance Insights card removed — /insights route does not exist
];

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-primary">Training Tools</h1>
        <p className="text-sm text-textSecondary mt-1">
          Essential calculators and analysis tools to optimize your training
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => {
          const Icon = tool.icon;

          return (
            <Link
              key={tool.id}
              href={tool.href}
              className="group bg-bgSecondary rounded-xl border border-borderPrimary p-4 hover:border-dream-400/40 shadow-sm transition-all"
            >
              <div className={`w-10 h-10 ${tool.bgColor} rounded-lg flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}>
                <Icon className={`w-5 h-5 ${tool.color}`} />
              </div>
              <h3 className="font-semibold text-sm text-textPrimary mb-1 group-hover:text-dream-600 transition-colors">
                {tool.title}
              </h3>
              <p className="text-xs text-textTertiary leading-relaxed">{tool.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}