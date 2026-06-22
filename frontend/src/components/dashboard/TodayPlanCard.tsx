import { Clock } from 'lucide-react';
import { Badge } from '../ui/Badge.tsx';
import { ProgressBar } from '../ui/ProgressBar.tsx';
import type { TodayPlanItem } from '../../types/challenge.ts';

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
      className={`w-full text-left rounded-2xl sm:rounded-3xl shadow-card p-4 sm:p-6 transition-all hover:shadow-card-hover ${
        isCompleted ? 'bg-lime-pale border border-lime-light' : 'bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-neutral-text mb-2">{challenge.title}</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant="orange" icon={<Clock size={12} />}>
              {challenge.dateLabel}
            </Badge>
            <Badge variant="grey">{challenge.participantCount} участника</Badge>
          </div>
        </div>
        {isCompleted && (
          <span className="px-4 py-1.5 bg-lime text-white text-xs font-semibold rounded-xl flex-shrink-0">
            Выполнено
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {challenge.exerciseTags.map((tag) => (
          <span
            key={tag}
            className="px-2.5 py-1 bg-neutral-card text-neutral-secondary text-xs rounded-lg"
          >
            {tag}
          </span>
        ))}
      </div>

      <ProgressBar value={progressPercent} color="lime" className="h-2.5" />
    </button>
  );
}
