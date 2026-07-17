interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

/** Donut chart for daily challenge completion (0–100%). */
export function CircularProgress({
  value,
  size = 56,
  strokeWidth = 5,
  className = '',
}: CircularProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={`relative flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Выполнено ${clamped}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-neutral-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-lime transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-bold text-lime ${
          size >= 80 ? 'text-base sm:text-lg' : size >= 64 ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
        }`}
      >
        {clamped}%
      </span>
    </div>
  );
}
