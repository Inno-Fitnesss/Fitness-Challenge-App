import { describe, it, expect } from 'vitest';
import {
  canEditChallenge,
  canPublishChallenge,
  canInviteToChallenge,
  canDeleteChallenge,
  canArchiveChallenge,
  canLeaveChallenge,
} from './challengePermissions.ts';
import type { ChallengeListItem } from '../types/challenge.ts';

function makeChallenge(overrides: Partial<ChallengeListItem> = {}): ChallengeListItem {
  return {
    id: 1,
    title: 'Test',
    description: '',
    startDate: '2026-06-01',
    endDate: '',
    scheduleType: 'daily',
    scheduleDays: [],
    scheduleLabel: 'Каждый день',
    status: 'active',
    participantCount: 1,
    isUnlimited: true,
    isOwner: true,
    joinCode: undefined,
    isPreset: false,
    isPrivate: true,
    joined: true,
    exerciseTags: [],
    dateLabel: '',
    ...overrides,
  };
}

// canEdit / canPublish / canDelete / canArchive all currently share the same
// rule (owner + private + active). These tests pin that down explicitly so
// a future divergence between them is a visible, intentional diff.
function sharedOwnerPrivateActiveCases(name: string, fn: (c: ChallengeListItem) => boolean) {
  describe(name, () => {
    it('true for the owner of a private, active challenge', () => {
      expect(fn(makeChallenge())).toBe(true);
    });

    it('false for a non-owner', () => {
      expect(fn(makeChallenge({ isOwner: false }))).toBe(false);
    });

    it('false once the challenge is public', () => {
      expect(fn(makeChallenge({ isPrivate: false }))).toBe(false);
    });

    it('false once archived', () => {
      expect(fn(makeChallenge({ status: 'archived' }))).toBe(false);
    });

    it('false once completed', () => {
      expect(fn(makeChallenge({ status: 'completed' }))).toBe(false);
    });
  });
}

sharedOwnerPrivateActiveCases('canEditChallenge', canEditChallenge);
sharedOwnerPrivateActiveCases('canPublishChallenge', canPublishChallenge);
sharedOwnerPrivateActiveCases('canDeleteChallenge', canDeleteChallenge);
sharedOwnerPrivateActiveCases('canArchiveChallenge', canArchiveChallenge);

describe('canInviteToChallenge', () => {
  it('true for the owner of a public, active challenge with a join code', () => {
    const c = makeChallenge({ isPrivate: false, joinCode: 'ABC123' });
    expect(canInviteToChallenge(c)).toBe(true);
  });

  it('false for a private challenge — nobody to invite until it is published', () => {
    const c = makeChallenge({ isPrivate: true, joinCode: 'ABC123' });
    expect(canInviteToChallenge(c)).toBe(false);
  });

  it('false without a join code even if public', () => {
    const c = makeChallenge({ isPrivate: false, joinCode: undefined });
    expect(canInviteToChallenge(c)).toBe(false);
  });

  it('false for a non-owner', () => {
    const c = makeChallenge({ isOwner: false, isPrivate: false, joinCode: 'ABC123' });
    expect(canInviteToChallenge(c)).toBe(false);
  });

  it('false once archived', () => {
    const c = makeChallenge({ isPrivate: false, joinCode: 'ABC123', status: 'archived' });
    expect(canInviteToChallenge(c)).toBe(false);
  });
});

describe('canLeaveChallenge', () => {
  it('true for a joined participant on someone else\'s challenge', () => {
    const c = makeChallenge({ isOwner: false, joined: true });
    expect(canLeaveChallenge(c)).toBe(true);
  });

  it('false for the owner of their own private challenge (leaving = deleting elsewhere)', () => {
    const c = makeChallenge({ isOwner: true, isPrivate: true, joined: true });
    expect(canLeaveChallenge(c)).toBe(false);
  });

  it('true for the owner once the challenge is public (they are just another participant then)', () => {
    const c = makeChallenge({ isOwner: true, isPrivate: false, joined: true });
    expect(canLeaveChallenge(c)).toBe(true);
  });

  it('false if not joined', () => {
    const c = makeChallenge({ isOwner: false, joined: false });
    expect(canLeaveChallenge(c)).toBe(false);
  });

  it('false once archived, even if joined', () => {
    const c = makeChallenge({ isOwner: false, joined: true, status: 'archived' });
    expect(canLeaveChallenge(c)).toBe(false);
  });
});