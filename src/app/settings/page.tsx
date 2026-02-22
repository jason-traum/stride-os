'use client';

import Link from 'next/link';
import { User, RefreshCw, Settings, ChevronRight, Footprints, Brain, Activity, Download } from 'lucide-react';
import { AnimatedList, AnimatedListItem } from '@/components/AnimatedList';
import { AnimatedCard } from '@/components/AnimatedCard';

const settingsLinks = [
  {
    href: '/profile',
    icon: User,
    color: 'text-accentTeal',
    bgColor: 'bg-accentTeal/10',
    borderColor: 'border-accentTeal/30',
    hoverColor: 'hover:bg-accentTeal/15',
    title: 'Runner Profile',
    description: 'Training preferences, goals, PRs, comfort levels, and more',
  },
  {
    href: '/shoes',
    icon: Footprints,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    hoverColor: 'hover:bg-amber-500/15',
    title: 'Shoes',
    description: 'Manage your shoe rotation and track mileage',
  },
  {
    href: '/memory',
    icon: Brain,
    color: 'text-dream-500',
    bgColor: 'bg-dream-500/10',
    borderColor: 'border-dream-500/30',
    hoverColor: 'hover:bg-dream-500/15',
    title: 'Coach Memory',
    description: 'What your coach knows and remembers about you',
  },
  {
    href: '/settings/integrations',
    icon: RefreshCw,
    color: 'text-[#FC4C02]',
    bgColor: 'bg-[#FC4C02]/10',
    borderColor: 'border-[#FC4C02]/30',
    hoverColor: 'hover:bg-[#FC4C02]/15',
    title: 'Strava & Integrations',
    description: 'Sync activities, connect external services',
  },
  {
    href: '/usage',
    icon: Activity,
    color: 'text-sky-500',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/30',
    hoverColor: 'hover:bg-sky-500/15',
    title: 'API Usage',
    description: 'Track API calls, token usage, and costs',
  },
  {
    href: '/settings/export',
    icon: Download,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    hoverColor: 'hover:bg-emerald-500/15',
    title: 'Data Export',
    description: 'Download workouts, race results as CSV or JSON',
  },
  {
    href: '/settings/general',
    icon: Settings,
    color: 'text-dream-500',
    bgColor: 'bg-dream-500/10',
    borderColor: 'border-dream-500/30',
    hoverColor: 'hover:bg-dream-500/15',
    title: 'General',
    description: 'Coach style, AI provider, demo data, app install',
  },
];

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-primary mb-6">Settings</h1>

      <AnimatedList className="space-y-3">
        {settingsLinks.map((link) => {
          const Icon = link.icon;
          return (
            <AnimatedListItem key={link.href}>
              <Link href={link.href} className="block">
                <AnimatedCard className={`${link.bgColor} rounded-xl border ${link.borderColor} p-4 shadow-sm ${link.hoverColor} transition-colors`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${link.color}`} />
                      <div>
                        <p className="font-semibold text-primary">{link.title}</p>
                        <p className="text-sm text-textSecondary">{link.description}</p>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 ${link.color}`} />
                  </div>
                </AnimatedCard>
              </Link>
            </AnimatedListItem>
          );
        })}
      </AnimatedList>
    </div>
  );
}
