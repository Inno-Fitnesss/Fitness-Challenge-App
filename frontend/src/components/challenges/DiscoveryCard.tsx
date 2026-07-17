import { Clock } from 'lucide-react';
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
    <div className="bg-white rounded-3xl lg:rounded-2xl shadow-card lg:shadow-none border-0 lg:border lg:border-neutral-border p-5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-bold text-neutral-text truncate min-w-0 max-lg:text-lg" title={challenge.title}>
          {challenge.title}
        </h3>
        <Badge variant="orange" icon={<Clock size={12} />} className="shrink-0 whitespace-nowrap">
          <span className="lg:hidden">бессрочный</span>
          <span className="hidden lg:inline">бессрочный</span>
        </Badge>
      </div>

      {/* На мобильном макете описания нет — только бейджи и чипы упражнений */}
      <p className="hidden lg:block text-sm text-neutral-muted mb-3">{challenge.description}</p>

      <div className="flex flex-wrap gap-2 mb-3">
        <ChallengeScheduleBadge label={challenge.scheduleLabel} />
        <Badge variant="green">{formatParticipants(challenge.participantCount)}</Badge>
      </div>

      <div className="flex flex-wrap gap-1.5 max-lg:gap-2 mb-4">
        {challenge.exerciseTags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 max-lg:px-2.5 max-lg:py-1 bg-neutral-card text-neutral-secondary text-xs rounded-md max-lg:rounded-lg"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
        <Button
          variant="lime"
          size="sm"
          disabled={isJoined}
          onClick={() => onJoin(challenge.id)}
          className="w-full lg:w-auto whitespace-nowrap max-lg:rounded-2xl max-lg:py-2.5 max-lg:text-sm"
        >
          {isJoined ? 'Вы уже присоединились' : 'Присоединиться'}
        </Button>
      </div>
    </div>
  );
}
