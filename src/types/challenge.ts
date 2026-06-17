export type ChallengeType = 'individual' | 'team';
export type PrivacyType = 'public' | 'private';
export type ChallengeStatus = 'draft' | 'published';

export interface Exercise {
  id: string;
  name: string;
  description: string;
  icon: string;
  reps: number;
}

export interface ExerciseTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultReps: number;
}

export interface ChallengeFormValues {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  type: ChallengeType;
  goal: number;
  privacy: PrivacyType;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  type: ChallengeType;
  goal: number;
  privacy: PrivacyType;
  exercises: Exercise[];
  status: ChallengeStatus;
  createdAt: string;
}
