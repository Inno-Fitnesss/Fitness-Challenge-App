import { apiClient } from './axios';
import type {
  ApiChallengeDetail,
  ApiChallengePreset,
  ApiChallengeSummary,
  ApiLeaderboardEntry,
  ApiMeResponse,
  ApiTodayChallenge,
  ApiJoinResponse,
} from '../types/api.types';

export const meApi = {
  async getProfile(): Promise<ApiMeResponse> {
    const { data } = await apiClient.get<ApiMeResponse>('/me');
    return data;
  },

  async getToday(): Promise<ApiTodayChallenge[]> {
    const { data } = await apiClient.get<ApiTodayChallenge[]>('/me/today');
    return data;
  },

  async getMyChallenges(status: 'active' | 'archived' = 'active'): Promise<ApiChallengeSummary[]> {
    const { data } = await apiClient.get<ApiChallengeSummary[]>('/me/challenges', {
      params: { status },
    });
    return data;
  },
};

export const challengeApi = {
  async getDetail(id: number): Promise<ApiChallengeDetail> {
    const { data } = await apiClient.get<ApiChallengeDetail>(`/challenges/${id}`);
    return data;
  },

  async getLeaderboard(id: number): Promise<ApiLeaderboardEntry[]> {
    const { data } = await apiClient.get<ApiLeaderboardEntry[]>(`/challenges/${id}/leaderboard`);
    return data;
  },

  async getPresets(): Promise<ApiChallengePreset[]> {
    const { data } = await apiClient.get<ApiChallengePreset[]>('/challenges/presets');
    return data;
  },

  async joinById(id: number): Promise<ApiJoinResponse> {
    const { data } = await apiClient.post<ApiJoinResponse>(`/challenges/${id}/join`);
    return data;
  },

  async joinByCode(joinCode: string): Promise<ApiJoinResponse> {
    const { data } = await apiClient.post<ApiJoinResponse>('/challenges/join', { join_code: joinCode });
    return data;
  },

  async leave(id: number): Promise<{ left: boolean }> {
    const { data } = await apiClient.post<{ left: boolean }>(`/challenges/${id}/leave`);
    return data;
  },

  async archive(id: number): Promise<{ id: number; status: string }> {
    const { data } = await apiClient.post<{ id: number; status: string }>(`/challenges/${id}/archive`);
    return data;
  },
};
