import { apiClient } from './axios';
import type {
  LoginCredentials,
  ProtectedResponse,
  RegisterData,
  User,
  UserInLogin,
  UserOutput,
  UserWithToken,
} from '../types/auth.types';
import type { ApiMeResponse } from '../types/api.types';
import { mapRegisterDataToApi, mapUserOutputToUser } from '../utils/userMapper';

function mapMeToUser(data: ApiMeResponse): User {
  return {
    id: data.id,
    username: data.username,
    email: data.email,
    streakCurrent: data.streak_current,
    streakLongest: data.streak_longest,
  };
}

export const authApi = {
  /** POST /auth/signup — регистрация, возвращает UserOutput (201) */
  async register(payload: RegisterData): Promise<User> {
    const { data } = await apiClient.post<UserOutput>(
      '/auth/signup',
      mapRegisterDataToApi(payload),
    );
    return mapUserOutputToUser(data);
  },

  /** POST /auth/login — вход, возвращает UserWithToken (200) */
  async login(credentials: LoginCredentials): Promise<UserWithToken> {
    const body: UserInLogin = {
      email: credentials.email,
      password: credentials.password,
    };
    const { data } = await apiClient.post<UserWithToken>('/auth/login', body);
    return data;
  },

  /** GET /me — профиль со стриком и объёмом */
  async getCurrentUser(): Promise<User> {
    const { data } = await apiClient.get<ApiMeResponse>('/me');
    return mapMeToUser(data);
  },

  /** GET /protected — fallback для совместимости */
  async getProtectedUser(): Promise<User> {
    const { data } = await apiClient.get<ProtectedResponse>('/protected');
    return mapUserOutputToUser(data.data);
  },

  /** GET /health — проверка доступности сервера */
  async healthCheck(): Promise<{ status: string }> {
    const { data } = await apiClient.get<{ status: string }>('/health');
    return data;
  },
};
