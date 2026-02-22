import Link from 'next/link';
import {
  Calculator,
  FileText,
  Activity,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  BarChart3,
  Brain,
  Gauge,
  TrendingDown,
  TrendingUp,
  MessageCircle,
  Sun,
  Shield,
  Cloud
} from 'lucide-react';

const tools = [
  {
    id: 'pace-bands',
    title: 'Pace Band Generator',
    description: 'Create printable pace bands for your races with even or negative split strategies',
    icon: FileText,
    href: '/pace-bands',
    color: 'text-[#00e5ff]',
    bgColor: 'bg-[#00e5ff]/10',
  },
  {
    id: 'pace-calculator',
    title: 'Pace Calculator',
    description: 'Convert between pace, time, and distance. Calculate race predictions.',
    icon: Calculator,
    href: '/calculator',
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
    id: 'performance-insights',
    title: 'Performance Insights',
    description: 'Discover patterns in your training and get AI-powered recommendations',
    icon: Brain,
    href: '/insights',
    color: 'text-[#ea80fc]',
    bgColor: 'bg-[#ea80fc]/10',
    comingSoon: true,
  },
];

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-bgTertiary">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">Training Tools</h1>
          <p className="text-textSecondary">
            Essential calculators and analysis tools to optimize your training
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon;

            if (tool.comingSoon) {
              return (
                <div
                  key={tool.id}
                  className="relative bg-surface-1 rounded-xl border border-default p-6 opacity-75"
                >
                  <div className="absolute top-3 right-3">
                    <span className="text-xs font-medium text-tertiary bg-bgTertiary px-2 py-1 rounded">
                      Coming Soon
                    </span>
                  </div>
                  <div className={`w-12 h-12 ${tool.bgColor} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${tool.color}`} />
                  </div>
                  <h3 className="font-semibold text-primary mb-2">{tool.title}</h3>
                  <p className="text-sm text-textTertiary">{tool.description}</p>
                </div>
              );
            }

            return (
              <Link
                key={tool.id}
                href={tool.href}
                className="group bg-surface-1 rounded-xl border border-default p-6 hover:border-dream-300 hover:shadow-sm transition-all"
              >
                <div className={`w-12 h-12 ${tool.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                  <Icon className={`w-6 h-6 ${tool.color}`} />
                </div>
                <h3 className="font-semibold text-primary mb-2 group-hover:text-dream-600 transition-colors">
                  {tool.title}
                </h3>
                <p className="text-sm text-textTertiary">{tool.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}