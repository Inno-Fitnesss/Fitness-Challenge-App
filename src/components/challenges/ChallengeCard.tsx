import { Clock, Trash2 } from 'lucide-react';
import { Badge } from '../ui/Badge.tsx';
import { ChallengeScheduleBadge } from './ChallengeScheduleBadge.tsx';
import type { ChallengeListItem, ChallengeTab } from '../../types/challenge.ts';
import { formatParticipants } from '../../utils/challengeMappers.ts';

interface ChallengeCardProps {
  challenge: ChallengeListItem;
  tab: ChallengeTab;
  onOpen: (id: number) => void;
  onCopyLink?: (id: number) => void;
  onArchive?: (id: number) => void;
  onDelete?: (id: number) => void;
  onLeave?: (id: number) => void;
  onResume?: (id: number) => void;
}

function ActionBar({
  challenge,
  tab,
  onCopyLink,
  onArchive,
  onDelete,
  onLeave,
  onResume,
}: ChallengeCardProps) {
  const challengeId = challenge.id;
  const btnClass =
    'flex-shrink-0 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-neutral-secondary hover:text-neutral-text hover:bg-white/60 transition-colors text-center whitespace-nowrap';

  const divider = <span className="w-px h-6 bg-neutral-border self-center flex-shrink-0" />;

  if (tab === 'mine') {
    return (
      <div className="border-t border-neutral-border bg-neutral-card/80 rounded-b-3xl overflow-x-auto">
        <div className="flex items-center min-w-max sm:min-w-0 sm:w-full">
          <button type="button" className={`${btnClass} sm:flex-1`} onClick={() => onCopyLink?.(challengeId)}>
            <span className="hidden sm:inline">Скопировать ссылку</span>
            <span className="sm:hidden">Ссылка</span>
          </button>
          {divider}
          <button type="button" className={`${btnClass} sm:flex-1`} onClick={() => onArchive?.(challengeId)}>
            В архив
          </button>
          {divider}
          <button
            type="button"
            className={`${btnClass} sm:flex-1 flex items-center justify-center gap-1 text-red-400 hover:text-red-500`}
            onClick={() => onDelete?.(challengeId)}
          >
            <Trash2 size={14} />
            Удалить
          </button>
        </div>
      </div>
    );
  }

  if (tab === 'participating') {
    return (
      <div className="flex border-t border-neutral-border bg-neutral-card/80 rounded-b-3xl overflow-hidden">
        <button type="button" className={`${btnClass} flex-1`} onClick={() => onLeave?.(challengeId)}>
          Покинуть
        </button>
      </div>
    );
  }

  if (tab === 'archive') {
    return (
      <div className="flex border-t border-neutral-border bg-neutral-card/80 rounded-b-3xl overflow-hidden">
        <button type="button" className={`${btnClass} flex-1`} onClick={() => onResume?.(challengeId)}>
          Возобновить
        </button>
        {challenge.isOwner && (
          <>
            {divider}
            <button
              type="button"
              className={`${btnClass} flex-1 flex items-center justify-center gap-1 text-red-400 hover:text-red-500`}
              onClick={() => onDelete?.(challengeId)}
            >
              <Trash2 size={14} />
              Удалить
            </button>
          </>
        )}
      </div>
    );
  }

  return null;
}

export function ChallengeCard(props: ChallengeCardProps) {
  const { challenge, tab, onOpen } = props;
  const dateVariant = challenge.isUnlimited || tab === 'archive' ? 'orange' : 'orange';

  return (
    <article className="bg-white rounded-2xl sm:rounded-3xl shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => onOpen(challenge.id)}
        className="w-full text-left p-4 sm:p-6 hover:bg-neutral-card/30 transition-colors"
      >
        <h3 className="text-base sm:text-lg font-bold text-neutral-text mb-3 truncate" title={challenge.title}>
          {challenge.title}
        </h3>

        <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
          <Badge variant={dateVariant} icon={<Clock size={12} />}>
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
      </button>

      <ActionBar {...props} />
    </article>
  );
}
