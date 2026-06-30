import type { DailyChallengeActivity } from '../../utils/profileActivityChart.ts';

interface ProfileActivityChartProps {
  data: DailyChallengeActivity[];
  isLoading?: boolean;
}

export function ProfileActivityChart({ data, isLoading }: ProfileActivityChartProps) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);

  return (
    <section className="bg-white rounded-3xl shadow-card p-5 sm:p-6 h-full min-h-[220px] flex flex-col">
      <h3 className="text-sm sm:text-base font-bold text-neutral-text mb-1">
        Активность за 7 дней
      </h3>
      <p className="text-xs text-neutral-muted mb-5">Выполненные челленджи по дням</p>

      {isLoading ? (
        <p className="text-sm text-neutral-muted flex-1 flex items-center justify-center">Загрузка…</p>
      ) : (
        <div className="flex-1 flex items-end gap-2 sm:gap-3 min-h-[140px]">
          {data.map((item) => {
            const heightPercent = item.count > 0 ? Math.max(12, (item.count / maxCount) * 100) : 6;
            return (
              <div
                key={item.isoDate}
                className="flex-1 min-w-0 flex flex-col items-center justify-end gap-2 h-full"
              >
                <span className="text-[10px] sm:text-xs font-semibold text-brand tabular-nums">
                  {item.count > 0 ? item.count : ''}
                </span>
                <div className="w-full flex items-end justify-center h-[100px] sm:h-[120px]">
                  <div
                    className={`w-full max-w-[2.25rem] rounded-t-xl transition-all ${
                      item.count > 0
                        ? 'bg-gradient-to-t from-brand to-brand/70'
                        : 'bg-neutral-card'
                    }`}
                    style={{ height: `${heightPercent}%` }}
                    title={`${item.weekdayLabel}: ${item.count}`}
                  />
                </div>
                <span className="text-[10px] sm:text-xs text-neutral-muted font-medium">
                  {item.weekdayLabel}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
