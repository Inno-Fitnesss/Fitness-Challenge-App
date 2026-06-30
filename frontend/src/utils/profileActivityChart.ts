import { meApi } from '../api/challengeApi.ts';
import { toIsoDate } from './dashboardCalendar.ts';

export interface DailyChallengeActivity {
  isoDate: string;
  weekdayLabel: string;
  count: number;
}

const WEEKDAY_LABELS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getWeekStart(date: Date): Date {
  const base = startOfDay(date);
  const dayOfWeek = base.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset);
  return monday;
}

function buildLast7Days(): Date[] {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return date;
  });
}

/** Completed challenge activity for the last 7 calendar days (count per day when API supports it). */
export async function fetchLast7DaysChallengeActivity(): Promise<DailyChallengeActivity[]> {
  const days = buildLast7Days();
  const weekStarts = [...new Set(days.map((day) => toIsoDate(getWeekStart(day))))];

  const weekResponses = await Promise.all(
    weekStarts.map((weekStart) => meApi.getWeekActivity(weekStart).catch(() => null)),
  );

  const completedDates = new Set<string>();
  for (const week of weekResponses) {
    if (!week) continue;
    week.completed_dates.forEach((date) => completedDates.add(date));
  }

  return days.map((date) => {
    const iso = toIsoDate(date);
    return {
      isoDate: iso,
      weekdayLabel: WEEKDAY_LABELS[date.getDay()],
      count: completedDates.has(iso) ? 1 : 0,
    };
  });
}
