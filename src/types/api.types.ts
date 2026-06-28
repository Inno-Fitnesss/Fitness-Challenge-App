/** Raw DTOs from FastAPI backend */

export interface ApiExercise {
  id: number;
  name: string;
  metric: 'reps' | 'seconds';
}

export interface ApiChallengeExercise {
  challenge_exercise_id: number;
  exercise_id: number;
  name: string;
  metric: 'reps' | 'seconds';
  goal: number;
  clean_today?: number;
  closed?: boolean;
}

export interface ApiChallengeDetail {
  id: number;
  name: string;
  description: string | null;
  schedule_type: 'daily' | 'weekly';
  schedule_days: number[] | null;
  start_date: string;
  end_date: string | null;
  is_private: boolean;
  is_preset: boolean;
  status: 'active' | 'archived' | 'completed';
  join_code: string | null;
  exercises: ApiChallengeExercise[];
  participants: number;
  joined: boolean;
}

export interface ApiChallengeSummary {
  id: number;
  name: string;
  status: string;
  days_completed: number;
  challenge_streak: number;
}

export interface ApiChallengePreset {
  id: number;
  name: string;
  description: string | null;
  schedule_type: string;
}

export interface ApiTodayChallenge {
  id: number;
  name: string;
  exercises: ApiChallengeExercise[];
}

export interface ApiLeaderboardEntry {
  place: number;
  username: string;
  days_completed: number;
  challenge_streak: number;
  total_clean_reps: number;
}

export interface ApiMeResponse {
  id: number;
  username: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  fitness_level?: string | null;
  streak_current: number;
  streak_longest: number;
  volume: { exercise: string; metric: string; total: number }[];
}

export interface ApiWeekActivity {
  week_start: string;
  week_end: string;
  completed_dates: string[];
  streak_current: number;
}

export interface ApiJoinResponse {
  participation_id: number;
  challenge_id: number;
}

export interface ApiPublicChallenge {
  id: number;
  name: string;
  description: string | null;
  join_code: string;
  schedule_type: 'daily' | 'weekly';
  schedule_days: number[] | null;
  start_date: string;
  end_date: string | null;
  is_private: boolean;
  status: string;
  participants: number;
  exercises: ApiChallengeExercise[];
  leaderboard: ApiLeaderboardEntry[];
}

export interface ApiSessionResponse {
  exercise: {
    clean: number;
    goal: number;
    closed: boolean;
  };
  day_closed: boolean;
  challenge_streak: number;
  user_streak: number;
  place: number | null;
}
