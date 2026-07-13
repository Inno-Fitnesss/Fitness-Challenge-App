import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { meApi } from '../api/challengeApi.ts';
import { PageContainer } from '../components/layout/PageContainer.tsx';
import { WeeklyCalendar } from '../components/dashboard/WeeklyCalendar.tsx';
import { StreakWidget } from '../components/dashboard/StreakWidget.tsx';
import { TodayPlanCard } from '../components/dashboard/TodayPlanCard.tsx';
import { ChallengeDetailModal } from '../components/challenges/ChallengeDetailModal.tsx';
import { ArticleCompactCard } from '../components/articles/ArticleCompactCard.tsx';
import { ALL_ARTICLES } from '../data/articles.ts';
import { Button } from '../components/ui/Button.tsx';
import { fetchChallengeListItems, fetchTodayPlan } from '../api/challengeQueries.ts';
import {
  buildWeekDays,
  formatWeekRangeLabel,
  getWeekEnd,
  getWeekStart,
  isCurrentWeek,
  toIsoDate,
} from '../utils/dashboardCalendar.ts';
import type { TodayPlanItem } from '../types/challenge.ts';
import type { ChallengeListItem } from '../types/challenge.ts';
import type { ApiTodayChallenge } from '../types/api.types.ts';

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

export function Dashboard() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const displayName = getDisplayName(user?.username, user?.email);
  const [selectedChallengeId, setSelectedChallengeId] = useState<number | null>(null);
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
      setError(apiErr.message ?? 'Не удалось загрузить данные');
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
      if (offset === 0) {
        setStreakDays(week.streak_current);
      }
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

  const weekLabel = formatWeekRangeLabel(viewedWeekStart, viewedWeekEnd);
  const showingCurrentWeek = isCurrentWeek(viewedWeekStart);

  const hasActiveChallenges = activeChallenges.length > 0;

  return (
    <PageContainer>
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-text leading-tight">
          {getGreeting()}, {displayName}!
        </h1>
      </header>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-8 sm:mb-10">
        <div className="flex-1 min-w-0" data-tour="week-calendar">
          <WeeklyCalendar
            days={calendarDays}
            weekLabel={weekLabel}
            isCurrentWeek={showingCurrentWeek}
            onPrevWeek={() => setWeekOffset((prev) => prev - 1)}
            onNextWeek={() => setWeekOffset((prev) => prev + 1)}
            onGoToToday={() => setWeekOffset(0)}
            isWeekLoading={isWeekLoading}
          />
          {calendarError && (
            <p className="text-red-500 text-xs mt-2 px-1" role="alert">{calendarError}</p>
          )}
        </div>
        <StreakWidget days={streakDays} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 xl:gap-8 items-start">
        <section data-tour="today-plan" className="min-w-0">
          <h2 className="text-lg sm:text-xl font-bold text-neutral-text mb-4 sm:mb-5">План на сегодня</h2>

          {isLoading && <p className="text-neutral-muted text-sm">Загрузка...</p>}

          {error && (
            <p className="text-red-500 text-sm" role="alert">{error}</p>
          )}

          {!isLoading && !error && todayPlan.length === 0 && (
            <div className="bg-white rounded-3xl shadow-card p-6 sm:p-8 text-center">
              {!hasActiveChallenges ? (
                <>
                  <p className="text-neutral-secondary mb-1">У вас пока нет активных челленджей</p>
                  <p className="text-sm text-neutral-muted mb-5">
                    Создайте первый челлендж, чтобы начать отслеживать прогресс
                  </p>
                  <Button
                    variant="primary"
                    size="md"
                    className="mx-auto"
                    onClick={() => navigate('/challenges?tab=individual&create=1')}
                  >
                    <Plus size={18} />
                    Создать челлендж
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-neutral-secondary mb-1">На сегодня нет запланированных челленджей</p>
                  <p className="text-sm text-neutral-muted">
                    Отдыхайте или загляните в раздел «Челленджи» — возможно, завтра снова в дело
                  </p>
                </>
              )}
            </div>
          )}

          <div className="space-y-4">
            {todayPlan.map((item) => (
              <TodayPlanCard
                key={item.challenge.id}
                item={item}
                onClick={() => setSelectedChallengeId(item.challenge.id)}
              />
            ))}
          </div>
        </section>

        <aside className="min-w-0">
          <div className="flex items-center justify-between gap-2 mb-4 sm:mb-5">
            <h2 className="text-lg sm:text-xl font-bold text-neutral-text">Интересные статьи</h2>
            <button
              type="button"
              onClick={() => navigate('/feed')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-hover transition-colors"
            >
              Все
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="space-y-4">
            {ALL_ARTICLES.map((article) => (
              <ArticleCompactCard
                key={article.id}
                article={article}
                onClick={() => navigate(`/articles/${article.id}`)}
              />
            ))}
          </div>
        </aside>
      </div>

      {selectedChallengeId != null && (
        <ChallengeDetailModal
          challengeId={selectedChallengeId}
          onClose={() => setSelectedChallengeId(null)}
          onEdit={(id) => {
            setSelectedChallengeId(null);
            navigate(`/challenges?tab=individual&edit=${id}`);
          }}
          returnTarget={{ type: 'dashboard' }}
        />
      )}
    </PageContainer>
  );
}
