import { describe, it, expect, vi, beforeEach } from 'vitest';

const patchMock = vi.fn();
const postMock = vi.fn();
vi.mock('./axios.ts', () => ({
  apiClient: {
    patch: (...args: unknown[]) => patchMock(...args),
    post: (...args: unknown[]) => postMock(...args),
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
  postMock.mockReset();
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

describe('registration legal consents', () => {
  it('maps the two consents to separate signup fields without client metadata', async () => {
    postMock.mockResolvedValue({
      data: { id: 1, username: 'runner', email: 'runner@example.com' },
    });

    await authApi.register({
      username: 'runner',
      email: 'runner@example.com',
      password: 'Password123!',
      termsAccepted: true,
      privacyAccepted: true,
    });

    expect(postMock).toHaveBeenCalledWith('/auth/signup', {
      username: 'runner',
      email: 'runner@example.com',
      password: 'Password123!',
      terms_accepted: true,
      privacy_accepted: true,
    });
  });

  it('omits consents for ordinary Google login and sends them for registration', async () => {
    postMock.mockResolvedValue({ data: { token: 'token' } });

    await authApi.loginWithGoogle('existing-token');
    await authApi.loginWithGoogle('new-token', {
      termsAccepted: true,
      privacyAccepted: true,
    });

    expect(postMock).toHaveBeenNthCalledWith(1, '/auth/google', {
      id_token: 'existing-token',
    });
    expect(postMock).toHaveBeenNthCalledWith(2, '/auth/google', {
      id_token: 'new-token',
      terms_accepted: true,
      privacy_accepted: true,
    });
  });
});
