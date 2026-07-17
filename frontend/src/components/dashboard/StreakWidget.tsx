import { useEffect, useRef, useState } from 'react';
import { StreakFlame } from './StreakFlame.tsx';
import { pluralizeRu } from '../../utils/russianPlural.ts';
import type { StreakCelebration } from '../../context/StreakCelebrationContext.tsx';

const COUNT_DURATION_MS = 1100;

interface StreakWidgetProps {
  days: number;
  celebration?: StreakCelebration | null;
  onCelebrationComplete?: () => void;
}

export function StreakWidget({ days, celebration, onCelebrationComplete }: StreakWidgetProps) {
  const isCelebrating = Boolean(celebration);
  const [displayDays, setDisplayDays] = useState(celebration ? celebration.from : days);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!celebration) {
      setDisplayDays(days);
      return;
    }

    const { from, to } = celebration;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / COUNT_DURATION_MS);
      setDisplayDays(Math.round(from + (to - from) * progress));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [celebration, days]);

  const isActive = displayDays > 0;

  return (
    <div
      data-tour="streak-widget"
      className="bg-white rounded-3xl shadow-card p-6 sm:p-8 w-full sm:w-[360px] flex items-center gap-5 flex-shrink-0"
    >
      <div
        className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex items-center justify-center flex-shrink-0 overflow-hidden ${
          isActive ? 'bg-brand-light' : 'bg-neutral-card'
        }`}
      >
        <StreakFlame
          isActive={isActive}
          isPlaying={isCelebrating}
          onPlayComplete={onCelebrationComplete}
          className="w-14 h-14 sm:w-16 sm:h-16"
        />
      </div>
      <div>
        <p className="text-4xl font-extrabold text-neutral-text leading-tight">{displayDays}</p>
        <p className="text-lg text-neutral-text">
          {pluralizeRu(displayDays, ['День в ударе', 'Дня в ударе', 'Дней в ударе'])}
        </p>
      </div>
    </div>
  );
}
