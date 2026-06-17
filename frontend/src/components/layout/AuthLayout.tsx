import { Flame } from 'lucide-react';
import { Logo } from '../ui/Logo';

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-white flex">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-brand/5 via-accent/20 to-success/30">
        <div className="absolute inset-0 flex flex-col justify-center px-16 xl:px-24">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-brand rounded-2xl flex items-center justify-center shadow-sm">
              <Flame size={24} className="text-white" />
            </div>
            <Logo className="text-2xl font-extrabold tracking-tight text-neutral-text" />
          </div>

          <h1 className="text-4xl xl:text-5xl font-extrabold text-neutral-text leading-tight tracking-tight mb-6">
            Stay active between<br />
            <span className="text-brand">training sessions</span>
          </h1>

          <p className="text-lg text-neutral-secondary leading-relaxed max-w-md">
            Join challenges, track your progress, and keep your fitness momentum going with personalized workouts.
          </p>

          <div className="flex flex-wrap gap-3 mt-10">
            {['Push-ups', 'Squats', 'Plank'].map((exercise) => (
              <span
                key={exercise}
                className="text-sm font-semibold px-4 py-2 rounded-full bg-white/80 text-neutral-text shadow-sm"
              >
                {exercise}
              </span>
            ))}
          </div>
        </div>

        <div className="absolute -bottom-20 -right-20 w-80 h-80 rounded-full bg-brand/10" aria-hidden="true" />
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-accent/30" aria-hidden="true" />
      </div>

      <div className="flex-1 flex flex-col justify-center px-4 sm:px-8 lg:px-16 xl:px-24 py-12">
        <div className="lg:hidden flex items-center justify-center gap-2.5 mb-10">
          <div className="w-10 h-10 bg-brand rounded-2xl flex items-center justify-center shadow-sm">
            <Flame size={20} className="text-white" />
          </div>
          <Logo className="text-xl font-extrabold tracking-tight text-neutral-text" />
        </div>

        <div className="w-full max-w-md mx-auto animate-slide-up">
          {children}
        </div>
      </div>
    </div>
  );
}
