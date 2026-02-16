import { cn } from '@/lib/utils';
import { CoachLogo } from './CoachLogo';

interface ChaseAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ChaseAvatar({ size = 'md', className }: ChaseAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-14 h-14',
    lg: 'w-16 h-16',
  };

  return (
    <div className={cn(sizeClasses[size], 'text-current', className)}>
      <CoachLogo />
    </div>
  );
}
