import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import type { CalendarDay } from '../../utils/dashboardCalendar.ts';

interface WeeklyCalendarProps {
  days: CalendarDay[];
  weekLabel: string;
  isCurrentWeek: boolean;
  isWeekLoading?: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToToday: () => void;
}

function dayCircleClass(day: CalendarDay): string {
  const base =
    'relative w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-colors mx-auto';

  switch (day.status) {
    case 'full':
      return `${base} bg-brand text-white shadow-sm`;
    case 'partial':
      return `${base} bg-brand-light text-brand ring-2 ring-brand/50`;
    case 'missed':
      return `${base} bg-neutral-card text-neutral-muted`;
    case 'pending':
      return `${base} bg-neutral-card text-neutral-secondary`;
    case 'rest':
      return `${base} bg-neutral-card/60 text-neutral-muted`;
    case 'future':
    default:
      return `${base} text-neutral-muted`;
  }
}

// Мобильная пилюля «день недели + число» по макету: кремовый прямоугольник,
// сегодняшний день — оранжевый, выполненные — лаймовые.
function dayPillClass(day: CalendarDay): string {
  const base =
    'w-full rounded-xl flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-bold transition-colors';

  switch (day.status) {
    case 'full':
      return `${base} bg-lime text-white`;
    case 'partial':
      return `${base} bg-lime-light text-lime-hover`;
    case 'missed':
      return `${base} bg-neutral-card text-neutral-muted`;
    case 'pending':
      return `${base} bg-brand-light text-brand`;
    case 'rest':
    case 'future':
    default:
      return `${base} bg-[#F6F1E4] ${day.status === 'future' ? 'text-neutral-muted' : 'text-neutral-text'}`;
  }
}

function dayTitle(day: CalendarDay): string {
  switch (day.status) {
    case 'full':
      return 'Все челленджи на день выполнены';
    case 'partial':
      return 'Выполнен хотя бы один челлендж';
    case 'missed':
      return 'Запланированные челленджи не выполнены';
    case 'pending':
      return 'Сегодня есть запланированные челленджи';
    case 'rest':
      return 'Нет запланированных челленджей';
    case 'future':
      return 'Ещё впереди';
    default:
      return '';
  }
}

export function WeeklyCalendar({
  days,
  weekLabel,
  isCurrentWeek,
  isWeekLoading = false,
  onPrevWeek,
  onNextWeek,
  onGoToToday,
}: WeeklyCalendarProps) {
  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-card p-4 sm:p-6 flex-1 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-4 sm:mb-5 min-w-0">
        <button
          type="button"
          onClick={onPrevWeek}
          aria-label="Предыдущая неделя"
          className="p-1.5 sm:p-2 rounded-xl text-neutral-muted hover:text-neutral-text hover:bg-neutral-card transition-colors flex-shrink-0"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex-1 min-w-0 text-center">
          <h2 className="text-sm sm:text-base font-bold text-neutral-text truncate">{weekLabel}</h2>
          {!isCurrentWeek && (
            <button
              type="button"
              onClick={onGoToToday}
              className="mt-0.5 text-[11px] sm:text-xs font-semibold text-brand hover:text-brand-hover"
            >
              Вернуться к текущей неделе
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onNextWeek}
          aria-label="Следующая неделя"
          className="p-1.5 sm:p-2 rounded-xl text-neutral-muted hover:text-neutral-text hover:bg-neutral-card transition-colors flex-shrink-0"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Мобильная сетка: пилюли «ПН / 8» по макету */}
      <div className="grid sm:hidden grid-cols-7 gap-1.5 w-full min-w-0" aria-label="Календарь активности">
        {days.map((day) => (
          <button
            key={day.isoDate}
            type="button"
            className={`${dayPillClass(day)} ${
              day.isToday && day.status !== 'full' && day.status !== 'partial' && day.status !== 'pending'
                ? '!bg-brand-light !text-brand'
                : ''
            } ${isWeekLoading ? 'opacity-60' : ''}`}
            title={dayTitle(day)}
            aria-label={`${day.day} ${dayTitle(day)}`}
            disabled={isWeekLoading}
          >
            <span className="text-[11px] leading-none uppercase">{day.weekdayLabel}</span>
            {day.status === 'full' ? (
              <Check size={14} strokeWidth={3} aria-hidden />
            ) : (
              <span className="text-sm leading-none">{day.day}</span>
            )}
          </button>
        ))}
      </div>

      {}
      <div className="hidden sm:grid grid-cols-7 gap-1 sm:gap-2 w-full min-w-0" aria-label="Календарь активности">
        {days.map((day) => (
          <div key={day.isoDate} className="flex flex-col items-center gap-1.5 min-w-0">
            <span className="text-[10px] sm:text-xs text-neutral-muted font-medium truncate w-full text-center">
              {day.weekdayLabel}
            </span>
            <button
              type="button"
              className={`${dayCircleClass(day)} ${
                day.isToday && day.status !== 'full' && day.status !== 'partial'
                  ? 'ring-2 ring-brand/40 ring-offset-1'
                  : ''
              } ${isWeekLoading ? 'opacity-60' : ''}`}
              title={dayTitle(day)}
              aria-label={`${day.day} ${dayTitle(day)}`}
              disabled={isWeekLoading}
            >
              {day.status === 'full' ? (
                <Check size={18} strokeWidth={3} aria-hidden />
              ) : (
                <span>{day.day}</span>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
