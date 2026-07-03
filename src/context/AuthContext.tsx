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
import type {
  ApiError,
  AuthContextValue,
  LoginCredentials,
  RegisterData,
  User,
} from '../types/auth.types.ts';

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function persistSession(token: string, user: User, rememberMe: boolean): void {
  localStorage.setItem(STORAGE_KEYS.TOKEN, token);
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, String(rememberMe));
}

function warmUpCvModel(): void {
  try {
    preloadPoseRuntime();
  } catch {
    // CV preload is best-effort and should not block auth.
  }
}

function clearSession(): void {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
}

function storeRefreshToken(refreshToken?: string): void {
  if (refreshToken) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);

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
      setUser(freshUser);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(freshUser));
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
      localStorage.setItem(STORAGE_KEYS.TOKEN, authToken);

      const currentUser = await authApi.getCurrentUser();
      persistSession(authToken, currentUser, true);
      setToken(authToken);
      setUser(currentUser);
      warmUpCvModel();
      navigate(redirectTo);
    },
    [navigate],
  );

  const login = useCallback(
    async (credentials: LoginCredentials, redirectTo = '/settings') => {
      const { token: authToken, refresh_token } = await authApi.login(credentials);
      storeRefreshToken(refresh_token);
      await completeSession(authToken, redirectTo);
    },
    [completeSession],
  );

  const register = useCallback(
    async (data: RegisterData, redirectTo = '/settings') => {
      await authApi.register(data);
      const { token: authToken, refresh_token } = await authApi.login({
        email: data.email,
        password: data.password,
      });
      storeRefreshToken(refresh_token);
      await completeSession(authToken, redirectTo);
    },
    [completeSession],
  );

  const refreshProfile = useCallback(async () => {
    const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (!storedToken) return;

    try {
      const freshUser = await authApi.getCurrentUser();
      setUser(freshUser);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(freshUser));
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
      register,
      logout,
      checkAuth,
      refreshProfile,
    }),
    [user, token, isLoading, login, register, logout, checkAuth, refreshProfile],
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
