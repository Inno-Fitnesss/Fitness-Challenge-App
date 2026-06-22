import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/ProgressBar';
import { fetchChallengeModalData } from '../../api/challengeQueries';
import { useAuth } from '../../context/AuthContext';
import type { ChallengeModalData, ExerciseProgress, LeaderboardEntry } from '../../types/challenge';

interface ChallengeDetailModalProps {
  challengeId: number;
  onClose: () => void;
}

function formatGoal(exercise: ExerciseProgress): string {
  if (exercise.unit === 'minutes') {
    return `${exercise.goal} ${exercise.goal === 1 ? 'минута' : exercise.goal < 5 ? 'минуты' : 'минут'}`;
  }
  return `${exercise.goal} повторений`;
}

function formatStatus(exercise: ExerciseProgress): string {
  if (exercise.status === 'completed') {
    return `Выполнено ${exercise.completed} / ${exercise.goal}`;
  }
  if (exercise.status === 'in_progress') {
    return `Выполнено ${exercise.completed} / ${exercise.goal}`;
  }
  return 'Не начато';
}

function ExerciseItem({ exercise }: { exercise: ExerciseProgress }) {
  const isCompleted = exercise.status === 'completed';
  const percent = exercise.goal > 0 ? (exercise.completed / exercise.goal) * 100 : 0;

  return (
    <div className="py-4 border-b border-neutral-border last:border-0">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h4 className="font-semibold text-neutral-text">{exercise.name}</h4>
          <p className="text-sm text-neutral-muted">{formatGoal(exercise)}</p>
        </div>
        <Button
          variant={isCompleted ? 'lime' : 'primary'}
          size="sm"
          className={isCompleted ? 'pointer-events-none opacity-90' : ''}
        >
          {isCompleted ? 'Выполнено' : 'Начать'}
        </Button>
      </div>
      <ProgressBar value={percent} color={isCompleted ? 'orange' : 'grey'} className="mb-1.5" />
      <p className={`text-xs ${isCompleted ? 'text-lime-hover' : 'text-neutral-muted'}`}>
        {formatStatus(exercise)}
      </p>
    </div>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const medalColors: Record<number, string> = {
    1: 'text-amber-500',
    2: 'text-neutral-muted',
    3: 'text-amber-700',
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-2xl ${
        entry.isCurrentUser ? 'bg-brand-light' : ''
      }`}
    >
      <span className={`text-lg font-bold w-6 text-center ${medalColors[entry.rank] ?? 'text-neutral-muted'}`}>
        {entry.rank}
      </span>
      <div className={`w-9 h-9 rounded-full flex-shrink-0 ${entry.avatarColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-text truncate">{entry.username}</p>
        <p className="text-xs text-neutral-muted flex items-center gap-1">
          🔥 {entry.streakDays} {entry.streakDays === 1 ? 'день' : entry.streakDays < 5 ? 'дня' : 'дней'}
        </p>
      </div>
      <div className="w-24 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-neutral-muted">{entry.progressPercent}%</span>
        </div>
        <ProgressBar value={entry.progressPercent} color="orange" />
      </div>
    </div>
  );
}

export function ChallengeDetailModal({ challengeId, onClose }: ChallengeDetailModalProps) {
  const { user } = useAuth();
  const [data, setData] = useState<ChallengeModalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
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
        className="relative bg-white rounded-3xl shadow-modal w-full max-w-[900px] max-h-[90vh] overflow-y-auto animate-scale-in"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="absolute top-5 right-5 p-2 rounded-xl text-neutral-muted hover:text-neutral-text hover:bg-neutral-card transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="p-8">
          {isLoading && (
            <p className="text-neutral-muted text-sm py-12 text-center">Загрузка...</p>
          )}

          {error && (
            <p className="text-red-500 text-sm py-12 text-center" role="alert">{error}</p>
          )}

          {challenge && data && !isLoading && !error && (
            <>
              <header className="mb-8 pr-10">
                <h2 id="challenge-modal-title" className="text-2xl font-extrabold text-neutral-text mb-3">
                  {challenge.title}
                </h2>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Badge variant="orange" icon={<Clock size={12} />}>
                    {challenge.dateLabel}
                  </Badge>
                  <Badge variant="grey">{challenge.participantCount} участника</Badge>
                </div>
                {challenge.description && (
                  <p className="text-sm text-neutral-secondary">{challenge.description}</p>
                )}
              </header>

              <div className="grid grid-cols-2 gap-8">
                <section>
                  <h3 className="text-base font-bold text-neutral-text mb-2">Упражнения</h3>
                  {data.exercises.length === 0 ? (
                    <p className="text-sm text-neutral-muted">Нет упражнений</p>
                  ) : (
                    data.exercises.map((exercise) => (
                      <ExerciseItem key={exercise.exerciseId} exercise={exercise} />
                    ))
                  )}
                </section>

                <section>
                  <h3 className="text-base font-bold text-neutral-text mb-1">Лидерборд</h3>
                  <p className="text-xs text-neutral-muted mb-4">сортировка по регулярности</p>
                  {data.leaderboard.length === 0 ? (
                    <p className="text-sm text-neutral-muted">Пока нет участников</p>
                  ) : (
                    <div className="space-y-1">
                      {data.leaderboard.map((entry) => (
                        <LeaderboardRow key={`${entry.rank}-${entry.username}`} entry={entry} />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
