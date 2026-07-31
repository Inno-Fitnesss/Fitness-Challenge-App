import { apiClient } from './axios.ts';

export interface ApiStepsDay {
  date: string;
  step_count: number;
  source: string;
}

export interface ApiStepsRange {
  days: ApiStepsDay[];
  total_steps: number;
  connected: boolean;
  /** Привязан ли Withings прямо сейчас. `connected` на это не отвечает: он
   * остаётся true навсегда, стоит прийти хоть одной записи шагов. */
  withings_linked: boolean;
  last_synced_at: string | null;
}

export const stepsApi = {
  async getRecent(days: number = 7): Promise<ApiStepsRange> {
    const { data } = await apiClient.get<ApiStepsRange>('/me/steps', {
      params: { days },
    });
    return data;
  },
};