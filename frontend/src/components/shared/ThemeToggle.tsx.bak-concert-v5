import { Moon, Sun } from 'lucide-react';

import { useThemeStore } from '@/store/useThemeStore';

type ThemeToggleProps = {
  variant?: 'inline' | 'floating';
};

export function ThemeToggle({ variant = 'inline' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';

  const className = variant === 'floating'
    ? 'fixed bottom-5 right-5 z-[80] flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[#111129]/90 text-white shadow-2xl backdrop-blur-md transition hover:scale-105 hover:bg-[#1d1d3d] focus:outline-none focus:ring-2 focus:ring-primary/50'
    : 'inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-slate-900/90 text-gray-700 dark:text-slate-200 shadow-sm transition hover:bg-gray-50 dark:hover:bg-slate-800 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/15';

  return (
    <button
      type="button"
      aria-label={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      title={isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
      onClick={toggleTheme}
      className={className}
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
