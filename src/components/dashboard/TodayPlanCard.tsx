import { Clock } from 'lucide-react';
import { Badge } from '../ui/Badge.tsx';
import { CircularProgress } from '../ui/CircularProgress.tsx';
import { ChallengeScheduleBadge } from '../challenges/ChallengeScheduleBadge.tsx';
import type { TodayPlanItem } from '../../types/challenge.ts';
import { formatParticipants } from '../../utils/challengeMappers.ts';

interface TodayPlanCardProps {
  item: TodayPlanItem;
  onClick: () => void;
}

export function TodayPlanCard({ item, onClick }: TodayPlanCardProps) {
  const { challenge, progressPercent, isCompleted } = item;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl sm:rounded-3xl shadow-card transition-all hover:shadow-card-hover ${
        isCompleted ? 'bg-lime-pale border border-lime-light' : 'bg-white'
      }`}
    >
      <div className="relative p-4 sm:p-6 pr-32 sm:pr-36">
        <h3 className="text-base sm:text-lg font-bold text-neutral-text mb-3 truncate" title={challenge.title}>
          {challenge.title}
        </h3>

        <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
          <Badge variant="orange" icon={<Clock size={12} />}>
            {challenge.dateLabel}
          </Badge>
          <ChallengeScheduleBadge label={challenge.scheduleLabel} />
          <Badge variant="grey">{formatParticipants(challenge.participantCount)}</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {challenge.exerciseTags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 bg-neutral-card text-neutral-secondary text-xs rounded-lg"
            >
              {tag}
            </span>
          ))}
        </div>

        <div
          className="absolute right-6 sm:right-8 top-8 sm:top-10 pointer-events-none"
          aria-hidden="true"
        >
          <CircularProgress value={progressPercent} size={84} strokeWidth={6} />
        </div>
      </div>
    </button>
  );
}
