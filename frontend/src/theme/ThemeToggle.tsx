import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

function applyTheme(next: "light" | "dark") {
  const el = document.documentElement;
  el.setAttribute("data-theme", next);
  if (next === "dark") el.classList.add("dark");
  else el.classList.remove("dark");
  try {
    localStorage.setItem("theme", next);
  } catch {}
  (el.style as any).colorScheme = next;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as
        | "light"
        | "dark"
        | null) ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light");
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Cambiar a claro" : "Cambiar a oscuro"}
      title={isDark ? "Tema: Oscuro" : "Tema: Claro"}
      className="
        inline-flex items-center gap-1 rounded-xl px-2 py-1 text-sm
        transition-colors border
        bg-[rgb(var(--card-rgb))] border-[rgb(var(--line-rgb))]
        hover:bg-[rgb(var(--muted-rgb))]
      "
    >
      {isDark ? (
        <Moon size={16} className="opacity-80" />
      ) : (
        <Sun size={16} className="opacity-80" />
      )}
      <span className="hidden sm:inline">{isDark ? "Oscuro" : "Claro"}</span>
    </button>
  );
}
