import type { ChallengeListItem } from '../types/challenge.ts';
import { todayIso } from './dateFormat.ts';

export function isChallengeExpired(challenge: ChallengeListItem): boolean {
  return !challenge.isUnlimited && Boolean(challenge.endDate) && challenge.endDate < todayIso();
}

export function canResumeChallenge(challenge: ChallengeListItem): boolean {
  return !isChallengeExpired(challenge);
}

export function canEditChallenge(challenge: ChallengeListItem): boolean {
  return challenge.isOwner && challenge.isPrivate && challenge.status === 'active';
}

export function canPublishChallenge(challenge: ChallengeListItem): boolean {
  return challenge.isOwner && challenge.isPrivate && challenge.status === 'active';
}

export function canInviteToChallenge(challenge: ChallengeListItem): boolean {
  // Ссылка-приглашение только для публичных челленджей — в приватный
  // (индивидуальный) приглашать некого, пока он не опубликован.
  return (
    challenge.isOwner &&
    !challenge.isPrivate &&
    Boolean(challenge.joinCode) &&
    challenge.status === 'active'
  );
}

export function canDeleteChallenge(challenge: ChallengeListItem): boolean {
  return challenge.isOwner && challenge.isPrivate && challenge.status === 'active';
}

export function canArchiveChallenge(challenge: ChallengeListItem): boolean {
  return challenge.isOwner && challenge.isPrivate && challenge.status === 'active';
}

export function canLeaveChallenge(challenge: ChallengeListItem): boolean {
  if (challenge.status !== 'active') return false;
  if (challenge.isOwner && challenge.isPrivate) return false;
  return challenge.joined;
}
