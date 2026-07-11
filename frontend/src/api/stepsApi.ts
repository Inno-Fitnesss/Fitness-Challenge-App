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