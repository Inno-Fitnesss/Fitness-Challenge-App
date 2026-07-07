import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  todayIso,
  isoToDisplay,
  displayToIso,
  isValidIsoDate,
  formatIsoForDisplay,
  formatDateInput,
} from './dateFormat.ts';

afterEach(() => {
  vi.useRealTimers();
});

describe('todayIso', () => {
  it('reflects the local system clock, zero-padded', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5));
    expect(todayIso()).toBe('2026-01-05');
  });
});

describe('isoToDisplay / displayToIso', () => {
  it('round-trips a valid date', () => {
    expect(isoToDisplay('2026-06-15')).toBe('15.06.2026');
    expect(displayToIso('15.06.2026')).toBe('2026-06-15');
  });

  it('isoToDisplay rejects malformed input', () => {
    expect(isoToDisplay('')).toBe('');
    expect(isoToDisplay('2026/06/15')).toBe('');
    expect(isoToDisplay('not-a-date')).toBe('');
  });

  it('displayToIso rejects malformed input', () => {
    expect(displayToIso('')).toBeNull();
    expect(displayToIso('2026-06-15')).toBeNull();
  });

  it('displayToIso rejects a calendar-invalid date (e.g. 31 Feb)', () => {
    expect(displayToIso('31.02.2026')).toBeNull();
  });

  it('displayToIso trims surrounding whitespace', () => {
    expect(displayToIso('  15.06.2026  ')).toBe('2026-06-15');
  });
});

describe('isValidIsoDate', () => {
  it('accepts a normal date', () => {
    expect(isValidIsoDate('2026-06-15')).toBe(true);
  });

  it('rejects year outside the supported range', () => {
    expect(isValidIsoDate('2019-06-15')).toBe(false);
    expect(isValidIsoDate('2036-06-15')).toBe(false);
  });

  it('rejects an out-of-range month or day', () => {
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('2026-00-01')).toBe(false);
    expect(isValidIsoDate('2026-06-32')).toBe(false);
    expect(isValidIsoDate('2026-06-00')).toBe(false);
  });

  it('rejects a day that does not exist in that month (JS Date auto-rolls over otherwise)', () => {
    // 2026 is not a leap year — Feb 29 doesn't exist.
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2026-04-31')).toBe(false);
  });

  it('accepts Feb 29 on an actual leap year', () => {
    expect(isValidIsoDate('2028-02-29')).toBe(true);
  });
});

describe('formatIsoForDisplay', () => {
  it('formats a valid ISO date in Russian long form', () => {
    // Exact output depends on the ICU data bundled with Node, so check the
    // meaningful pieces rather than pin an exact string.
    const result = formatIsoForDisplay('2026-06-15');
    expect(result).toContain('15');
    expect(result).toContain('июня');
    expect(result).toContain('2026');
  });

  it('returns empty string for an invalid date', () => {
    expect(formatIsoForDisplay('not-a-date')).toBe('');
    expect(formatIsoForDisplay('2026-02-30')).toBe('');
  });
});

describe('formatDateInput (deprecated masking helper)', () => {
  it('inserts dots as digits accumulate', () => {
    expect(formatDateInput('1')).toBe('1');
    expect(formatDateInput('15')).toBe('15');
    expect(formatDateInput('1506')).toBe('15.06');
    expect(formatDateInput('15062026')).toBe('15.06.2026');
  });

  it('strips non-digit characters and caps at 8 digits', () => {
    expect(formatDateInput('15/06/2026extra')).toBe('15.06.2026');
  });
});