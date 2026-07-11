import { Clock, Flame } from 'lucide-react';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';
import { ChallengeScheduleBadge } from './ChallengeScheduleBadge.tsx';
import type { DiscoveryChallenge } from '../../types/challenge.ts';
import { formatParticipants } from '../../utils/challengeMappers.ts';

interface DiscoveryCardProps {
  challenge: DiscoveryChallenge;
  onJoin: (id: number) => void;
}

export function DiscoveryCard({ challenge, onJoin }: DiscoveryCardProps) {
  const isJoined = challenge.joined;

  return (
    <div className="bg-white rounded-2xl border border-neutral-border p-5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-bold text-neutral-text truncate min-w-0" title={challenge.title}>{challenge.title}</h3>
        <Badge variant="orange" icon={<Clock size={12} />}>
          без ограничений
        </Badge>
      </div>

      <p className="text-sm text-neutral-muted mb-3">{challenge.description}</p>

      <div className="flex flex-wrap gap-2 mb-3">
        <ChallengeScheduleBadge label={challenge.scheduleLabel} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {challenge.exerciseTags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 bg-neutral-card text-neutral-secondary text-xs rounded-md"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <span className="flex items-center gap-1.5 text-xs text-neutral-secondary">
          <Flame size={14} className="text-brand" />
          {formatParticipants(challenge.participantCount)}
        </span>
        <Button
          variant="lime"
          size="sm"
          disabled={isJoined}
          onClick={() => onJoin(challenge.id)}
          className="w-full sm:w-auto whitespace-nowrap"
        >
          {isJoined ? 'Вы уже присоединились' : 'Присоединиться'}
        </Button>
      </div>
    </div>
  );
}
