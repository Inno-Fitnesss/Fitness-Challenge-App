import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import { STORAGE_KEYS } from '../constants/storage.ts';
import { parseApiError } from '../utils/parseApiError.ts';
import { safeStorage } from '../utils/safeStorage.ts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// A bare client without interceptors — used to call /auth/refresh so the refresh
// request itself never triggers the 401-refresh logic (no recursion).
const rawClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = safeStorage.getItem(STORAGE_KEYS.TOKEN);
    // Don't clobber an Authorization header a caller already set explicitly
    // (e.g. admin panel requests, which use their own short-lived token).
    if (token && config.headers && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error),
);

function clearSession(): void {
  safeStorage.removeItem(STORAGE_KEYS.TOKEN);
  safeStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  safeStorage.removeItem(STORAGE_KEYS.USER);
  safeStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
}

function forceLogout(): void {
  clearSession();
  if (!window.location.pathname.startsWith('/auth')) {
    window.location.href = '/auth';
  }
}

// --- single-flight refresh -------------------------------------------------
// While one refresh request is in flight, all other 401s wait in a queue and
// are replayed with the new token once it arrives (or rejected if it fails).
let isRefreshing = false;
let waiters: Array<(token: string | null) => void> = [];

function flushWaiters(token: string | null): void {
  waiters.forEach((resolve) => resolve(token));
  waiters = [];
}

async function runRefresh(): Promise<string | null> {
  const refreshToken = safeStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  if (!refreshToken) return null;
  try {
    const { data } = await rawClient.post<{ token: string; refresh_token?: string }>(
      '/auth/refresh',
      { refresh_token: refreshToken },
    );
    safeStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
    if (data.refresh_token) {
      safeStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
    }
    return data.token;
  } catch {
    return null;
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const AUTH_PATHS = ['/auth/login', '/auth/signup', '/auth/refresh', '/admin/'];

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? '';
    const isAuthCall = AUTH_PATHS.some((p) => url.includes(p));

    // Only attempt a refresh once per request, and never for the auth calls.
    if (status !== 401 || !original || original._retry || isAuthCall) {
      return Promise.reject(parseApiError(error));
    }
    original._retry = true;

    // If a refresh is already running, wait for it instead of starting another.
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waiters.push((token) => {
          if (!token) {
            reject(parseApiError(error));
            return;
          }
          setAuthHeader(original, token);
          resolve(apiClient(original as AxiosRequestConfig));
        });
      });
    }

    isRefreshing = true;
    const newToken = await runRefresh();
    isRefreshing = false;
    flushWaiters(newToken);

    if (!newToken) {
      forceLogout();
      return Promise.reject(parseApiError(error));
    }

    setAuthHeader(original, newToken);
    return apiClient(original as AxiosRequestConfig);
  },
);

function setAuthHeader(config: AxiosRequestConfig, token: string): void {
  config.headers = config.headers ?? {};
  (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
}
