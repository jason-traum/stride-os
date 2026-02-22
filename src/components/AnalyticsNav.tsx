'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export const analyticsTabs = [
  { href: '/analytics', label: 'Overview', exact: true },
  { href: '/analytics/training', label: 'Training' },
  { href: '/analytics/load', label: 'Load' },
  { href: '/analytics/performance', label: 'Performance' },
  { href: '/analytics/racing', label: 'Racing' },
  { href: '/analytics/history', label: 'History' },
  { href: '/analytics/progress', label: 'Progress' },
];

export function AnalyticsNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-10 bg-bgTertiary/80 backdrop-blur-sm border-b border-borderPrimary -mx-4 px-4 sm:-mx-6 sm:px-6 mb-4">
      <div className="flex gap-1 overflow-x-auto scrollbar-hide py-2">
        {analyticsTabs.map((tab) => {
          const isActive = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-dream-600 text-white'
                  : 'text-textTertiary hover:text-textPrimary hover:bg-bgSecondary'
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
