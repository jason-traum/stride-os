import Link from 'next/link';
import {
  Calculator,
  FileText,
  Activity,
  Zap,
  BarChart3,
  Brain,
  Target,
  Gauge
} from 'lucide-react';

const tools = [
  {
    id: 'pace-bands',
    title: 'Pace Band Generator',
    description: 'Create printable pace bands for your races with even or negative split strategies',
    icon: FileText,
    href: '/pace-bands',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
  },
  {
    id: 'pace-calculator',
    title: 'Pace Calculator',
    description: 'Convert between pace, time, and distance. Calculate race predictions.',
    icon: Calculator,
    href: '/calculator',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  {
    id: 'readiness',
    title: 'Readiness Analysis',
    description: 'Detailed breakdown of your readiness score with actionable insights',
    icon: Activity,
    href: '/readiness',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  {
    id: 'best-efforts',
    title: 'Best Efforts',
    description: 'Automatically detected personal records from your runs',
    icon: Zap,
    href: '/best-efforts',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
  },
  {
    id: 'workout-confidence',
    title: 'Workout Confidence',
    description: 'Get a confidence score for today\'s workout based on your current state',
    icon: Gauge,
    href: '/workout-confidence',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
  },
  {
    id: 'race-predictor',
    title: 'Race Predictor',
    description: 'Predict your race times based on recent performances and fitness',
    icon: Target,
    href: '/race-predictor',
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    comingSoon: true,
  },
  {
    id: 'performance-insights',
    title: 'Performance Insights',
    description: 'Discover patterns in your training and get AI-powered recommendations',
    icon: Brain,
    href: '/insights',
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    comingSoon: true,
  },
];

export default function ToolsPage() {
  return (
    <div className="min-h-screen bg-stone-50">
      <div className="mx-auto max-w-6xl p-4 sm:p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-stone-900 mb-2">Training Tools</h1>
          <p className="text-stone-600">
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
                  className="relative bg-white rounded-xl border border-stone-200 p-6 opacity-75"
                >
                  <div className="absolute top-3 right-3">
                    <span className="text-xs font-medium text-stone-400 bg-stone-100 px-2 py-1 rounded">
                      Coming Soon
                    </span>
                  </div>
                  <div className={`w-12 h-12 ${tool.bgColor} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon className={`w-6 h-6 ${tool.color}`} />
                  </div>
                  <h3 className="font-semibold text-stone-900 mb-2">{tool.title}</h3>
                  <p className="text-sm text-stone-500">{tool.description}</p>
                </div>
              );
            }

            return (
              <Link
                key={tool.id}
                href={tool.href}
                className="group bg-white rounded-xl border border-stone-200 p-6 hover:border-teal-300 hover:shadow-sm transition-all"
              >
                <div className={`w-12 h-12 ${tool.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                  <Icon className={`w-6 h-6 ${tool.color}`} />
                </div>
                <h3 className="font-semibold text-stone-900 mb-2 group-hover:text-teal-600 transition-colors">
                  {tool.title}
                </h3>
                <p className="text-sm text-stone-500">{tool.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}