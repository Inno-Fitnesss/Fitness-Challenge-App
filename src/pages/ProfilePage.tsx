import { useCallback, useEffect, useState } from 'react';
import { Flame, LogOut, Pencil, Trophy } from 'lucide-react';
import type { AxiosError } from 'axios';
import { authApi } from '../api/authApi.ts';
import { stepsApi, type ApiStepsRange } from '../api/stepsApi.ts';
import { withingsApi } from '../api/withingsApi.ts';
import { PageContainer } from '../components/layout/PageContainer.tsx';
import { ProfileActivityChart } from '../components/profile/ProfileActivityChart.tsx';
import { StepsWidget } from '../components/profile/StepsWidget.tsx';
import { ProfileAvatar } from '../components/profile/ProfileAvatar.tsx';
import { ProfileEditModal } from '../components/profile/ProfileEditModal.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import type { User } from '../types/auth.types.ts';
import { fetchLast7DaysChallengeActivity } from '../utils/profileActivityChart.ts';
import type { DailyChallengeActivity } from '../utils/profileActivityChart.ts';
import {
  getPlankDuration,
  getPushupsVolume,
  getSquatsVolume,
  formatRepsCount,
} from '../utils/profileStats.ts';
import { getStoredAvatarUrl, setStoredAvatarUrl } from '../utils/profileAvatarStorage.ts';
import { parseApiError } from '../utils/parseApiError.ts';

function ProfileStatCard({
  icon: Icon,
  value,
  label,
  iconClassName,
}: {
  icon: typeof Flame;
  value: number;
  label: string;
  iconClassName?: string;
}) {
  return (
    <div className="bg-white rounded-3xl shadow-card p-5 sm:p-6 flex flex-col items-center justify-center text-center min-h-[120px]">
      <Icon size={22} className={`mb-2 ${iconClassName ?? 'text-neutral-muted'}`} />
      <p className="text-2xl font-extrabold text-brand">{value}</p>
      <p className="text-sm text-neutral-secondary mt-1">{label}</p>
    </div>
  );
}

function VolumeCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-white rounded-3xl shadow-card p-5 sm:p-6 min-h-[120px] flex flex-col justify-center">
      <p className="text-sm text-neutral-secondary mb-2">{title}</p>
      <p className="text-3xl sm:text-4xl font-extrabold text-brand leading-tight">{value}</p>
    </div>
  );
}

function PlankCard({ secondsParts }: { secondsParts: ReturnType<typeof getPlankDuration> }) {
  const parts = [
    { value: secondsParts.days, label: 'дней' },
    { value: secondsParts.hours, label: 'часов' },
    { value: secondsParts.minutes, label: 'минут' },
    { value: secondsParts.seconds, label: 'секунд' },
  ];

  const firstActiveIndex = parts.findIndex((p) => p.value > 0);

  return (
    <div className="bg-white rounded-3xl shadow-card p-5 sm:p-6">
      <p className="text-sm text-neutral-secondary mb-4">За всё время вы простояли в планке</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {parts.map((part, index) => {
          const isActive = firstActiveIndex !== -1 && index >= firstActiveIndex;
          return (
            <div key={part.label} className="text-center min-w-0">
              <p
                className={`text-2xl sm:text-3xl font-extrabold tabular-nums ${
                  isActive ? 'text-brand' : 'text-neutral-muted'
                }`}
              >
                {part.value}
              </p>
              <p className="text-xs sm:text-sm text-neutral-muted mt-1">{part.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const { user: authUser, refreshProfile, logout } = useAuth();
  const [profile, setProfile] = useState<User | null>(authUser);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    authUser ? getStoredAvatarUrl(authUser.id) : null,
  );
  const [chartData, setChartData] = useState<DailyChallengeActivity[]>([]);
  const [isLoading, setIsLoading] = useState(!authUser);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [stepsData, setStepsData] = useState<ApiStepsRange | null>(null);
  const [isStepsLoading, setIsStepsLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authApi.getCurrentUser();
      setProfile(data);
      setAvatarUrl(getStoredAvatarUrl(data.id));
    } catch (err) {
      setError(parseApiError(err as AxiosError).message);
      if (authUser) {
        setProfile(authUser);
        setAvatarUrl(getStoredAvatarUrl(authUser.id));
      }
    } finally {
      setIsLoading(false);
    }
  }, [authUser]);

  const loadChart = useCallback(async () => {
    setIsChartLoading(true);
    try {
      const data = await fetchLast7DaysChallengeActivity();
      setChartData(data);
    } catch {
      setChartData([]);
    } finally {
      setIsChartLoading(false);
    }
  }, []);

  const loadSteps = useCallback(async () => {
    setIsStepsLoading(true);
    try {
      // Тихая попытка подтянуть свежие данные из Withings при каждом заходе
      // на страницу — если аккаунт ещё не подключен, sync() просто упадёт
      // с 400, и это нормально, тогда просто показываем то, что есть.
      try {
        await withingsApi.sync();
      } catch {
        /* не подключено или Withings временно недоступен — не блокируем показ */
      }
      const data = await stepsApi.getRecent(7);
      setStepsData(data);
    } catch {
      setStepsData(null);
    } finally {
      setIsStepsLoading(false);
    }
  }, []);

  const handleStepsRefresh = useCallback(async () => {
    try {
      await withingsApi.sync();
    } catch {
      setError('Не удалось обновить шаги из Withings — попробуй ещё раз позже.');
    }
    const data = await stepsApi.getRecent(7);
    setStepsData(data);
  }, []);

  useEffect(() => {
    void loadProfile();
    void loadChart();
    void loadSteps();
  }, [loadProfile, loadChart, loadSteps]);

  // Пока страница открыта — тихо обновляем шаги из Withings каждые пару
  // минут сами, без участия пользователя. Ошибки специально проглатываются:
  // это фоновый опрос, а не действие по клику, лишний раз пугать не нужно.
  useEffect(() => {
    const intervalId = setInterval(() => {
      withingsApi
        .sync()
        .then(() => stepsApi.getRecent(7))
        .then(setStepsData)
        .catch(() => {});
    }, 2 * 60 * 1000); // каждые 2 минуты

    return () => clearInterval(intervalId);
  }, []);

  // После возврата с OAuth-логина Withings (?withings=connected) сразу
  // подтягиваем шаги один раз и убираем параметр из адресной строки.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const withingsResult = params.get('withings');
    if (!withingsResult) return;

    window.history.replaceState({}, '', window.location.pathname);

    if (withingsResult === 'connected') {
      void withingsApi.sync().then(() => void loadSteps());
    } else if (withingsResult === 'error') {
      setError('Не удалось подключить Withings — попробуй ещё раз.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveProfile = async (username: string, nextAvatarUrl: string | null) => {
    if (!profile || isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const updated = await authApi.updateProfile({
        username,
        email: profile.email,
      });

      setStoredAvatarUrl(updated.id, nextAvatarUrl);
      setAvatarUrl(nextAvatarUrl);
      setProfile(updated);
      setIsEditOpen(false);
      await refreshProfile();
    } catch (err) {
      setError(parseApiError(err as AxiosError).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !profile) {
    return (
      <PageContainer>
        <p className="text-neutral-muted text-sm">Загрузка профиля…</p>
      </PageContainer>
    );
  }

  const volume = profile.volume ?? [];
  const squats = getSquatsVolume(volume);
  const pushups = getPushupsVolume(volume);
  const plank = getPlankDuration(volume);

  return (
    <PageContainer>
      <header className="mb-6 sm:mb-8 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-text">Мой профиль</h1>
          <p className="text-sm text-neutral-muted mt-1">Управление аккаунтом</p>
        </div>
        {/* На десктопе «Выйти» живёт в сайдбаре — тут кнопка только для мобилки */}
        <button
          type="button"
          onClick={logout}
          className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-brand bg-brand-light hover:bg-brand-light/70 transition-colors flex-shrink-0"
        >
          <LogOut size={16} />
          Выйти
        </button>
      </header>

      {error && !isEditOpen && (
        <p className="mb-4 text-sm text-red-500" role="alert">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,340px)_1fr] gap-6 xl:gap-8 items-start">
        <div className="space-y-4">
          <section className="relative bg-white rounded-3xl shadow-card p-6 sm:p-8 text-center">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setIsEditOpen(true);
              }}
              aria-label="Редактировать профиль"
              className="absolute top-5 right-5 p-2 rounded-xl text-neutral-muted hover:text-neutral-secondary hover:bg-neutral-card transition-colors"
            >
              <Pencil size={18} />
            </button>

            <div className="mx-auto mb-4 w-fit">
              <ProfileAvatar userId={profile.id} username={profile.username} size="lg" />
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-neutral-text break-words px-2">
              {profile.username}
            </h2>
            <p className="text-sm text-neutral-muted mt-1 break-all px-2">{profile.email}</p>
          </section>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <ProfileStatCard
              icon={Flame}
              value={profile.streakCurrent ?? 0}
              label="Дни в ударе"
              iconClassName="text-brand"
            />
            <ProfileStatCard
              icon={Trophy}
              value={profile.streakLongest ?? 0}
              label="Рекорд"
              iconClassName="text-accent"
            />
          </div>
        </div>

        <div className="space-y-4" data-tour="profile-stats">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <VolumeCard
              title="За всё время вы присели"
              value={formatRepsCount(squats.total)}
            />
            <VolumeCard
              title="За всё время вы отжались"
              value={formatRepsCount(pushups.total)}
            />
          </div>

          <PlankCard secondsParts={plank} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StepsWidget data={stepsData} isLoading={isStepsLoading} onRefresh={handleStepsRefresh} />
            <ProfileActivityChart data={chartData} isLoading={isChartLoading} />
          </div>
        </div>
      </div>

      {isEditOpen && (
        <ProfileEditModal
          username={profile.username}
          avatarUrl={avatarUrl}
          isSaving={isSaving}
          error={error}
          onClose={() => {
            if (!isSaving) {
              setIsEditOpen(false);
              setError(null);
            }
          }}
          onSave={(username, nextAvatarUrl) => void handleSaveProfile(username, nextAvatarUrl)}
        />
      )}
    </PageContainer>
  );
}
