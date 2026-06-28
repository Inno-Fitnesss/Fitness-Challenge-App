import { Flame } from 'lucide-react';
import { pluralizeRu } from '../../utils/russianPlural.ts';

interface StreakWidgetProps {
  days: number;
}

export function StreakWidget({ days }: StreakWidgetProps) {
  const isActive = days > 0;

  return (
    <div className="bg-white rounded-3xl shadow-card p-5 sm:p-6 w-full sm:w-[200px] flex flex-row sm:flex-col items-center justify-center gap-4 sm:gap-3 flex-shrink-0">
      <div
        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center flex-shrink-0 ${
          isActive ? 'bg-brand-light' : 'bg-neutral-card'
        }`}
      >
        <Flame
          size={24}
          className={`sm:hidden ${isActive ? 'text-brand' : 'text-neutral-muted'}`}
        />
        <Flame
          size={28}
          className={`hidden sm:block ${isActive ? 'text-brand' : 'text-neutral-muted'}`}
        />
      </div>
      <div className="text-center sm:text-center flex-1 sm:flex-none">
        <p className="text-2xl font-extrabold text-neutral-text">{days}</p>
        <p className="text-sm text-neutral-secondary">
          {pluralizeRu(days, ['День в ударе', 'Дня в ударе', 'Дней в ударе'])}
        </p>
      </div>
    </div>
  );
}
