import type { ChallengeTab } from '../types/challenge.ts';

export type ExerciseReturnTarget =
  | { type: 'dashboard' }
  | { type: 'challenges'; tab?: ChallengeTab }
  | { type: 'challenge'; challengeId: number; tab?: ChallengeTab };

export function buildExerciseSessionPath(
  challengeId: number,
  challengeExerciseId: string | number,
  returnTo: ExerciseReturnTarget,
): string {
  const params = new URLSearchParams();
  params.set('from', returnTo.type);

  if (returnTo.type === 'challenges' && returnTo.tab) {
    params.set('tab', returnTo.tab);
  }

  if (returnTo.type === 'challenge') {
    if (returnTo.tab) params.set('tab', returnTo.tab);
  }

  const query = params.toString();
  return `/challenges/${challengeId}/exercise/${challengeExerciseId}${query ? `?${query}` : ''}`;
}

export function resolveExerciseReturnPath(
  searchParams: URLSearchParams,
  challengeId: number,
): string {
  const from = searchParams.get('from');
  const tab = searchParams.get('tab');

  if (from === 'dashboard') return '/dashboard';

  if (from === 'challenges') {
    return tab ? `/challenges?tab=${tab}` : '/challenges';
  }

  if (from === 'challenge') {
    return tab
      ? `/challenges/${challengeId}?tab=${tab}`
      : `/challenges/${challengeId}`;
  }

  return `/challenges/${challengeId}`;
}
