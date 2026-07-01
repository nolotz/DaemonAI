import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ThemePreference } from '@daemonai/shared';

interface ThemeState {
  theme: ThemePreference;
  setTheme(theme: ThemePreference): void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeState | null>(null);

function computeIsDark(theme: ThemePreference): boolean {
  return (
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(
    () => (localStorage.getItem('theme') as ThemePreference) ?? 'system'
  );
  const [isDark, setIsDark] = useState(() => computeIsDark(theme));

  useEffect(() => {
    const apply = () => {
      const dark = computeIsDark(theme);
      document.documentElement.classList.toggle('dark', dark);
      setIsDark(dark);
    };
    apply();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = (next: ThemePreference) => {
    localStorage.setItem('theme', next);
    setThemeState(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme außerhalb des ThemeProviders');
  return ctx;
}
