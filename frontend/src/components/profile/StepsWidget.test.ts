import { describe, it, expect } from 'vitest';
import { isStepsDataStale } from './StepsWidget.tsx';

/** Порог живёт в компоненте (5 часов); тесты считают время сами, чтобы не
 * зависеть от системных часов машины, на которой их запускают. */
const HOUR = 60 * 60 * 1000;
const NOW = Date.parse('2026-07-29T16:00:00Z');

function hoursAgo(hours: number): string {
  return new Date(NOW - hours * HOUR).toISOString();
}

describe('isStepsDataStale', () => {
  it('молчит, пока шаги обновлялись недавно', () => {
    expect(isStepsDataStale(hoursAgo(0), NOW)).toBe(false);
    expect(isStepsDataStale(hoursAgo(1), NOW)).toBe(false);
  });

  it('молчит ровно до порога и срабатывает за ним', () => {
    expect(isStepsDataStale(hoursAgo(4.9), NOW)).toBe(false);
    expect(isStepsDataStale(hoursAgo(5.1), NOW)).toBe(true);
  });

  it('срабатывает на многодневном отставании', () => {
    // Реальный случай с прода: у части пользователей шаги отставали на 3–19 суток.
    expect(isStepsDataStale(hoursAgo(79), NOW)).toBe(true);
    expect(isStepsDataStale(hoursAgo(464), NOW)).toBe(true);
  });

  it('срабатывает, когда Withings подключён, но шагов не было ни разу', () => {
    // last_synced_at === null: пятеро таких на проде — им подсказка нужнее всех.
    expect(isStepsDataStale(null, NOW)).toBe(true);
  });

  it('читает время как UTC, а не как локальное', () => {
    // Бэк отдаёт зону явно. Если она когда-нибудь пропадёт, браузер начнёт
    // трактовать строку как локальное время и порог поедет на смещение зоны —
    // в Москве подсказка вылезала бы через два часа вместо пяти.
    const twoHoursBefore = '2026-07-29T14:00:00+00:00';
    expect(isStepsDataStale(twoHoursBefore, NOW)).toBe(false);

    const sixHoursBefore = '2026-07-29T10:00:00+00:00';
    expect(isStepsDataStale(sixHoursBefore, NOW)).toBe(true);
  });

  it('не пугает красным из-за неразбираемой даты', () => {
    expect(isStepsDataStale('не дата', NOW)).toBe(false);
  });
});
