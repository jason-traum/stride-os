'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sun, Clock, Settings, Timer, Flag, Calendar, BarChart2, HelpCircle, MoreHorizontal, X, User, ChevronDown, Wrench, Trophy } from 'lucide-react';
import { CoachLogo } from './CoachLogo';
import { ProfileSwitcher } from './ProfileSwitcher';
import { DarkModeToggle } from './DarkModeToggle';
import { useProfile } from '@/lib/profile-context';
import { analyticsTabs } from './AnalyticsNav';

import type { LucideIcon } from 'lucide-react';

type AuthRole = 'admin' | 'user' | 'viewer' | 'coach' | 'customer';

type NavItem = { href: string; label: string; icon: LucideIcon | null };
type NavSection = { label: string; items: NavItem[] };

// Sidebar navigation grouped into logical sections
const sidebarSections: NavSection[] = [
  {
    label: '',
    items: [
      { href: '/today', label: 'Today', icon: Sun },
      { href: '/coach', label: 'Coach', icon: null },
    ],
  },
  {
    label: 'TRAINING',
    items: [
      { href: '/plan', label: 'Plan', icon: Calendar },
      { href: '/races', label: 'Races', icon: Flag },
      { href: '/analytics', label: 'Analytics', icon: BarChart2 },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { href: '/pace-calculator', label: 'Pace Calculator', icon: Timer },
      { href: '/achievements', label: 'Achievements', icon: Trophy },
      { href: '/tools', label: 'All Tools', icon: Wrench },
    ],
  },
  {
    label: 'MORE',
    items: [
      { href: '/history', label: 'History', icon: Clock },
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/guide', label: 'Guide', icon: HelpCircle },
    ],
  },
];

// Flat list of all sidebar items (used for MobileHeader title resolution)
const allNavItems: NavItem[] = sidebarSections.flatMap((s) => s.items);

// Primary mobile nav items (4 items + More button)
const fullMobileNavItems: NavItem[] = [
  { href: '/today', label: 'Today', icon: Sun },
  { href: '/coach', label: 'Coach', icon: null },
  { href: '/analytics', label: 'Analytics', icon: BarChart2 },
  { href: '/tools', label: 'Tools', icon: Wrench },
];

// Items shown in the mobile "More" menu
const fullMoreMenuItems: NavItem[] = [
  { href: '/plan', label: 'Plan', icon: Calendar },
  { href: '/races', label: 'Races', icon: Flag },
  { href: '/achievements', label: 'Achievements', icon: Trophy },
  { href: '/pace-calculator', label: 'Pace Calc', icon: Timer },
  { href: '/history', label: 'History', icon: Clock },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/guide', label: 'Guide', icon: HelpCircle },
];

function getRoleScopedItems(_role?: string | null) {
  return {
    sidebarSections,
    allNavItems,
    mobileNavItems: fullMobileNavItems,
    moreMenuItems: fullMoreMenuItems,
  };
}

function SidebarNavItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
  const Icon = item.icon;
  const isCoach = item.href === '/coach';
  const isAnalytics = item.href === '/analytics';

  return (
    <div>
      <Link
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
        {isAnalytics && isActive && (
          <ChevronDown className="ml-auto h-4 w-4 text-textTertiary" />
        )}
      </Link>
      {/* Analytics sub-items */}
      {isAnalytics && isActive && (
        <div className="ml-8 mt-1 space-y-0.5">
          {analyticsTabs.map((tab) => {
            const isSubActive = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  'block px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                  isSubActive
                    ? 'text-dream-500 bg-dream-500/10'
                    : 'text-textTertiary hover:text-textPrimary hover:bg-surface-interactive-hover'
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ role }: { role?: AuthRole | null }) {
  const pathname = usePathname();
  const { sidebarSections: sections } = getRoleScopedItems(role);

  if (pathname === '/coach' || pathname.startsWith('/coach/')) return null;

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
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {sections.map((section, sectionIdx) => (
            <div key={section.label || `section-${sectionIdx}`}>
              {/* Section header */}
              {section.label && (
                <div className={cn(
                  'px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-textTertiary/60 select-none',
                  sectionIdx > 0 ? 'pt-4' : 'pt-2'
                )}>
                  {section.label}
                </div>
              )}
              {/* Section items */}
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <SidebarNavItem key={item.href} item={item} pathname={pathname} />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}

export function MobileNav({ role }: { role?: AuthRole | null }) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const { mobileNavItems, moreMenuItems } = getRoleScopedItems(role);

  if (pathname === '/coach' || pathname.startsWith('/coach/')) return null;

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
                      'flex flex-col items-center justify-center min-h-[56px] p-3 rounded-xl transition-colors',
                      isActive
                        ? 'bg-surface-interactive text-dream-400'
                        : 'text-textSecondary hover:bg-surface-interactive-hover'
                    )}
                  >
                    {Icon && <Icon className="h-7 w-7 mb-1.5" />}
                    <span className="text-sm font-medium text-center">{item.label}</span>
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
                  'flex flex-col items-center justify-center flex-1 min-h-[44px] py-1 text-xs font-medium transition-colors',
                  isActive
                    ? isCoach ? 'text-rose-400' : 'text-dream-400'
                    : 'text-textTertiary hover:text-textPrimary'
                )}
              >
                {isCoach ? (
                  <CoachLogo className="h-6 w-6 mb-0.5" />
                ) : Icon ? (
                  <Icon className="h-6 w-6 mb-0.5" />
                ) : null}
                <span>{item.label}</span>
              </Link>
            );
          })}
          {/* More button */}
          <button
            onClick={() => setShowMore(true)}
            className={cn(
              'flex flex-col items-center justify-center flex-1 min-h-[44px] py-1 text-xs font-medium transition-colors',
              isMoreActive
                ? 'text-dream-400'
                : 'text-textTertiary hover:text-textPrimary'
            )}
          >
            <MoreHorizontal className="h-6 w-6 mb-0.5" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function getAvatarStyle(profile: { avatarColor: string; auraColorStart?: string | null; auraColorEnd?: string | null }) {
  if (profile.auraColorStart && profile.auraColorEnd) {
    return { background: `linear-gradient(135deg, ${profile.auraColorStart}, ${profile.auraColorEnd})` };
  }
  return { backgroundColor: profile.avatarColor };
}

export function MobileHeader({ role }: { role?: AuthRole | null }) {
  const pathname = usePathname();
  const { activeProfile, setShowPicker } = useProfile();
  const { allNavItems: navItems, mobileNavItems, moreMenuItems } = getRoleScopedItems(role);
  const allPages = [...navItems, ...mobileNavItems, ...moreMenuItems];

  if (pathname === '/coach' || pathname.startsWith('/coach/')) return null;

  // Find the current page title — check analytics sub-pages for a more specific name
  const currentPage = allPages.find(
    item => pathname === item.href || pathname.startsWith(item.href + '/')
  );
  let pageTitle = currentPage?.label || 'Dreamy';
  if (currentPage?.href === '/analytics' && pathname !== '/analytics') {
    const subTab = analyticsTabs.find(tab =>
      tab.exact ? pathname === tab.href : pathname.startsWith(tab.href)
    );
    if (subTab) pageTitle = subTab.label;
  }

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
            className="p-2 rounded-lg hover:bg-surface-interactive-hover transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
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
