import { useMemo } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BrandMark } from '../../components/ui/BrandMark.tsx';
import { SignInForm } from '../../components/auth/SignInForm.tsx';
import { SignUpForm } from '../../components/auth/SignUpForm.tsx';
import { useAuth } from '../../context/AuthContext.tsx';

type AuthMode = 'landing' | 'signin' | 'signup';

function normalizeMode(mode: string | null, tab: string | null): AuthMode {
  if (mode === 'signin' || tab === 'signin') return 'signin';
  if (mode === 'signup' || tab === 'signup') return 'signup';
  return 'landing';
}

export function MobileAuthPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const redirectTo = searchParams.get('redirect') ?? '/dashboard';
  const mode = normalizeMode(searchParams.get('mode'), searchParams.get('tab'));

  const withRedirect = useMemo(() => {
    return (nextMode: AuthMode) => {
      const params = new URLSearchParams();
      params.set('mode', nextMode);
      if (redirectTo !== '/dashboard') params.set('redirect', redirectTo);
      return `/auth?${params.toString()}`;
    };
  }, [redirectTo]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-lime/30 border-t-lime"
          role="status"
          aria-label="Загрузка"
        />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (mode === 'landing') {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white px-8 pb-10 pt-14">
        <div className="mb-11 flex justify-center">
          <BrandMark className="h-9" />
        </div>

        <section className="flex flex-1 flex-col">
          <h1 className="mb-7 text-[21px] font-extrabold leading-[1.25] text-black">
            Поддерживайте форму даже
            <br />
            вне занятий с тренером
          </h1>

          <div className="relative mb-7 flex items-center justify-center">
            <button
              type="button"
              aria-label="Предыдущий слайд"
              className="absolute left-0 rounded-full p-1 text-neutral-muted"
            >
              <ChevronLeft size={30} strokeWidth={1.4} />
            </button>
            <img
              src="/mobile-assets/onboarding-workout.png"
              alt=""
              className="h-[178px] w-[234px] rounded-sm object-cover"
            />
            <button
              type="button"
              aria-label="Следующий слайд"
              className="absolute right-0 rounded-full p-1 text-neutral-muted"
            >
              <ChevronRight size={30} strokeWidth={1.4} />
            </button>
          </div>

          <ul className="mb-11 list-disc space-y-1 pl-5 text-[13px] font-bold leading-tight text-black">
            <li>создавайте соревнования или участвуйте в чужих</li>
            <li>отслеживайте приседания, отжимания и планку</li>
          </ul>

          <div className="mt-auto space-y-5 px-7">
            <button
              type="button"
              onClick={() => navigate(withRedirect('signup'))}
              className="h-[35px] w-full rounded-[8px] bg-brand text-[15px] font-extrabold lowercase text-white transition-colors hover:bg-brand-hover"
            >
              начать
            </button>
            <button
              type="button"
              onClick={() => navigate(withRedirect('signin'))}
              className="h-[35px] w-full rounded-[8px] bg-lime text-[15px] font-extrabold lowercase text-white transition-colors hover:bg-lime-hover"
            >
              у меня уже есть аккаунт
            </button>
          </div>
        </section>
      </main>
    );
  }

  const isSignUp = mode === 'signup';

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[430px] bg-white px-8 pb-10 pt-14">
      <div className="mb-14 flex justify-center">
        <BrandMark className="h-9" />
      </div>

      <section className={isSignUp ? 'mx-auto max-w-[266px]' : 'mx-auto max-w-[312px]'}>
        <div className="mb-7 text-center">
          <h1 className="text-[28px] font-extrabold leading-tight text-neutral-text">
            {isSignUp ? 'Создайте аккаунт' : 'С возвращением!'}
          </h1>
          <p className="mt-2 text-[16px] font-semibold text-neutral-muted">
            {isSignUp ? 'Зарегистрируйтесь, чтобы начать' : 'Войдите, чтобы продолжить'}
          </p>
        </div>

        {isSignUp ? (
          <SignUpForm redirectTo={redirectTo} />
        ) : (
          <>
            <SignInForm redirectTo={redirectTo} />
            <p className="mt-5 text-center text-[14px] font-extrabold text-black">
              Нет аккаунта?{' '}
              <button
                type="button"
                onClick={() => navigate(withRedirect('signup'))}
                className="text-lime-hover"
              >
                РЕГИСТРАЦИЯ
              </button>
            </p>
          </>
        )}

        {isSignUp && (
          <p className="mt-5 text-center text-[13px] font-bold text-neutral-secondary">
            Уже есть аккаунт?{' '}
            <button
              type="button"
              onClick={() => navigate(withRedirect('signin'))}
              className="font-extrabold text-brand"
            >
              Войти
            </button>
          </p>
        )}
      </section>
    </main>
  );
}
