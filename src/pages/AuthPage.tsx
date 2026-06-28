import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';
import { Tabs } from '../components/ui/Tabs.tsx';
import { Toast } from '../components/ui/Toast.tsx';
import { BrandLogoLink } from '../components/ui/BrandLogoLink.tsx';
import { SignInForm } from '../components/auth/SignInForm.tsx';
import { SignUpForm } from '../components/auth/SignUpForm.tsx';
import { useAuth } from '../context/AuthContext.tsx';

const AUTH_TABS = [
  { id: 'signin', label: 'Вход' },
  { id: 'signup', label: 'Регистрация' },
];

export function AuthPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? '/dashboard';
  const initialTab = searchParams.get('tab') === 'signup' ? 'signup' : 'signin';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [toast, setToast] = useState<string | null>(null);
  const isSignUp = activeTab === 'signup';

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-card">
        <div
          className="w-10 h-10 border-3 border-lime/30 border-t-lime rounded-full animate-spin"
          role="status"
          aria-label="Загрузка"
        />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="min-h-screen bg-neutral-card flex flex-col lg:flex-row lg:h-screen lg:overflow-hidden">
      <aside className="hidden lg:flex lg:w-[40%] bg-white border-r border-neutral-border relative h-full items-center justify-center px-10 xl:px-14">
        <div className="relative z-10 w-full max-w-sm">
          <BrandLogoLink className="inline-flex items-center gap-2.5 mb-8 hover:opacity-90 transition-opacity" />

          <h2 className="text-2xl xl:text-3xl font-extrabold text-neutral-text leading-snug mb-3">
            Будьте активны между тренировками
          </h2>
          <p className="text-sm text-neutral-secondary leading-relaxed mb-6">
            Челленджи, прогресс и мотивация — даже вне занятий с тренером.
          </p>

          <div className="space-y-3">
            {[
              'Создавайте челленджи или участвуйте в чужих',
              'Отслеживайте отжимания, приседания и планку',
            ].map((text) => (
              <div key={text} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-lime-pale flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Dumbbell size={10} className="text-lime-hover" />
                </div>
                <span className="text-sm text-neutral-text leading-snug">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-lime-pale blur-3xl pointer-events-none" />
        <div className="absolute -top-8 -left-8 w-48 h-48 rounded-full bg-brand-light blur-2xl pointer-events-none" />
      </aside>

      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-6 overflow-y-auto min-h-0">
        <div className="w-full max-w-lg animate-slide-up">
          <BrandLogoLink className="lg:hidden inline-flex items-center gap-2.5 mb-5 justify-center hover:opacity-90 transition-opacity" />

          <div className="bg-white rounded-3xl shadow-card px-6 py-5 sm:px-7 sm:py-6">
            <div className="text-center mb-5">
              <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-text mb-1">
                {isSignUp ? 'Создайте аккаунт' : 'С возвращением!'}
              </h1>
              {!isSignUp && (
                <p className="text-sm text-neutral-secondary">
                  Войдите, чтобы продолжить
                </p>
              )}
            </div>

            <Tabs
              tabs={AUTH_TABS}
              activeTab={activeTab}
              onChange={setActiveTab}
              className="mb-5"
            />

            <div
              role="tabpanel"
              id={`panel-${activeTab}`}
              aria-labelledby={`tab-${activeTab}`}
            >
              {isSignUp ? (
                <SignUpForm redirectTo={redirectTo} />
              ) : (
                <SignInForm redirectTo={redirectTo} />
              )}
            </div>
          </div>
        </div>
      </main>

      {toast && (
        <Toast message={toast} type="success" onClose={() => setToast(null)} />
      )}
    </div>
  );
}

