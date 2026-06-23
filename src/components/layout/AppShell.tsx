import { NavLink, Outlet } from 'react-router-dom';
import { LayoutGrid, BarChart3, User, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { BrandLogoLink } from '../ui/BrandLogoLink.tsx';

const navItems = [
  { to: '/dashboard', label: 'Главная', icon: LayoutGrid, end: true },
  { to: '/challenges', label: 'Челленджи', icon: BarChart3, end: false },
  { to: '/settings', label: 'Профиль', icon: User, end: false },
];

function getDisplayName(username?: string, email?: string): string {
  if (username) return username;
  if (email) return email.split('@')[0];
  return 'runner';
}

function NavItem({
  to,
  label,
  icon: Icon,
  end,
  mobile = false,
}: {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  end?: boolean;
  mobile?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        mobile
          ? `flex flex-col items-center gap-1 flex-1 py-2 px-1 text-[11px] font-medium transition-colors ${
              isActive ? 'text-brand' : 'text-neutral-muted'
            }`
          : `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors relative ${
              isActive
                ? 'text-neutral-text bg-lime-pale'
                : 'text-neutral-muted hover:text-neutral-secondary hover:bg-neutral-card'
            }`
      }
    >
      {({ isActive }) =>
        mobile ? (
          <>
            <Icon size={20} className={isActive ? 'text-brand' : 'text-neutral-muted'} />
            <span>{label}</span>
          </>
        ) : (
          <>
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-lime rounded-r-full" />
            )}
            <Icon size={18} className={isActive ? 'text-neutral-text' : 'text-neutral-muted'} />
            {label}
          </>
        )
      }
    </NavLink>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const displayName = getDisplayName(user?.username, user?.email);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-neutral-card">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[240px] flex-shrink-0 bg-white border-r border-neutral-border flex-col fixed inset-y-0 left-0 z-30">
        <div className="px-6 pt-8 pb-6">
          <BrandLogoLink />
        </div>

        <nav className="flex-1 px-3 space-y-1" aria-label="Основная навигация">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
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

      {/* Mobile header */}
      <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-neutral-border px-4 py-3 flex items-center justify-between">
        <BrandLogoLink
          iconClassName="w-8 h-8 rounded-lg bg-lime flex-shrink-0"
          logoClassName="text-base font-extrabold truncate"
          className="inline-flex items-center gap-2.5 min-w-0 flex-shrink hover:opacity-90 transition-opacity"
        />
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-semibold text-neutral-secondary truncate max-w-[80px]">
            {displayName}
          </span>
          <button
            type="button"
            onClick={logout}
            aria-label="Выйти"
            className="p-2 rounded-xl text-neutral-muted hover:text-neutral-text hover:bg-neutral-card"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 lg:ml-[240px] min-h-0 pb-[72px] lg:pb-0">
        <Outlet />
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-neutral-border px-2 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex"
        aria-label="Мобильная навигация"
      >
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} mobile />
        ))}
      </nav>
    </div>
  );
}
