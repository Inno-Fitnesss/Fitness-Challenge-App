import { apiClient } from './axios.ts';
import type {
  ApiChallengeDetail,
  ApiChallengePreset,
  ApiChallengeSummary,
  ApiExercise,
  ApiLeaderboardEntry,
  ApiMeResponse,
  ApiWeekActivity,
  ApiTodayChallenge,
  ApiJoinResponse,
  ApiSessionResponse,
} from '../types/api.types.ts';

export interface ChallengeCreatePayload {
  name: string;
  description?: string | null;
  schedule_type: 'daily' | 'weekly';
  schedule_days?: number[] | null;
  start_date?: string;
  end_date?: string | null;
  is_private?: boolean;
  exercises: { exercise_id: number; goal: number }[];
}

export interface ChallengeEditPayload {
  name?: string;
  description?: string | null;
  schedule_type?: 'daily' | 'weekly';
  schedule_days?: number[] | null;
  start_date?: string;
  end_date?: string | null;
  exercises?: { exercise_id: number; goal: number }[];
}

export interface SessionSubmitPayload {
  challenge_exercise_id: number;
  total_reps: number;
  clean_reps: number;
  duration_seconds?: number | null;
}

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

  async getWeekActivity(): Promise<ApiWeekActivity> {
    const { data } = await apiClient.get<ApiWeekActivity>('/me/week');
    return data;
  },
};

export const exerciseApi = {
  async list(): Promise<ApiExercise[]> {
    const { data } = await apiClient.get<ApiExercise[]>('/exercises');
    return data;
  },
};

export const challengeApi = {
  async create(payload: ChallengeCreatePayload): Promise<ApiChallengeDetail> {
    const { data } = await apiClient.post<ApiChallengeDetail>('/challenges', payload);
    return data;
  },

  async update(id: number, payload: ChallengeEditPayload): Promise<ApiChallengeDetail> {
    const { data } = await apiClient.patch<ApiChallengeDetail>(`/challenges/${id}`, payload);
    return data;
  },

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

  async resume(id: number): Promise<{ id: number; status: string }> {
    const { data } = await apiClient.post<{ id: number; status: string }>(`/challenges/${id}/resume`);
    return data;
  },

  async delete(id: number): Promise<{ deleted: boolean }> {
    const { data } = await apiClient.delete<{ deleted: boolean }>(`/challenges/${id}`);
    return data;
  },

  async submitSession(
    challengeId: number,
    payload: SessionSubmitPayload,
  ): Promise<ApiSessionResponse> {
    const { data } = await apiClient.post<ApiSessionResponse>(
      `/challenges/${challengeId}/sessions`,
      payload,
    );
    return data;
  },
};
