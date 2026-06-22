import { Flame } from 'lucide-react';

interface StreakWidgetProps {
  days: number;
}

export function StreakWidget({ days }: StreakWidgetProps) {
  return (
    <div className="bg-white rounded-3xl shadow-card p-5 sm:p-6 w-full sm:w-[200px] flex flex-row sm:flex-col items-center justify-center gap-4 sm:gap-3 flex-shrink-0">
      <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-brand-light flex items-center justify-center flex-shrink-0">
        <Flame size={24} className="text-brand sm:hidden" />
        <Flame size={28} className="text-brand hidden sm:block" />
      </div>
      <div className="text-center sm:text-center flex-1 sm:flex-none">
        <p className="text-2xl font-extrabold text-neutral-text">{days}</p>
        <p className="text-sm text-neutral-secondary">Дней в ударе</p>
      </div>
    </div>
  );
}
