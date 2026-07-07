/**
 * OAuth 2.0 Client ID из Google Cloud Console (VITE_GOOGLE_CLIENT_ID).
 * Пустое значение отключает "Войти через Google" — кнопка не рендерится.
 */
export const GOOGLE_CLIENT_ID: string | undefined =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || undefined;
