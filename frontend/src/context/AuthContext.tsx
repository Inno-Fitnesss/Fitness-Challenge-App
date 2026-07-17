import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/authApi.ts';
import { preloadPoseRuntime } from '../cv/poseCvEngine.ts';
import { STORAGE_KEYS } from '../constants/storage.ts';
import { safeStorage } from '../utils/safeStorage.ts';
import type {
  ApiError,
  AuthContextValue,
  LoginCredentials,
  RegisterData,
  RegisterResult,
  User,
} from '../types/auth.types.ts';

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredUser(): User | null {
  try {
    const raw = safeStorage.getItem(STORAGE_KEYS.USER);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function persistSession(token: string, user: User, rememberMe: boolean): void {
  safeStorage.setItem(STORAGE_KEYS.TOKEN, token);
  safeStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  safeStorage.setItem(STORAGE_KEYS.REMEMBER_ME, String(rememberMe));
}

function warmUpCvModel(): void {
  try {
    preloadPoseRuntime();
  } catch {
    // CV preload is best-effort and should not block auth.
  }
}

function clearSession(): void {
  safeStorage.removeItem(STORAGE_KEYS.TOKEN);
  safeStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  safeStorage.removeItem(STORAGE_KEYS.USER);
  safeStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
}

function storeRefreshToken(refreshToken?: string): void {
  if (refreshToken) {
    safeStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const storedToken = safeStorage.getItem(STORAGE_KEYS.TOKEN);

    if (!storedToken) {
      clearSession();
      setToken(null);
      setUser(null);
      setIsLoading(false);
      return;
    }

    setToken(storedToken);
    setUser(loadStoredUser());

    try {
      const freshUser = await authApi.getCurrentUser();
      const syncedTimezone = await authApi.syncTimezone(freshUser.timezone);
      const resolvedUser = syncedTimezone !== freshUser.timezone
        ? { ...freshUser, timezone: syncedTimezone }
        : freshUser;
      setUser(resolvedUser);
      safeStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(resolvedUser));
      warmUpCvModel();
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 401) {
        clearSession();
        setToken(null);
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  const completeSession = useCallback(
    async (authToken: string, redirectTo: string) => {
      safeStorage.setItem(STORAGE_KEYS.TOKEN, authToken);

      const currentUser = await authApi.getCurrentUser();
      const syncedTimezone = await authApi.syncTimezone(currentUser.timezone);
      const resolvedUser = syncedTimezone !== currentUser.timezone
        ? { ...currentUser, timezone: syncedTimezone }
        : currentUser;
      persistSession(authToken, resolvedUser, true);
      setToken(authToken);
      setUser(resolvedUser);
      warmUpCvModel();
      navigate(redirectTo);
    },
    [navigate],
  );

  const login = useCallback(
    async (credentials: LoginCredentials, redirectTo = '/dashboard') => {
      const { token: authToken, refresh_token } = await authApi.login(credentials);
      storeRefreshToken(refresh_token);
      await completeSession(authToken, redirectTo);
    },
    [completeSession],
  );

  const loginWithGoogle = useCallback(
    async (idToken: string, redirectTo = '/dashboard') => {
      const { token: authToken, refresh_token } = await authApi.loginWithGoogle(idToken);
      storeRefreshToken(refresh_token);
      await completeSession(authToken, redirectTo);
    },
    [completeSession],
  );

  const register = useCallback(
    async (data: RegisterData, redirectTo = '/dashboard'): Promise<RegisterResult> => {
      const created = await authApi.register(data);
      // Сервер требует подтвердить email — вход произойдёт после ввода кода
      // (см. verifyEmail). Без SMTP на сервере аккаунт создаётся сразу
      // подтверждённым, и работает старый сценарий «регистрация → вход».
      if (created.emailVerified === false) {
        return 'verification_required';
      }
      const { token: authToken, refresh_token } = await authApi.login({
        email: data.email,
        password: data.password,
      });
      storeRefreshToken(refresh_token);
      await completeSession(authToken, redirectTo);
      return 'logged_in';
    },
    [completeSession],
  );

  const verifyEmail = useCallback(
    async (email: string, code: string, redirectTo = '/dashboard') => {
      const { token: authToken, refresh_token } = await authApi.verifyEmail(email, code);
      storeRefreshToken(refresh_token);
      await completeSession(authToken, redirectTo);
    },
    [completeSession],
  );

  const setUiFlag = useCallback(
    async (key: string, value: boolean) => {
      // Optimistic local update so the UI reacts immediately and survives a
      // reload even if the network write is slow/offline.
      let optimistic: User | null = null;
      setUser((prev) => {
        if (!prev) return prev;
        const nextFlags = { ...(prev.uiFlags ?? {}) };
        if (value) nextFlags[key] = true;
        else delete nextFlags[key];
        optimistic = { ...prev, uiFlags: nextFlags };
        return optimistic;
      });
      if (optimistic) {
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(optimistic));
      }
      if (!localStorage.getItem(STORAGE_KEYS.TOKEN)) return;
      try {
        const updated = await authApi.updateUiFlags({ [key]: value });
        setUser(updated);
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(updated));
      } catch {
        // Keep the optimistic value; it will re-sync on next successful /me.
      }
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    const storedToken = safeStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!storedToken) return;

    try {
      const freshUser = await authApi.getCurrentUser();
      setUser(freshUser);
      safeStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(freshUser));
    } catch {
      // Keep cached profile if refresh fails.
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setUser(null);
    navigate('/auth');
  }, [navigate]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!token && !!user,
      isLoading,
      login,
      loginWithGoogle,
      register,
      verifyEmail,
      logout,
      checkAuth,
      refreshProfile,
      setUiFlag,
    }),
    [user, token, isLoading, login, loginWithGoogle, register, verifyEmail, logout, checkAuth, refreshProfile, setUiFlag],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
}