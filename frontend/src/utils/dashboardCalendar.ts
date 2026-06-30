import type { ApiTodayChallenge } from '../types/api.types.ts';
import type { ChallengeListItem } from '../types/challenge.ts';

export type CalendarDayStatus = 'future' | 'rest' | 'pending' | 'missed' | 'partial' | 'full';

export interface CalendarDay {
  isoDate: string;
  day: number;
  weekdayLabel: string;
  isToday: boolean;
  status: CalendarDayStatus;
}

const WEEKDAY_LABELS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'];
const MONTH_NAMES = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toIsoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Monday of the week for `date`, shifted by `weekOffset` whole weeks. */
export function getWeekStart(date: Date, weekOffset = 0): Date {
  const base = startOfDay(date);
  const dayOfWeek = base.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(base);
  monday.setDate(base.getDate() + mondayOffset + weekOffset * 7);
  return monday;
}

export function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(weekStart.getDate() + 6);
  return end;
}

export function formatWeekRangeLabel(weekStart: Date, weekEnd: Date): string {
  const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
  const sameYear = weekStart.getFullYear() === weekEnd.getFullYear();

  if (sameMonth && sameYear) {
    return `${weekStart.getDate()}–${weekEnd.getDate()} ${MONTH_NAMES[weekStart.getMonth()]}`;
  }

  const startPart = `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()].slice(0, 3)}`;
  const endPart = `${weekEnd.getDate()} ${MONTH_NAMES[weekEnd.getMonth()].slice(0, 3)}`;
  return `${startPart} – ${endPart}`;
}

export function isCurrentWeek(weekStart: Date): boolean {
  const todayWeekStart = getWeekStart(new Date(), 0);
  return toIsoDate(weekStart) === toIsoDate(todayWeekStart);
}

export function isChallengeScheduledOn(challenge: ChallengeListItem, date: Date): boolean {
  const iso = toIsoDate(date);
  if (challenge.startDate && iso < challenge.startDate) return false;
  if (challenge.endDate && iso > challenge.endDate) return false;
  if (challenge.scheduleType === 'daily') return true;
  return challenge.scheduleDays.includes(toIsoWeekday(date));
}

export function countScheduledChallenges(
  challenges: ChallengeListItem[],
  date: Date,
): number {
  return challenges.filter((c) => isChallengeScheduledOn(c, date)).length;
}

function countCompletedTodayChallenges(todayChallenges: ApiTodayChallenge[]): number {
  return todayChallenges.filter(
    (c) => c.exercises.length > 0 && c.exercises.every((ex) => ex.closed),
  ).length;
}

function resolveDayStatus(
  date: Date,
  today: Date,
  scheduledCount: number,
  completedDates: Set<string>,
  todayChallenges: ApiTodayChallenge[],
): CalendarDayStatus {
  const iso = toIsoDate(date);
  const isFuture = date > today;

  if (scheduledCount === 0) return isFuture ? 'future' : 'rest';
  if (isFuture) return 'future';

  if (iso === toIsoDate(today)) {
    const completedCount = countCompletedTodayChallenges(todayChallenges);
    if (completedCount === 0) return 'pending';
    if (completedCount >= scheduledCount) return 'full';
    return 'partial';
  }

  if (!completedDates.has(iso)) return 'missed';
  if (scheduledCount === 1) return 'full';
  return 'partial';
}

export function buildWeekDays(
  weekStart: Date,
  challenges: ChallengeListItem[],
  completedDates: string[],
  todayChallenges: ApiTodayChallenge[],
): CalendarDay[] {
  const today = startOfDay(new Date());
  const completedSet = new Set(completedDates);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    const scheduledCount = countScheduledChallenges(challenges, date);

    return {
      isoDate: toIsoDate(date),
      day: date.getDate(),
      weekdayLabel: WEEKDAY_LABELS[index],
      isToday: date.getTime() === today.getTime(),
      status: resolveDayStatus(
        date,
        today,
        scheduledCount,
        completedSet,
        todayChallenges,
      ),
    };
  });
}
