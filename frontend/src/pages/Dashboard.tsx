import { Link } from 'react-router-dom';
import { Flame, LogOut, Plus, Trophy, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';

const EXERCISES = [
  {
    id: 'pushups',
    name: 'Отжимания',
    icon: '💪',
    description: 'Классическое упражнение для грудных мышц и трицепсов',
  },
  {
    id: 'squats',
    name: 'Приседания',
    icon: '🦵',
    description: 'Базовое упражнение для укрепления ног и ягодиц',
  },
  {
    id: 'plank',
    name: 'Планка',
    icon: '🧘',
    description: 'Статическое упражнение для укрепления кора',
  },
];

export function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 h-[72px] bg-white border-b border-neutral-border">
        <div className="max-w-[1280px] mx-auto h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <Link to="/dashboard" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
              <div className="w-9 h-9 bg-brand rounded-2xl flex items-center justify-center shadow-sm">
                <Flame size={18} className="text-white" />
              </div>
              <Logo />
            </Link>
          </div>

          <nav className="hidden sm:flex items-center gap-1" aria-label="Навигация">
            <Link
              to="/dashboard"
              className="px-4 py-2 text-sm font-semibold text-brand bg-brand/5 rounded-xl"
            >
              Дашборд
            </Link>
            <Link
              to="/challenges/create"
              className="px-4 py-2 text-sm font-medium text-neutral-secondary rounded-xl hover:bg-neutral-card hover:text-neutral-text transition-all duration-150"
            >
              Создать челлендж
            </Link>
          </nav>

          <Button variant="ghost" size="md" onClick={logout}>
            <LogOut size={18} />
            <span className="hidden sm:inline">Выйти</span>
          </Button>
        </div>
      </header>

      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-16">
        <section className="mb-12 animate-slide-up">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-neutral-text mb-3">
            Добро пожаловать, {user?.firstName ?? 'User'}
          </h1>
          <p className="text-base text-neutral-secondary max-w-xl mb-8">
            Выберите упражнение и начните отслеживать свой прогресс сегодня.
          </p>

          <Link
            to="/challenges/create"
            className="group flex flex-col sm:flex-row sm:items-center gap-5 p-6 sm:p-8 rounded-3xl
              bg-gradient-to-br from-brand/5 via-accent/20 to-success/30
              border border-brand/15 shadow-card hover:shadow-card-hover
              transition-all duration-300 max-w-2xl"
          >
            <div className="w-14 h-14 bg-brand rounded-2xl flex items-center justify-center shadow-sm
              group-hover:scale-105 transition-transform duration-300 flex-shrink-0">
              <Trophy size={26} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-neutral-text mb-1.5">
                Создать челлендж
              </h2>
              <p className="text-sm text-neutral-secondary leading-relaxed">
                Запустите новый челлендж, добавьте упражнения и мотивируйте участников.
              </p>
            </div>
            <div className="flex items-center gap-2 text-brand font-semibold text-sm flex-shrink-0
              group-hover:gap-3 transition-all duration-200">
              <Plus size={18} />
              <span>Начать</span>
              <ChevronRight size={16} />
            </div>
          </Link>
        </section>

        <section>
          <h2 className="text-xl font-bold text-neutral-text mb-6">Упражнения</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {EXERCISES.map((exercise, index) => (
              <article
                key={exercise.id}
                className="group bg-white rounded-3xl border border-neutral-border shadow-card
                  p-6 sm:p-8 hover:shadow-card-hover hover:border-brand/20
                  transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <div className="w-14 h-14 bg-brand/10 rounded-2xl flex items-center justify-center text-2xl mb-5
                  group-hover:scale-110 transition-transform duration-300">
                  {exercise.icon}
                </div>
                <h3 className="text-lg font-bold text-neutral-text mb-2">{exercise.name}</h3>
                <p className="text-sm text-neutral-secondary leading-relaxed">
                  {exercise.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
