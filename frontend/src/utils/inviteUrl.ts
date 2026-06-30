export function buildChallengeInviteUrl(joinCode: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/invite/${joinCode}`;
}
