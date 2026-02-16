import Image from 'next/image';
import { cn } from '@/lib/utils';

interface ChaseAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes = {
  sm: { container: 'w-8 h-8', px: 32 },
  md: { container: 'w-14 h-14', px: 56 },
  lg: { container: 'w-16 h-16', px: 64 },
};

export function ChaseAvatar({ size = 'md', className }: ChaseAvatarProps) {
  const s = sizes[size];
  return (
    <Image
      src="/chase-avatar.png"
      alt="Chase"
      width={s.px}
      height={s.px}
      className={cn('rounded-full', s.container, className)}
    />
  );
}
