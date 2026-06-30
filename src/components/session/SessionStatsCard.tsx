import { Flame } from 'lucide-react';
import { ProgressBar } from '../ui/ProgressBar.tsx';
import type { CvSessionStats, ExerciseMetric } from '../../types/session.types.ts';

interface SessionStatsCardProps {
  exerciseName: string;
  metric: ExerciseMetric;
  goal: number;
  completedToday: number;
  stats: CvSessionStats;
  isRunning: boolean;
  onShowTechnique?: () => void;
}

function formatDuration(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function SessionStatsCard({
  exerciseName,
  metric,
  goal,
  completedToday,
  stats,
  isRunning,
  onShowTechnique,
}: SessionStatsCardProps) {
  const isTimed = metric === 'seconds';
  const sessionGoalMet = isTimed
    ? stats.elapsedSeconds >= goal
    : stats.cleanReps >= goal;
  const sessionProgress = isTimed
    ? Math.min(100, (stats.elapsedSeconds / goal) * 100)
    : Math.min(100, (stats.cleanReps / goal) * 100);

  const mainValue = isTimed ? stats.elapsedSeconds : stats.cleanReps;
  const mainSuffix = isTimed ? 'сек' : '';

  const creditedSessionValue = sessionGoalMet
    ? isTimed
      ? stats.elapsedSeconds
      : stats.cleanReps
    : 0;
  const totalProgress = Math.min(
    100,
    ((completedToday + creditedSessionValue) / goal) * 100,
  );

  return (
    <section className="bg-white rounded-3xl shadow-card border border-neutral-border/60 p-5 sm:p-6">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-muted mb-1">
          Сейчас выполняете
        </p>
        <h2 className="text-lg font-extrabold text-neutral-text">{exerciseName}</h2>
      </div>

      {onShowTechnique && (
        <button
          type="button"
          onClick={onShowTechnique}
          className="w-full mb-5 px-4 py-2.5 rounded-2xl bg-lime text-neutral-text text-sm font-semibold hover:bg-lime-hover transition-colors"
        >
          Техника выполнения
        </button>
      )}

      <div className="rounded-2xl bg-neutral-card p-4 mb-5 text-center">
        <div className="flex items-center justify-center gap-2 text-brand mb-2">
          <Flame size={18} />
          <span className="text-xs font-semibold text-neutral-secondary">
            {isTimed ? 'Время' : 'Повторений'}
          </span>
        </div>
        <p className="text-3xl sm:text-4xl font-extrabold text-neutral-text tabular-nums">
          {isTimed ? formatDuration(mainValue) : `${mainValue} / ${goal}`}
          {mainSuffix && (
            <span className="text-lg font-bold text-neutral-muted ml-1">{mainSuffix}</span>
          )}
        </p>
        {!isTimed && (
          <p className="text-xs text-neutral-muted mt-1">
            Всего в сессии: {stats.reps}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-neutral-secondary">Прогресс сессии</span>
            <span className="text-xs font-bold text-brand tabular-nums">{Math.round(sessionProgress)}%</span>
          </div>
          <ProgressBar value={sessionProgress} color="orange" />
          <p className="text-xs text-neutral-muted mt-1.5">
            Цель: {isTimed ? formatDuration(goal) : `${goal} повторений`}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-neutral-secondary">Качество формы</span>
            <span className="text-xs font-bold text-lime-hover tabular-nums">{stats.formQuality}%</span>
          </div>
          <ProgressBar value={stats.formQuality} color="lime" />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-neutral-secondary">План на сегодня</span>
            <span className="text-xs font-bold text-neutral-text tabular-nums">
              {Math.round(totalProgress)}%
            </span>
          </div>
          <ProgressBar value={totalProgress} color="grey" />
        </div>
      </div>

      <p className="mt-4 text-xs text-neutral-muted text-center">
        {isRunning ? 'Сессия идёт' : 'Нажмите «Начать», чтобы запустить подсчёт'}
      </p>
    </section>
  );
}
