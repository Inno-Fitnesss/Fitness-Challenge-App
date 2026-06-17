import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Flame, Dumbbell } from 'lucide-react';
import { Tabs } from '../components/ui/Tabs';
import { Toast } from '../components/ui/Toast';
import { Logo } from '../components/ui/Logo';
import { SignInForm } from '../components/auth/SignInForm';
import { SignUpForm } from '../components/auth/SignUpForm';
import { useAuth } from '../context/AuthContext';

const AUTH_TABS = [
  { id: 'signin', label: 'Вход' },
  { id: 'signup', label: 'Регистрация' },
];

export function AuthPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState('signin');
  const [toast, setToast] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div
          className="w-10 h-10 border-3 border-brand/30 border-t-brand rounded-full animate-spin"
          role="status"
          aria-label="Загрузка"
        />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleRegisterSuccess = () => {
    setToast('Аккаунт успешно создан! Войдите в систему.');
    setActiveTab('signin');
  };

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      <aside className="hidden lg:flex lg:w-[45%] xl:w-[42%] bg-gradient-to-br from-brand/10 via-success/30 to-accent/40 relative overflow-hidden">
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-brand rounded-2xl flex items-center justify-center shadow-sm">
              <Flame size={22} className="text-white" />
            </div>
            <Logo className="text-xl font-extrabold tracking-tight text-neutral-text" />
          </div>

          <div className="max-w-md">
            <h2 className="text-3xl xl:text-4xl font-extrabold text-neutral-text leading-tight mb-4">
              Будьте активны между тренировками
            </h2>
            <p className="text-base text-neutral-secondary leading-relaxed mb-8">
              Участвуйте в челленджах, отслеживайте прогресс и поддерживайте
              спортивную форму даже вне занятий с тренером.
            </p>

            <div className="space-y-4">
              {[
                'Присоединяйтесь к челленджам или создавайте свои',
                'Отслеживайте отжимания, приседания и планку',
                'Оставайтесь мотивированными вместе с сообществом',
              ].map((text) => (
                <div key={text} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-brand/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Dumbbell size={12} className="text-brand" />
                  </div>
                  <span className="text-sm text-neutral-text">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-brand/10 blur-3xl" />
        <div className="absolute -top-10 -left-10 w-60 h-60 rounded-full bg-accent/30 blur-2xl" />
      </aside>

      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-12 py-10 lg:py-16">
        <div className="lg:hidden flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 bg-brand rounded-2xl flex items-center justify-center shadow-sm">
            <Flame size={18} className="text-white" />
          </div>
          <Logo />
        </div>

        <div className="w-full max-w-md animate-slide-up">
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-text mb-2">
              {activeTab === 'signin' ? 'С возвращением!' : 'Создайте аккаунт'}
            </h1>
            <p className="text-neutral-secondary">
              {activeTab === 'signin'
                ? 'Войдите, чтобы продолжить свой фитнес-путь'
                : 'Начните свой путь к здоровому образу жизни'}
            </p>
          </div>

          <Tabs
            tabs={AUTH_TABS}
            activeTab={activeTab}
            onChange={setActiveTab}
            className="mb-8"
          />

          <div
            role="tabpanel"
            id={`panel-${activeTab}`}
            aria-labelledby={`tab-${activeTab}`}
          >
            {activeTab === 'signin' ? (
              <SignInForm />
            ) : (
              <SignUpForm onSuccess={handleRegisterSuccess} />
            )}
          </div>
        </div>
      </main>

      {toast && (
        <Toast message={toast} type="success" onClose={() => setToast(null)} />
      )}
    </div>
  );
}
