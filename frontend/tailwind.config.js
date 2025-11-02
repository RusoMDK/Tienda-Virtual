// tailwind.config.ts
import type { Config } from "tailwindcss";

export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      container: { center: true, padding: "1rem" },
      colors: {
        bg:       "rgb(var(--bg-rgb) / <alpha-value>)",
        fg:       "rgb(var(--fg-rgb) / <alpha-value>)",
        card:     "rgb(var(--card-rgb) / <alpha-value>)",
        "card-2": "rgb(var(--card-2-rgb) / <alpha-value>)",
        elev:     "rgb(var(--elev-rgb) / <alpha-value>)",
        border:   "rgb(var(--border-rgb) / <alpha-value>)",
        primary:  "rgb(var(--primary-rgb) / <alpha-value>)",
        accent:   "rgb(var(--accent-rgb) / <alpha-value>)",
        danger:   "rgb(var(--danger-rgb) / <alpha-value>)",
        zinc: {
          50:  "rgb(var(--zinc-50) / <alpha-value>)",
          100: "rgb(var(--zinc-100) / <alpha-value>)",
          200: "rgb(var(--zinc-200) / <alpha-value>)",
          300: "rgb(var(--zinc-300) / <alpha-value>)",
          400: "rgb(var(--zinc-400) / <alpha-value>)",
          500: "rgb(var(--zinc-500) / <alpha-value>)",
          600: "rgb(var(--zinc-600) / <alpha-value>)",
          700: "rgb(var(--zinc-700) / <alpha-value>)",
          800: "rgb(var(--zinc-800) / <alpha-value>)",
          900: "rgb(var(--zinc-900) / <alpha-value>)",
        },
      },
      borderColor: { DEFAULT: "rgb(var(--border-rgb) / <alpha-value>)" },
      ringColor:   { DEFAULT: "rgb(var(--ring-rgb) / <alpha-value>)" },
    },
  },
  plugins: [],
} satisfies Config;
