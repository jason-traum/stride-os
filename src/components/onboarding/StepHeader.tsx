import type { LucideIcon } from 'lucide-react';

interface StepHeaderProps {
  icon: LucideIcon;
  iconColor?: string;
  title: string;
  subtitle: string;
}

export function StepHeader({ icon: Icon, iconColor = 'text-dream-500', title, subtitle }: StepHeaderProps) {
  return (
    <div className="text-center mb-6">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-dream-500/20 mb-3">
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <h2 className="text-xl font-semibold text-primary">{title}</h2>
      <p className="text-tertiary text-sm mt-1">{subtitle}</p>
    </div>
  );
}
