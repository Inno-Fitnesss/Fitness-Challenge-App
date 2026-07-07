import { describe, it, expect } from 'vitest';
import {
  formatDateLabel,
  formatExerciseTag,
  formatParticipants,
  avatarColorForUsername,
  mapChallengeDetailToListItem,
  calcExerciseProgressPercent,
  mapTodayToPlanItem,
  mapExerciseProgress,
  mapLeaderboard,
} from './challengeMappers.ts';
import type { ApiChallengeDetail, ApiChallengeExercise, ApiTodayChallenge } from '../types/api.types.ts';

function makeExercise(overrides: Partial<ApiChallengeExercise> = {}): ApiChallengeExercise {
  return {
    challenge_exercise_id: 1,
    exercise_id: 1,
    name: 'Squats',
    metric: 'reps',
    goal: 10,
    clean_today: 0,
    closed: false,
    ...overrides,
  };
}

function makeDetail(overrides: Partial<ApiChallengeDetail> = {}): ApiChallengeDetail {
  return {
    id: 1,
    name: 'My Challenge',
    description: null,
    schedule_type: 'daily',
    schedule_days: null,
    start_date: '2026-06-01',
    end_date: null,
    is_private: true,
    is_preset: false,
    status: 'active',
    join_code: 'ABC123',
    exercises: [makeExercise()],
    participants: 1,
    joined: true,
    ...overrides,
  };
}

describe('formatDateLabel', () => {
  it('reports "без ограничений" for an open-ended challenge', () => {
    expect(formatDateLabel('2026-06-01', null)).toBe('без ограничений');
  });

  it('formats a bounded range as short dates', () => {
    expect(formatDateLabel('2026-06-01', '2026-06-15')).toBe('1 июн - 15 июн');
  });
});

describe('formatExerciseTag', () => {
  it('formats a reps-based exercise as "name x goal"', () => {
    expect(formatExerciseTag('Отжимания', 20, 'reps')).toBe('Отжимания x 20');
  });

  it('formats a whole-minute plank goal in minutes', () => {
    expect(formatExerciseTag('Планка', 120, 'seconds')).toBe('Планка 2 мин');
  });

  it('formats a non-whole-minute plank goal in seconds', () => {
    expect(formatExerciseTag('Планка', 90, 'seconds')).toBe('Планка 90 сек');
  });

  it('formats a sub-minute plank goal in seconds', () => {
    expect(formatExerciseTag('Планка', 45, 'seconds')).toBe('Планка 45 сек');
  });
});

describe('formatParticipants', () => {
  it('applies correct Russian plural forms', () => {
    expect(formatParticipants(1)).toBe('1 участник');
    expect(formatParticipants(2)).toBe('2 участника');
    expect(formatParticipants(5)).toBe('5 участников');
    expect(formatParticipants(11)).toBe('11 участников');
    expect(formatParticipants(21)).toBe('21 участник');
  });
});

describe('avatarColorForUsername', () => {
  it('is deterministic for the same username', () => {
    expect(avatarColorForUsername('alice')).toBe(avatarColorForUsername('alice'));
  });

  it('always returns one of the known palette classes', () => {
    const palette = ['bg-lime-light', 'bg-brand-light', 'bg-lime/40', 'bg-accent/60', 'bg-success/80'];
    expect(palette).toContain(avatarColorForUsername('someone'));
    expect(palette).toContain(avatarColorForUsername(''));
  });
});

describe('mapChallengeDetailToListItem', () => {
  it('derives isOwner from join_code being present (backend nulls it for non-owners)', () => {
    const ownerView = mapChallengeDetailToListItem(makeDetail({ join_code: 'ABC123' }));
    expect(ownerView.isOwner).toBe(true);

    const nonOwnerView = mapChallengeDetailToListItem(makeDetail({ join_code: null }));
    expect(nonOwnerView.isOwner).toBe(false);
  });

  it('maps archived status through, defaults everything else to active', () => {
    expect(mapChallengeDetailToListItem(makeDetail({ status: 'archived' })).status).toBe('archived');
    expect(mapChallengeDetailToListItem(makeDetail({ status: 'completed' })).status).toBe('active');
  });

  it('isUnlimited is derived from end_date being null', () => {
    expect(mapChallengeDetailToListItem(makeDetail({ end_date: null })).isUnlimited).toBe(true);
    expect(mapChallengeDetailToListItem(makeDetail({ end_date: '2026-12-31' })).isUnlimited).toBe(false);
  });

  it('builds one exercise tag per exercise', () => {
    const detail = makeDetail({
      exercises: [makeExercise({ name: 'Squats', goal: 20 }), makeExercise({ name: 'Plank', metric: 'seconds', goal: 60 })],
    });
    const item = mapChallengeDetailToListItem(detail);
    expect(item.exerciseTags).toEqual(['Squats x 20', 'Plank 1 мин']);
  });
});

describe('calcExerciseProgressPercent', () => {
  it('0% for an empty exercise list', () => {
    expect(calcExerciseProgressPercent([])).toBe(0);
  });

  it('rounds the fraction of closed exercises to a whole percent', () => {
    const exercises = [makeExercise({ closed: true }), makeExercise({ closed: false }), makeExercise({ closed: false })];
    expect(calcExerciseProgressPercent(exercises)).toBe(33);
  });

  it('100% when every exercise is closed', () => {
    const exercises = [makeExercise({ closed: true }), makeExercise({ closed: true })];
    expect(calcExerciseProgressPercent(exercises)).toBe(100);
  });
});

describe('mapTodayToPlanItem', () => {
  it('isCompleted is false for a challenge with zero exercises', () => {
    const today: ApiTodayChallenge = { id: 1, name: 'X', exercises: [] };
    const plan = mapTodayToPlanItem(today, makeDetail({ exercises: [] }));
    expect(plan.isCompleted).toBe(false);
  });

  it('isCompleted is true only when every exercise for today is closed', () => {
    const today: ApiTodayChallenge = {
      id: 1,
      name: 'X',
      exercises: [makeExercise({ closed: true }), makeExercise({ closed: true })],
    };
    const plan = mapTodayToPlanItem(today, makeDetail());
    expect(plan.isCompleted).toBe(true);
    expect(plan.progressPercent).toBe(100);
  });

  it('isCompleted is false if even one exercise is still open', () => {
    const today: ApiTodayChallenge = {
      id: 1,
      name: 'X',
      exercises: [makeExercise({ closed: true }), makeExercise({ closed: false })],
    };
    const plan = mapTodayToPlanItem(today, makeDetail());
    expect(plan.isCompleted).toBe(false);
  });
});

describe('mapExerciseProgress', () => {
  it('converts a whole-minute seconds goal to minutes for display', () => {
    const [progress] = mapExerciseProgress([makeExercise({ metric: 'seconds', goal: 120, closed: true })]);
    expect(progress.goal).toBe(2);
    expect(progress.completed).toBe(2);
  });

  it('keeps a sub-minute seconds goal as-is', () => {
    const [progress] = mapExerciseProgress([makeExercise({ metric: 'seconds', goal: 45 })]);
    expect(progress.goal).toBe(45);
  });

  it(
    'FLAG: a sub-minute plank duration is labeled unit "reps", not "seconds" ' +
    '— ExerciseProgress.unit only allows \'reps\' | \'minutes\' in its type, so ' +
    'the mapper\'s `unit === \'seconds\' ? \'reps\' : unit` line silently turns ' +
    'any sub-minute seconds-based exercise into a "reps" unit for display. ' +
    'Worth checking whether the component that renders this actually falls ' +
    'back to something sane, or literally shows e.g. "45 reps" for a 45-second plank.',
    () => {
      const [progress] = mapExerciseProgress([makeExercise({ metric: 'seconds', goal: 45 })]);
      expect(progress.unit).toBe('reps');
    },
  );

  it('status is completed only when closed', () => {
    const [done, notDone] = mapExerciseProgress([
      makeExercise({ challenge_exercise_id: 1, closed: true }),
      makeExercise({ challenge_exercise_id: 2, closed: false }),
    ]);
    expect(done.status).toBe('completed');
    expect(notDone.status).toBe('not_started');
  });
});

describe('mapLeaderboard', () => {
  it('flags the current user by username', () => {
    const entries = [
      { place: 1, username: 'alice', days_completed: 5, challenge_streak: 3, total_clean_reps: 100 },
      { place: 2, username: 'bob', days_completed: 3, challenge_streak: 1, total_clean_reps: 50 },
    ];
    const mapped = mapLeaderboard(entries, 'bob');
    expect(mapped.find((e) => e.username === 'bob')?.isCurrentUser).toBe(true);
    expect(mapped.find((e) => e.username === 'alice')?.isCurrentUser).toBe(false);
  });

  it('scales progressPercent relative to the leader\'s days_completed', () => {
    const entries = [
      { place: 1, username: 'alice', days_completed: 10, challenge_streak: 3, total_clean_reps: 100 },
      { place: 2, username: 'bob', days_completed: 5, challenge_streak: 1, total_clean_reps: 50 },
    ];
    const mapped = mapLeaderboard(entries);
    expect(mapped.find((e) => e.username === 'alice')?.progressPercent).toBe(100);
    expect(mapped.find((e) => e.username === 'bob')?.progressPercent).toBe(50);
  });

  it('does not divide by zero when every entry has 0 days_completed', () => {
    const entries = [
      { place: 1, username: 'alice', days_completed: 0, challenge_streak: 0, total_clean_reps: 0 },
    ];
    const mapped = mapLeaderboard(entries);
    expect(Number.isFinite(mapped[0].progressPercent)).toBe(true);
  });
});