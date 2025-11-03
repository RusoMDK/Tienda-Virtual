// src/layout/Navbar.tsx
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input, IconButton, Badge, Dropdown, Button } from "@/ui";
import { ShoppingCart, Search, User as UserIcon, Globe } from "lucide-react";
import Container from "./Container";
import { useCartStore } from "@/features/cart/store";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import ThemeToggle from "@/theme/ThemeToggle";

// Currency
import { useCurrency } from "@/features/currency/CurrencyProvider";
import { Price } from "@/features/currency/Price";

/* Utils */
function initials(name?: string | null, email?: string | null) {
  if (name && name.trim()) {
    const p = name.trim().split(/\s+/);
    return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase();
  }
  return (email?.[0] || "U").toUpperCase();
}
type Cat = {
  slug: string;
  name: string;
  sub?: { slug: string; name: string }[];
};

/* Language switcher */
function LangSwitcher() {
  const [lang, setLang] = useState<string>(() => {
    try {
      return localStorage.getItem("lang") || "ES";
    } catch {
      return "ES";
    }
  });
  function change(next: string) {
    setLang(next);
    try {
      localStorage.setItem("lang", next);
    } catch {}
  }
  return (
    <Dropdown
      trigger={
        <button
          aria-label="Idioma"
          title="Idioma"
          className="
            inline-flex items-center gap-1 rounded-xl px-2 py-1 text-sm transition-colors
            border bg-[rgb(var(--card-rgb))] border-[rgb(var(--border-rgb))]
            hover:bg-[rgb(var(--muted-rgb))]
          "
        >
          <Globe size={16} className="opacity-80" />
          <span className="hidden sm:inline">{lang}</span>
        </button>
      }
      items={[
        { label: "ES · Español", onSelect: () => change("ES") },
        { label: "EN · English", onSelect: () => change("EN") },
      ]}
    />
  );
}

/* Currency switcher — CUP primero y mostrando MN */
const CURRENCIES = ["CUP", "CLA", "USD", "EUR", "MXN", "CAD", "CHF"] as const;
type Code = (typeof CURRENCIES)[number];

function CurrencySwitcher() {
  const { currency, setCurrency, rates } = useCurrency();

  // Vista previa junto al trigger
  const preview =
    rates?.USD && currency !== "USD"
      ? (() => {
          if (currency === "CUP") {
            const v = Math.round((rates.USD || 0) * 100) / 100;
            return `· 1 USD≈${v} MN`;
          }
          const denom = (rates as any)?.[currency];
          if (!denom) return "";
          const v = Math.round(((rates.USD || 0) / denom) * 100) / 100;
          return `· 1 USD≈${v} ${currency}`;
        })()
      : "";

  // Etiquetas del menú
  const items = CURRENCIES.map((c) => {
    const label =
      c === "CUP"
        ? "CUP (MN)"
        : (rates as any)?.[c]
        ? `${c} · ${(rates as any)[c]} MN`
        : c;
    return { label, onSelect: () => setCurrency(c as Code) };
  });

  return (
    <Dropdown
      trigger={
        <button
          aria-label="Moneda"
          title={`Moneda: ${currency}`}
          className="
            inline-flex items-center gap-2 rounded-xl px-2 py-1 text-sm transition-colors
            border bg-[rgb(var(--card-rgb))] border-[rgb(var(--border-rgb))]
            hover:bg-[rgb(var(--muted-rgb))]
          "
        >
          <span className="font-semibold">{currency}</span>
          <span className="text-xs opacity-70 hidden md:inline">{preview}</span>
        </button>
      }
      items={items}
    />
  );
}

/* Navbar */
export default function Navbar() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  // Search state
  const [term, setTerm] = useState("");
  const [cat, setCat] = useState<string>("all");
  useEffect(() => {
    setTerm(sp.get("q") || "");
    setCat(sp.get("cat") || "all");
  }, [sp]);

  // Cart
  const items = useCartStore((s) => s.items);
  const count = useMemo(() => items.reduce((a, b) => a + b.qty, 0), [items]);
  const totalCentsUSD = useMemo(
    () => items.reduce((a, b) => a + b.price * b.qty, 0),
    [items]
  );

  // Currency helpers
  const { currency, convert, fmt } = useCurrency();
  const totalCentsActive = useMemo(
    () => convert(totalCentsUSD, "USD", currency),
    [totalCentsUSD, currency, convert]
  );
  const totalText = useMemo(() => {
    if (currency === "CUP") {
      const n = Math.max(0, totalCentsActive) / 100;
      return (
        new Intl.NumberFormat("es-CU", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(n) + " MN"
      );
    }
    return fmt(totalCentsActive, currency);
  }, [currency, totalCentsActive, fmt]);

  // Auth
  const { user, logout } = useAuth();

  // Control de fallback de avatar
  const [avatarError, setAvatarError] = useState(false);
  const avatarUrl = (user as any)?.avatarUrl as string | undefined;
  useEffect(() => {
    // si el usuario cambió de avatar, reintenta mostrarlo
    setAvatarError(false);
  }, [avatarUrl]);

  // Categorías
  const {
    data: categories,
    isLoading: catsLoading,
    isError: catsError,
  } = useQuery<Cat[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await api.get("/categories");
      return data as Cat[];
    },
    staleTime: 5 * 60_000,
  });
  const parentCats = useMemo(
    () => (categories || []).filter((c) => c.slug !== "all"),
    [categories]
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(sp);
    term ? next.set("q", term) : next.delete("q");
    cat && cat !== "all" ? next.set("cat", cat) : next.delete("cat");
    next.set("page", "1");
    nav(`/?${next.toString()}`);
  }

  const userInitials = user
    ? initials(user.name as any, user.email as any)
    : "U";
  const showAvatar = !!(avatarUrl && !avatarError);

  return (
    <header
      className="
        sticky top-0 z-40 backdrop-blur
        bg-[rgb(var(--bg-rgb)/0.70)]
        supports-[backdrop-filter]:bg-[rgb(var(--bg-rgb)/0.55)]
        border-b border-[rgb(var(--border-rgb))]
      "
    >
      {/* Grid 3 columnas: logo | buscador centrado | bloque derecho */}
      <Container
        className="
          grid items-center gap-2 md:gap-3 h-16 md:h-20
          grid-cols-[auto_minmax(360px,900px)_auto]
        "
      >
        {/* Logo */}
        <Link
          to="/"
          aria-label="Ir al inicio"
          className="
            font-extrabold tracking-tight text-transparent bg-clip-text
            bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)]
            text-lg md:text-xl select-none
          "
        >
          tienda
        </Link>

        {/* Buscador */}
        <form
          onSubmit={submit}
          role="search"
          aria-label="Buscar productos"
          className="hidden sm:block justify-self-center w-full"
        >
          <div
            className="
              group flex items-stretch w-full
              rounded-xl border border-[rgb(var(--border-rgb))]
              bg-[rgb(var(--card-rgb))]
              shadow-sm transition
              focus-within:ring-2 focus-within:ring-[rgb(var(--ring-rgb))]
              focus-within:border-transparent
              hover:bg-[rgb(var(--muted-rgb))]
            "
          >
            <label htmlFor="navbar-cat" className="sr-only">
              Categoría
            </label>
            <select
              id="navbar-cat"
              name="cat"
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              disabled={catsLoading || catsError}
              aria-label="Seleccionar categoría"
              className="
                shrink-0 h-10 md:h-11 w-24 md:w-28
                rounded-l-xl px-2 text-sm
                bg-transparent outline-none
              "
            >
              <option value="all">Todas</option>
              {parentCats.map((p) => (
                <optgroup key={p.slug} label={p.name}>
                  {(p.sub || []).map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
                  <option value={p.slug}>{p.name} (todo)</option>
                </optgroup>
              ))}
            </select>

            <label htmlFor="navbar-q" className="sr-only">
              Buscar
            </label>
            <div className="relative flex-1">
              <Input
                id="navbar-q"
                name="q"
                autoComplete="off"
                placeholder="Buscar productos…"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="
                  h-10 md:h-11 rounded-none border-0
                  bg-transparent pr-10
                  focus:ring-0 focus:outline-none
                "
              />
              <button
                type="submit"
                aria-label="Buscar"
                className="
                  absolute right-1.5 top-1/2 -translate-y-1/2
                  inline-flex h-8 w-8 items-center justify-center
                  rounded-lg transition
                  text-[rgb(var(--fg-rgb)/0.8)]
                  hover:bg-[rgb(var(--muted-rgb))]
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring-rgb))]
                "
              >
                <Search size={18} />
              </button>
            </div>
          </div>
        </form>

        {/* Derecha: Idioma / Moneda / Tema + Carrito + Perfil */}
        <div className="flex items-center gap-2 justify-self-end">
          <div className="hidden sm:flex items-center gap-2">
            <LangSwitcher />
            <CurrencySwitcher />
            <ThemeToggle />
          </div>

          <Link
            to="/cart"
            aria-label="Ir al carrito"
            className="
              relative inline-flex items-center gap-2 px-2 py-1 rounded-xl
              hover:bg-[rgb(var(--muted-rgb))]
            "
          >
            <IconButton aria-label="Carrito" className="shadow-sm">
              <ShoppingCart size={18} />
            </IconButton>
            <div className="hidden md:flex flex-col leading-tight text-sm">
              <span className="text-[rgb(var(--fg-rgb)/0.7)]">Total</span>
              <span className="font-semibold">
                {currency === "CUP" ? (
                  totalText
                ) : (
                  <Price cents={totalCentsUSD} currency="USD" />
                )}
              </span>
            </div>
            {count > 0 && (
              <span className="absolute -right-1 -top-1">
                <Badge className="bg-[rgb(var(--primary-rgb))] text-[rgb(var(--bg-rgb))] border-none">
                  {count}
                </Badge>
              </span>
            )}
          </Link>

          {user ? (
            <Dropdown
              trigger={
                <button
                  aria-label="Perfil"
                  title={user.name || user.email}
                  className="
                    inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold
                    border bg-[rgb(var(--card-rgb))] border-[rgb(var(--border-rgb))]
                    overflow-hidden
                  "
                >
                  {showAvatar ? (
                    <img
                      src={avatarUrl}
                      alt={user.name || user.email}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <span className="select-none">{userInitials}</span>
                  )}
                </button>
              }
              items={[
                ...(user.role === "ADMIN"
                  ? [
                      { label: "Admin", onSelect: () => nav("/admin") },
                      { label: "Soporte", onSelect: () => nav("/support") },
                    ]
                  : user.role === "SUPPORT"
                  ? [{ label: "Soporte", onSelect: () => nav("/support") }]
                  : []),
                { label: "Mi cuenta", onSelect: () => nav("/me") },
                { label: "Salir", onSelect: logout },
              ]}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-sm opacity-90 hover:opacity-100"
              >
                Entrar
              </Link>
              <Link to="/register">
                <Button size="sm" variant="primary" className="shadow-sm">
                  Crear cuenta
                </Button>
              </Link>
            </div>
          )}
        </div>
      </Container>

      {/* Móvil: buscador + idioma/moneda/tema */}
      <div className="sm:hidden border-t border-[rgb(var(--border-rgb))]">
        <Container className="py-2 space-y-2">
          {/* (omito el buscador móvil por brevedad si ya lo tenías) */}
          <div className="flex justify-end gap-2">
            <LangSwitcher />
            <CurrencySwitcher />
            <ThemeToggle />
          </div>
        </Container>
      </div>
    </header>
  );
}
