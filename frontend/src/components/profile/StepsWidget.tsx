import { useEffect, useState } from 'react';
import { Footprints, Loader2, RefreshCw, X, Maximize2 } from 'lucide-react';
import { stepsApi, type ApiStepsRange } from '../../api/stepsApi.ts';
import { withingsApi } from '../../api/withingsApi.ts';

const WEEKDAY_LABELS = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'];
const WEEKDAY_LABELS_SHORT_MONTH = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

interface StepsWidgetProps {
  data: ApiStepsRange | null;
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
}

function buildLastNDays(days: ApiStepsRange['days'], count: number) {
  const byDate = new Map(days.map((d) => [d.date, d.step_count]));
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - (count - 1 - i));
    const iso = date.toISOString().slice(0, 10);
    return {
      isoDate: iso,
      date,
      weekdayLabel: WEEKDAY_LABELS[date.getDay()],
      steps: byDate.get(iso) ?? 0,
    };
  });
}

/** "5 мин назад", "2 ч назад", "вчера в 14:03" и т.п. — без падежных форм,
 * чтобы не гадать со склонением числительных на все случаи. */
function formatLastSynced(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'обновлено только что';
  if (diffMin < 60) return `обновлено ${diffMin} мин назад`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `обновлено ${diffH} ч назад`;

  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const diffDays = Math.floor(diffH / 24);
  if (diffDays === 1) return `обновлено вчера в ${time}`;
  const day = date.getDate();
  const month = WEEKDAY_LABELS_SHORT_MONTH[date.getMonth()];
  return `обновлено ${day} ${month} в ${time}`;
}

function StepsBarChart({
  days,
  variant = 'compact',
}: {
  days: ReturnType<typeof buildLastNDays>;
  variant?: 'compact' | 'detailed';
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const maxSteps = Math.max(...days.map((d) => d.steps), 1);
  const isDetailed = variant === 'detailed';

  return (
    <div
      className={`flex items-end ${isDetailed ? 'gap-3' : 'gap-1.5 sm:gap-2 flex-1'} ${
        isDetailed ? 'min-h-[200px]' : 'min-h-[100px]'
      }`}
    >
      {days.map((day, index) => {
        const heightPercent = day.steps > 0 ? Math.max(10, (day.steps / maxSteps) * 100) : 4;
        const isHovered = hoveredIndex === index;
        return (
          <div
            key={day.isoDate}
            className={`${isDetailed ? 'w-9 shrink-0' : 'flex-1 min-w-0'} flex flex-col items-center justify-end gap-1.5 h-full`}
          >
            {!isDetailed && (
              <span className="text-[10px] text-neutral-muted font-semibold tabular-nums leading-tight text-center">
                {day.steps > 0 ? day.steps.toLocaleString('ru-RU') : '—'}
              </span>
            )}
            <div
              className={`relative w-full flex items-end justify-center ${
                isDetailed ? 'h-[140px]' : 'h-[80px] sm:h-[100px]'
              }`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {isHovered && (
                <div className="absolute -top-11 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-lg bg-neutral-text text-white text-xs font-semibold px-2.5 py-1.5 shadow-modal pointer-events-none">
                  {day.steps.toLocaleString('ru-RU')} шагов
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-text" />
                </div>
              )}
              <div
                className={`w-full rounded-t-xl transition-all cursor-default ${
                  isDetailed ? 'max-w-[1.75rem]' : 'max-w-[2.25rem]'
                } ${
                  day.steps > 0 ? 'bg-gradient-to-t from-brand to-brand/70' : 'bg-neutral-card'
                } ${isHovered ? 'brightness-110' : ''}`}
                style={{ height: `${heightPercent}%` }}
              />
            </div>
            {isDetailed ? (
              <div className="text-center leading-tight">
                <div className="text-[11px] text-neutral-text font-semibold">{day.date.getDate()}</div>
                <div className="text-[10px] text-neutral-muted">{day.weekdayLabel}</div>
              </div>
            ) : (
              <span className="text-[10px] sm:text-xs text-neutral-muted font-medium">
                {day.weekdayLabel}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepsHistoryModal({ onClose }: { onClose: () => void }) {
  const [range, setRange] = useState<ApiStepsRange | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    stepsApi
      .getRecent(30)
      .then(setRange)
      .catch(() => setRange(null))
      .finally(() => setIsLoading(false));
  }, []);

  const days30 = range ? buildLastNDays(range.days, 30) : [];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="absolute inset-0 flex items-center justify-center modal-safe-x py-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-2xl max-h-[90dvh] overflow-y-auto overflow-x-hidden bg-white rounded-3xl shadow-modal p-6 sm:p-8"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-neutral-text">Шаги за 30 дней</h2>
              <p className="text-xs text-neutral-muted mt-1">История по дням</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="p-2 rounded-xl text-neutral-muted hover:text-neutral-secondary hover:bg-neutral-card transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-neutral-muted text-center py-12">Загрузка…</p>
          ) : (
            <div className="overflow-x-auto pb-2">
              <StepsBarChart days={days30} variant="detailed" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function StepsWidget({ data, isLoading, onRefresh }: StepsWidgetProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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

  const last7 = buildLastNDays(data.days, 7);
  const todaySteps = last7[last7.length - 1].steps;

  return (
    <>
      <section className="bg-white rounded-3xl shadow-card p-5 sm:p-6 h-full min-h-[220px] flex flex-col">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-neutral-text">Шаги</h3>
            <p className="text-xs text-neutral-muted">За последние 7 дней</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsHistoryOpen(true)}
              title="Смотреть историю за 30 дней"
              className="p-1.5 rounded-lg text-neutral-muted hover:text-brand hover:bg-neutral-card transition-colors"
            >
              <Maximize2 size={16} />
            </button>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              title="Обновить шаги из Withings"
              className="p-1.5 rounded-lg text-neutral-muted hover:text-brand hover:bg-neutral-card transition-colors disabled:opacity-60"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <Footprints size={20} className="text-brand ml-1" />
          </div>
        </div>

        <p className="text-2xl sm:text-3xl font-extrabold text-brand mt-3 mb-1">
          {todaySteps.toLocaleString('ru-RU')}
        </p>
        <div className="flex items-center gap-1.5 mb-5">
          <p className="text-xs text-neutral-muted">шагов сегодня</p>
          {data.last_synced_at && (
            <>
              <span className="text-neutral-muted/50">·</span>
              <p className="text-[11px] text-neutral-muted/80">
                {formatLastSynced(data.last_synced_at)}
              </p>
            </>
          )}
        </div>

        <StepsBarChart days={last7} variant="compact" />
      </section>

      {isHistoryOpen && <StepsHistoryModal onClose={() => setIsHistoryOpen(false)} />}
    </>
  );
}
