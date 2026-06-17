/** DTO запроса регистрации — POST /auth/signup */
export interface UserInCreate {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

/** DTO запроса входа — POST /auth/login */
export interface UserInLogin {
  email: string;
  password: string;
}

/** DTO ответа с данными пользователя — UserOutput */
export interface UserOutput {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
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
  email: string;
  firstName: string;
  lastName: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials, rememberMe?: boolean) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export interface ApiError {
  message: string;
  status?: number;
}
