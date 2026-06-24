import { useEffect, useState } from 'react';
import { Mail, User as UserIcon } from 'lucide-react';
import { authApi } from '../api/authApi.ts';
import { PageContainer } from '../components/layout/PageContainer.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import type { User } from '../types/auth.types.ts';

function getDisplayName(user: User): string {
  if (user.firstName || user.lastName) {
    return [user.firstName, user.lastName].filter(Boolean).join(' ');
  }
  return user.username;
}

function getInitial(user: User): string {
  const name = getDisplayName(user);
  return name.charAt(0).toUpperCase();
}

export function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<User | null>(user);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    authApi
      .getCurrentUser()
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch(() => {
        if (!cancelled && user) setProfile(user);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!profile && isLoading) {
    return (
      <PageContainer>
        <p className="text-neutral-muted text-sm">Загрузка профиля…</p>
      </PageContainer>
    );
  }

  if (!profile) {
    return (
      <PageContainer>
        <p className="text-neutral-muted text-sm">Не удалось загрузить профиль</p>
      </PageContainer>
    );
  }

  const displayName = getDisplayName(profile);

  return (
    <PageContainer>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-text mb-6 sm:mb-8">
        Профиль
      </h1>

      <div className="max-w-lg">
        <section className="bg-white rounded-3xl shadow-card p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-brand-light to-lime-pale flex items-center justify-center text-2xl font-extrabold text-brand flex-shrink-0">
              {getInitial(profile)}
            </div>
            <div className="text-center sm:text-left min-w-0">
              <h2 className="text-xl font-bold text-neutral-text truncate">{displayName}</h2>
              <p className="text-sm text-neutral-muted mt-0.5">@{profile.username}</p>
            </div>
          </div>

          <div className="space-y-3 border-t border-neutral-border pt-5">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-9 h-9 rounded-xl bg-neutral-card flex items-center justify-center flex-shrink-0">
                <Mail size={16} className="text-neutral-muted" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-neutral-muted">Email</p>
                <p className="text-neutral-text truncate">{profile.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <div className="w-9 h-9 rounded-xl bg-neutral-card flex items-center justify-center flex-shrink-0">
                <UserIcon size={16} className="text-neutral-muted" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-neutral-muted">Имя пользователя</p>
                <p className="text-neutral-text truncate">{profile.username}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-white rounded-2xl shadow-card p-4 text-center">
            <p className="text-2xl font-extrabold text-neutral-text">
              {profile.streakCurrent ?? 0}
            </p>
            <p className="text-xs text-neutral-muted mt-1">Текущий стрик</p>
          </div>
          <div className="bg-white rounded-2xl shadow-card p-4 text-center">
            <p className="text-2xl font-extrabold text-neutral-text">
              {profile.streakLongest ?? 0}
            </p>
            <p className="text-xs text-neutral-muted mt-1">Лучший стрик</p>
          </div>
        </div>

        <p className="text-sm text-neutral-muted mt-6 text-center sm:text-left">
          Редактирование профиля и настройки аккаунта появятся позже.
        </p>
      </div>
    </PageContainer>
  );
}
