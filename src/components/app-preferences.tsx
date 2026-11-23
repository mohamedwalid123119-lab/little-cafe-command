
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DirectionProvider } from "@radix-ui/react-direction";
import { useRouterState } from "@tanstack/react-router";

export type AppLanguage = "ar" | "en";
export type AppTheme = "light" | "dark";

type Preferences = {
  language: AppLanguage;
  theme: AppTheme;
  setLanguage: (language: AppLanguage) => void;
  setTheme: (theme: AppTheme) => void;
  toggleLanguage: () => void;
  toggleTheme: () => void;
};

const PreferencesContext = createContext<Preferences | null>(null);

const STORAGE_KEY = "cafe-os-preferences";

function readPreferences(): { language: AppLanguage; theme: AppTheme } {
  if (typeof window === "undefined") {
    return { language: "ar", theme: "light" };
  }

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);

      return {
        language: parsed.language === "en" ? "en" : "ar",
        theme: parsed.theme === "dark" ? "dark" : "light",
      };
    }
  } catch {
    // Use defaults when stored preferences are invalid.
  }

  return { language: "ar", theme: "light" };
}

export function AppPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  const [language, setLanguageState] = useState<AppLanguage>("ar");
  const [theme, setThemeState] = useState<AppTheme>("light");
  const [ready, setReady] = useState(false);

  const isAppRoute =
    pathname === "/app" || pathname.startsWith("/app/");

  const effectiveLanguage: AppLanguage = isAppRoute ? language : "ar";

  useEffect(() => {
    const saved = readPreferences();
    setLanguageState(saved.language);
    setThemeState(saved.theme);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;

    const direction = effectiveLanguage === "ar" ? "rtl" : "ltr";

    document.documentElement.lang = effectiveLanguage;
    document.documentElement.dir = direction;
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ language, theme }),
    );
  }, [language, effectiveLanguage, theme, ready]);

  const setLanguage = useCallback((value: AppLanguage) => {
    setLanguageState(value);
  }, []);

  const setTheme = useCallback((value: AppTheme) => {
    setThemeState(value);
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguageState((current) => current === "ar" ? "en" : "ar");
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => current === "light" ? "dark" : "light");
  }, []);

  const value = useMemo(
    () => ({
      language,
      theme,
      setLanguage,
      setTheme,
      toggleLanguage,
      toggleTheme,
    }),
    [language, theme, setLanguage, setTheme, toggleLanguage, toggleTheme],
  );

  return (
    <PreferencesContext.Provider value={value}>
      <DirectionProvider dir={effectiveLanguage === "ar" ? "rtl" : "ltr"}>
        {children}
      </DirectionProvider>
    </PreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error(
      "useAppPreferences must be used inside AppPreferencesProvider.",
    );
  }

  return context;
}
