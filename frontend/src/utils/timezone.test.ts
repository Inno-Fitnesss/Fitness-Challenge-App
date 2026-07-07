import { describe, it, expect, vi, afterEach } from 'vitest';
import { getBrowserTimezone } from './timezone.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getBrowserTimezone', () => {
  it('returns the IANA zone reported by Intl', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () => ({ resolvedOptions: () => ({ timeZone: 'Europe/Moscow' }) }) as unknown as Intl.DateTimeFormat,
    );
    expect(getBrowserTimezone()).toBe('Europe/Moscow');
  });

  it('falls back to UTC if Intl throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('not supported');
    });
    expect(getBrowserTimezone()).toBe('UTC');
  });

  it('falls back to UTC if resolvedOptions returns an empty timeZone', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () => ({ resolvedOptions: () => ({ timeZone: '' }) }) as unknown as Intl.DateTimeFormat,
    );
    expect(getBrowserTimezone()).toBe('UTC');
  });
});