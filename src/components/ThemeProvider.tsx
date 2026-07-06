"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  isDarkMode: boolean;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  isDarkMode: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Centralized theme provider. Manages the `dark` class on <html>,
 * reads/writes localStorage('insight_theme'), and keeps all consumers in sync.
 *
 * Replaces the fragmented isDarkMode pattern across the app.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Initialize from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("insight_theme") as Theme | null;
    const initial: Theme = stored === "dark" ? "dark" : "light";
    setThemeState(initial);
    applyThemeToDOM(initial);
  }, []);

  const applyThemeToDOM = (t: Theme) => {
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    applyThemeToDOM(t);
    localStorage.setItem("insight_theme", t);
    // Dispatch storage event for any legacy listeners or cross-tab sync
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "insight_theme",
        newValue: t,
        storageArea: localStorage,
      })
    );
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyThemeToDOM(next);
      localStorage.setItem("insight_theme", next);
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "insight_theme",
          newValue: next,
          storageArea: localStorage,
        })
      );
      return next;
    });
  }, []);

  // Listen for cross-tab changes
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === "insight_theme") {
        const next: Theme = e.newValue === "light" ? "light" : "dark";
        setThemeState(next);
        applyThemeToDOM(next);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ theme, isDarkMode: theme === "dark", setTheme, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
