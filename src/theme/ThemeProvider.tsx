import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Theme = "light" | "dark" | "system";
type Effective = "light" | "dark";

type ThemeCtx = {
  theme: Theme;
  effectiveTheme: Effective;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeCtx | undefined>(undefined);
const THEME_KEY = "theme";

function getSystemPref(): Effective {
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}
function calcEffective(theme: Theme): Effective {
  return theme === "system" ? getSystemPref() : theme;
}

/** Applicera tema-attributen på <html> */
function applyToDom(effective: Effective) {
  const root = document.documentElement;
  // Vårt eget attribut (används i theme.css)
  root.setAttribute("data-theme", effective);
  // Bootstrap 5.3 temaväxling (låter komponenter följa temat)
  root.setAttribute("data-bs-theme", effective);
  // För native formulärelement m.m.
  root.style.colorScheme = effective;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const raw = localStorage.getItem(THEME_KEY) as Theme | null;
    return raw ?? "system";
  });

  const effectiveTheme = useMemo(() => calcEffective(theme), [theme]);

  useEffect(() => {
    applyToDom(effectiveTheme);
  }, [effectiveTheme]);

  // Lyssna på systemtema om man valt "system"
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyToDom(mq.matches ? "dark" : "light");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [theme]);

  const setTheme = (t: Theme) => {
    localStorage.setItem(THEME_KEY, t);
    setThemeState(t);
  };
  const toggle = () => {
    setTheme(theme === "dark" ? "light" : theme === "light" ? "dark" : "light");
  };

  const value: ThemeCtx = { theme, effectiveTheme, setTheme, toggle };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
