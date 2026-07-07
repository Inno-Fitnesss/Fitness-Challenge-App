/**
 * dashboardCalendar.ts is the prime suspect for the "wrong day marked
 * completed" bug the teamlead reported. It computes "today" from the
 * BROWSER'S local clock (`new Date()`), while every date it's handed
 * (`completedDates`, `todayChallenges`) comes from the backend, which — as
 * confirmed in the backend test suite — has no concept of the user's real
 * timezone and always keys days by UTC. Whenever the browser's local
 * calendar day and the backend's UTC calendar day disagree (which happens
 * for part of every single day, for any non-UTC user), this file's
 * "which cell is today" logic and the backend's "which day did this data
 * belong to" logic are talking about two different days without either
 * side knowing it.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  toIsoDate,
  getWeekStart,
  getWeekEnd,
  formatWeekRangeLabel,
  isCurrentWeek,
  isChallengeScheduledOn,
  countScheduledChallenges,
  buildWeekDays,
} from './dashboardCalendar.ts';
import type { ChallengeListItem } from '../types/challenge.ts';
import type { ApiTodayChallenge } from '../types/api.types.ts';

function makeChallenge(overrides: Partial<ChallengeListItem> = {}): ChallengeListItem {
  return {
    id: 1,
    title: 'Test Challenge',
    description: '',
    startDate: '2026-06-01',
    endDate: '',
    scheduleType: 'daily',
    scheduleDays: [],
    scheduleLabel: 'Каждый день',
    status: 'active',
    participantCount: 1,
    isUnlimited: true,
    isOwner: true,
    joinCode: undefined,
    isPreset: false,
    isPrivate: true,
    joined: true,
    exerciseTags: [],
    dateLabel: '',
    ...overrides,
  };
}

function makeTodayChallenge(closed: boolean): ApiTodayChallenge {
  return {
    id: 1,
    name: 'Test Challenge',
    exercises: [
      { challenge_exercise_id: 1, exercise_id: 1, name: 'Squats', metric: 'reps', goal: 10, clean_today: closed ? 10 : 0, closed },
    ],
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('toIsoDate', () => {
  it('formats using local calendar fields, zero-padded', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('getWeekStart / getWeekEnd', () => {
  it('resolves to Monday regardless of which weekday is passed', () => {
    // 2026-06-03 is a Wednesday.
    const monday = getWeekStart(new Date(2026, 5, 3));
    expect(toIsoDate(monday)).toBe('2026-06-01');
  });

  it('handles Sunday correctly (JS getDay()=0 is a common off-by-one source)', () => {
    // 2026-06-07 is a Sunday; the Monday of that week is 2026-06-01.
    const monday = getWeekStart(new Date(2026, 5, 7));
    expect(toIsoDate(monday)).toBe('2026-06-01');
  });

  it('applies weekOffset in whole weeks', () => {
    const monday = getWeekStart(new Date(2026, 5, 3), 1);
    expect(toIsoDate(monday)).toBe('2026-06-08');
  });

  it('week end is 6 days after week start', () => {
    const start = getWeekStart(new Date(2026, 5, 3));
    const end = getWeekEnd(start);
    expect(toIsoDate(end)).toBe('2026-06-07');
  });
});

describe('formatWeekRangeLabel', () => {
  it('formats a same-month range compactly', () => {
    const start = new Date(2026, 5, 1);
    const end = new Date(2026, 5, 7);
    expect(formatWeekRangeLabel(start, end)).toBe('1–7 июня');
  });

  it('formats a cross-month range with both month names', () => {
    const start = new Date(2026, 4, 28);
    const end = new Date(2026, 5, 3);
    expect(formatWeekRangeLabel(start, end)).toBe('28 мая – 3 июн');
  });
});

describe('isCurrentWeek', () => {
  it('true for the week containing today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 3, 12, 0, 0));
    const monday = getWeekStart(new Date(2026, 5, 3));
    expect(isCurrentWeek(monday)).toBe(true);
  });

  it('false for a different week', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 3, 12, 0, 0));
    const otherMonday = getWeekStart(new Date(2026, 5, 3), -1);
    expect(isCurrentWeek(otherMonday)).toBe(false);
  });
});

describe('isChallengeScheduledOn', () => {
  it('daily challenge is scheduled every day within its range', () => {
    const c = makeChallenge({ scheduleType: 'daily', startDate: '2026-06-01', endDate: '' });
    expect(isChallengeScheduledOn(c, new Date(2026, 5, 15))).toBe(true);
  });

  it('excludes days before startDate', () => {
    const c = makeChallenge({ startDate: '2026-06-10' });
    expect(isChallengeScheduledOn(c, new Date(2026, 5, 5))).toBe(false);
  });

  it('excludes days after endDate', () => {
    const c = makeChallenge({ startDate: '2026-06-01', endDate: '2026-06-10' });
    expect(isChallengeScheduledOn(c, new Date(2026, 5, 15))).toBe(false);
  });

  it('weekly challenge only matches its scheduleDays (ISO weekday)', () => {
    const c = makeChallenge({ scheduleType: 'weekly', scheduleDays: [1, 3, 5] });
    // 2026-06-01 is a Monday (ISO weekday 1).
    expect(isChallengeScheduledOn(c, new Date(2026, 5, 1))).toBe(true);
    // 2026-06-02 is a Tuesday (ISO weekday 2) — not scheduled.
    expect(isChallengeScheduledOn(c, new Date(2026, 5, 2))).toBe(false);
  });

  it('Sunday maps to ISO weekday 7, not 0', () => {
    const c = makeChallenge({ scheduleType: 'weekly', scheduleDays: [7] });
    // 2026-06-07 is a Sunday.
    expect(isChallengeScheduledOn(c, new Date(2026, 5, 7))).toBe(true);
  });
});

describe('countScheduledChallenges', () => {
  it('counts only challenges scheduled on the given day', () => {
    const daily = makeChallenge({ id: 1, scheduleType: 'daily' });
    const weeklyMonOnly = makeChallenge({ id: 2, scheduleType: 'weekly', scheduleDays: [1] });
    // 2026-06-02 is a Tuesday: daily counts, weekly (Mon-only) doesn't.
    expect(countScheduledChallenges([daily, weeklyMonOnly], new Date(2026, 5, 2))).toBe(1);
  });
});

describe('buildWeekDays — normal (no timezone mismatch) cases', () => {
  it('marks a fully-completed past day as full', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 3, 12, 0, 0)); // "today" = June 3
    const challenge = makeChallenge({ scheduleType: 'daily' });
    const weekStart = getWeekStart(new Date(2026, 5, 3));
    const days = buildWeekDays(weekStart, [challenge], ['2026-06-01'], []);
    const monday = days.find((d) => d.isoDate === '2026-06-01');
    expect(monday?.status).toBe('full');
  });

  it('marks a past day with no completion record as missed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 3, 12, 0, 0));
    const challenge = makeChallenge({ scheduleType: 'daily' });
    const weekStart = getWeekStart(new Date(2026, 5, 3));
    const days = buildWeekDays(weekStart, [challenge], [], []);
    const monday = days.find((d) => d.isoDate === '2026-06-01');
    expect(monday?.status).toBe('missed');
  });

  it('a day with nothing scheduled is "rest", not "missed"', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 3, 12, 0, 0));
    const weekStart = getWeekStart(new Date(2026, 5, 3));
    const days = buildWeekDays(weekStart, [], [], []);
    const monday = days.find((d) => d.isoDate === '2026-06-01');
    expect(monday?.status).toBe('rest');
  });

  it("today's cell reflects live todayChallenges progress, not completedDates", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 3, 12, 0, 0));
    const challenge = makeChallenge({ scheduleType: 'daily' });
    const weekStart = getWeekStart(new Date(2026, 5, 3));
    const days = buildWeekDays(weekStart, [challenge], [], [makeTodayChallenge(true)]);
    const today = days.find((d) => d.isoDate === '2026-06-03');
    expect(today?.status).toBe('full');
  });
});

describe('buildWeekDays — client/server day-boundary mismatch (the suspected root cause)', () => {
  it.fails(
    'KNOWN BUG: when the browser\'s local calendar day is ahead of the ' +
    'backend\'s (UTC-only) day, the day the user actually completed shows ' +
    '"missed" and an untouched day shows "full" — this is very plausibly ' +
    'what the teamlead saw. Root cause: buildWeekDays() computes `today` ' +
    'from the browser clock, but todayChallenges/completedDates are keyed ' +
    'to whatever day the backend\'s UTC-only local_today() considers ' +
    '"today" — the two can point at different calendar days.',
    () => {
      vi.useFakeTimers();
      // The BROWSER thinks "today" is June 4 (e.g. a user several hours
      // ahead of UTC, shortly after their local midnight).
      vi.setSystemTime(new Date(2026, 5, 4, 0, 30, 0));

      const challenge = makeChallenge({ scheduleType: 'daily' });
      const weekStart = getWeekStart(new Date(2026, 5, 4));

      // The user actually finished everything on what the BACKEND still
      // calls June 3 (UTC hasn't rolled over yet) — reflected in
      // todayChallenges (from /me/today) as closed, but NOT YET in
      // completedDates (from /me/week, which the client hasn't re-fetched).
      const completedDates: string[] = [];
      const todayChallenges = [makeTodayChallenge(true)];

      const days = buildWeekDays(weekStart, [challenge], completedDates, todayChallenges);
      const june3 = days.find((d) => d.isoDate === '2026-06-03'); // day actually completed
      const june4 = days.find((d) => d.isoDate === '2026-06-04'); // day nothing happened on yet

      // What SHOULD be true: June 3 (really completed) shows full, June 4
      // (browser's "today", nothing done yet) shows pending.
      expect(june3?.status).toBe('full');
      expect(june4?.status).toBe('pending');
    },
  );

  it('documents what ACTUALLY happens today given that mismatch (for comparison)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 4, 0, 30, 0));
    const challenge = makeChallenge({ scheduleType: 'daily' });
    const weekStart = getWeekStart(new Date(2026, 5, 4));
    const days = buildWeekDays(weekStart, [challenge], [], [makeTodayChallenge(true)]);
    const june3 = days.find((d) => d.isoDate === '2026-06-03');
    const june4 = days.find((d) => d.isoDate === '2026-06-04');

    // The day actually finished (June 3, per the backend) reads as missed...
    expect(june3?.status).toBe('missed');
    // ...while June 4, which the backend hasn't scored anything for yet,
    // reads as fully completed just because the browser calls it "today"
    // and todayChallenges (last fetched for backend-day June 3) is still
    // sitting there closed.
    expect(june4?.status).toBe('full');
  });
});