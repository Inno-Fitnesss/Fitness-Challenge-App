export type ExerciseMetric = 'reps' | 'seconds';

export type CvFeedbackType = 'posture' | 'camera' | 'lighting' | 'general';

export type CvFeedbackSeverity = 'info' | 'warning' | 'success';

export interface CvFeedbackMessage {
  id: string;
  type: CvFeedbackType;
  severity: CvFeedbackSeverity;
  text: string;
  timestamp: number;
}

export type SessionStatus = 'idle' | 'calibrating' | 'running' | 'paused' | 'finished';

export interface ExerciseSessionContext {
  challengeId: number;
  challengeExerciseId: number;
  exerciseName: string;
  metric: ExerciseMetric;
  goal: number;
  completedToday: number;
  challengeTitle: string;
}

export interface CvSessionStats {
  reps: number;
  cleanReps: number;
  elapsedSeconds: number;
  formQuality: number;
}

/** Контракт для интеграции CV-модуля (подключит другой разработчик). */
export interface CvSessionBridge {
  onFrame?: (video: HTMLVideoElement) => void;
  onFeedback?: (message: Omit<CvFeedbackMessage, 'id' | 'timestamp'>) => void;
  onStatsUpdate?: (stats: Partial<CvSessionStats>) => void;
}
