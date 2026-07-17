import { useMemo } from 'react';
import { Calendar, Target, Users, Lock, Globe, TrendingUp, Zap } from 'lucide-react';
import { pluralizeRu } from '../utils/russianPlural.ts';
import type { ChallengeFormValues, Exercise } from '../types/challenge.ts';

interface ChallengePreviewProps {
  data: Partial<ChallengeFormValues>;
  exercises: Exercise[];
}

function formatDate(dateStr: string) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDurationDays(start: string, end: string) {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? days : null;
}

export function ChallengePreview({ data, exercises }: ChallengePreviewProps) {
  const totalReps = useMemo(() => exercises.reduce((sum, e) => sum + e.reps, 0), [exercises]);
  const durationDays = useMemo(() => getDurationDays(data.startDate ?? '', data.endDate ?? ''), [data.startDate, data.endDate]);
  const progressPercent = data.goal && totalReps > 0 ? Math.min(Math.round((totalReps / data.goal) * 100), 100) : 0;

  const hasContent = data.title || exercises.length > 0;

  return (
    <div className="bg-white rounded-3xl shadow-card border border-neutral-border overflow-hidden sticky top-6">
      <div className="h-1.5 bg-gradient-to-r from-brand via-accent to-success" />

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/60 text-xs font-semibold text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Предпросмотр
          </span>
          <span className="text-xs text-neutral-secondary font-medium">
            {data.privacy === 'private' ? (
              <span className="flex items-center gap-1"><Lock size={11} /> Индивидуальный</span>
            ) : (
              <span className="flex items-center gap-1"><Globe size={11} /> Групповой</span>
            )}
          </span>
        </div>

        {data.title ? (
          <h3 className="text-lg font-bold text-neutral-text leading-tight mb-2">{data.title}</h3>
        ) : (
          <div className="h-5 bg-neutral-card rounded-lg w-3/4 mb-2 animate-pulse" />
        )}

        {data.description ? (
          <p className="text-sm text-neutral-secondary leading-relaxed mb-4 line-clamp-3">{data.description}</p>
        ) : (
          <div className="space-y-1.5 mb-4">
            <div className="h-3 bg-neutral-card rounded w-full animate-pulse" />
            <div className="h-3 bg-neutral-card rounded w-4/5 animate-pulse" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <div className="flex flex-col gap-1 bg-neutral-card rounded-2xl p-3">
            <div className="flex items-center gap-1.5 text-neutral-secondary">
              <Calendar size={12} />
              <span className="text-[10px] font-medium uppercase tracking-wide">Начало</span>
            </div>
            <span className="text-xs font-semibold text-neutral-text">{formatDate(data.startDate ?? '')}</span>
          </div>

          <div className="flex flex-col gap-1 bg-neutral-card rounded-2xl p-3">
            <div className="flex items-center gap-1.5 text-neutral-secondary">
              <Calendar size={12} />
              <span className="text-[10px] font-medium uppercase tracking-wide">Конец</span>
            </div>
            <span className="text-xs font-semibold text-neutral-text">{formatDate(data.endDate ?? '')}</span>
          </div>

          <div className="flex flex-col gap-1 bg-accent/30 rounded-2xl p-3">
            <div className="flex items-center gap-1.5 text-amber-700">
              <Users size={12} />
              <span className="text-[10px] font-medium uppercase tracking-wide">Тип</span>
            </div>
            <span className="text-xs font-semibold text-neutral-text">
              {data.type === 'team' ? 'Командный' : 'Индивидуальный'}
            </span>
          </div>

          <div className="flex flex-col gap-1 bg-brand/5 rounded-2xl p-3">
            <div className="flex items-center gap-1.5 text-brand">
              <Target size={12} />
              <span className="text-[10px] font-medium uppercase tracking-wide">Цель</span>
            </div>
            <span className="text-xs font-semibold text-neutral-text">
              {data.goal ? `${data.goal.toLocaleString('ru')} повт.` : '—'}
            </span>
          </div>
        </div>

        {durationDays && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-success/40 rounded-xl">
            <Zap size={13} className="text-green-600" />
            <span className="text-xs font-semibold text-green-700">{durationDays} {pluralizeRu(durationDays, ['день', 'дня', 'дней'])}</span>
            <span className="text-xs text-neutral-secondary">продолжительность</span>
          </div>
        )}

        {data.goal && data.goal > 0 && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-neutral-secondary flex items-center gap-1">
                <TrendingUp size={11} /> Прогресс цели
              </span>
              <span className="text-xs font-bold text-brand">{progressPercent}%</span>
            </div>
            <div className="h-2 bg-neutral-card rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand to-accent rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-neutral-text uppercase tracking-wide">Упражнения</span>
            {exercises.length > 0 && (
              <span className="text-[10px] font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded-full">
                {exercises.length}
              </span>
            )}
          </div>

          {exercises.length === 0 ? (
            <div className="py-6 text-center">
              <div className="text-2xl mb-1">🏋️</div>
              <p className="text-xs text-neutral-secondary">Упражнения не добавлены</p>
            </div>
          ) : (
            <div className="space-y-2">
              {exercises.map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center gap-2.5 px-3 py-2 bg-neutral-card rounded-xl"
                >
                  <span className="text-base leading-none">{ex.icon}</span>
                  <span className="flex-1 text-xs font-medium text-neutral-text truncate">{ex.name}</span>
                  <span className="text-xs font-bold text-brand flex-shrink-0">{ex.reps}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {exercises.length > 0 && (
          <div className="mt-4 pt-4 border-t border-neutral-border flex items-center justify-between">
            <span className="text-xs text-neutral-secondary">Итого повторений</span>
            <span className="text-sm font-bold text-neutral-text">{totalReps.toLocaleString('ru')}</span>
          </div>
        )}

        {!hasContent && (
          <div className="mt-4 pt-4 border-t border-neutral-border text-center">
            <p className="text-xs text-neutral-secondary">Заполните форму, чтобы увидеть предпросмотр</p>
          </div>
        )}
      </div>
    </div>
  );
}
