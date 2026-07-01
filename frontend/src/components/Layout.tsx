import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router-dom';
import type { ThemePreference } from '@daemonai/shared';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { to: '/', key: 'nav.chat', icon: '💬' },
  { to: '/history', key: 'nav.history', icon: '📖' },
  { to: '/insights', key: 'nav.insights', icon: '📈' },
] as const;

function ThemeToggle() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const options: Array<{ value: ThemePreference; label: string }> = [
    { value: 'system', label: t('common.themeSystem') },
    { value: 'light', label: t('common.themeLight') },
    { value: 'dark', label: t('common.themeDark') },
  ];
  return (
    <select
      aria-label={t('common.theme')}
      value={theme}
      onChange={(e) => setTheme(e.target.value as ThemePreference)}
      className="rounded-lg border border-surface-200 bg-transparent px-2 py-1 text-sm dark:border-surface-700"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Layout() {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-xs sm:flex-row sm:gap-2 sm:text-sm ${
      isActive
        ? 'font-semibold text-accent-700 dark:text-accent-400'
        : 'text-surface-700 hover:text-surface-900 dark:text-surface-300 dark:hover:text-surface-100'
    }`;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-surface-200 bg-surface-50/90 backdrop-blur dark:border-surface-800 dark:bg-surface-950/90">
        <div className="mx-auto flex max-w-content items-center justify-between gap-4 px-4 py-3">
          <span className="text-lg font-semibold tracking-tight">{t('app.name')}</span>
          <nav className="hidden gap-1 sm:flex" aria-label="Hauptnavigation">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
                {t(item.key)}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={signOut}
              className="rounded-lg px-2 py-1 text-sm text-surface-700 hover:text-surface-900 dark:text-surface-300 dark:hover:text-surface-100"
            >
              {t('nav.signOut')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-content flex-1 px-4 pb-20 pt-4 sm:pb-8">
        <Outlet />
      </main>

      {/* Mobile: Bottom-Navigation */}
      <nav
        className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-surface-200 bg-surface-50/95 py-2 backdrop-blur sm:hidden dark:border-surface-800 dark:bg-surface-950/95"
        aria-label="Hauptnavigation mobil"
      >
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
            <span aria-hidden>{item.icon}</span>
            {t(item.key)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
