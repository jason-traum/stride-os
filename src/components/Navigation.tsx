'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Sun, PlusCircle, Footprints, Clock, Settings, Timer, Bot, Shirt, Flag, Calendar } from 'lucide-react';

const navItems = [
  { href: '/today', label: 'Today', icon: Sun },
  { href: '/log', label: 'Log Run', icon: PlusCircle },
  { href: '/coach', label: 'Coach', icon: Bot },
  { href: '/races', label: 'Races', icon: Flag },
  { href: '/plan', label: 'Plan', icon: Calendar },
  { href: '/pace-calculator', label: 'Pace Calc', icon: Timer },
  { href: '/wardrobe', label: 'Wardrobe', icon: Shirt },
  { href: '/shoes', label: 'Shoes', icon: Footprints },
  { href: '/history', label: 'History', icon: Clock },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-slate-900">
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center h-16 flex-shrink-0 px-4 border-b border-slate-800">
          <h1 className="text-xl font-semibold text-white tracking-tight">Stride OS</h1>
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
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
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

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 safe-area-inset-bottom">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center flex-1 py-2 text-xs font-medium transition-colors',
                isActive
                  ? 'text-blue-600'
                  : 'text-slate-500 hover:text-slate-900'
              )}
            >
              <Icon className="h-5 w-5 mb-1" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
