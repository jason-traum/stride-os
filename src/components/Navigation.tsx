'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sun, Footprints, Clock, Settings, Timer, Bot, Flag, Calendar, BarChart2, HelpCircle, MoreHorizontal, X, Brain, Activity, RefreshCw } from 'lucide-react';
import { ProfileSwitcher } from './ProfileSwitcher';

// Full navigation for sidebar
const navItems = [
  { href: '/today', label: 'Today', icon: Sun },
  { href: '/coach', label: 'Coach', icon: Bot },
  { href: '/memory', label: 'Memory', icon: Brain },
  { href: '/plan', label: 'Plan', icon: Calendar },
  { href: '/races', label: 'Races', icon: Flag },
  { href: '/strava-sync', label: 'Strava Sync', icon: RefreshCw },
  { href: '/pace-calculator', label: 'Pace Calc', icon: Timer },
  { href: '/shoes', label: 'Shoes', icon: Footprints },
  { href: '/history', label: 'History', icon: Clock },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/usage', label: 'API Usage', icon: Activity },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/guide', label: 'Guide', icon: HelpCircle },
];

// Primary mobile nav items (4 + More button)
const mobileNavItems = [
  { href: '/today', label: 'Today', icon: Sun },
  { href: '/coach', label: 'Coach', icon: Bot },
  { href: '/plan', label: 'Plan', icon: Calendar },
];

// Items shown in the "More" menu
const moreMenuItems = [
  { href: '/memory', label: 'Memory', icon: Brain },
  { href: '/races', label: 'Races', icon: Flag },
  { href: '/strava-sync', label: 'Strava', icon: RefreshCw },
  { href: '/pace-calculator', label: 'Pace Calc', icon: Timer },
  { href: '/shoes', label: 'Shoes', icon: Footprints },
  { href: '/history', label: 'History', icon: Clock },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/usage', label: 'API Usage', icon: Activity },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/guide', label: 'Guide', icon: HelpCircle },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-stone-900">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center h-16 flex-shrink-0 px-4 border-b border-stone-800">
          <h1 className="text-xl font-display font-semibold text-white tracking-tight">Dreamy</h1>
        </div>
        {/* Profile Switcher */}
        <div className="px-3 pt-4 pb-2 border-b border-stone-800">
          <ProfileSwitcher variant="sidebar" />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                  isActive
                    ? 'bg-stone-800 text-white'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                )}
              >
                <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);

  // Check if current page is in the "more" menu
  const isMoreActive = moreMenuItems.some(
    item => pathname === item.href || pathname.startsWith(item.href + '/')
  );

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setShowMore(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 pb-8 safe-area-inset-bottom"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-stone-900">More</h3>
              <button
                onClick={() => setShowMore(false)}
                className="p-2 -mr-2 text-stone-500 hover:text-stone-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {moreMenuItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowMore(false)}
                    className={cn(
                      'flex flex-col items-center justify-center p-3 rounded-xl transition-colors',
                      isActive
                        ? 'bg-slate-50 text-teal-600'
                        : 'text-stone-600 hover:bg-stone-100'
                    )}
                  >
                    <Icon className="h-6 w-6 mb-1" />
                    <span className="text-xs font-medium text-center">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 z-40 safe-area-inset-bottom">
        <div className="flex justify-around items-center h-16">
          {mobileNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            const isCoach = item.href === '/coach';
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 py-2 text-xs font-medium transition-colors',
                  isActive
                    ? isCoach ? 'text-rose-600' : 'text-teal-600'
                    : 'text-stone-500 hover:text-stone-900'
                )}
              >
                <Icon className={cn(
                  "h-5 w-5 mb-1",
                  isCoach && !isActive && "text-rose-500"
                )} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setShowMore(true)}
            className={cn(
              'flex flex-col items-center justify-center flex-1 py-2 text-xs font-medium transition-colors',
              isMoreActive
                ? 'text-teal-600'
                : 'text-stone-500 hover:text-stone-900'
            )}
          >
            <MoreHorizontal className="h-5 w-5 mb-1" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
