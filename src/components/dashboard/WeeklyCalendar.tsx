import { Flame } from 'lucide-react';

const WEEK_DAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

interface DayInfo {
  label: string;
  day: number;
  isoDate: string;
  isToday: boolean;
  isFuture: boolean;
  isCompleted: boolean;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildWeekDays(completedDates: Set<string>): DayInfo[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  return WEEK_DAYS.map((label, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const isoDate = toIsoDate(date);

    return {
      label,
      day: date.getDate(),
      isoDate,
      isToday: date.getTime() === today.getTime(),
      isFuture: date > today,
      isCompleted: completedDates.has(isoDate),
    };
  });
}

interface WeeklyCalendarProps {
  completedDates?: string[];
}

export function WeeklyCalendar({ completedDates = [] }: WeeklyCalendarProps) {
  const completedSet = new Set(completedDates);
  const days = buildWeekDays(completedSet);

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-card p-4 sm:p-6 flex-1 min-w-0">
      <h2 className="text-base font-bold text-neutral-text mb-4 sm:mb-6">Эта неделя</h2>

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {days.map((day) => (
          <div key={day.isoDate} className="flex flex-col items-center gap-2">
            <span className="text-xs text-neutral-muted font-medium">{day.label}</span>
            <span
              className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                day.isCompleted
                  ? 'bg-brand text-white shadow-sm'
                  : day.isFuture
                    ? 'text-neutral-muted'
                    : 'bg-neutral-card text-neutral-muted'
              } ${day.isToday && !day.isCompleted ? 'ring-2 ring-brand/40 ring-offset-1' : ''}`}
              title={
                day.isCompleted
                  ? 'Челлендж выполнен'
                  : day.isFuture
                    ? 'Ещё впереди'
                    : 'Не выполнено'
              }
            >
              {day.isCompleted && (
                <Flame
                  size={28}
                  className="absolute text-brand/25 pointer-events-none"
                  aria-hidden
                />
              )}
              <span className="relative z-[1]">{day.day}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
