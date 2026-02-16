import { cn } from '@/lib/utils';

interface CoachLogoProps {
  className?: string;
}

export function CoachLogo({ className }: CoachLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      fill="currentColor"
      className={cn('w-full h-full', className)}
    >
      <g transform="rotate(15 512 512)">
        <circle cx="565" cy="310" r="110" />
        <path
          d="M 285 650 C 395 520 545 450 705 470 C 845 488 900 600 820 720"
          fill="none"
          stroke="currentColor"
          strokeWidth="160"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}
