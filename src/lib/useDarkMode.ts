import { useTheme } from '@/components/ThemeProvider';

/**
 * Shared dark mode hook — now a thin wrapper around the centralized ThemeProvider.
 * 
 * Kept for backwards compatibility with the many portal components that import it.
 * New code should use `useTheme()` from `@/components/ThemeProvider` directly.
 */
export function useDarkMode(): boolean {
  const { isDarkMode } = useTheme();
  return isDarkMode;
}
