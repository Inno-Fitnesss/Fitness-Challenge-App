import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { ChallengeDetailModal } from '../../components/challenges/ChallengeDetailModal.tsx';
import { ChallengeFormModal } from '../../components/challenges/ChallengeFormModal.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import { fetchChallengeListItems, fetchTodayPlan } from '../../api/challengeQueries.ts';
import { challengeApi, meApi } from '../../api/challengeApi.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import type { ApiTodayChallenge } from '../../types/api.types.ts';
import type { ChallengeListItem, TodayPlanItem } from '../../types/challenge.ts';
import type { CalendarDay } from '../../utils/dashboardCalendar.ts';
import {
  buildWeekDays,
  formatWeekRangeLabel,
  getWeekEnd,
  getWeekStart,
  isCurrentWeek,
  toIsoDate,
} from '../../utils/dashboardCalendar.ts';
import {
  getChallengeDescription,
  MobileChallengeBadges,
  MobileExerciseTag,
  MobileProgressBar,
} from '../components/MobileChallengeParts.tsx';
import { parseApiError } from '../../utils/parseApiError.ts';
import type { AxiosError } from 'axios';
import { canEditChallenge } from '../../utils/challengePermissions.ts';
import { buildChallengeInviteUrl } from '../../utils/inviteUrl.ts';

type ConfirmState = {
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  action: () => Promise<void>;
} | null;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

function getDisplayName(username?: string, email?: string): string {
  if (username) return username;
  if (email) return email.split('@')[0];
  return 'runner';
}

function dayClass(day: CalendarDay): string {
  const base =
    'mx-auto grid h-[35px] w-[35px] place-items-center rounded-full text-[14px] font-medium transition-colors';

  if (day.status === 'full') return `${base} bg-brand text-white`;
  if (day.status === 'partial' || day.status === 'pending') return `${base} bg-[#f8efe2] text-brand`;
  if (day.status === 'missed') return `${base} bg-neutral-border text-neutral-muted`;
  if (day.isToday) return `${base} bg-brand-light text-brand`;
  return `${base} bg-[#f8f4ed] text-neutral-text`;
}

function MobileWeekCard({
  days,
  weekLabel,
  isCurrentWeekVisible,
  isLoading,
  onPrev,
  onNext,
  onToday,
}: {
  days: CalendarDay[];
  weekLabel: string;
  isCurrentWeekVisible: boolean;
  isLoading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  return (
    <section className="rounded-[14px] bg-white px-3 pb-4 pt-3">
      <div className="mb-3 grid grid-cols-[32px_1fr_32px] items-center">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Предыдущая неделя"
          className="grid h-8 w-8 place-items-center rounded-full text-neutral-text"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="text-[16px] font-medium text-neutral-text">{weekLabel}</p>
          {!isCurrentWeekVisible && (
            <button
              type="button"
              onClick={onToday}
              className="text-[11px] font-semibold text-brand"
            >
              текущая неделя
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onNext}
          aria-label="Следующая неделя"
          className="grid h-8 w-8 place-items-center rounded-full text-neutral-text"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div className={`grid grid-cols-7 gap-1 ${isLoading ? 'opacity-60' : ''}`}>
        {days.map((day) => (
          <div key={day.isoDate} className="text-center">
            <p className="mb-1 text-[13px] font-medium uppercase text-neutral-secondary">
              {day.weekdayLabel}
            </p>
            <span className={dayClass(day)}>
              {day.status === 'full' ? <Check size={17} strokeWidth={3} /> : day.day}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function MobilePlanCard({ item, onOpen }: { item: TodayPlanItem; onOpen: () => void }) {
  const { challenge, progressPercent, isCompleted } = item;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full rounded-[14px] p-4 text-left shadow-card ${
        isCompleted ? 'bg-lime-light' : 'bg-white'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-semibold text-[#15133d]">{challenge.title}</h3>
          <p className="mt-0.5 max-h-[38px] overflow-hidden text-[12px] font-medium leading-[1.25] text-neutral-muted">
            {getChallengeDescription(challenge)}
          </p>
        </div>
        {isCompleted && (
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] bg-lime text-neutral-text">
            <Check size={28} strokeWidth={3.5} />
          </span>
        )}
      </div>

      <div className="mb-2">
        <MobileChallengeBadges challenge={challenge} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {challenge.exerciseTags.map((tag) => (
          <MobileExerciseTag key={tag}>{tag}</MobileExerciseTag>
        ))}
      </div>

      <MobileProgressBar value={progressPercent} />
    </button>
  );
}

export function MobileHomePage() {
  const { user, refreshProfile } = useAuth();
  const displayName = getDisplayName(user?.username, user?.email);
  const [selectedChallengeId, setSelectedChallengeId] = useState<number | null>(null);
  const [editChallengeId, setEditChallengeId] = useState<number | null>(null);
  const [todayPlan, setTodayPlan] = useState<TodayPlanItem[]>([]);
  const [activeChallenges, setActiveChallenges] = useState<ChallengeListItem[]>([]);
  const [todayChallenges, setTodayChallenges] = useState<ApiTodayChallenge[]>([]);
  const [completedDates, setCompletedDates] = useState<string[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [isWeekLoading, setIsWeekLoading] = useState(false);
  const [streakDays, setStreakDays] = useState(user?.streakCurrent ?? 0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  };

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await refreshProfile();
      const [items, active, todayRaw] = await Promise.all([
        fetchTodayPlan(),
        fetchChallengeListItems('active'),
        meApi.getToday(),
      ]);
      setTodayPlan(items);
      setActiveChallenges(active);
      setTodayChallenges(todayRaw);
    } catch (err) {
      const apiErr = err as { message?: string };
      setError(apiErr.message ?? 'Не удалось загрузить план');
    } finally {
      setIsLoading(false);
    }
  }, [refreshProfile]);

  const loadWeekActivity = useCallback(async (offset: number) => {
    setIsWeekLoading(true);
    setCalendarError(null);
    try {
      const week = await meApi.getWeekActivity(toIsoDate(getWeekStart(new Date(), offset)));
      setCompletedDates(week.completed_dates);
      if (offset === 0) setStreakDays(week.streak_current);
    } catch (err) {
      const apiErr = err as { message?: string };
      setCalendarError(apiErr.message ?? 'Не удалось загрузить календарь');
    } finally {
      setIsWeekLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadWeekActivity(weekOffset);
  }, [weekOffset, loadWeekActivity]);

  const viewedWeekStart = useMemo(() => getWeekStart(new Date(), weekOffset), [weekOffset]);
  const viewedWeekEnd = useMemo(() => getWeekEnd(viewedWeekStart), [viewedWeekStart]);
  const calendarDays = useMemo(
    () => buildWeekDays(viewedWeekStart, activeChallenges, completedDates, todayChallenges),
    [viewedWeekStart, activeChallenges, completedDates, todayChallenges],
  );

  const allVisibleChallenges = useMemo(
    () => [
      ...activeChallenges,
      ...todayPlan.map((item) => item.challenge),
    ],
    [activeChallenges, todayPlan],
  );

  const closeChallenge = () => {
    setSelectedChallengeId(null);
  };

  const handleOpenEdit = (id: number) => {
    const challenge = allVisibleChallenges.find((item) => item.id === id);
    if (!challenge || !canEditChallenge(challenge)) {
      showToast('Публичный челлендж нельзя редактировать');
      return;
    }
    closeChallenge();
    setEditChallengeId(id);
  };

  const handleEditSuccess = async () => {
    setEditChallengeId(null);
    showToast('Изменения сохранены');
    await loadDashboard();
  };

  const handlePublish = (id: number) => {
    setConfirmState({
      title: 'Сделать челлендж публичным?',
      description:
        'После этого его нельзя будет редактировать, он переместится в групповые.',
      confirmLabel: 'Сделать публичным',
      action: async () => {
        try {
          await challengeApi.publish(id);
          if (selectedChallengeId === id) closeChallenge();
          showToast('Челлендж опубликован');
          await loadDashboard();
        } catch (err) {
          showToast(parseApiError(err as AxiosError).message);
        }
      },
    });
  };

  const handleCopyLink = async (id: number) => {
    const challenge = allVisibleChallenges.find((item) => item.id === id);
    if (!challenge?.joinCode) return;

    const inviteUrl = buildChallengeInviteUrl(challenge.joinCode);
    try {
      await navigator.clipboard.writeText(inviteUrl);
      showToast('Ссылка-приглашение скопирована');
    } catch {
      showToast(inviteUrl);
    }
  };

  const runConfirmed = async () => {
    if (!confirmState || isConfirming) return;
    setIsConfirming(true);
    try {
      await confirmState.action();
    } finally {
      setIsConfirming(false);
      setConfirmState(null);
    }
  };

  return (
    <div className="min-h-dvh px-4 pt-14">
      <header className="mb-3 flex items-center justify-between gap-4 px-1">
        <h1 className="text-[20px] font-extrabold leading-tight text-neutral-text">
          {getGreeting()}, {displayName}!
        </h1>
        <div className="flex items-center gap-1">
          <span className="text-[32px] font-extrabold leading-none text-neutral-text">
            {streakDays}
          </span>
          <span className="grid h-[44px] w-[48px] place-items-center bg-white text-brand">
            <Flame size={24} />
          </span>
        </div>
      </header>

      <MobileWeekCard
        days={calendarDays}
        weekLabel={formatWeekRangeLabel(viewedWeekStart, viewedWeekEnd)}
        isCurrentWeekVisible={isCurrentWeek(viewedWeekStart)}
        isLoading={isWeekLoading}
        onPrev={() => setWeekOffset((prev) => prev - 1)}
        onNext={() => setWeekOffset((prev) => prev + 1)}
        onToday={() => setWeekOffset(0)}
      />

      {calendarError && (
        <p className="mt-2 px-1 text-[12px] font-semibold text-red-500" role="alert">
          {calendarError}
        </p>
      )}

      <section className="mt-6">
        <h2 className="mb-3 px-1 text-[18px] font-extrabold text-neutral-text">
          План на сегодня
        </h2>

        {isLoading && (
          <p className="rounded-[14px] bg-white p-4 text-[13px] font-semibold text-neutral-muted">
            Загрузка...
          </p>
        )}

        {error && (
          <p className="rounded-[14px] bg-white p-4 text-[13px] font-semibold text-red-500">
            {error}
          </p>
        )}

        {!isLoading && !error && todayPlan.length === 0 && (
          <div className="rounded-[14px] bg-white p-5 text-center shadow-card">
            <p className="text-[14px] font-bold text-neutral-text">На сегодня нет упражнений</p>
            <p className="mt-1 text-[12px] font-medium text-neutral-muted">
              Загляните в соревнования или создайте новый челлендж.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {todayPlan.map((item) => (
            <MobilePlanCard
              key={item.challenge.id}
              item={item}
              onOpen={() => setSelectedChallengeId(item.challenge.id)}
            />
          ))}
        </div>
      </section>

      {selectedChallengeId != null && (
        <ChallengeDetailModal
          challengeId={selectedChallengeId}
          onClose={closeChallenge}
          onEdit={handleOpenEdit}
          onPublish={(id) => void handlePublish(id)}
          onCopyLink={() => void handleCopyLink(selectedChallengeId)}
          returnTarget={{ type: 'dashboard' }}
        />
      )}

      {editChallengeId != null && (
        <ChallengeFormModal
          mode="edit"
          challengeId={editChallengeId}
          onClose={() => setEditChallengeId(null)}
          onSuccess={() => void handleEditSuccess()}
        />
      )}

      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ''}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        tone={confirmState?.tone}
        isLoading={isConfirming}
        onConfirm={() => void runConfirmed()}
        onCancel={() => {
          if (!isConfirming) setConfirmState(null);
        }}
      />

      {toast && (
        <div
          role="status"
          className="fixed bottom-[86px] left-4 right-4 z-50 mx-auto max-w-[398px] rounded-[12px] bg-neutral-text px-4 py-3 text-center text-[13px] font-semibold text-white shadow-modal"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
