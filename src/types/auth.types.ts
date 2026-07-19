/** DTO запроса регистрации — POST /auth/signup */
export interface UserInCreate {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

/** DTO запроса входа — POST /auth/login */
export interface UserInLogin {
  email: string;
  password: string;
}

/** DTO ответа с данными пользователя — UserOutput */
export interface UserOutput {
  id: number;
  username: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  /** false сразу после регистрации, пока не введён код из письма */
  email_verified?: boolean;
}

/** DTO ответа с токеном — UserWithToken */
export interface UserWithToken {
  token: string;
  refresh_token?: string;
}

/** DTO ответа защищённого маршрута — GET /protected */
export interface ProtectedResponse {
  data: UserOutput;
}

import type { FitnessLevel } from '../constants/fitnessLevels.ts';

/** Доменная модель пользователя на фронтенде (camelCase) */
export interface User {
  id: number;
  username: string;
  email: string;
  emailVerified?: boolean;
  firstName?: string;
  lastName?: string;
  heightCm?: number;
  weightKg?: number;
  fitnessLevel?: FitnessLevel;
  timezone?: string;
  streakCurrent?: number;
  streakLongest?: number;
  uiFlags?: Record<string, boolean>;
  volume?: { exercise: string; metric: string; total: number }[];
}

export interface ProfileUpdateData {
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  heightCm?: number | null;
  weightKg?: number | null;
  fitnessLevel?: FitnessLevel | null;
  newPassword?: string;
  confirmPassword?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/** Данные для POST /auth/reset-password (camelCase, маппится в snake_case) */
export interface ResetPasswordData {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

/** Результат регистрации: вошли сразу или ждём код подтверждения email */
export type RegisterResult = 'logged_in' | 'verification_required';

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials, redirectTo?: string) => Promise<void>;
  loginWithGoogle: (idToken: string, redirectTo?: string) => Promise<void>;
  register: (data: RegisterData, redirectTo?: string) => Promise<RegisterResult>;
  verifyEmail: (email: string, code: string, redirectTo?: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Обновить UI-флаг аккаунта (онбординг, «больше не показывать»). Оптимистично + PATCH /me. */
  setUiFlag: (key: string, value: boolean) => Promise<void>;
}

export interface ApiError {
  message: string;
  status?: number;
}