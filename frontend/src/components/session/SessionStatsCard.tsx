import { Flame, Target, Timer, TrendingUp } from 'lucide-react';
import { ProgressBar } from '../ui/ProgressBar.tsx';
import type { CvSessionStats, ExerciseMetric } from '../../types/session.types.ts';

interface SessionStatsCardProps {
  exerciseName: string;
  metric: ExerciseMetric;
  goal: number;
  completedToday: number;
  stats: CvSessionStats;
  isRunning: boolean;
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
}: SessionStatsCardProps) {
  const isTimed = metric === 'seconds';
  const sessionProgress = isTimed
    ? Math.min(100, (stats.elapsedSeconds / goal) * 100)
    : Math.min(100, (stats.cleanReps / goal) * 100);

  const mainValue = isTimed
    ? formatDuration(stats.elapsedSeconds)
    : String(stats.cleanReps);

  const mainLabel = isTimed ? 'Время' : 'Чистые повторения';
  const secondaryValue = isTimed
    ? formatDuration(Math.max(0, goal - stats.elapsedSeconds))
    : String(stats.reps);
  const secondaryLabel = isTimed ? 'Осталось' : 'Всего повторений';

  const totalProgress = isTimed
    ? Math.min(100, ((completedToday + stats.elapsedSeconds) / goal) * 100)
    : Math.min(100, ((completedToday + stats.cleanReps) / goal) * 100);

  return (
    <section className="bg-white rounded-3xl shadow-card border border-neutral-border/60 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-muted mb-1">
            Сейчас выполняете
          </p>
          <h2 className="text-lg font-extrabold text-neutral-text">{exerciseName}</h2>
        </div>
        <div
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold ${
            isRunning ? 'bg-brand-light text-brand' : 'bg-neutral-card text-neutral-muted'
          }`}
        >
          {isRunning ? 'Идёт сессия' : 'Пауза'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-2xl bg-gradient-to-br from-brand-light to-white p-4 border border-brand/10">
          <div className="flex items-center gap-2 text-brand mb-2">
            {isTimed ? <Timer size={16} /> : <Target size={16} />}
            <span className="text-xs font-semibold">{mainLabel}</span>
          </div>
          <p className="text-3xl sm:text-4xl font-extrabold text-neutral-text tabular-nums">
            {mainValue}
          </p>
        </div>

        <div className="rounded-2xl bg-neutral-card p-4">
          <div className="flex items-center gap-2 text-neutral-secondary mb-2">
            {isTimed ? <TrendingUp size={16} /> : <Flame size={16} />}
            <span className="text-xs font-semibold">{secondaryLabel}</span>
          </div>
          <p className="text-3xl sm:text-4xl font-extrabold text-neutral-text tabular-nums">
            {secondaryValue}
          </p>
        </div>
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
    </section>
  );
}
