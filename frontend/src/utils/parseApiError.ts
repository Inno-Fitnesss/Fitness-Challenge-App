import type { AxiosError } from 'axios';

const ERROR_TRANSLATIONS: Record<string, string> = {
  'Please Login': 'Этот email уже зарегистрирован. Войдите в аккаунт.',
  'Please create an Account': 'Пользователь с таким email не найден. Создайте аккаунт.',
  'Please check your Credentials': 'Неверный пароль. Проверьте данные и попробуйте снова.',
  'Unable to process request': 'Не удалось обработать запрос. Попробуйте позже.',
  'Invalid Authentication Credentials': 'Сессия истекла. Войдите снова.',
  'Username already taken': 'Это имя пользователя уже занято. Выберите другое.',
  'Already joined': 'Вы уже участвуете в этом челлендже.',
  'Challenge not found': 'Челлендж не найден.',
  'Invalid code': 'Неверный код приглашения.',
  'Only the creator can archive': 'Только создатель может архивировать челлендж.',
  'Not a participant': 'Вы не участвуете в этом челлендже.',
  'Validation Error': 'Проверьте правильность заполнения полей.',
};

function extractRawMessage(data: unknown): string | undefined {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return undefined;

  const record = data as Record<string, unknown>;

  if (typeof record.message === 'string') return record.message;
  if (typeof record.detail === 'string') return record.detail;

  if (Array.isArray(record.detail) && record.detail.length > 0) {
    const first = record.detail[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'msg' in first) {
      return String((first as { msg: unknown }).msg);
    }
  }

  return undefined;
}

export function translateApiMessage(message: string): string {
  return ERROR_TRANSLATIONS[message] ?? message;
}

export function parseApiError(error: AxiosError): { message: string; status?: number } {
  if (!error.response) {
    return {
      message:
        'Не удалось подключиться к серверу. Убедитесь, что backend запущен (uvicorn на порту 8000) и перезапустите frontend (npm run dev).',
    };
  }

  const rawMessage = extractRawMessage(error.response.data);
  const message = translateApiMessage(
    rawMessage ?? error.message ?? 'Произошла непредвиденная ошибка',
  );

  return {
    message,
    status: error.response?.status,
  };
}
