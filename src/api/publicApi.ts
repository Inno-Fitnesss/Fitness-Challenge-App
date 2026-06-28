import { apiClient } from './axios.ts';
import type { ApiJoinResponse, ApiPublicChallenge } from '../types/api.types.ts';

export const publicApi = {
  async getChallengeByCode(joinCode: string): Promise<ApiPublicChallenge> {
    const { data } = await apiClient.get<ApiPublicChallenge>(
      `/public/challenge/${encodeURIComponent(joinCode)}`,
    );
    return data;
  },

  async joinByCode(joinCode: string): Promise<ApiJoinResponse> {
    const { data } = await apiClient.post<ApiJoinResponse>(
      `/public/challenge/${encodeURIComponent(joinCode)}/join`,
    );
    return data;
  },
};
