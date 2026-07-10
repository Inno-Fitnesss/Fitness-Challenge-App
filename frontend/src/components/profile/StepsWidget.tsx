import { useState } from 'react';
import { Footprints, Loader2, RefreshCw } from 'lucide-react';
import type { ApiStepsRange } from '../../api/stepsApi.ts';
import { withingsApi } from '../../api/withingsApi.ts';

const WEEKDAY_LABELS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];

interface StepsWidgetProps {
  data: ApiStepsRange | null;
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
}

export function StepsWidget({ data, isLoading, onRefresh }: StepsWidgetProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const url = await withingsApi.getAuthorizeUrl();
      window.location.href = url; // полный переход браузера — не fetch
    } catch {
      setIsConnecting(false);
    }
  };

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <section className="bg-white rounded-3xl shadow-card p-5 sm:p-6 h-full min-h-[220px] flex items-center justify-center">
        <p className="text-sm text-neutral-muted">Загрузка…</p>
      </section>
    );
  }

  if (!data || !data.connected) {
    return (
      <section className="bg-white rounded-3xl shadow-card p-5 sm:p-6 h-full min-h-[220px] flex flex-col items-center justify-center text-center gap-3">
        <Footprints size={28} className="text-neutral-muted mb-1" />
        <p className="text-sm font-semibold text-neutral-text">Шаги ещё не подключены</p>
        <p className="text-xs text-neutral-muted max-w-xs">
          Подключи Withings (бесплатное приложение, трекает шаги через сенсоры
          телефона — своё устройство не нужно) — шаги начнут появляться здесь
          автоматически.
        </p>
        <button
          type="button"
          onClick={() => void handleConnect()}
          disabled={isConnecting}
          className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-60"
        >
          {isConnecting && <Loader2 size={16} className="animate-spin" />}
          Подключить Withings
        </button>
      </section>
    );
  }

  const byDate = new Map(data.days.map((d) => [d.date, d.step_count]));
  const today = new Date();
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (6 - i));
    const iso = date.toISOString().slice(0, 10);
    return {
      isoDate: iso,
      weekdayLabel: WEEKDAY_LABELS[date.getDay()],
      steps: byDate.get(iso) ?? 0,
    };
  });

  const maxSteps = Math.max(...last7.map((d) => d.steps), 1);
  const todaySteps = last7[last7.length - 1].steps;

  return (
    <section className="bg-white rounded-3xl shadow-card p-5 sm:p-6 h-full min-h-[220px] flex flex-col">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-neutral-text">Шаги</h3>
          <p className="text-xs text-neutral-muted">За последние 7 дней</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isRefreshing}
            title="Обновить шаги из Withings"
            className="p-1.5 rounded-lg text-neutral-muted hover:text-brand hover:bg-neutral-card transition-colors disabled:opacity-60"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <Footprints size={20} className="text-brand" />
        </div>
      </div>

      <p className="text-2xl sm:text-3xl font-extrabold text-brand mt-3 mb-1">
        {todaySteps.toLocaleString('ru-RU')}
      </p>
      <p className="text-xs text-neutral-muted mb-5">шагов сегодня</p>

      <div className="flex-1 flex items-end gap-2 sm:gap-3 min-h-[100px]">
        {last7.map((day) => {
          const heightPercent = day.steps > 0 ? Math.max(12, (day.steps / maxSteps) * 100) : 6;
          return (
            <div
              key={day.isoDate}
              className="flex-1 min-w-0 flex flex-col items-center justify-end gap-2 h-full"
            >
              <div className="w-full flex items-end justify-center h-[80px] sm:h-[100px]">
                <div
                  className={`w-full max-w-[2.25rem] rounded-t-xl transition-all ${
                    day.steps > 0
                      ? 'bg-gradient-to-t from-brand to-brand/70'
                      : 'bg-neutral-card'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                  title={`${day.weekdayLabel}: ${day.steps} шагов`}
                />
              </div>
              <span className="text-[10px] sm:text-xs text-neutral-muted font-medium">
                {day.weekdayLabel}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
