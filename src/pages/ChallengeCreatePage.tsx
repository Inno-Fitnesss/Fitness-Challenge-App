import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Bell, User, Zap, ChevronRight, Trophy, Flame } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { ChallengeForm } from '../components/ChallengeForm';
import { ChallengePreview } from '../components/ChallengePreview';
import type { Challenge, ChallengeFormValues, Exercise } from '../types/challenge';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-4 py-2 text-sm font-medium rounded-xl transition-all duration-150 ${
    isActive
      ? 'text-brand bg-brand/5 font-semibold'
      : 'text-neutral-secondary hover:bg-neutral-card hover:text-neutral-text'
  }`;

function Header() {
  return (
    <header className="sticky top-0 z-40 h-[72px] bg-white border-b border-neutral-border flex items-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1280px] mx-auto w-full flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 bg-brand rounded-2xl flex items-center justify-center shadow-sm">
            <Flame size={18} className="text-white" />
          </div>
          <Logo />
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Навигация">
          <NavLink to="/dashboard" className={navLinkClass}>
            Дашборд
          </NavLink>
          <NavLink to="/challenges/create" className={navLinkClass}>
            Создать челлендж
          </NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <button
            aria-label="Уведомления"
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-neutral-card text-neutral-secondary hover:text-neutral-text transition-all duration-150"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand rounded-full border-2 border-white" aria-hidden="true" />
          </button>
          <button
            aria-label="Профиль пользователя"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-brand to-accent text-white shadow-sm hover:shadow-md transition-all duration-150"
          >
            <User size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}

function HeroBlock() {
  return (
    <section className="relative overflow-hidden bg-white border-b border-neutral-border py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1280px] mx-auto flex items-center justify-between gap-8">
        <div className="max-w-lg animate-slide-up">
          <div className="flex items-center gap-1.5 text-xs text-neutral-secondary mb-4">
            <Link to="/dashboard" className="hover:text-brand transition-colors">
              Дашборд
            </Link>
            <ChevronRight size={12} />
            <Link to="/challenges/create" className="hover:text-brand transition-colors">
              Челленджи
            </Link>
            <ChevronRight size={12} />
            <span className="text-brand font-medium">Создать</span>
          </div>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Trophy size={22} className="text-brand" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-text leading-tight tracking-tight">
              Создать новый<br />
              <span className="text-brand">челлендж</span>
            </h1>
          </div>

          <p className="text-base text-neutral-secondary leading-relaxed">
            Мотивируйте участников поддерживать спортивную активность между тренировками.
          </p>

          <div className="flex flex-wrap gap-2 mt-5">
            {[
              { label: '2 400+ челленджей', color: 'bg-brand/10 text-brand' },
              { label: '14 000+ участников', color: 'bg-success/60 text-green-700' },
              { label: 'Топ-платформа', color: 'bg-accent/60 text-amber-700' },
            ].map(({ label, color }) => (
              <span key={label} className={`text-xs font-semibold px-3 py-1.5 rounded-full ${color}`}>
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="hidden lg:flex items-center justify-center relative flex-shrink-0">
          <div className="relative w-52 h-52">
            <div className="absolute inset-0 rounded-full border-4 border-dashed border-brand/20 animate-spin" style={{ animationDuration: '20s' }} />
            <div className="absolute inset-6 rounded-full bg-gradient-to-br from-success/40 to-accent/40" />
            <div className="absolute inset-10 rounded-full bg-gradient-to-br from-brand to-accent flex items-center justify-center shadow-lg">
              <Zap size={32} className="text-white" />
            </div>
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <div
                key={deg}
                className="absolute w-3 h-3 rounded-full bg-brand/30"
                style={{
                  top: `calc(50% + ${Math.sin((deg * Math.PI) / 180) * 92}px - 6px)`,
                  left: `calc(50% + ${Math.cos((deg * Math.PI) / 180) * 92}px - 6px)`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ChallengeCreatePage() {
  const [formValues, setFormValues] = useState<Partial<ChallengeFormValues>>({
    type: 'individual',
    privacy: 'public',
  });
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'draft' | 'published' | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (values: ChallengeFormValues, exs: Exercise[], status: 'draft' | 'published') => {
    setIsSubmitting(true);
    setSubmitStatus(status);
    try {
      await new Promise<void>((res) => setTimeout(res, 1200));
      const challenge: Challenge = {
        id: crypto.randomUUID(),
        ...values,
        exercises: exs,
        status,
        createdAt: new Date().toISOString(),
      };
      console.log('Challenge created:', challenge);
      setToast({
        message: status === 'published' ? 'Челлендж опубликован!' : 'Черновик сохранён',
        type: 'success',
      });
    } catch {
      setToast({ message: 'Что-то пошло не так. Попробуйте ещё раз.', type: 'error' });
    } finally {
      setIsSubmitting(false);
      setSubmitStatus(null);
      setTimeout(() => setToast(null), 3500);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <HeroBlock />

      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="flex gap-8 items-start">
          <div className="flex-1 min-w-0">
            <ChallengeForm
              onValuesChange={setFormValues}
              onExercisesChange={setExercises}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              submitStatus={submitStatus}
            />
          </div>

          <div className="hidden lg:block w-80 flex-shrink-0">
            <ChallengePreview
              data={{ ...formValues }}
              exercises={exercises}
            />
          </div>
        </div>

        <div className="lg:hidden mt-8">
          <h2 className="text-lg font-bold text-neutral-text mb-4">Предпросмотр</h2>
          <ChallengePreview
            data={{ ...formValues }}
            exercises={exercises}
          />
        </div>
      </main>

      {toast && (
        <div
          role="alert"
          className={`
            fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-modal
            text-sm font-semibold animate-slide-up
            ${toast.type === 'success' ? 'bg-success text-green-800' : 'bg-red-50 text-red-700 border border-red-200'}
          `}
        >
          {toast.type === 'success' ? '✅' : '❌'}
          {toast.message}
        </div>
      )}
    </div>
  );
}
