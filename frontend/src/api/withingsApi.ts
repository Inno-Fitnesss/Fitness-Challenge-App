import { apiClient } from './axios.ts';

export const withingsApi = {
  /** GET /me/withings/authorize-url — отдаёт ссылку, на которую нужно
   * сделать полный переход браузера (window.location.href), а не fetch —
   * Withings должен показать свою страницу логина/согласия. */
  async getAuthorizeUrl(): Promise<string> {
    const { data } = await apiClient.get<{ authorize_url: string }>('/me/withings/authorize-url');
    return data.authorize_url;
  },

  async getStatus(): Promise<{ connected: boolean }> {
    const { data } = await apiClient.get<{ connected: boolean }>('/me/withings/status');
    return data;
  },

  /** POST /me/withings/sync — подтягивает последние N дней шагов из
   * Withings в общую таблицу шагов (ту же, что заполняет мобильное
   * приложение-компаньон, если когда-нибудь его тоже подключишь). */
  async sync(days: number = 7): Promise<{ synced_days: number }> {
    const { data } = await apiClient.post<{ synced_days: number }>(
      '/me/withings/sync',
      null,
      { params: { days } },
    );
    return data;
  },
};
