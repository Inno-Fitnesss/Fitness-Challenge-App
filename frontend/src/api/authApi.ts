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
import { mapRegisterDataToApi, mapUserOutputToUser } from '../utils/userMapper';

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

  /** GET /protected — проверка токена и получение данных пользователя (200) */
  async getCurrentUser(): Promise<User> {
    const { data } = await apiClient.get<ProtectedResponse>('/protected');
    return mapUserOutputToUser(data.data);
  },

  /** GET /health — проверка доступности сервера */
  async healthCheck(): Promise<{ status: string }> {
    const { data } = await apiClient.get<{ status: string }>('/health');
    return data;
  },
};
