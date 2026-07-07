import { describe, it, expect, vi, beforeEach } from 'vitest';

const patchMock = vi.fn();
vi.mock('./axios.ts', () => ({
  apiClient: {
    patch: (...args: unknown[]) => patchMock(...args),
    post: vi.fn(),
    get: vi.fn(),
  },
}));

const getBrowserTimezoneMock = vi.fn();
vi.mock('../utils/timezone.ts', () => ({
  getBrowserTimezone: () => getBrowserTimezoneMock(),
}));

import { authApi } from './authApi.ts';

beforeEach(() => {
  patchMock.mockReset();
  getBrowserTimezoneMock.mockReset();
});

describe('authApi.syncTimezone', () => {
  it('does nothing (no network call) if the detected zone already matches', async () => {
    getBrowserTimezoneMock.mockReturnValue('Europe/Moscow');
    const result = await authApi.syncTimezone('Europe/Moscow');
    expect(result).toBe('Europe/Moscow');
    expect(patchMock).not.toHaveBeenCalled();
  });

  it('sends a PATCH with the new zone when it differs, and returns the server-confirmed value', async () => {
    getBrowserTimezoneMock.mockReturnValue('Asia/Almaty');
    patchMock.mockResolvedValue({ data: { timezone: 'Asia/Almaty' } });
    const result = await authApi.syncTimezone('UTC');
    expect(patchMock).toHaveBeenCalledWith('/me', { timezone: 'Asia/Almaty' });
    expect(result).toBe('Asia/Almaty');
  });

  it('treats an undefined current timezone (brand new user) as different and syncs', async () => {
    getBrowserTimezoneMock.mockReturnValue('Europe/Berlin');
    patchMock.mockResolvedValue({ data: { timezone: 'Europe/Berlin' } });
    const result = await authApi.syncTimezone(undefined);
    expect(patchMock).toHaveBeenCalledWith('/me', { timezone: 'Europe/Berlin' });
    expect(result).toBe('Europe/Berlin');
  });

  it('never throws — falls back to the original value if the PATCH fails', async () => {
    getBrowserTimezoneMock.mockReturnValue('Asia/Tokyo');
    patchMock.mockRejectedValue(new Error('network error'));
    const result = await authApi.syncTimezone('UTC');
    expect(result).toBe('UTC');
  });
});