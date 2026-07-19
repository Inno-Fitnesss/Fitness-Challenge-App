import { Link, NavLink, Outlet } from 'react-router-dom';
import {
  LayoutGrid,
  BarChart3,
  Newspaper,
  Settings,
  LogOut,
  Home,
  ClipboardList,
  CircleUserRound,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useStepsAutoSync } from '../../hooks/useStepsAutoSync.ts';
import { BrandLogoLink } from '../ui/BrandLogoLink.tsx';
import { ProfileAvatar } from '../profile/ProfileAvatar.tsx';
import { AppOnboardingGate } from '../onboarding/AppOnboardingGate.tsx';

// label/icon — десктопный сайдбар, mobileLabel/mobileIcon — нижняя таб-панель
// по мобильным макетам (иконки и подписи там другие).
const navItems = [
  { to: '/dashboard', label: 'Главная', icon: LayoutGrid, mobileLabel: 'Главная', mobileIcon: Home, end: true, tourId: 'nav-dashboard' },
  { to: '/challenges', label: 'Челленджи', icon: BarChart3, mobileLabel: 'Челленджи', mobileIcon: BarChart3, end: false, tourId: 'nav-challenges' },
  { to: '/feed', label: 'Лента', icon: Newspaper, mobileLabel: 'Полезно', mobileIcon: ClipboardList, end: false, tourId: 'nav-feed' },
  { to: '/settings', label: 'Профиль', icon: Settings, mobileLabel: 'Профиль', mobileIcon: CircleUserRound, end: false, tourId: 'nav-profile' },
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
  mobileLabel,
  mobileIcon: MobileIcon,
  end,
  mobile = false,
  tourId,
}: {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  mobileLabel?: string;
  mobileIcon?: typeof LayoutGrid;
  end?: boolean;
  mobile?: boolean;
  tourId?: string;
}) {
  const TabIcon = MobileIcon ?? Icon;
  return (
    <NavLink
      to={to}
      end={end}
      data-tour={tourId}
      className={({ isActive }) =>
        mobile
          ? `flex flex-col items-center gap-1 flex-1 min-w-0 pt-2 pb-1 px-1 text-[11px] font-medium transition-colors ${
              isActive ? 'text-brand' : 'text-neutral-text'
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
            <TabIcon size={22} className={isActive ? 'text-brand' : 'text-neutral-text'} />
            <span className="truncate max-w-full">{mobileLabel ?? label}</span>
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

  // Keep steps flowing app-wide (profile + step challenges) while the app is open.
  useStepsAutoSync();

  return (
    <AppOnboardingGate>
    <div className="min-h-screen flex flex-col lg:flex-row bg-neutral-card">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[240px] flex-shrink-0 bg-white border-r border-neutral-border flex-col fixed inset-y-0 left-0 z-30">
        <div className="px-6 pt-8 pb-6">
          <BrandLogoLink showIcon={false} />
        </div>

        <nav className="flex-1 px-3 space-y-1" aria-label="Основная навигация">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="px-4 py-6 border-t border-neutral-border">
          <div className="flex items-center gap-3 px-2">
            <Link
              to="/settings"
              className="flex items-center gap-3 flex-1 min-w-0 rounded-xl px-1 py-1 -mx-1 hover:bg-neutral-card transition-colors"
              aria-label="Профиль"
            >
              <ProfileAvatar userId={user?.id ?? 0} username={displayName} size="md" />
              <span className="text-sm font-semibold text-neutral-text flex-1 truncate">{displayName}</span>
            </Link>
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

      {/* Main content */}
      <div className="flex-1 lg:ml-[240px] min-h-0 pb-[76px] lg:pb-0">
        <Outlet />
      </div>

      {/* Mobile bottom navigation */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-neutral-border px-2 pt-0.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex"
        aria-label="Мобильная навигация"
      >
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} mobile />
        ))}
      </nav>
    </div>
    </AppOnboardingGate>
  );
}
