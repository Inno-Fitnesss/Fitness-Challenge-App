import type { LeaderboardEntry } from '../../types/challenge.ts';
import { pluralizeRu } from '../../utils/russianPlural.ts';

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const medalColors: Record<number, string> = {
    1: 'text-amber-500',
    2: 'text-neutral-muted',
    3: 'text-amber-700',
  };

  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-2xl ${
        entry.isCurrentUser ? 'bg-brand-light' : ''
      }`}
    >
      <span
        className={`text-base sm:text-lg font-bold w-5 sm:w-6 text-center flex-shrink-0 ${
          medalColors[entry.rank] ?? 'text-neutral-muted'
        }`}
      >
        {entry.rank}
      </span>
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex-shrink-0 ${entry.avatarColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-text truncate">{entry.username}</p>
        <p className="text-xs text-neutral-muted flex items-center gap-1">
          🔥 Глобальный стрик: {entry.globalStreakDays} {pluralizeRu(entry.globalStreakDays, ['день', 'дня', 'дней'])}
        </p>
      </div>
      <div className="w-16 sm:w-24 flex-shrink-0 text-right">
        <span className="text-sm font-semibold text-neutral-text">
          {entry.challengeStreakDays} {pluralizeRu(entry.challengeStreakDays, ['день', 'дня', 'дней'])}
        </span>
      </div>
    </div>
  );
}

interface LeaderboardListProps {
  entries: LeaderboardEntry[];
  emptyMessage?: string;
  maxVisibleRows?: number;
}

export function LeaderboardList({
  entries,
  emptyMessage = 'Пока нет участников',
  maxVisibleRows = 5,
}: LeaderboardListProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-neutral-muted">{emptyMessage}</p>;
  }

  const rowHeightRem = 3.75;
  const maxHeight = `${maxVisibleRows * rowHeightRem}rem`;

  return (
    <div
      className="overflow-y-auto overflow-x-hidden pr-1 -mr-1 space-y-1 [scrollbar-width:thin]"
      style={{ maxHeight }}
      aria-label="Лидерборд"
    >
      {entries.map((entry) => (
        <LeaderboardRow key={`${entry.rank}-${entry.username}`} entry={entry} />
      ))}
    </div>
  );
}
