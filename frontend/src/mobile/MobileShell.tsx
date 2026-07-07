import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, ClipboardList, Home, UserCircle } from 'lucide-react';

const navItems = [
  { to: '/dashboard', label: 'Главная', icon: Home, end: true },
  { to: '/challenges', label: 'Соревнования', icon: BarChart3, end: false },
  { to: '/articles', label: 'Статьи', icon: ClipboardList, end: false },
  { to: '/settings', label: 'Профиль', icon: UserCircle, end: false },
];

export function MobileShell() {
  return (
    <div className="min-h-dvh bg-neutral-card text-neutral-text">
      <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-neutral-card">
        <main className="min-h-dvh pb-[84px]">
          <Outlet />
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[430px] items-end justify-around border-t border-neutral-border bg-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-1"
          aria-label="Мобильная навигация"
        >
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex h-14 flex-1 flex-col items-center justify-end gap-1 rounded-lg text-[9px] font-medium transition-colors ${
                  isActive ? 'text-black' : 'text-black/85'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute -top-1 h-[3px] w-12 rounded-full bg-black"
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    size={24}
                    strokeWidth={isActive ? 3 : 2.2}
                    fill={isActive ? 'currentColor' : 'none'}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
