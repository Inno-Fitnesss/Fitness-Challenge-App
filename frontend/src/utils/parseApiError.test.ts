import { describe, it, expect } from 'vitest';
import { parseApiError, translateApiMessage } from './parseApiError.ts';
import type { AxiosError } from 'axios';

function makeError(overrides: Partial<AxiosError> = {}): AxiosError {
  return {
    isAxiosError: true,
    name: 'AxiosError',
    message: 'Request failed',
    toJSON: () => ({}),
    config: undefined,
    ...overrides,
  } as AxiosError;
}

describe('translateApiMessage', () => {
  it('translates a known backend message', () => {
    expect(translateApiMessage('Please Login')).toBe(
      'Этот email уже зарегистрирован. Войдите в аккаунт.',
    );
  });

  it('passes through an unknown message unchanged', () => {
    expect(translateApiMessage('Some brand new backend message')).toBe(
      'Some brand new backend message',
    );
  });
});

describe('parseApiError', () => {
  it('reports a connectivity message when there is no response at all', () => {
    const result = parseApiError(makeError({ response: undefined }));
    expect(result.message).toContain('Не удалось подключиться');
    expect(result.status).toBeUndefined();
  });

  it('extracts detail as a string for a 422', () => {
    const error = makeError({
      response: { status: 422, data: { detail: 'end_date is before start_date' } } as never,
    });
    const result = parseApiError(error);
    expect(result.status).toBe(422);
    expect(result.message).toBe('end_date is before start_date');
  });

  it('falls back to a generic message for a 422 with no usable detail', () => {
    const error = makeError({ response: { status: 422, data: {} } as never });
    const result = parseApiError(error);
    expect(result.message).toContain('Проверьте данные');
  });

  it('extracts the first message from a FastAPI validation error array', () => {
    const error = makeError({
      response: {
        status: 422,
        data: { detail: [{ msg: 'goal must be positive', loc: ['body', 'goal'] }] },
      } as never,
    });
    const result = parseApiError(error);
    expect(result.message).toBe('goal must be positive');
  });

  it('translates a known message for non-422 statuses', () => {
    const error = makeError({
      response: { status: 401, data: { detail: 'Invalid Authentication Credentials' } } as never,
    });
    const result = parseApiError(error);
    expect(result.message).toBe('Сессия истекла. Войдите снова.');
    expect(result.status).toBe(401);
  });

  it('passes through an untranslated message for non-422 statuses', () => {
    const error = makeError({
      response: { status: 500, data: { detail: 'Internal Server Error' } } as never,
    });
    const result = parseApiError(error);
    expect(result.message).toBe('Internal Server Error');
  });

  it('prefers `message` over `detail` when both are present as strings', () => {
    const error = makeError({
      response: { status: 400, data: { message: 'Please Login', detail: 'ignored' } } as never,
    });
    const result = parseApiError(error);
    expect(result.message).toBe('Этот email уже зарегистрирован. Войдите в аккаунт.');
  });

  it('falls back to error.message, then a generic string, if data has nothing usable', () => {
    const error = makeError({
      message: 'Network Error',
      response: { status: 500, data: null } as never,
    });
    const result = parseApiError(error);
    expect(result.message).toBe('Network Error');
  });
});