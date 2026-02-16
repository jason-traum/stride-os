'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sun, Moon, Clock, Settings, Timer, Flag, Calendar, BarChart2, HelpCircle, MoreHorizontal, X, User } from 'lucide-react';
import { CoachLogo } from './CoachLogo';
import { ProfileSwitcher } from './ProfileSwitcher';
import { DarkModeToggle } from './DarkModeToggle';
import { useProfile } from '@/lib/profile-context';

// Full navigation for sidebar
const navItems = [
  { href: '/today', label: 'Today', icon: Sun },
  { href: '/coach', label: 'Coach', icon: null },
  { href: '/plan', label: 'Plan', icon: Calendar },
  { href: '/races', label: 'Races', icon: Flag },
  { href: '/pace-calculator', label: 'Pace Calc', icon: Timer },
  { href: '/history', label: 'History', icon: Clock },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/guide', label: 'Guide', icon: HelpCircle },
];

// Primary mobile nav items (4 + More button)
const mobileNavItems = [
  { href: '/today', label: 'Today', icon: Sun },
  { href: '/coach', label: 'Coach', icon: null },
  { href: '/plan', label: 'Plan', icon: Calendar },
];

// Items shown in the "More" menu
const moreMenuItems = [
  { href: '/races', label: 'Races', icon: Flag },
  { href: '/pace-calculator', label: 'Pace Calc', icon: Timer },
  { href: '/history', label: 'History', icon: Clock },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/guide', label: 'Guide', icon: HelpCircle },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-surface-0">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between h-16 flex-shrink-0 px-4 border-b border-borderSecondary">
          <h1 className="text-xl brand-text tracking-tight">dreamy</h1>
          <DarkModeToggle />
        </div>
        {/* Profile Switcher */}
        <div className="px-3 pt-4 pb-2 border-b border-borderSecondary">
          <ProfileSwitcher variant="sidebar" />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            const isCoach = item.href === '/coach';
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors',
                  isActive
                    ? 'bg-surface-interactive text-textPrimary border-l-2 border-dream-500'
                    : 'text-textTertiary hover:bg-surface-interactive-hover hover:text-textPrimary border-l-2 border-transparent'
                )}
              >
                {isCoach ? (
                  <CoachLogo className="mr-3 h-5 w-5 flex-shrink-0" />
                ) : Icon ? (
                  <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                ) : null}
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
            className="absolute bottom-0 left-0 right-0 bg-bgSecondary rounded-t-2xl p-4 pb-8 safe-area-inset-bottom"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-textPrimary">More</h3>
              <button
                onClick={() => setShowMore(false)}
                className="p-2 -mr-2 text-textTertiary hover:text-textPrimary"
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
                        ? 'bg-surface-interactive text-dream-400'
                        : 'text-textSecondary hover:bg-surface-interactive-hover'
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-0 border-t border-borderSecondary z-40 safe-area-inset-bottom">
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
                    ? isCoach ? 'text-rose-600 dark:text-rose-400' : 'text-dream-400'
                    : 'text-textTertiary hover:text-textPrimary'
                )}
              >
                {isCoach ? (
                  <CoachLogo className="h-5 w-5 mb-1" />
                ) : Icon ? (
                  <Icon className="h-5 w-5 mb-1" />
                ) : null}
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
                ? 'text-dream-400'
                : 'text-textTertiary hover:text-textPrimary'
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

// All pages across navItems + moreMenuItems for title lookup
const allPages = [...navItems, ...moreMenuItems];

function getAvatarStyle(profile: { avatarColor: string; auraColorStart?: string | null; auraColorEnd?: string | null }) {
  if (profile.auraColorStart && profile.auraColorEnd) {
    return { background: `linear-gradient(135deg, ${profile.auraColorStart}, ${profile.auraColorEnd})` };
  }
  return { backgroundColor: profile.avatarColor };
}

export function MobileHeader() {
  const pathname = usePathname();
  const { activeProfile, setShowPicker } = useProfile();
  const [darkMode, setDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(stored === 'dark' || (!stored && prefersDark));
  }, []);

  const toggleDarkMode = () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    localStorage.setItem('theme', newValue ? 'dark' : 'light');
    if (newValue) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  };

  // Find the current page title
  const currentPage = allPages.find(
    item => pathname === item.href || pathname.startsWith(item.href + '/')
  );
  const pageTitle = currentPage?.label || 'Dreamy';

  const avatarStyle = activeProfile ? getAvatarStyle(activeProfile) : { backgroundColor: '#6b7280' };

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 bg-surface-0 border-b border-borderSecondary safe-area-inset-top">
      <div className="flex items-center justify-between h-12 px-4">
        {pageTitle === 'Dreamy' ? (
          <h1 className="text-lg brand-text tracking-tight">dreamy</h1>
        ) : (
          <h1 className="text-lg font-display font-semibold text-textPrimary truncate">
            {pageTitle}
          </h1>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPicker(true)}
            className="p-1.5 rounded-lg hover:bg-surface-interactive-hover transition-colors"
            aria-label="Switch profile"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={avatarStyle}
            >
              <User className="w-3.5 h-3.5 text-white" />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
