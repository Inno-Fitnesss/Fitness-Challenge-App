import { WEEKDAYS } from '../components/challenges/SchedulePicker.tsx';

export function formatScheduleLabel(
  scheduleType: 'daily' | 'weekly',
  scheduleDays: number[] | null | undefined,
): string {
  if (scheduleType === 'daily') return 'Каждый день';
  if (!scheduleDays?.length) return 'По дням недели';

  return WEEKDAYS.filter((day) => scheduleDays.includes(day.value))
    .map((day) => day.label)
    .join(', ');
}
