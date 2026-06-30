import type { ChallengeListItem } from '../types/challenge.ts';

export function canEditChallenge(challenge: ChallengeListItem): boolean {
  return challenge.isOwner && challenge.isPrivate && challenge.status === 'active';
}

export function canPublishChallenge(challenge: ChallengeListItem): boolean {
  return challenge.isOwner && challenge.isPrivate && challenge.status === 'active';
}

export function canInviteToChallenge(challenge: ChallengeListItem): boolean {
  // Invite links are only for public challenges — a private (individual)
  // challenge has nobody to invite until it's published.
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
