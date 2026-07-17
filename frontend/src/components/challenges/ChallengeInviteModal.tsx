import { Clock, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '../ui/Badge.tsx';
import { Button } from '../ui/Button.tsx';
import { publicApi } from '../../api/publicApi.ts';
import { challengeApi } from '../../api/challengeApi.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import type { ApiPublicChallenge } from '../../types/api.types.ts';
import {
  formatDateLabel,
  formatParticipants,
  mapLeaderboard,
} from '../../utils/challengeMappers.ts';
import { formatScheduleLabel } from '../../utils/scheduleFormat.ts';
import { pluralizeRu } from '../../utils/russianPlural.ts';
import { parseApiError } from '../../utils/parseApiError.ts';
import { ChallengeScheduleBadge } from './ChallengeScheduleBadge.tsx';
import { LeaderboardList } from './LeaderboardList.tsx';
import type { AxiosError } from 'axios';

interface ChallengeInviteModalProps {
  joinCode: string;
  onClose: () => void;
  onJoined: (challengeId: number) => void;
}

function formatExerciseGoal(name: string, goal: number, metric: string): { name: string; goal: string } {
  if (metric === 'seconds') {
    if (goal >= 60 && goal % 60 === 0) {
      const mins = goal / 60;
      return {
        name,
        goal: `${mins} ${pluralizeRu(mins, ['минута', 'минуты', 'минут'])}`,
      };
    }
    return {
      name,
      goal: `${goal} ${pluralizeRu(goal, ['секунда', 'секунды', 'секунд'])}`,
    };
  }
  return {
    name,
    goal: `${goal} ${pluralizeRu(goal, ['повторение', 'повторения', 'повторений'])}`,
  };
}

export function ChallengeInviteModal({ joinCode, onClose, onJoined }: ChallengeInviteModalProps) {
  const { user } = useAuth();
  const [data, setData] = useState<ApiPublicChallenge | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedCode = joinCode.trim().toUpperCase();

  const loadInvite = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const publicChallenge = await publicApi.getChallengeByCode(normalizedCode);
      setData(publicChallenge);

      if (user) {
        try {
          const detail = await challengeApi.getDetail(publicChallenge.id);
          setIsJoined(detail.joined);
        } catch {
          setIsJoined(false);
        }
      } else {
        setIsJoined(false);
      }
    } catch (err) {
      setError(parseApiError(err as AxiosError).message ?? 'Приглашение не найдено');
    } finally {
      setIsLoading(false);
    }
  }, [normalizedCode, user]);

  useEffect(() => {
    void loadInvite();
  }, [loadInvite]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isJoining) onClose();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isJoining, onClose]);

  const leaderboard = useMemo(
    () => (data ? mapLeaderboard(data.leaderboard, user?.username) : []),
    [data, user?.username],
  );

  const handleJoin = async () => {
    if (!data || isJoining) return;
    setIsJoining(true);
    setError(null);
    try {
      const result = await publicApi.joinByCode(normalizedCode);
      setIsJoined(true);
      onJoined(result.challenge_id);
    } catch (err) {
      const apiErr = parseApiError(err as AxiosError);
      if (apiErr.message.includes('уже участвуете') || apiErr.status === 409) {
        setIsJoined(true);
        onJoined(data.id);
        return;
      }
      setError(apiErr.message);
    } finally {
      setIsJoining(false);
    }
  };

  const dateLabel = data ? formatDateLabel(data.start_date, data.end_date) : '';
  const scheduleLabel = data
    ? formatScheduleLabel(data.schedule_type, data.schedule_days)
    : '';

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
        aria-labelledby="invite-modal-title"
        className="absolute inset-x-0 top-0 h-[100dvh] flex items-end justify-center sm:items-center sm:p-6 pointer-events-none"
      >
      <div
        className="pointer-events-auto relative bg-white rounded-t-3xl sm:rounded-3xl shadow-modal w-full max-w-full sm:max-w-[900px] max-h-[92dvh] sm:max-h-[90vh] overflow-y-auto overflow-x-hidden animate-fade-in min-w-0 mx-auto"
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
            <p className="text-neutral-muted text-sm py-12 text-center">Загрузка приглашения…</p>
          )}

          {error && !data && !isLoading && (
            <p className="text-red-500 text-sm py-12 text-center" role="alert">
              {error}
            </p>
          )}

          {data && !isLoading && (
            <>
              <header className="mb-6 sm:mb-8 pr-10 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-3">
                  <h2
                    id="invite-modal-title"
                    className="text-xl sm:text-2xl font-extrabold text-neutral-text truncate min-w-0"
                    title={data.name}
                  >
                    {data.name}
                  </h2>
                  {!isJoined ? (
                    <Button
                      variant="lime"
                      size="sm"
                      className="w-full sm:w-auto flex-shrink-0"
                      onClick={() => void handleJoin()}
                      disabled={isJoining}
                    >
                      {isJoining ? 'Присоединяем…' : 'Присоединиться'}
                    </Button>
                  ) : (
                    <Button
                      variant="lime"
                      size="sm"
                      className="w-full sm:w-auto flex-shrink-0"
                      onClick={() => onJoined(data.id)}
                    >
                      Открыть челлендж
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="orange" icon={<Clock size={12} />}>
                    {dateLabel}
                  </Badge>
                  <ChallengeScheduleBadge label={scheduleLabel} />
                  <Badge variant="grey">{formatParticipants(data.participants)}</Badge>
                </div>

                {data.description && (
                  <p className="text-sm text-neutral-secondary whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {data.description}
                  </p>
                )}

                {error && (
                  <p className="mt-3 text-sm text-red-500" role="alert">
                    {error}
                  </p>
                )}
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                <section>
                  <h3 className="text-base font-bold text-neutral-text mb-2">Упражнения</h3>
                  {data.exercises.length === 0 ? (
                    <p className="text-sm text-neutral-muted">Нет упражнений</p>
                  ) : (
                    <div className="divide-y divide-neutral-border">
                      {data.exercises.map((exercise) => {
                        const formatted = formatExerciseGoal(
                          exercise.name,
                          exercise.goal,
                          exercise.metric,
                        );
                        return (
                          <div key={exercise.challenge_exercise_id} className="py-4 first:pt-0">
                            <p className="font-semibold text-neutral-text">{formatted.name}</p>
                            <p className="text-sm text-neutral-muted">{formatted.goal}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section>
                  <div className="flex items-baseline justify-between gap-2 mb-4">
                    <h3 className="text-base font-bold text-neutral-text">Таблица лидеров</h3>
                    <span className="text-xs text-brand font-medium">регулярность</span>
                  </div>
                  <LeaderboardList entries={leaderboard} />
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
