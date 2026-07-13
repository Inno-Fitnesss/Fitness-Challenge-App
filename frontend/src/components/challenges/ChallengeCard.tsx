import { Clock, Globe, Trash2 } from 'lucide-react';
import { Badge } from '../ui/Badge.tsx';
import { ChallengeScheduleBadge } from './ChallengeScheduleBadge.tsx';
import type { ChallengeListItem, ChallengeTab } from '../../types/challenge.ts';
import { formatParticipants } from '../../utils/challengeMappers.ts';
import { useCopyFeedback } from '../../hooks/useCopyFeedback.ts';
import {
  canArchiveChallenge,
  canDeleteChallenge,
  canEditChallenge,
  canInviteToChallenge,
  canLeaveChallenge,
  canPublishChallenge,
} from '../../utils/challengePermissions.ts';

interface ChallengeCardProps {
  challenge: ChallengeListItem;
  tab: ChallengeTab;
  /** Прогресс за сегодня (0-100) — кольцо на мобильной карточке; undefined = не показывать */
  progressPercent?: number;
  onOpen: (id: number) => void;
  onCopyLink?: (id: number) => void;
  onPublish?: (id: number) => void;
  onEdit?: (id: number) => void;
  onArchive?: (id: number) => void;
  onDelete?: (id: number) => void;
  onLeave?: (id: number) => void;
  onResume?: (id: number) => void;
}

/** Кольцо прогресса с процентом внутри (мобильный макет) */
function ProgressRing({ percent, className = '' }: { percent: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  const radius = 26;
  const circumference = 2 * Math.PI * radius;

  return (
    <span
      className={`relative flex w-16 h-16 flex-shrink-0 items-center justify-center ${className}`}
      role="img"
      aria-label={`Выполнено сегодня: ${clamped}%`}
    >
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-neutral-border" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className="stroke-lime"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-lime-hover">
        {clamped}%
      </span>
    </span>
  );
}

function ActionBar({
  challenge,
  tab,
  onCopyLink,
  onPublish,
  onEdit,
  onArchive,
  onDelete,
  onLeave,
  onResume,
}: ChallengeCardProps) {
  const challengeId = challenge.id;
  const { copied, markCopied } = useCopyFeedback();

  const handleCopy = () => {
    markCopied();
    onCopyLink?.(challengeId);
  };

  const copiedClass = copied ? 'text-neutral-muted pointer-events-none' : '';

  const btnClass =
    'flex-shrink-0 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium text-neutral-secondary hover:text-neutral-text hover:bg-white/60 transition-colors text-center whitespace-nowrap';

  // Кнопка мобильного футера по макету: текст без иконок, переносится на 2 строки
  const mobileBtnClass =
    'flex-1 min-w-0 px-1.5 py-3.5 text-xs font-medium leading-tight text-neutral-secondary active:text-neutral-text text-center';

  // Разделители между действиями — только на десктопе (на макете их нет)
  const divider = <span className="hidden lg:block w-px h-6 bg-neutral-border self-center flex-shrink-0" />;

  if (tab === 'individual') {
    const mobileActions = [
      canPublishChallenge(challenge) && (
        <button key="publish" type="button" className={mobileBtnClass} onClick={() => onPublish?.(challengeId)}>
          Сделать публичным
        </button>
      ),
      canEditChallenge(challenge) && onEdit && (
        <button key="edit" type="button" className={mobileBtnClass} onClick={() => onEdit(challengeId)}>
          Редактировать
        </button>
      ),
      canArchiveChallenge(challenge) && (
        <button key="archive" type="button" className={mobileBtnClass} onClick={() => onArchive?.(challengeId)}>
          В архив
        </button>
      ),
      canDeleteChallenge(challenge) && (
        <button key="delete" type="button" className={mobileBtnClass} onClick={() => onDelete?.(challengeId)}>
          Удалить
        </button>
      ),
    ].filter(Boolean);

    const actions = [
      canInviteToChallenge(challenge) && (
        <button
          key="link"
          type="button"
          className={`${btnClass} sm:flex-1 ${copiedClass}`}
          onClick={handleCopy}
          disabled={copied}
        >
          {copied ? (
            'Скопировано!'
          ) : (
            <>
              <span className="hidden sm:inline">Скопировать ссылку</span>
              <span className="sm:hidden">Ссылка</span>
            </>
          )}
        </button>
      ),
      canPublishChallenge(challenge) && (
        <button
          key="publish"
          type="button"
          className={`${btnClass} sm:flex-1 flex items-center justify-center gap-1 text-lime-hover`}
          onClick={() => onPublish?.(challengeId)}
        >
          <Globe size={14} />
          Сделать публичным
        </button>
      ),
      canArchiveChallenge(challenge) && (
        <button key="archive" type="button" className={`${btnClass} sm:flex-1`} onClick={() => onArchive?.(challengeId)}>
          В архив
        </button>
      ),
      canDeleteChallenge(challenge) && (
        <button
          key="delete"
          type="button"
          className={`${btnClass} sm:flex-1 flex items-center justify-center gap-1 text-red-400 hover:text-red-500`}
          onClick={() => onDelete?.(challengeId)}
        >
          <Trash2 size={14} />
          Удалить
        </button>
      ),
    ].filter(Boolean);

    if (actions.length === 0 && mobileActions.length === 0) return null;

    return (
      <div className="border-t border-neutral-border bg-neutral-card/80 rounded-b-3xl overflow-x-auto">
        {mobileActions.length > 0 && (
          <div className="lg:hidden flex items-stretch w-full">{mobileActions}</div>
        )}
        <div className="hidden lg:flex items-center min-w-0 w-full">
          {actions.map((action, index) => (
            <span key={index} className="contents">
              {index > 0 && divider}
              {action}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (tab === 'group') {
    const actions = [
      canInviteToChallenge(challenge) && (
        <button
          key="link"
          type="button"
          className={`${btnClass} flex-1 ${copiedClass}`}
          onClick={handleCopy}
          disabled={copied}
        >
          {copied ? (
            'Скопировано!'
          ) : (
            <>
              <span className="lg:hidden">Скопировать ссылку</span>
              <span className="hidden lg:inline">Пригласить по ссылке</span>
            </>
          )}
        </button>
      ),
      canLeaveChallenge(challenge) && (
        <button key="leave" type="button" className={`${btnClass} flex-1`} onClick={() => onLeave?.(challengeId)}>
          Покинуть
        </button>
      ),
    ].filter(Boolean);

    if (actions.length === 0) return null;

    return (
      <div className="flex border-t border-neutral-border bg-neutral-card/80 rounded-b-3xl overflow-hidden">
        {actions.map((action, index) => (
          <span key={index} className="contents">
            {index > 0 && divider}
            {action}
          </span>
        ))}
      </div>
    );
  }

  if (tab === 'archive') {
    return (
      <div className="flex border-t border-neutral-border bg-neutral-card/80 rounded-b-3xl overflow-hidden">
        <button type="button" className={`${btnClass} flex-1`} onClick={() => onResume?.(challengeId)}>
          Возобновить
        </button>
        {challenge.isOwner && challenge.isPrivate && (
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
  const { challenge, tab, progressPercent, onOpen } = props;
  // Все варианты дат сейчас оранжевые (раньше тут был мёртвый тернарник с одинаковыми ветками)
  const dateVariant = 'orange';

  return (
    <article className="bg-white rounded-2xl sm:rounded-3xl shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => onOpen(challenge.id)}
        className="w-full text-left p-4 sm:p-6 hover:bg-neutral-card/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-neutral-text mb-3 truncate" title={challenge.title}>
              {challenge.title}
            </h3>
            {challenge.description && (
              <p className="lg:hidden text-sm text-neutral-muted line-clamp-2 -mt-1 mb-3">
                {challenge.description}
              </p>
            )}
          </div>
          {progressPercent !== undefined && tab !== 'archive' && (
            <ProgressRing percent={progressPercent} className="lg:hidden" />
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
          <Badge variant={dateVariant} icon={<Clock size={12} />}>
            {challenge.isUnlimited ? (
              <>
                <span className="lg:hidden">бессрочный</span>
                <span className="hidden lg:inline">{challenge.dateLabel}</span>
              </>
            ) : (
              challenge.dateLabel
            )}
          </Badge>
          <ChallengeScheduleBadge label={challenge.scheduleLabel} />
          <Badge variant="green">{formatParticipants(challenge.participantCount)}</Badge>
          {tab === 'group' && !challenge.isPrivate && (
            <Badge variant="green">Публичный</Badge>
          )}
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
