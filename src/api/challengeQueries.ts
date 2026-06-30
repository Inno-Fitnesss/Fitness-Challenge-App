import {
  mapChallengeDetailToListItem,
  mapExerciseProgress,
  mapLeaderboard,
  mapPresetToDiscovery,
  mapTodayToPlanItem,
} from '../utils/challengeMappers.ts';
import { meApi, challengeApi } from './challengeApi.ts';
import type { ChallengeListItem, DiscoveryChallenge, TodayPlanItem } from '../types/challenge.ts';
import { todayIso } from '../utils/dateFormat.ts';

async function archiveExpiredOwnedChallenges(items: ChallengeListItem[]): Promise<ChallengeListItem[]> {
  const today = todayIso();
  const expiredIds = items
    .filter((c) => c.isOwner && c.endDate && c.endDate < today)
    .map((c) => c.id);

  if (expiredIds.length === 0) return items;

  await Promise.all(
    expiredIds.map((id) => challengeApi.archive(id).catch(() => undefined)),
  );

  return items.filter((c) => !expiredIds.includes(c.id));
}

export async function fetchChallengeListItems(
  status: 'active' | 'archived',
): Promise<ChallengeListItem[]> {
  const summaries = await meApi.getMyChallenges(status);
  if (summaries.length === 0) return [];

  const details = await Promise.all(
    summaries.map((s) => challengeApi.getDetail(s.id)),
  );
  const items = details.map(mapChallengeDetailToListItem);

  if (status === 'active') {
    return archiveExpiredOwnedChallenges(items);
  }

  return items;
}

export async function fetchDiscoveryChallenges(): Promise<DiscoveryChallenge[]> {
  const presets = await challengeApi.getPresets();
  if (presets.length === 0) return [];

  const details = await Promise.all(
    presets.map((p) => challengeApi.getDetail(p.id)),
  );
  return presets.map((preset, i) => mapPresetToDiscovery(preset, details[i]));
}

export async function fetchTodayPlan(): Promise<TodayPlanItem[]> {
  const today = await meApi.getToday();
  if (today.length === 0) return [];

  const details = await Promise.all(
    today.map((t) => challengeApi.getDetail(t.id)),
  );
  return today.map((item, i) => mapTodayToPlanItem(item, details[i]));
}

export async function fetchChallengeModalData(
  challengeId: number,
  currentUsername?: string,
) {
  const [detail, leaderboard, todayList] = await Promise.all([
    challengeApi.getDetail(challengeId),
    challengeApi.getLeaderboard(challengeId),
    meApi.getToday(),
  ]);

  const todayEntry = todayList.find((t) => t.id === challengeId);
  const exercises = todayEntry?.exercises ?? detail.exercises.map((ex) => ({
    ...ex,
    clean_today: 0,
    closed: false,
  }));

  return {
    challenge: mapChallengeDetailToListItem(detail),
    exercises: mapExerciseProgress(exercises),
    leaderboard: mapLeaderboard(leaderboard, currentUsername),
  };
}
