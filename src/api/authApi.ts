import { apiClient } from './axios.ts';
import type {
  LoginCredentials,
  ProfileUpdateData,
  ProtectedResponse,
  RegisterData,
  User,
  UserInLogin,
  UserOutput,
  UserWithToken,
} from '../types/auth.types.ts';
import type { ApiMeResponse } from '../types/api.types.ts';
import type { FitnessLevel } from '../constants/fitnessLevels.ts';
import { mapRegisterDataToApi, mapUserOutputToUser } from '../utils/userMapper.ts';

function mapMeToUser(data: ApiMeResponse): User {
  return {
    id: data.id,
    username: data.username,
    email: data.email,
    firstName: data.first_name ?? undefined,
    lastName: data.last_name ?? undefined,
    heightCm: data.height_cm ?? undefined,
    weightKg: data.weight_kg ?? undefined,
    fitnessLevel: (data.fitness_level as FitnessLevel | null) ?? undefined,
    streakCurrent: data.streak_current,
    streakLongest: data.streak_longest,
  };
}

function mapProfileUpdateToApi(data: ProfileUpdateData) {
  return {
    username: data.username,
    email: data.email,
    first_name: data.firstName?.trim() || null,
    last_name: data.lastName?.trim() || null,
    height_cm: data.heightCm ?? null,
    weight_kg: data.weightKg ?? null,
    fitness_level: data.fitnessLevel ?? null,
    ...(data.newPassword
      ? {
          new_password: data.newPassword,
          confirm_password: data.confirmPassword,
        }
      : {}),
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

  /** PATCH /me — обновление профиля */
  async updateProfile(payload: ProfileUpdateData): Promise<User> {
    const { data } = await apiClient.patch<ApiMeResponse>('/me', mapProfileUpdateToApi(payload));
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
