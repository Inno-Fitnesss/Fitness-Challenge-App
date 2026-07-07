import type { ReactNode } from 'react';
import { CalendarDays, Clock } from 'lucide-react';
import type { ChallengeListItem, DiscoveryChallenge } from '../../types/challenge.ts';
import { formatParticipants } from '../../utils/challengeMappers.ts';

type BadgeTone = 'date' | 'schedule' | 'participants' | 'neutral';

const badgeToneClasses: Record<BadgeTone, string> = {
  date: 'bg-[#ffd8ce] text-brand',
  schedule: 'bg-[#ffe7c3] text-[#f59e0b]',
  participants: 'bg-lime-light text-lime-hover',
  neutral: 'bg-[#dedede] text-neutral-secondary',
};

export function MobileBadge({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium leading-none ${badgeToneClasses[tone]}`}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function MobileExerciseTag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[#dedede] px-2.5 py-1 text-[12px] font-medium leading-none text-neutral-secondary">
      {children}
    </span>
  );
}

export function MobileProgressBar({ value }: { value: number }) {
  const normalized = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-[#d9d9d9]" aria-hidden="true">
      <div className="h-full rounded-full bg-lime" style={{ width: `${normalized}%` }} />
    </div>
  );
}

export function MobileProgressRing({ value }: { value: number }) {
  const normalized = Math.max(0, Math.min(100, value));
  return (
    <div
      className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(#a3e635 ${normalized * 3.6}deg, #e4e4e4 0deg)`,
      }}
      role="img"
      aria-label={`Прогресс ${normalized}%`}
    >
      <div className="grid h-[46px] w-[46px] place-items-center rounded-full bg-white text-[16px] font-semibold text-lime-hover">
        {normalized}%
      </div>
    </div>
  );
}

function parseIsoDate(iso: string): Date | null {
  if (!iso) return null;
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function getChallengeDateProgress(challenge: ChallengeListItem): number {
  const start = parseIsoDate(challenge.startDate);
  const end = parseIsoDate(challenge.endDate);
  if (!start || !end) return 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const total = end.getTime() - start.getTime();
  if (total <= 0) return today >= end ? 100 : 0;

  const elapsed = today.getTime() - start.getTime();
  return Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
}

export function getChallengeDescription(
  challenge: Pick<ChallengeListItem | DiscoveryChallenge, 'description'>,
): string {
  return challenge.description.trim() || 'описание соревнования появится здесь';
}

export function MobileChallengeBadges({
  challenge,
}: {
  challenge: ChallengeListItem | DiscoveryChallenge;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <MobileBadge tone="date" icon={<Clock size={12} />}>
        {'dateLabel' in challenge
          ? challenge.dateLabel
          : challenge.isUnlimited
            ? 'бессрочный'
            : 'по датам'}
      </MobileBadge>
      <MobileBadge tone="schedule" icon={<CalendarDays size={12} />}>
        {challenge.scheduleLabel}
      </MobileBadge>
      <MobileBadge tone="participants">{formatParticipants(challenge.participantCount)}</MobileBadge>
    </div>
  );
}
