import { useState, type FormEvent } from 'react';
import type { AxiosError } from 'axios';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { Input } from '../components/ui/Input.tsx';
import { Toast } from '../components/ui/Toast.tsx';
import { BrandLogoLink } from '../components/ui/BrandLogoLink.tsx';
import { BigNumberCard } from '../components/admin/BigNumberCard.tsx';
import { PieStatCard } from '../components/admin/PieStatCard.tsx';
import { TopStreaksChart } from '../components/admin/TopStreaksChart.tsx';
import { ExerciseTotalsChart } from '../components/admin/ExerciseTotalsChart.tsx';
import { RegistrationsTimelineChart } from '../components/admin/RegistrationsTimelineChart.tsx';
import { adminApi, type AdminStats } from '../api/adminApi.ts';
import { parseApiError } from '../utils/parseApiError.ts';

// Deliberately NOT persisted to localStorage/sessionStorage — the admin
// token lives only in this component's state, so a fresh page load (or a
// new tab) always re-asks for the password. This is the "most strict" mode:
// there is no remembered admin session at all.
export function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const adminToken = await adminApi.login(password);
      const data = await adminApi.getStats(adminToken);
      setToken(adminToken);
      setStats(data);
      setPassword('');
    } catch (err) {
      setError(parseApiError(err as AxiosError).message ?? 'Неверный пароль');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token || !stats) {
    return (
      <div className="min-h-screen bg-neutral-card flex items-center justify-center px-4 sm:px-6 py-6">
        <div className="w-full max-w-sm animate-slide-up">
          <BrandLogoLink className="inline-flex items-center gap-2.5 mb-5 justify-center hover:opacity-90 transition-opacity" />

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl shadow-card px-6 py-6 sm:px-7"
          >
            <div className="text-center mb-5">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-brand-light flex items-center justify-center">
                <LockKeyhole size={20} className="text-brand" />
              </div>
              <h1 className="text-xl font-extrabold text-neutral-text mb-1">
                Админ-панель
              </h1>
              <p className="text-sm text-neutral-secondary">
                Введите пароль, чтобы посмотреть статистику
              </p>
            </div>

            <label htmlFor="admin-password" className="sr-only">
              Пароль
            </label>
            <Input
              id="admin-password"
              type="password"
              autoFocus
              placeholder="Пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hasError={!!error}
            />

            <Button
              type="submit"
              fullWidth
              isLoading={isSubmitting}
              disabled={!password}
              className="mt-4"
            >
              Войти
            </Button>
          </form>
        </div>

        {error && <Toast message={error} type="error" onClose={() => setError(null)} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-card px-4 sm:px-6 py-8">
      <div className="max-w-5xl mx-auto animate-slide-up">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-lime-pale flex items-center justify-center">
            <ShieldCheck size={18} className="text-lime-hover" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-neutral-text">Админ-панель</h1>
            <p className="text-sm text-neutral-secondary">Статистика проекта</p>
          </div>
        </div>

        {/* Активность: DAU / WAU / MAU + новые за сегодня */}
        <h2 className="text-xl font-extrabold text-neutral-text mb-3">Активные пользователи</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <BigNumberCard label="За 24 часа" value={stats.activity.active_today} />
          <BigNumberCard label="За 7 дней" value={stats.activity.active_week} />
          <BigNumberCard label="За 30 дней" value={stats.activity.active_month} />
          <BigNumberCard label="Новые за сегодня" value={stats.activity.new_today} />
        </div>

        {/* Большие цифры */}
        <h2 className="text-xl font-extrabold text-neutral-text mb-3">Общая статистика</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <BigNumberCard label="Всего пользователей" value={stats.total_users} />
          <BigNumberCard label="Всего челленджей" value={stats.challenges.total} />
          {stats.exercise_totals.map((ex) => (
            <BigNumberCard
              key={ex.exercise}
              label={ex.exercise}
              value={ex.total}
              suffix={ex.unit}
            />
          ))}
        </div>

        {/* Разбивка челленджей по измерениям — pie charts */}
        <h2 className="text-xl font-extrabold text-neutral-text mb-3">Разбивка челленджей по измерениям</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <PieStatCard title="По длительности" data={stats.challenges.by_duration} />
          <PieStatCard title="По видимости" data={stats.challenges.by_visibility} />
          <PieStatCard title="По расписанию" data={stats.challenges.by_schedule} />
          <PieStatCard title="По числу упражнений" data={stats.challenges.by_exercise_count} />
        </div>

        {/* Bar charts */}
        <h2 className="text-xl font-extrabold text-neutral-text mb-3">Достижения и объёмы</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <TopStreaksChart data={stats.top_streaks} />
          <ExerciseTotalsChart data={stats.exercise_totals} />
        </div>

        {/* Таймлайн регистраций */}
        <h2 className="text-xl font-extrabold text-neutral-text mb-3">Регистрации</h2>
        <RegistrationsTimelineChart data={stats.registrations_daily} />
      </div>
    </div>
  );
}