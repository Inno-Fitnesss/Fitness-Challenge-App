const WEEK_DAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];

interface DayInfo {
  label: string;
  day: number;
  isToday: boolean;
  isFuture: boolean;
}

function buildWeekDays(): DayInfo[] {
  const today = new Date();
  const currentDay = today.getDate();
  const startDay = currentDay - today.getDay() + (today.getDay() === 0 ? -6 : 1);

  return WEEK_DAYS.map((label, index) => {
    const day = startDay + index;
    const isToday = day === currentDay;
    const isFuture = day > currentDay;

    return { label, day, isToday, isFuture };
  });
}

export function WeeklyCalendar() {
  const days = buildWeekDays();
  const monthLabel = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date());

  return (
    <div className="bg-white rounded-3xl shadow-card p-6 flex-1">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-bold text-neutral-text">Эта неделя</h2>
        <span className="text-sm text-neutral-muted">{monthLabel}</span>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => (
          <div key={day.label} className="flex flex-col items-center gap-2">
            <span className="text-xs text-neutral-muted font-medium">{day.label}</span>
            <span
              className={`text-sm font-semibold ${
                day.isToday ? 'text-brand' : day.isFuture ? 'text-neutral-muted' : 'text-neutral-text'
              }`}
            >
              {day.day}
            </span>
            {day.isToday ? (
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
            ) : (
              <span className="h-1.5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
