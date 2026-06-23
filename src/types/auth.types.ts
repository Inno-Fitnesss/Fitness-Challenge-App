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
}

/** DTO ответа с токеном — UserWithToken */
export interface UserWithToken {
  token: string;
}

/** DTO ответа защищённого маршрута — GET /protected */
export interface ProtectedResponse {
  data: UserOutput;
}

/** Доменная модель пользователя на фронтенде (camelCase) */
export interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  streakCurrent?: number;
  streakLongest?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export interface ApiError {
  message: string;
  status?: number;
}
