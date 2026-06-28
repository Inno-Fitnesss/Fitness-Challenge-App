import { useCallback, useEffect, useMemo, useState } from 'react';
import { Flame, Trophy } from 'lucide-react';
import type { AxiosError } from 'axios';
import { authApi } from '../api/authApi.ts';
import { PageContainer } from '../components/layout/PageContainer.tsx';
import {
  FITNESS_LEVEL_OPTIONS,
  fitnessLevelLabel,
  type FitnessLevel,
} from '../constants/fitnessLevels.ts';
import { useAuth } from '../context/AuthContext.tsx';
import type { User } from '../types/auth.types.ts';
import { parseApiError } from '../utils/parseApiError.ts';

interface ProfileFormState {
  username: string;
  firstName: string;
  lastName: string;
  heightCm: string;
  weightKg: string;
  fitnessLevel: FitnessLevel | '';
  email: string;
  newPassword: string;
  confirmPassword: string;
}

const fieldClass =
  'w-full px-4 py-3 border border-neutral-border rounded-2xl text-sm text-neutral-text placeholder:text-neutral-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 disabled:bg-neutral-card disabled:text-neutral-muted';

function getFullName(user: Pick<User, 'firstName' | 'lastName'>): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ');
}

function formFromUser(user: User): ProfileFormState {
  return {
    username: user.username,
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    heightCm: user.heightCm != null ? String(user.heightCm) : '',
    weightKg: user.weightKg != null ? String(user.weightKg) : '',
    fitnessLevel: user.fitnessLevel ?? '',
    email: user.email,
    newPassword: '',
    confirmPassword: '',
  };
}

function snapshotsEqual(a: ProfileFormState, b: ProfileFormState): boolean {
  return (
    a.username === b.username &&
    a.firstName === b.firstName &&
    a.lastName === b.lastName &&
    a.heightCm === b.heightCm &&
    a.weightKg === b.weightKg &&
    a.fitnessLevel === b.fitnessLevel &&
    a.email === b.email &&
    a.newPassword === b.newPassword &&
    a.confirmPassword === b.confirmPassword
  );
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function isFormValid(form: ProfileFormState): boolean {
  if (!form.username.trim()) return false;
  if (!form.email.trim() || !form.email.includes('@')) return false;
  if (form.heightCm.trim() && parseOptionalInt(form.heightCm) == null) return false;
  if (form.weightKg.trim() && parseOptionalInt(form.weightKg) == null) return false;
  if (form.newPassword || form.confirmPassword) {
    if (form.newPassword.length < 6) return false;
    if (form.newPassword !== form.confirmPassword) return false;
  }
  return true;
}

function ProfileSummaryCard({ user }: { user: User }) {
  const fullName = getFullName(user);

  return (
    <section className="bg-white rounded-3xl shadow-card p-6 sm:p-8 text-center">
      <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-accent mx-auto flex items-center justify-center text-3xl sm:text-4xl font-extrabold text-white mb-4">
        {user.username.charAt(0).toLowerCase()}
      </div>
      <h2 className="text-lg sm:text-xl font-bold text-neutral-text">{user.username}</h2>
      {fullName && <p className="text-sm text-neutral-secondary mt-1">{fullName}</p>}
      <p className="text-sm text-neutral-muted mt-0.5 break-all">{user.email}</p>

      <div className="mt-6 space-y-2 text-sm text-neutral-secondary text-left max-w-[220px] mx-auto">
        <p>
          <span className="text-neutral-muted">рост:</span>{' '}
          {user.heightCm != null ? user.heightCm : '—'}
        </p>
        <p>
          <span className="text-neutral-muted">вес:</span>{' '}
          {user.weightKg != null ? user.weightKg : '—'}
        </p>
        <p>
          <span className="text-neutral-muted">уровень:</span> {fitnessLevelLabel(user.fitnessLevel)}
        </p>
      </div>
    </section>
  );
}

function ProfileStatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Flame;
  value: number;
  label: string;
}) {
  return (
    <div className="bg-white rounded-3xl shadow-card p-5 sm:p-6 flex flex-col items-center justify-center text-center min-h-[120px]">
      <Icon size={22} className="text-neutral-muted mb-2" />
      <p className="text-2xl font-extrabold text-neutral-text">{value}</p>
      <p className="text-sm text-neutral-secondary mt-1">{label}</p>
    </div>
  );
}

function FormLabel({ children, required }: { children: string; required?: boolean }) {
  return (
    <label className="block text-sm text-neutral-muted mb-1.5">
      {children}
      {required && <span className="text-brand">*</span>}
    </label>
  );
}

export function ProfilePage() {
  const { user: authUser, refreshProfile } = useAuth();
  const [profile, setProfile] = useState<User | null>(authUser);
  const [form, setForm] = useState<ProfileFormState | null>(
    authUser ? formFromUser(authUser) : null,
  );
  const [initialForm, setInitialForm] = useState<ProfileFormState | null>(
    authUser ? formFromUser(authUser) : null,
  );
  const [isLoading, setIsLoading] = useState(!authUser);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await authApi.getCurrentUser();
      const nextForm = formFromUser(data);
      setProfile(data);
      setForm(nextForm);
      setInitialForm(nextForm);
    } catch (err) {
      setError(parseApiError(err as AxiosError).message);
      if (authUser) {
        const fallback = formFromUser(authUser);
        setProfile(authUser);
        setForm(fallback);
        setInitialForm(fallback);
      }
    } finally {
      setIsLoading(false);
    }
  }, [authUser]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const hasChanges = useMemo(() => {
    if (!form || !initialForm) return false;
    return !snapshotsEqual(form, initialForm);
  }, [form, initialForm]);

  const isValid = form ? isFormValid(form) : false;

  const updateField = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSuccess(null);
  };

  const handleCancel = () => {
    if (initialForm) setForm(initialForm);
    setError(null);
    setSuccess(null);
  };

  const handleSave = async () => {
    if (!form || !isValid || isSaving) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await authApi.updateProfile({
        username: form.username.trim(),
        email: form.email.trim(),
        firstName: form.firstName,
        lastName: form.lastName,
        heightCm: parseOptionalInt(form.heightCm),
        weightKg: parseOptionalInt(form.weightKg),
        fitnessLevel: form.fitnessLevel || null,
        newPassword: form.newPassword || undefined,
        confirmPassword: form.confirmPassword || undefined,
      });

      const nextForm = formFromUser(updated);
      setProfile(updated);
      setForm(nextForm);
      setInitialForm(nextForm);
      setSuccess('Изменения сохранены');
      await refreshProfile();
    } catch (err) {
      setError(parseApiError(err as AxiosError).message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !profile || !form) {
    return (
      <PageContainer>
        <p className="text-neutral-muted text-sm">Загрузка профиля…</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-text">Мой профиль</h1>
        <p className="text-sm text-neutral-muted mt-1">Управление аккаунтом</p>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,340px)_1fr] gap-6 xl:gap-8 items-start">
        <div className="space-y-4">
          <ProfileSummaryCard user={profile} />
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <ProfileStatCard
              icon={Flame}
              value={profile.streakCurrent ?? 0}
              label="Стрик"
            />
            <ProfileStatCard
              icon={Trophy}
              value={profile.streakLongest ?? 0}
              label="Рекорд"
            />
          </div>
        </div>

        <section className="bg-white rounded-3xl shadow-card p-5 sm:p-8">
          <h2 className="text-lg sm:text-xl font-bold text-neutral-text mb-6 sm:mb-8">
            Редактировать профиль
          </h2>

          {error && (
            <p className="mb-4 text-sm text-red-500" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="mb-4 text-sm text-lime-hover" role="status">
              {success}
            </p>
          )}

          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-bold text-neutral-text mb-4">Основная информация</h3>
              <div className="space-y-4">
                <div>
                  <FormLabel required>Никнейм</FormLabel>
                  <input
                    type="text"
                    value={form.username}
                    onChange={(e) => updateField('username', e.target.value)}
                    className={fieldClass}
                    autoComplete="username"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FormLabel>Имя</FormLabel>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => updateField('firstName', e.target.value)}
                      className={fieldClass}
                      autoComplete="given-name"
                    />
                  </div>
                  <div>
                    <FormLabel>Фамилия</FormLabel>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => updateField('lastName', e.target.value)}
                      className={fieldClass}
                      autoComplete="family-name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <FormLabel>Рост</FormLabel>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={50}
                      max={300}
                      value={form.heightCm}
                      onChange={(e) => updateField('heightCm', e.target.value)}
                      className={fieldClass}
                      placeholder="см"
                    />
                  </div>
                  <div>
                    <FormLabel>Вес</FormLabel>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={20}
                      max={500}
                      value={form.weightKg}
                      onChange={(e) => updateField('weightKg', e.target.value)}
                      className={fieldClass}
                      placeholder="кг"
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <FormLabel>Уровень подготовки</FormLabel>
                    <select
                      value={form.fitnessLevel}
                      onChange={(e) =>
                        updateField('fitnessLevel', e.target.value as FitnessLevel | '')
                      }
                      className={`${fieldClass} appearance-none bg-white`}
                    >
                      <option value="">Не выбран</option>
                      {FITNESS_LEVEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-neutral-text mb-4">Безопасность</h3>
              <div className="space-y-4">
                <div>
                  <FormLabel required>Email</FormLabel>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    className={fieldClass}
                    autoComplete="email"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FormLabel>Новый пароль</FormLabel>
                    <input
                      type="password"
                      value={form.newPassword}
                      onChange={(e) => updateField('newPassword', e.target.value)}
                      className={fieldClass}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <FormLabel>Подтвердите</FormLabel>
                    <input
                      type="password"
                      value={form.confirmPassword}
                      onChange={(e) => updateField('confirmPassword', e.target.value)}
                      className={fieldClass}
                      autoComplete="new-password"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3 mt-8 sm:mt-10">
            <button
              type="button"
              onClick={handleCancel}
              disabled={!hasChanges || isSaving}
              className="flex-1 sm:flex-none sm:min-w-[140px] px-5 py-3 rounded-2xl text-sm font-semibold bg-neutral-border text-neutral-secondary hover:bg-neutral-muted/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Отменить
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!hasChanges || !isValid || isSaving}
              className={`flex-1 sm:flex-auto px-5 py-3 rounded-2xl text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
                hasChanges && isValid
                  ? 'bg-brand text-white hover:bg-brand-hover'
                  : 'bg-neutral-border text-neutral-secondary'
              }`}
            >
              {isSaving ? 'Сохраняем…' : 'Сохранить изменения'}
            </button>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
