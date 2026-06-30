/** Лимит на фронте; на бэке сейчас 255 — попросить выставить 50 в ChallengeCreate/Edit */
export const CHALLENGE_NAME_MAX_LENGTH = 50;

/** Лимит описания на фронте; на бэке лимита нет — попросить max_length=200 */
export const CHALLENGE_DESCRIPTION_MAX_LENGTH = 200;

/** Дефолтная цель при добавлении упражнения в форме челленджа */
export const DEFAULT_REPS_GOAL = 10;

/** Дефолтная длительность планки (секунды) */
export const DEFAULT_PLANK_SECONDS = 30;

/** Максимум повторений для reps-упражнений */
export const MAX_REPS_GOAL = 9_999;

/** Максимальная длительность планки (секунды) — 60 минут */
export const MAX_PLANK_TOTAL_SECONDS = 3_600;

export const MAX_PLANK_MINUTES = Math.floor(MAX_PLANK_TOTAL_SECONDS / 60);

export function clampRepsGoal(value: number): number {
  return Math.min(Math.max(1, value), MAX_REPS_GOAL);
}

export function clampPlankSeconds(totalSeconds: number): number {
  return Math.min(Math.max(1, totalSeconds), MAX_PLANK_TOTAL_SECONDS);
}

export function splitPlankGoal(totalSeconds: number): { minutes: number; seconds: number } {
  const clamped = clampPlankSeconds(totalSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return { minutes, seconds };
}

export function combinePlankGoal(minutes: number, seconds: number): number {
  const safeMinutes = Math.min(Math.max(0, minutes), MAX_PLANK_MINUTES);
  const safeSeconds = Math.min(Math.max(0, seconds), 59);
  const total = safeMinutes * 60 + safeSeconds;
  return clampPlankSeconds(total > 0 ? total : 1);
}

export function isGoalWithinLimits(
  metric: 'reps' | 'seconds' | undefined,
  goal: number,
): boolean {
  if (goal <= 0) return false;
  if (metric === 'seconds') return goal <= MAX_PLANK_TOTAL_SECONDS;
  return goal <= MAX_REPS_GOAL;
}
