import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';
import { ProgressBar } from '../ui/ProgressBar.tsx';
import { useCopyFeedback } from '../../hooks/useCopyFeedback.ts';
import { fetchChallengeModalData } from '../../api/challengeQueries.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import type { ChallengeModalData, ExerciseProgress } from '../../types/challenge.ts';
import { formatParticipants } from '../../utils/challengeMappers.ts';
import { pluralizeRu } from '../../utils/russianPlural.ts';
import {
  buildExerciseSessionPath,
  type ExerciseReturnTarget,
} from '../../utils/exerciseNavigation.ts';
import { ChallengeScheduleBadge } from './ChallengeScheduleBadge.tsx';
import { LeaderboardList } from './LeaderboardList.tsx';
import {
  canEditChallenge,
  canInviteToChallenge,
  canLeaveChallenge,
  canPublishChallenge,
} from '../../utils/challengePermissions.ts';

interface ChallengeDetailModalProps {
  challengeId: number;
  onClose: () => void;
  onResume?: (challengeId: number) => void;
  onEdit?: (challengeId: number) => void;
  onPublish?: (challengeId: number) => void;
  onCopyLink?: () => void;
  onLeave?: (challengeId: number) => void;
  returnTarget?: ExerciseReturnTarget;
}

interface ExerciseItemProps {
  exercise: ExerciseProgress;
  challengeId: number;
  isArchived: boolean;
  returnTarget: ExerciseReturnTarget;
  onStart: () => void;
}

function formatGoal(exercise: ExerciseProgress): string {
  if (exercise.unit === 'minutes') {
    return `${exercise.goal} ${pluralizeRu(exercise.goal, ['минута', 'минуты', 'минут'])}`;
  }
  return `${exercise.goal} ${pluralizeRu(exercise.goal, ['повторение', 'повторения', 'повторений'])}`;
}

function formatStatus(exercise: ExerciseProgress): string {
  if (exercise.status === 'completed') {
    return `Выполнено ${exercise.completed} / ${exercise.goal}`;
  }
  return 'Не начато';
}

function ExerciseItem({ exercise, challengeId, isArchived, returnTarget, onStart }: ExerciseItemProps) {
  const navigate = useNavigate();
  const isCompleted = exercise.status === 'completed';
  const percent = exercise.goal > 0 ? (exercise.completed / exercise.goal) * 100 : 0;

  const handleStart = () => {
    if (isArchived) return;
    onStart();
    navigate(buildExerciseSessionPath(challengeId, exercise.exerciseId, returnTarget));
  };

  return (
    <div className="py-4 border-b border-neutral-border last:border-0">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
        <div className="min-w-0">
          <h4 className="font-semibold text-neutral-text">{exercise.name}</h4>
          <p className="text-sm text-neutral-muted">{formatGoal(exercise)}</p>
        </div>
        <Button
          variant={isCompleted ? 'lime' : 'primary'}
          size="sm"
          className={`w-full sm:w-auto flex-shrink-0 ${isCompleted && !isArchived ? 'opacity-90' : ''}`}
          onClick={handleStart}
          disabled={isArchived}
          title={isArchived ? 'Сначала возобновите челлендж из архива' : undefined}
        >
          {isArchived ? 'Недоступно' : isCompleted ? 'Повторить' : 'Начать'}
        </Button>
      </div>
      <ProgressBar value={percent} color={isCompleted ? 'orange' : 'grey'} className="mb-1.5" />
      <p className={`text-xs ${isCompleted ? 'text-lime-hover' : 'text-neutral-muted'}`}>
        {isArchived
          ? 'Выполнение недоступно — челлендж в архиве'
          : formatStatus(exercise)}
      </p>
    </div>
  );
}

export function ChallengeDetailModal({
  challengeId,
  onClose,
  onResume,
  onEdit,
  onPublish,
  onCopyLink,
  onLeave,
  returnTarget = { type: 'challenge', challengeId },
}: ChallengeDetailModalProps) {
  const { user } = useAuth();
  const [data, setData] = useState<ChallengeModalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { copied: linkCopied, markCopied: markLinkCopied } = useCopyFeedback();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchChallengeModalData(challengeId, user?.username)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: { message?: string }) => {
        if (!cancelled) setError(err.message ?? 'Не удалось загрузить челлендж');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [challengeId, user?.username]);

  const challenge = data?.challenge;
  const isArchived = challenge?.status === 'archived';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="challenge-modal-title"
        className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-6 pointer-events-none"
      >
      <div
        className="pointer-events-auto relative bg-white rounded-t-3xl sm:rounded-3xl shadow-modal w-full max-w-full sm:max-w-[900px] max-h-[min(92dvh,100%)] sm:max-h-[90vh] overflow-y-auto overflow-x-hidden animate-fade-in min-w-0 mx-auto"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute top-4 right-4 sm:top-5 sm:right-5 p-2 rounded-xl text-neutral-muted hover:text-neutral-text hover:bg-neutral-card transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="p-4 sm:p-8 pt-5 min-w-0 modal-safe-x sm:px-8">
          {isLoading && (
            <p className="text-neutral-muted text-sm py-12 text-center">Загрузка...</p>
          )}

          {error && (
            <p className="text-red-500 text-sm py-12 text-center" role="alert">{error}</p>
          )}

          {challenge && data && !isLoading && !error && (
            <>
              <header className="mb-6 sm:mb-8 pr-10 min-w-0">
                <h2 id="challenge-modal-title" className="text-xl sm:text-2xl font-extrabold text-neutral-text mb-3 truncate" title={challenge.title}>
                  {challenge.title}
                </h2>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="orange" icon={<Clock size={12} />}>
                    {challenge.dateLabel}
                  </Badge>
                  <ChallengeScheduleBadge label={challenge.scheduleLabel} />
                  <Badge variant="grey">{formatParticipants(challenge.participantCount)}</Badge>
                  {challenge.isOwner && !challenge.isPrivate && !isArchived && (
                    <Badge variant="green">Публичный</Badge>
                  )}
                  {isArchived && <Badge variant="grey">В архиве</Badge>}
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {canEditChallenge(challenge) && onEdit && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full sm:w-auto flex-shrink-0"
                      onClick={() => onEdit(challengeId)}
                    >
                      Редактировать
                    </Button>
                  )}
                  {canPublishChallenge(challenge) && onPublish && (
                    <Button
                      variant="lime"
                      size="sm"
                      className="w-full sm:w-auto flex-shrink-0"
                      onClick={() => onPublish(challengeId)}
                    >
                      Сделать публичным
                    </Button>
                  )}
                  {canInviteToChallenge(challenge) && onCopyLink && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full sm:w-auto flex-shrink-0"
                      onClick={() => {
                        markLinkCopied();
                        onCopyLink?.();
                      }}
                      disabled={linkCopied}
                    >
                      {linkCopied ? 'Скопировано!' : 'Пригласить по ссылке'}
                    </Button>
                  )}
                  {canLeaveChallenge(challenge) && onLeave && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full sm:w-auto flex-shrink-0"
                      onClick={() => onLeave(challengeId)}
                    >
                      Покинуть
                    </Button>
                  )}
                </div>
                {challenge.isOwner && !challenge.isPrivate && !isArchived && (
                  <p className="text-xs text-neutral-muted mt-3">
                    Публичный челлендж нельзя редактировать. Вы можете приглашать участников по ссылке.
                  </p>
                )}
                {isArchived && (
                  <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <p className="text-sm text-amber-900">
                      Челлендж в архиве. Возобновите его, чтобы снова начать выполнение упражнений.
                    </p>
                    {onResume && (
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full sm:w-auto flex-shrink-0"
                        onClick={() => onResume(challengeId)}
                      >
                        Возобновить
                      </Button>
                    )}
                  </div>
                )}
                {challenge.description && (
                  <p className="text-sm text-neutral-secondary whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {challenge.description}
                  </p>
                )}
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                <section>
                  <h3 className="text-base font-bold text-neutral-text mb-2">Упражнения</h3>
                  {data.exercises.length === 0 ? (
                    <p className="text-sm text-neutral-muted">Нет упражнений</p>
                  ) : (
                    data.exercises.map((exercise) => (
                      <ExerciseItem
                        key={exercise.exerciseId}
                        exercise={exercise}
                        challengeId={challengeId}
                        isArchived={isArchived}
                        returnTarget={returnTarget}
                        onStart={onClose}
                      />
                    ))
                  )}
                </section>

                <section>
                  <h3 className="text-base font-bold text-neutral-text mb-1">Лидерборд</h3>
                  <p className="text-xs text-neutral-muted mb-4">сортировка по регулярности</p>
                  <LeaderboardList entries={data.leaderboard} />
                </section>
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
