(function () {
  try {
    const saved = localStorage.getItem("theme"); // "light" | "dark" | null
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const mode = saved === "light" || saved === "dark" ? saved : (prefersDark ? "dark" : "light");

    const html = document.documentElement;
    html.setAttribute("data-theme", mode);

    // Compat con Tailwind "dark" por clase
    if (mode === "dark") html.classList.add("dark");
    else html.classList.remove("dark");

    // Mejora contraste nativo de formularios/tooltips
    (html.style as any).colorScheme = mode;
  } catch {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.classList.remove("dark");
  }
})();
