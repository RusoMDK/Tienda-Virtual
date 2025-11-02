import { useEffect, useState, useCallback } from "react";

type ThemeMode = "light" | "dark";
const STORAGE_KEY = "theme";

function systemPref(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(mode: ThemeMode) {
  const themeName = mode === "dark" ? "caribe-minimal" : "claro-tropical";
  const html = document.documentElement;
  html.setAttribute("data-theme", themeName);
  // Mejora contraste en inputs nativos/tooltips
  html.style.colorScheme = mode;
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    const saved = (localStorage.getItem(STORAGE_KEY) as ThemeMode) || systemPref();
    return saved;
  });

  useEffect(() => {
    applyTheme(mode);
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
  }, [mode]);

  // Si el usuario cambia el sistema mientras está en la página (no persistimos auto)
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (!saved) setMode(mql.matches ? "dark" : "light");
    };
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, []);

  const toggle = useCallback(() => {
    setMode((m) => (m === "dark" ? "light" : "dark"));
  }, []);

  return { mode, setMode, toggle };
}
