import type { ReactNode } from 'react';

type BadgeVariant = 'default' | 'orange' | 'green' | 'grey';

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  icon?: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-neutral-card text-neutral-secondary',
  orange: 'bg-brand-light text-brand',
  green: 'bg-lime-light text-lime-hover',
  grey: 'bg-neutral-card text-neutral-secondary',
};

export function Badge({ children, variant = 'default', icon, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}
