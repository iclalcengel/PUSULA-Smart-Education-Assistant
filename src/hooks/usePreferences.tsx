import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { AppLanguage, TranslationKey, translate } from "@/lib/i18n";

type AppTheme = "light" | "dark";

interface PreferencesContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  t: (key: TranslationKey) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

const readLanguage = (): AppLanguage => {
  if (typeof window === "undefined") return "tr";
  return (window.localStorage.getItem("pusula-language") ?? window.localStorage.getItem("tutorly-language")) === "en" ? "en" : "tr";
};

const readTheme = (): AppTheme => {
  if (typeof window === "undefined") return "light";
  return (window.localStorage.getItem("pusula-theme") ?? window.localStorage.getItem("tutorly-theme")) === "dark" ? "dark" : "light";
};

export const PreferencesProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<AppLanguage>(readLanguage);
  const [theme, setTheme] = useState<AppTheme>(readTheme);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("pusula-language", language);
  }, [language]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem("pusula-theme", theme);
  }, [theme]);

  const value = useMemo<PreferencesContextValue>(() => ({
    language,
    setLanguage,
    theme,
    setTheme,
    toggleTheme: () => setTheme(current => current === "dark" ? "light" : "dark"),
    t: key => translate(language, key),
  }), [language, theme]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
};

export const usePreferences = () => {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used within PreferencesProvider");
  return context;
};
