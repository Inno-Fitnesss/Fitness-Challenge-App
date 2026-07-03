import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { Tabs } from '../components/ui/Tabs.tsx';
import { Toast } from '../components/ui/Toast.tsx';
import { AuthLandingHero } from '../components/auth/AuthLandingHero.tsx';
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
    <div className="min-h-screen lg:h-screen lg:overflow-hidden grid grid-cols-1 lg:grid-cols-2">
      <aside className="bg-white flex items-center justify-center px-6 sm:px-10 py-10 lg:py-12 lg:overflow-y-auto">
        <AuthLandingHero />
      </aside>

      <main className="bg-neutral-card flex items-center justify-center px-4 sm:px-8 py-8 lg:py-12 lg:overflow-y-auto">
        <div className="w-full max-w-md min-w-0 animate-slide-up">
          <div className="lg:hidden flex justify-center mb-6">
            <AuthBrandMark />
          </div>

          <div className="bg-white rounded-3xl shadow-card px-5 py-6 sm:px-8 sm:py-7 min-w-0 overflow-hidden">
            <div className="text-center mb-6">
              <h1 className="text-2xl sm:text-[1.65rem] font-extrabold text-neutral-text mb-1.5">
                {isSignUp ? 'Создайте аккаунт' : 'С возвращением!'}
              </h1>
              <p className="text-sm text-neutral-secondary">
                {isSignUp ? 'Зарегистрируйтесь, чтобы начать' : 'Войдите, чтобы продолжить'}
              </p>
            </div>

            <Tabs
              tabs={AUTH_TABS}
              activeTab={activeTab}
              onChange={setActiveTab}
              className="mb-6 bg-neutral-card/80"
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
