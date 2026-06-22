import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { PageContainer } from '../components/layout/PageContainer.tsx';
import { WeeklyCalendar } from '../components/dashboard/WeeklyCalendar.tsx';
import { StreakWidget } from '../components/dashboard/StreakWidget.tsx';
import { TodayPlanCard } from '../components/dashboard/TodayPlanCard.tsx';
import { ChallengeDetailModal } from '../components/challenges/ChallengeDetailModal.tsx';
import { fetchTodayPlan } from '../api/challengeQueries.ts';
import type { TodayPlanItem } from '../types/challenge.ts';

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
  const { user } = useAuth();
  const displayName = getDisplayName(user?.username, user?.email);
  const [selectedChallengeId, setSelectedChallengeId] = useState<number | null>(null);
  const [todayPlan, setTodayPlan] = useState<TodayPlanItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchTodayPlan()
      .then((items) => {
        if (!cancelled) setTodayPlan(items);
      })
      .catch((err: { message?: string }) => {
        if (!cancelled) setError(err.message ?? 'Не удалось загрузить план на сегодня');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const streakDays = user?.streakCurrent ?? 0;

  return (
    <PageContainer>
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-text leading-tight">
          {getGreeting()}, {displayName}!
        </h1>
      </header>

      <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mb-8 sm:mb-10">
        <WeeklyCalendar />
        <StreakWidget days={streakDays} />
      </div>

      <section>
        <h2 className="text-lg sm:text-xl font-bold text-neutral-text mb-4 sm:mb-5">План на сегодня</h2>

        {isLoading && <p className="text-neutral-muted text-sm">Загрузка...</p>}

        {error && (
          <p className="text-red-500 text-sm" role="alert">{error}</p>
        )}

        {!isLoading && !error && todayPlan.length === 0 && (
          <div className="bg-white rounded-3xl shadow-card p-6 sm:p-8 text-center">
            <p className="text-neutral-secondary mb-1">На сегодня нет активных челленджей</p>
            <p className="text-sm text-neutral-muted">
              Создайте челлендж или присоединитесь к готовому в разделе «Челленджи»
            </p>
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

      {selectedChallengeId != null && (
        <ChallengeDetailModal
          challengeId={selectedChallengeId}
          onClose={() => setSelectedChallengeId(null)}
        />
      )}
    </PageContainer>
  );
}
