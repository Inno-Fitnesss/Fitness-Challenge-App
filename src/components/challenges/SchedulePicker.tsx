export type ScheduleMode = 'daily' | 'weekly';

export const WEEKDAYS = [
  { value: 1, label: 'Пн', full: 'Понедельник' },
  { value: 2, label: 'Вт', full: 'Вторник' },
  { value: 3, label: 'Ср', full: 'Среда' },
  { value: 4, label: 'Чт', full: 'Четверг' },
  { value: 5, label: 'Пт', full: 'Пятница' },
  { value: 6, label: 'Сб', full: 'Суббота' },
  { value: 7, label: 'Вс', full: 'Воскресенье' },
] as const;

interface SchedulePickerProps {
  mode: ScheduleMode;
  selectedDays: number[];
  onModeChange: (mode: ScheduleMode) => void;
  onDaysChange: (days: number[]) => void;
}

export function SchedulePicker({
  mode,
  selectedDays,
  onModeChange,
  onDaysChange,
}: SchedulePickerProps) {
  const toggleDay = (day: number) => {
    onDaysChange(
      selectedDays.includes(day)
        ? selectedDays.filter((d) => d !== day)
        : [...selectedDays, day].sort((a, b) => a - b),
    );
  };

  const modeBtnClass = (active: boolean) =>
    `flex-1 px-3 py-2.5 text-sm font-semibold rounded-xl border-2 transition-colors cursor-pointer ${
      active
        ? 'border-brand bg-brand/5 text-brand'
        : 'border-neutral-border text-neutral-secondary hover:border-brand/40'
    }`;

  return (
    <section className="min-w-0">
      <h2 className="text-sm font-bold text-neutral-text mb-3">Расписание</h2>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full min-w-0 max-w-md">
        <button
          type="button"
          className={modeBtnClass(mode === 'daily')}
          onClick={() => onModeChange('daily')}
        >
          Каждый день
        </button>
        <button
          type="button"
          className={modeBtnClass(mode === 'weekly')}
          onClick={() => onModeChange('weekly')}
        >
          Выбрать дни
        </button>
      </div>

      {mode === 'weekly' && (
        <div className="mt-3 p-3 sm:p-4 border border-neutral-border rounded-2xl bg-neutral-card/50 animate-slide-up">
          <p className="text-xs text-neutral-muted mb-3">
            Отметьте дни, когда нужно выполнять упражнения
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 min-w-0">
            {WEEKDAYS.map(({ value, label, full }) => {
              const selected = selectedDays.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-label={full}
                  aria-pressed={selected}
                  onClick={() => toggleDay(value)}
                  className={`
                    py-2.5 text-sm font-semibold rounded-xl border-2 transition-all cursor-pointer active:scale-95
                    ${selected
                      ? 'border-lime bg-lime text-neutral-text shadow-sm'
                      : 'border-neutral-border bg-white text-neutral-secondary hover:border-brand/40'
                    }
                  `}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {selectedDays.length === 0 && (
            <p className="text-xs text-amber-600 mt-2">Выберите хотя бы один день</p>
          )}
        </div>
      )}
    </section>
  );
}
