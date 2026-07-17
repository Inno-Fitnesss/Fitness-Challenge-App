import { apiClient } from './axios.ts';
import type {
  LoginCredentials,
  ProfileUpdateData,
  ProtectedResponse,
  RegisterData,
  ResetPasswordData,
  User,
  UserInLogin,
  UserOutput,
  UserWithToken,
} from '../types/auth.types.ts';
import type { ApiMeResponse } from '../types/api.types.ts';
import type { FitnessLevel } from '../constants/fitnessLevels.ts';
import { mapRegisterDataToApi, mapUserOutputToUser } from '../utils/userMapper.ts';
import { getBrowserTimezone } from '../utils/timezone.ts';

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
    timezone: data.timezone ?? undefined,
    streakCurrent: data.streak_current,
    streakLongest: data.streak_longest,
    uiFlags: data.ui_flags ?? {},
    volume: data.volume,
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

  /** POST /auth/google — вход/регистрация по Google ID-токену */
  async loginWithGoogle(idToken: string): Promise<UserWithToken> {
    const { data } = await apiClient.post<UserWithToken>('/auth/google', {
      id_token: idToken,
    });
    return data;
  },

  /** POST /auth/verify-email — подтвердить email кодом из письма, возвращает токены */
  async verifyEmail(email: string, code: string): Promise<UserWithToken> {
    const { data } = await apiClient.post<UserWithToken>('/auth/verify-email', {
      email,
      code,
    });
    return data;
  },

  /** POST /auth/resend-verification — выслать код подтверждения повторно */
  async resendVerification(email: string): Promise<void> {
    await apiClient.post('/auth/resend-verification', { email });
  },

  /** POST /auth/forgot-password — запросить код восстановления на email */
  async forgotPassword(email: string): Promise<void> {
    await apiClient.post('/auth/forgot-password', { email });
  },

  /** POST /auth/reset-password — сменить пароль по коду из письма */
  async resetPassword(payload: ResetPasswordData): Promise<void> {
    await apiClient.post('/auth/reset-password', {
      email: payload.email,
      code: payload.code,
      new_password: payload.newPassword,
      confirm_password: payload.confirmPassword,
    });
  },

  /** POST /auth/refresh — обмен refresh-токена на новый access-токен */
  async refresh(refreshToken: string): Promise<UserWithToken> {
    const { data } = await apiClient.post<UserWithToken>('/auth/refresh', {
      refresh_token: refreshToken,
    });
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

  /**
   * Best-effort sync of the browser's detected timezone to the backend.
   * Only sends a PATCH when it actually differs from what's already
   * stored, and never throws — a failure here must never block
   * login/signup/app boot. Returns the timezone now in effect (new value
   * if it changed, the original one otherwise).
   */
  async syncTimezone(currentTimezone?: string): Promise<string | undefined> {
    const detected = getBrowserTimezone();
    if (detected === currentTimezone) return currentTimezone;
    try {
      const { data } = await apiClient.patch<ApiMeResponse>('/me', { timezone: detected });
      return data.timezone ?? detected;
    } catch {
      return currentTimezone;
    }
  },

  /** PATCH /me — обновить UI-флаги аккаунта (онбординг, «больше не показывать») */
  async updateUiFlags(flags: Record<string, boolean>): Promise<User> {
    const { data } = await apiClient.patch<ApiMeResponse>('/me', { ui_flags: flags });
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