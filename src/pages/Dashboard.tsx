import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { WeeklyCalendar } from '../components/dashboard/WeeklyCalendar';
import { StreakWidget } from '../components/dashboard/StreakWidget';
import { TodayPlanCard } from '../components/dashboard/TodayPlanCard';
import { ChallengeDetailModal } from '../components/challenges/ChallengeDetailModal';
import { fetchTodayPlan } from '../api/challengeQueries';
import type { TodayPlanItem } from '../types/challenge';
import { useEffect } from 'react';

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
    <div className="min-h-screen p-8 lg:p-10">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-neutral-text">
          {getGreeting()}, {displayName}!
        </h1>
      </header>

      <div className="flex gap-6 mb-10">
        <WeeklyCalendar />
        <StreakWidget days={streakDays} />
      </div>

      <section>
        <h2 className="text-xl font-bold text-neutral-text mb-5">План на сегодня</h2>

        {isLoading && (
          <p className="text-neutral-muted text-sm">Загрузка...</p>
        )}

        {error && (
          <p className="text-red-500 text-sm" role="alert">{error}</p>
        )}

        {!isLoading && !error && todayPlan.length === 0 && (
          <div className="max-w-3xl bg-white rounded-3xl shadow-card p-8 text-center">
            <p className="text-neutral-secondary mb-1">На сегодня нет активных челленджей</p>
            <p className="text-sm text-neutral-muted">
              Создайте челлендж или присоединитесь к готовому в разделе «Челленджи»
            </p>
          </div>
        )}

        <div className="space-y-4 max-w-3xl">
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
    </div>
  );
}
