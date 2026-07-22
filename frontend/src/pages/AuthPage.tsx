import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Tabs } from '../components/ui/Tabs.tsx';
import { Toast } from '../components/ui/Toast.tsx';
import { AuthLandingHero } from '../components/auth/AuthLandingHero.tsx';
import { AuthMobileOnboarding } from '../components/auth/AuthMobileOnboarding.tsx';
import { AuthBrandMark } from '../components/auth/AuthBrandMark.tsx';
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
  // Мобильный (< lg) вводный экран до авторизации. Если пришли по прямой
  // ссылке на вкладку или с редиректом — сразу показываем форму.
  const [mobileView, setMobileView] = useState<'landing' | 'form'>(
    searchParams.get('tab') || searchParams.get('redirect') ? 'form' : 'landing',
  );
  const isSignUp = activeTab === 'signup';
  const showMobileLanding = mobileView === 'landing';

  const openForm = (tab: string) => {
    setActiveTab(tab);
    setMobileView('form');
  };

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
    <div className="min-h-screen lg:h-screen lg:overflow-hidden grid grid-cols-1 lg:grid-cols-2">
      {/* Мобильный онбординг (< lg) до авторизации; на десктопе скрыт */}
      {showMobileLanding && (
        <div className="lg:hidden">
          <AuthMobileOnboarding
            onStart={() => openForm('signup')}
            onSignIn={() => openForm('signin')}
          />
        </div>
      )}

      <aside className="bg-white hidden lg:flex items-center justify-center px-4 sm:px-8 py-10 lg:py-12 lg:overflow-y-auto">
        <AuthLandingHero />
      </aside>

      <main
        className={`bg-white lg:bg-neutral-card items-center justify-center px-4 sm:px-8 py-8 lg:py-12 lg:overflow-y-auto ${
          showMobileLanding ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="w-full max-w-md min-w-0 animate-slide-up">
          <div className="lg:hidden flex justify-center mb-6">
            <AuthBrandMark />
          </div>

          <div className="bg-white rounded-3xl lg:shadow-card px-5 py-6 sm:px-8 sm:py-7 min-w-0 overflow-hidden">
            <div className="text-center mb-6">
              <h1 className="text-3xl sm:text-[1.65rem] font-extrabold text-neutral-text mb-1.5">
                {isSignUp ? 'Создайте аккаунт' : 'С возвращением!'}
              </h1>
              <p className="text-sm text-neutral-secondary">
                {isSignUp ? 'Зарегистрируйтесь, чтобы начать' : 'Войдите, чтобы продолжить'}
              </p>
            </div>

            {/* На мобилке вкладки заменяет ссылка-переключатель под формой */}
            <div className="hidden lg:block">
              <Tabs
                tabs={AUTH_TABS}
                activeTab={activeTab}
                onChange={setActiveTab}
                className="mb-6 bg-neutral-card/80"
              />
            </div>

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

            <p className="lg:hidden mt-6 text-center text-sm font-bold text-neutral-text">
              {isSignUp ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}{' '}
              <button
                type="button"
                onClick={() => setActiveTab(isSignUp ? 'signin' : 'signup')}
                className="font-extrabold uppercase tracking-wide text-lime hover:text-lime-hover transition-colors duration-150"
              >
                {isSignUp ? 'Войти' : 'Регистрация'}
              </button>
            </p>
          </div>
        </div>
      </main>

      {toast && (
        <Toast message={toast} type="success" onClose={() => setToast(null)} />
      )}
    </div>
  );
}
