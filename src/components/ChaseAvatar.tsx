import { cn } from '@/lib/utils';

interface ChaseAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: { container: 'w-8 h-8', icon: 'w-4 h-4' },
  md: { container: 'w-14 h-14', icon: 'w-7 h-7' },
  lg: { container: 'w-16 h-16', icon: 'w-8 h-8' },
};

function RunnerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <circle cx="13.5" cy="5.5" r="2.5" />
      <path d="M9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" />
    </svg>
  );
}

export function ChaseAvatar({ size = 'md', className }: ChaseAvatarProps) {
  const s = sizes[size];
  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-br from-dream-500 to-dream-700 flex items-center justify-center',
        s.container,
        className
      )}
    >
      <RunnerIcon className={cn(s.icon, 'text-white')} />
    </div>
  );
}
