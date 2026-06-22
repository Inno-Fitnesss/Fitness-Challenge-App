import { Clock, Trash2 } from 'lucide-react';
import { Badge } from '../ui/Badge';
import type { ChallengeListItem, ChallengeTab } from '../../types/challenge';

interface ChallengeCardProps {
  challenge: ChallengeListItem;
  tab: ChallengeTab;
  onOpen: (id: number) => void;
  onEdit?: (id: number) => void;
  onCopyLink?: (id: number) => void;
  onLeaderboard?: (id: number) => void;
  onArchive?: (id: number) => void;
  onDelete?: (id: number) => void;
  onLeave?: (id: number) => void;
  onResume?: (id: number) => void;
}

function ActionBar({
  challenge,
  tab,
  onEdit,
  onCopyLink,
  onLeaderboard,
  onArchive,
  onDelete,
  onLeave,
  onResume,
}: ChallengeCardProps) {
  const challengeId = challenge.id;
  const btnClass =
    'flex-1 py-3 text-sm font-medium text-neutral-secondary hover:text-neutral-text hover:bg-white/60 transition-colors text-center';

  if (tab === 'mine') {
    return (
      <div className="flex items-center border-t border-neutral-border bg-neutral-card/80 rounded-b-3xl overflow-hidden">
        <button type="button" className={btnClass} onClick={() => onEdit?.(challengeId)}>
          Редактировать
        </button>
        <span className="w-px h-6 bg-neutral-border" />
        <button type="button" className={btnClass} onClick={() => onCopyLink?.(challengeId)}>
          Скопировать ссылку
        </button>
        <span className="w-px h-6 bg-neutral-border" />
        <button type="button" className={btnClass} onClick={() => onLeaderboard?.(challengeId)}>
          Лидерборд
        </button>
        <span className="w-px h-6 bg-neutral-border" />
        <button type="button" className={btnClass} onClick={() => onArchive?.(challengeId)}>
          В архив
        </button>
        <span className="w-px h-6 bg-neutral-border" />
        <button
          type="button"
          className={`${btnClass} flex items-center justify-center gap-1 text-red-400 hover:text-red-500`}
          onClick={() => onDelete?.(challengeId)}
        >
          <Trash2 size={14} />
          Удалить
        </button>
      </div>
    );
  }

  if (tab === 'participating') {
    return (
      <div className="flex border-t border-neutral-border bg-neutral-card/80 rounded-b-3xl overflow-hidden">
        <button type="button" className={btnClass} onClick={() => onLeaderboard?.(challengeId)}>
          Лидерборд
        </button>
        <span className="w-px h-6 bg-neutral-border self-center" />
        <button type="button" className={btnClass} onClick={() => onLeave?.(challengeId)}>
          Покинуть
        </button>
      </div>
    );
  }

  return (
    <div className="flex border-t border-neutral-border bg-neutral-card/80 rounded-b-3xl overflow-hidden">
      <button type="button" className={btnClass} onClick={() => onLeaderboard?.(challengeId)}>
        Лидерборд
      </button>
      <span className="w-px h-6 bg-neutral-border self-center" />
      <button type="button" className={btnClass} onClick={() => onResume?.(challengeId)}>
        Возобновить
      </button>
    </div>
  );
}

export function ChallengeCard(props: ChallengeCardProps) {
  const { challenge, tab, onOpen } = props;
  const dateVariant = challenge.isUnlimited || tab === 'archive' ? 'orange' : 'orange';

  return (
    <article className="bg-white rounded-3xl shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => onOpen(challenge.id)}
        className="w-full text-left p-6 hover:bg-neutral-card/30 transition-colors"
      >
        <h3 className="text-lg font-bold text-neutral-text mb-3">{challenge.title}</h3>

        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant={dateVariant} icon={<Clock size={12} />}>
            {challenge.dateLabel}
          </Badge>
          <Badge variant="grey">{challenge.participantCount} участника</Badge>
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
