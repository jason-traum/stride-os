'use client';

import Link from 'next/link';
import { User, RefreshCw, Settings, ChevronRight, Footprints, Brain, Activity } from 'lucide-react';

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
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    hoverColor: 'hover:bg-purple-500/15',
    title: 'Coach Memory',
    description: 'What your coach knows and remembers about you',
  },
  {
    href: '/strava-sync',
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
    href: '/settings/general',
    icon: Settings,
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/30',
    hoverColor: 'hover:bg-indigo-500/15',
    title: 'General',
    description: 'Coach style, AI provider, demo data, app install',
  },
];

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-display font-semibold text-primary mb-6">Settings</h1>

      <div className="space-y-3">
        {settingsLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="block">
              <div className={`${link.bgColor} rounded-xl border ${link.borderColor} p-4 shadow-sm ${link.hoverColor} transition-colors`}>
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
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
