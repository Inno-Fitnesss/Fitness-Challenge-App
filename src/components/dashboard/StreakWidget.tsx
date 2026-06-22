import { Flame } from 'lucide-react';

interface StreakWidgetProps {
  days: number;
}

export function StreakWidget({ days }: StreakWidgetProps) {
  return (
    <div className="bg-white rounded-3xl shadow-card p-6 w-[200px] flex flex-col items-center justify-center gap-3">
      <div className="w-14 h-14 rounded-full bg-brand-light flex items-center justify-center">
        <Flame size={28} className="text-brand" />
      </div>
      <div className="text-center">
        <p className="text-2xl font-extrabold text-neutral-text">{days}</p>
        <p className="text-sm text-neutral-secondary">Дней в ударе</p>
      </div>
    </div>
  );
}
