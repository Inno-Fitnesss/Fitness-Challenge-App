export type ChallengeTab = 'mine' | 'participating' | 'archive';
export type ExerciseStatus = 'not_started' | 'in_progress' | 'completed';
export type ChallengeStatus = 'active' | 'archived' | 'completed';

export interface Exercise {
  id: string;
  name: string;
  description: string;
  icon: string;
  reps: number;
  unit?: 'reps' | 'minutes';
}

export interface ExerciseTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultReps: number;
}

export interface ExerciseProgress {
  exerciseId: string;
  name: string;
  goal: number;
  completed: number;
  unit: 'reps' | 'minutes';
  status: ExerciseStatus;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  streakDays: number;
  progressPercent: number;
  isCurrentUser?: boolean;
  avatarColor: string;
}

export interface ChallengeFormValues {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  type: 'individual' | 'team';
  goal: number;
  privacy: 'public' | 'private';
}

/** UI model mapped from backend challenge detail */
export interface ChallengeListItem {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  scheduleType: 'daily' | 'weekly';
  scheduleDays: number[];
  scheduleLabel: string;
  status: ChallengeStatus;
  participantCount: number;
  isUnlimited: boolean;
  isOwner: boolean;
  joinCode?: string;
  isPreset: boolean;
  isPrivate: boolean;
  joined: boolean;
  exerciseTags: string[];
  dateLabel: string;
}

export interface TodayPlanItem {
  challenge: ChallengeListItem;
  progressPercent: number;
  isCompleted: boolean;
}

export interface DiscoveryChallenge {
  id: number;
  title: string;
  description: string;
  isUnlimited: boolean;
  scheduleType: 'daily' | 'weekly';
  scheduleDays: number[];
  scheduleLabel: string;
  exerciseTags: string[];
  participantCount: number;
}

export interface ChallengeModalData {
  challenge: ChallengeListItem;
  exercises: ExerciseProgress[];
  leaderboard: LeaderboardEntry[];
}
