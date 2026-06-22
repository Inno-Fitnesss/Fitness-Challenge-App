import { NavLink, Outlet } from 'react-router-dom';
import { LayoutGrid, BarChart3, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../ui/Logo';
import { BrandIcon } from '../ui/BrandIcon';

const navItems = [
  { to: '/dashboard', label: 'Главная', icon: LayoutGrid, end: true },
  { to: '/challenges', label: 'Челленджи', icon: BarChart3, end: false },
  { to: '/settings', label: 'Настройки', icon: Settings, end: false },
];

function getDisplayName(username?: string, email?: string): string {
  if (username) return username;
  if (email) return email.split('@')[0];
  return 'runner';
}

export function AppShell() {
  const { user, logout } = useAuth();
  const displayName = getDisplayName(user?.username, user?.email);

  return (
    <div className="min-h-screen flex bg-neutral-card">
      <aside className="w-[240px] flex-shrink-0 bg-white border-r border-neutral-border flex flex-col fixed inset-y-0 left-0 z-30">
        <div className="px-6 pt-8 pb-6">
          <div className="flex items-center gap-2.5">
            <BrandIcon />
            <Logo />
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1" aria-label="Основная навигация">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors relative ${
                  isActive
                    ? 'text-neutral-text bg-lime-pale'
                    : 'text-neutral-muted hover:text-neutral-secondary hover:bg-neutral-card'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-lime rounded-r-full" />
                  )}
                  <Icon size={18} className={isActive ? 'text-neutral-text' : 'text-neutral-muted'} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-6 border-t border-neutral-border">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-light to-accent flex items-center justify-center text-sm font-bold text-brand flex-shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-neutral-text flex-1 truncate">{displayName}</span>
            <button
              type="button"
              onClick={logout}
              aria-label="Выйти"
              className="p-1.5 rounded-lg text-neutral-muted hover:text-neutral-secondary hover:bg-neutral-card transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 ml-[240px] min-h-screen">
        <Outlet />
      </div>
    </div>
  );
}
