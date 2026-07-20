import { Clock } from 'lucide-react';
import { Badge } from '../ui/Badge.tsx';
import { ProgressBar } from '../ui/ProgressBar.tsx';
import { ChallengeScheduleBadge } from '../challenges/ChallengeScheduleBadge.tsx';
import type { TodayPlanItem } from '../../types/challenge.ts';
import { UNLIMITED_DATE_LABEL } from '../../utils/challengeMappers.ts';

interface TodayPlanCardProps {
  item: TodayPlanItem;
  onClick: () => void;
}

export function TodayPlanCard({ item, onClick }: TodayPlanCardProps) {
  const { challenge, progressPercent, isCompleted, exercises } = item;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl sm:rounded-3xl shadow-card p-4 sm:p-6 transition-all hover:shadow-card-hover ${
        isCompleted ? 'max-lg:bg-success/60 bg-lime-pale border border-lime-light' : 'bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-3 lg:mb-4">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-bold text-neutral-text mb-2 truncate" title={challenge.title}>{challenge.title}</h3>
          {challenge.description && (
            <p className="lg:hidden text-sm text-neutral-muted line-clamp-2 mb-2">
              {challenge.description}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Badge variant="orange" icon={<Clock size={12} />} className="shrink-0 whitespace-nowrap normal-case">
              {challenge.isUnlimited ? UNLIMITED_DATE_LABEL : challenge.dateLabel}
            </Badge>
            <ChallengeScheduleBadge label={challenge.scheduleLabel} />
          </div>
        </div>
        {isCompleted && (
          <span className="px-4 py-1.5 bg-lime text-white text-xs font-semibold rounded-xl flex-shrink-0">
            Выполнено
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {exercises.map((exercise) => (
          <span
            key={exercise.label}
            className={`px-2.5 py-1 text-xs rounded-lg ${
              exercise.completed ? 'bg-lime-light text-lime-hover' : 'bg-neutral-card text-neutral-secondary'
            }`}
          >
            {exercise.label}
          </span>
        ))}
      </div>

      <ProgressBar value={progressPercent} color="lime" className="h-2.5" />
    </button>
  );
}
