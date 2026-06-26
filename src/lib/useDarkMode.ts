import { useState, useEffect } from 'react';

/**
 * Shared dark mode hook. Reads from localStorage ('insight_theme')
 * and listens for cross-tab storage events + same-window dispatched
 * StorageEvents so all components stay in sync.
 */
export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const check = () => {
      setIsDark(localStorage.getItem('insight_theme') === 'dark');
    };
    check();

    // Listen for storage events (both cross-tab and same-window dispatched)
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'insight_theme') setIsDark(e.newValue === 'dark');
    };
    window.addEventListener('storage', onStorage);

    // Poll for same-window changes as a failsafe
    const interval = setInterval(check, 500);
    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, []);

  return isDark;
}
