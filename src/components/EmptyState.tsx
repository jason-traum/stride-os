'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Activity,
  Calendar,
  BarChart3,
  Footprints,
  Trophy,
  MessageCircle,
  Shirt,
  type LucideIcon,
} from 'lucide-react';

export type EmptyStateVariant =
  | 'workouts'
  | 'history'
  | 'analytics'
  | 'plan'
  | 'shoes'
  | 'races'
  | 'chat'
  | 'wardrobe';

interface EmptyStateConfig {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  actionHref?: string;
  iconColor: string;
  iconBg: string;
}

const configs: Record<EmptyStateVariant, EmptyStateConfig> = {
  workouts: {
    icon: Activity,
    title: 'No workouts yet',
    description: 'Log your first run to start tracking your training.',
    actionLabel: 'Log a Run',
    actionHref: '/log',
    iconColor: 'text-teal-500',
    iconBg: 'bg-surface-1',
  },
  history: {
    icon: Calendar,
    title: 'Your run history will appear here',
    description: 'Once you log workouts, you\'ll see them listed here with all the details.',
    actionLabel: 'Log Your First Run',
    actionHref: '/log',
    iconColor: 'text-tertiary',
    iconBg: 'bg-bgTertiary',
  },
  analytics: {
    icon: BarChart3,
    title: 'Not enough data yet',
    description: 'Log a few runs to start seeing your training trends and insights.',
    actionLabel: 'Log a Run',
    actionHref: '/log',
    iconColor: 'text-emerald-500',
    iconBg: 'bg-emerald-50',
  },
  plan: {
    icon: Calendar,
    title: 'No training plan yet',
    description: 'Let\'s build a personalized plan based on your goals and schedule.',
    actionLabel: 'Create a Plan',
    actionHref: '/onboarding',
    iconColor: 'text-purple-500',
    iconBg: 'bg-purple-50',
  },
  shoes: {
    icon: Footprints,
    title: 'No shoes tracked',
    description: 'Add your running shoes to track mileage and know when they need replacing.',
    actionLabel: 'Add Your First Pair',
    iconColor: 'text-rose-500',
    iconBg: 'bg-rose-50',
  },
  races: {
    icon: Trophy,
    title: 'No race results yet',
    description: 'Add a race result to calculate your VDOT and get personalized training paces.',
    actionLabel: 'Add a Race',
    iconColor: 'text-teal-500',
    iconBg: 'bg-surface-1',
  },
  chat: {
    icon: MessageCircle,
    title: 'Ask me anything',
    description: 'I can log runs, adjust your plan, analyze your training, suggest paces, and more.',
    actionLabel: 'Start Chatting',
    iconColor: 'text-teal-500',
    iconBg: 'bg-surface-1',
  },
  wardrobe: {
    icon: Shirt,
    title: 'No gear added yet',
    description: 'Add your running wardrobe to get personalized outfit recommendations.',
    actionLabel: 'Add Clothing',
    iconColor: 'text-pink-500',
    iconBg: 'bg-pink-50',
  },
};

interface EmptyStateProps {
  variant: EmptyStateVariant;
  onAction?: () => void;
  className?: string;
  compact?: boolean;
}

export function EmptyState({ variant, onAction, className, compact = false }: EmptyStateProps) {
  const config = configs[variant];
  const Icon = config.icon;

  const content = (
    <>
      <div
        className={cn(
          'rounded-full flex items-center justify-center mx-auto',
          config.iconBg,
          compact ? 'w-12 h-12 mb-3' : 'w-16 h-16 mb-4'
        )}
      >
        <Icon className={cn(config.iconColor, compact ? 'w-6 h-6' : 'w-8 h-8')} />
      </div>

      <h3
        className={cn(
          'font-semibold text-primary',
          compact ? 'text-sm mb-1' : 'text-lg mb-2'
        )}
      >
        {config.title}
      </h3>

      <p
        className={cn(
          'text-textTertiary max-w-xs mx-auto',
          compact ? 'text-xs mb-3' : 'text-sm mb-4'
        )}
      >
        {config.description}
      </p>

      {config.actionHref && !onAction ? (
        <Link
          href={config.actionHref}
          className={cn(
            'inline-flex items-center justify-center font-medium rounded-xl transition-colors',
            'bg-accentTeal text-white hover:bg-accentTeal-hover shadow-sm hover:shadow-md transition-all',
            compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
          )}
        >
          {config.actionLabel}
        </Link>
      ) : onAction ? (
        <button
          onClick={onAction}
          className={cn(
            'inline-flex items-center justify-center font-medium rounded-xl transition-colors',
            'bg-accentTeal text-white hover:bg-accentTeal-hover shadow-sm hover:shadow-md transition-all',
            compact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'
          )}
        >
          {config.actionLabel}
        </button>
      ) : null}
    </>
  );

  return (
    <div
      className={cn(
        'text-center',
        compact ? 'py-6' : 'py-12',
        className
      )}
    >
      {content}
    </div>
  );
}
