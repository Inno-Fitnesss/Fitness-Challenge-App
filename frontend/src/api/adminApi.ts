import { apiClient } from './axios.ts';

export interface PieSlice {
  label: string;
  value: number;
}

export interface ChallengeBreakdown {
  total: number;
  by_duration: PieSlice[];
  by_visibility: PieSlice[];
  by_schedule: PieSlice[];
  by_exercise_count: PieSlice[];
}

export interface TopStreakUser {
  username: string;
  streak_longest: number;
}

export interface ExerciseVolume {
  exercise: string;
  total: number;
  unit: string;
}

export interface RegistrationPoint {
  date: string; // ISO yyyy-mm-dd
  count: number;
}

export interface ActivityStats {
  /** Активные = хотя бы один авторизованный запрос за окно (24ч / 7д / 30д) */
  active_today: number;
  active_week: number;
  active_month: number;
  /** Зарегистрировались за текущие сутки (UTC) */
  new_today: number;
}

export interface AdminStats {
  total_users: number;
  activity: ActivityStats;
  challenges: ChallengeBreakdown;
  top_streaks: TopStreakUser[];
  exercise_totals: ExerciseVolume[];
  registrations_daily: RegistrationPoint[];
}

export const adminApi = {
  /** POST /admin/login — проверка пароля, возвращает короткоживущий admin-токен */
  async login(password: string): Promise<string> {
    const { data } = await apiClient.post<{ token: string }>('/admin/login', { password });
    return data.token;
  },

  /**
   * GET /admin/stats — реальная аналитика проекта.
   * Токен передаётся явно из состояния компонента, а не из localStorage —
   * админ-сессия нигде не persist-ится, поэтому хранить её негде и не нужно.
   */
  async getStats(token: string): Promise<AdminStats> {
    const { data } = await apiClient.get<AdminStats>('/admin/stats', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  },
};