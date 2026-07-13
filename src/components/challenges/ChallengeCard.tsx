import { Clock, Globe, Trash2 } from 'lucide-react';
import { Badge } from '../ui/Badge.tsx';
import { ChallengeScheduleBadge } from './ChallengeScheduleBadge.tsx';
import type { ChallengeListItem, ChallengeTab } from '../../types/challenge.ts';
import { formatParticipants } from '../../utils/challengeMappers.ts';
import { CircularProgress } from '../ui/CircularProgress.tsx';
import { useCopyFeedback } from '../../hooks/useCopyFeedback.ts';
import {
  canArchiveChallenge,
  canDeleteChallenge,
  canInviteToChallenge,
  canLeaveChallenge,
  canPublishChallenge,
} from '../../utils/challengePermissions.ts';

interface ChallengeCardProps {
  challenge: ChallengeListItem;
  tab: ChallengeTab;
  /** Daily progress 0–100 when the challenge is scheduled for today; omit on archive/off-days. */
  todayProgressPercent?: number;
  onOpen: (id: number) => void;
  onCopyLink?: (id: number) => void;
  onPublish?: (id: number) => void;
  onArchive?: (id: number) => void;
  onDelete?: (id: number) => void;
  onLeave?: (id: number) => void;
  onResume?: (id: number) => void;
}

function ActionBar({
  challenge,
  tab,
  onCopyLink,
  onPublish,
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

  const divider = <span className="w-px h-6 bg-neutral-border self-center flex-shrink-0" />;

  if (tab === 'individual') {
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

    if (actions.length === 0) return null;

    return (
      <div className="border-t border-neutral-border bg-neutral-card/80 rounded-b-3xl overflow-x-auto">
        <div className="flex items-center min-w-max sm:min-w-0 sm:w-full">
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
          {copied ? 'Скопировано!' : 'Пригласить по ссылке'}
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
  const { challenge, tab, todayProgressPercent, onOpen } = props;
  const dateVariant = challenge.isUnlimited || tab === 'archive' ? 'orange' : 'orange';
  const showTodayProgress = tab !== 'archive' && todayProgressPercent != null;

  return (
    <article className="bg-white rounded-2xl sm:rounded-3xl shadow-card overflow-hidden">
      <div className="relative">
        <button
          type="button"
          onClick={() => onOpen(challenge.id)}
          className={`w-full text-left p-4 sm:p-6 hover:bg-neutral-card/30 transition-colors ${
            showTodayProgress ? 'pr-32 sm:pr-36' : ''
          }`}
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

        {showTodayProgress && (
          <div
            className="absolute right-24 sm:right-28 top-8 sm:top-10 pointer-events-none"
            aria-hidden="true"
          >
            <CircularProgress value={todayProgressPercent} size={84} strokeWidth={6} />
          </div>
        )}
      </div>

      <ActionBar {...props} />
    </article>
  );
}
