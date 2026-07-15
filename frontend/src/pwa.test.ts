import { beforeEach, describe, expect, it, vi } from 'vitest';

// virtual:pwa-register существует только внутри vite-билда — в vitest мокаем.
const registerSWMock = vi.fn();
vi.mock('virtual:pwa-register', () => ({
  registerSW: (options: unknown) => registerSWMock(options),
}));

import { initPwa, UPDATE_CHECK_INTERVAL_MS } from './pwa.ts';

beforeEach(() => {
  registerSWMock.mockClear();
  vi.useRealTimers();
});

describe('initPwa', () => {
  it('регистрирует service worker сразу (immediate)', () => {
    initPwa();
    expect(registerSWMock).toHaveBeenCalledTimes(1);
    const options = registerSWMock.mock.calls[0][0] as { immediate: boolean };
    expect(options.immediate).toBe(true);
  });

  it('после регистрации периодически проверяет обновления', () => {
    vi.useFakeTimers();
    initPwa();
    const options = registerSWMock.mock.calls[0][0] as {
      onRegisteredSW: (url: string, reg: { update: () => Promise<void> }) => void;
    };

    const update = vi.fn().mockResolvedValue(undefined);
    options.onRegisteredSW('/sw.js', { update });

    expect(update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(update).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS * 2);
    expect(update).toHaveBeenCalledTimes(3);
  });

  it('переживает отсутствие registration (например, SW не поддерживается)', () => {
    initPwa();
    const options = registerSWMock.mock.calls[0][0] as {
      onRegisteredSW: (url: string, reg: undefined) => void;
    };
    expect(() => options.onRegisteredSW('/sw.js', undefined)).not.toThrow();
  });

  it('проверка обновлений не падает без сети (update режектится)', () => {
    vi.useFakeTimers();
    initPwa();
    const options = registerSWMock.mock.calls[0][0] as {
      onRegisteredSW: (url: string, reg: { update: () => Promise<void> }) => void;
    };
    const update = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    options.onRegisteredSW('/sw.js', { update });
    expect(() => vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS)).not.toThrow();
    expect(update).toHaveBeenCalledTimes(1);
  });
});
