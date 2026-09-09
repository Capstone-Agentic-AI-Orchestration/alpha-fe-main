import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'alpha_theme';

/**
 * Read the stored choice, falling back to the operating system.
 *
 * Wrapped because `localStorage` throws outright in a few real contexts — a
 * browser set to block site data, some private modes — and a theme preference
 * is not worth a blank screen.
 */
function storedTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

export function initialTheme(): Theme {
  return storedTheme() ?? systemTheme();
}

/**
 * The class on `<html>` is the single source of truth for the palette.
 *
 * `index.css` defines the light palette on bare `:root` and overrides it under
 * `.dark`, so removing the class is what makes the app light — there is no
 * second place to keep in step.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // The theme still applies for this session; it just will not be remembered.
    }
  }, [theme]);

  /*
   * Follow the system only while the user has expressed no preference of their
   * own. Someone who has chosen light should not be flipped at sunset by an
   * automatic dark-mode schedule.
   */
  useEffect(() => {
    if (storedTheme()) return;
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setTheme(e.matches ? 'light' : 'dark');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme(current => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, setTheme, toggle };
}
