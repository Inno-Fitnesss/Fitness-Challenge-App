import type {
  ApiChallengeDetail,
  ApiChallengeExercise,
  ApiLeaderboardEntry,
  ApiTodayChallenge,
} from '../types/api.types.ts';
import type {
  ChallengeListItem,
  DiscoveryChallenge,
  ExerciseProgress,
  LeaderboardEntry,
  TodayPlanItem,
} from '../types/challenge.ts';
import { pluralizeRuWithCount } from './russianPlural.ts';
import { formatScheduleLabel } from './scheduleFormat.ts';

const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatShortDate(iso: string): string {
  const date = parseDate(iso);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

export function formatDateLabel(startDate: string, endDate: string | null): string {
  if (!endDate) return 'без ограничений';
  return `${formatShortDate(startDate)} - ${formatShortDate(endDate)}`;
}

export function formatExerciseTag(name: string, goal: number, metric: string): string {
  if (metric === 'seconds') {
    if (goal >= 60 && goal % 60 === 0) {
      const mins = goal / 60;
      return `${name} ${mins} мин`;
    }
    return `${name} ${goal} сек`;
  }
  return `${name} x ${goal}`;
}

export function formatParticipants(count: number): string {
  return pluralizeRuWithCount(count, ['участник', 'участника', 'участников']);
}

const AVATAR_COLORS = [
  'bg-lime-light',
  'bg-brand-light',
  'bg-lime/40',
  'bg-accent/60',
  'bg-success/80',
];

export function avatarColorForUsername(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function mapChallengeDetailToListItem(detail: ApiChallengeDetail): ChallengeListItem {
  return {
    id: detail.id,
    title: detail.name,
    description: detail.description ?? '',
    startDate: detail.start_date,
    endDate: detail.end_date ?? '',
    scheduleType: detail.schedule_type,
    scheduleDays: detail.schedule_days ?? [],
    scheduleLabel: formatScheduleLabel(detail.schedule_type, detail.schedule_days),
    status: detail.status === 'archived' ? 'archived' : 'active',
    participantCount: detail.participants,
    isUnlimited: !detail.end_date,
    isOwner: detail.join_code != null,
    joinCode: detail.join_code ?? undefined,
    isPreset: detail.is_preset,
    isPrivate: detail.is_private,
    joined: detail.joined,
    dateLabel: formatDateLabel(detail.start_date, detail.end_date),
    exerciseTags: detail.exercises.map((ex) => formatExerciseTag(ex.name, ex.goal, ex.metric)),
  };
}

export function calcExerciseProgressPercent(exercises: ApiChallengeExercise[]): number {
  if (exercises.length === 0) return 0;
  const sum = exercises.reduce((acc, ex) => {
    if (ex.closed) return acc + 1;
    if (ex.goal <= 0) return acc;
    const done = ex.clean_today ?? 0;
    return acc + Math.min(done / ex.goal, 1);
  }, 0);
  return Math.round((sum / exercises.length) * 100);
}

export function mapTodayToPlanItem(
  today: ApiTodayChallenge,
  detail: ApiChallengeDetail,
): TodayPlanItem {
  const progressPercent = calcExerciseProgressPercent(today.exercises);
  const isCompleted = today.exercises.length > 0 && today.exercises.every((ex) => ex.closed);
  const exercises = today.exercises.map((ex) => ({
    label: formatExerciseTag(ex.name, ex.goal, ex.metric),
    completed: Boolean(ex.closed),
  }));

  return {
    challenge: mapChallengeDetailToListItem(detail),
    progressPercent,
    isCompleted,
    exercises,
  };
}

export function mapExerciseProgress(
  exercises: ApiChallengeExercise[],
): ExerciseProgress[] {
  return exercises.map((ex) => {
    const isSeconds = ex.metric === 'seconds';
    const goal = isSeconds && ex.goal >= 60 ? Math.floor(ex.goal / 60) : ex.goal;
    const unit = isSeconds && ex.goal >= 60 ? 'minutes' as const : isSeconds ? 'seconds' as const : 'reps' as const;

    let status: ExerciseProgress['status'] = 'not_started';
    if (ex.closed) status = 'completed';

    return {
      exerciseId: String(ex.challenge_exercise_id),
      name: ex.name,
      goal,
      completed: ex.closed ? goal : 0,
      unit: unit === 'seconds' ? 'reps' : unit,
      status,
    };
  });
}

export function mapLeaderboard(
  entries: ApiLeaderboardEntry[],
  currentUsername?: string,
): LeaderboardEntry[] {
  return entries.map((entry) => ({
    rank: entry.place,
    username: entry.username,
    globalStreakDays: entry.user_streak,
    challengeStreakDays: entry.challenge_streak,
    isCurrentUser: entry.username === currentUsername,
    avatarColor: avatarColorForUsername(entry.username),
  }));
}

export function mapPresetToDiscovery(
  preset: { id: number; name: string; description: string | null },
  detail: ApiChallengeDetail,
): DiscoveryChallenge {
  return {
    id: detail.id,
    title: detail.name,
    description: detail.description ?? preset.description ?? '',
    isUnlimited: !detail.end_date,
    scheduleType: detail.schedule_type,
    scheduleDays: detail.schedule_days ?? [],
    scheduleLabel: formatScheduleLabel(detail.schedule_type, detail.schedule_days),
    exerciseTags: detail.exercises.map((ex) => formatExerciseTag(ex.name, ex.goal, ex.metric)),
    participantCount: detail.participants,
    joined: detail.joined,
  };
}
