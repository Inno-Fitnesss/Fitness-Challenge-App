import { Clock, Flame } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { DiscoveryChallenge } from '../../types/challenge';

interface DiscoveryCardProps {
  challenge: DiscoveryChallenge;
  onJoin: (id: number) => void;
}

export function DiscoveryCard({ challenge, onJoin }: DiscoveryCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-border p-5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-bold text-neutral-text">{challenge.title}</h3>
        <Badge variant="orange" icon={<Clock size={12} />}>
          без ограничений
        </Badge>
      </div>

      <p className="text-sm text-neutral-muted mb-3">{challenge.description}</p>

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
          {challenge.participantCount} участников
        </span>
        <Button variant="lime" size="sm" onClick={() => onJoin(challenge.id)} className="w-full sm:w-auto">
          Присоединиться
        </Button>
      </div>
    </div>
  );
}
