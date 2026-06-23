interface ProgressBarProps {
  value: number;
  max?: number;
  color?: 'lime' | 'orange' | 'grey';
  className?: string;
}

export function ProgressBar({ value, max = 100, color = 'lime', className = '' }: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));

  const fillClass =
    color === 'orange' ? 'bg-brand' : color === 'grey' ? 'bg-neutral-muted' : 'bg-lime';

  return (
    <div className={`h-2 w-full rounded-full bg-neutral-border overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${fillClass}`}
        style={{ width: `${percent}%` }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
      />
    </div>
  );
}
