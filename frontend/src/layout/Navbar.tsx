import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input, IconButton, Badge, Dropdown, Button } from "@/ui";
import {
  ShoppingCart,
  Search,
  Globe,
  ChevronDown,
  MapPin,
  Menu,
  Package,
} from "lucide-react";
import Container from "./Container";
import { useCartStore } from "@/features/cart/store";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import ThemeToggle from "@/theme/ThemeToggle";
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
            inline-flex items-center gap-1 rounded-lg px-2 py-1
            text-xs md:text-sm transition-colors
            border bg-[rgb(var(--card-2-rgb))] border-[rgb(var(--border-rgb))]
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
            inline-flex items-center gap-2 rounded-lg px-2 py-1
            text-xs md:text-sm transition-colors
            border bg-[rgb(var(--card-2-rgb))] border-[rgb(var(--border-rgb))]
            hover:bg-[rgb(var(--muted-rgb))]
          "
        >
          <span className="font-semibold">{currency}</span>
          <span className="text-[10px] md:text-xs opacity-70 hidden md:inline">
            {preview}
          </span>
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

  const [avatarError, setAvatarError] = useState(false);
  const avatarUrl = (user as any)?.avatarUrl as string | undefined;
  useEffect(() => {
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

  const greeting = user
    ? `Hola, ${user.name?.split(" ")[0] || "usuario"}`
    : "Hola, identifícate";

  return (
    <header className="sticky top-0 z-40 shadow-sm bg-[rgb(var(--card-rgb))]">
      {/* Barra superior info */}
      <div className="hidden md:block border-b border-[rgb(var(--border-rgb))]">
        <Container className="!max-w-none px-4 lg:px-10 flex items-center justify-between text-[11px] lg:text-xs xl:text-[13px] py-1 text-[rgb(var(--fg-rgb)/0.8)]">
          <div className="flex items-center gap-2">
            <span className="hidden lg:inline">
              Envíos con tracking y soporte humano.
            </span>
            <span className="lg:hidden">Envíos con tracking.</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => nav("/help")} // ⬅ CAMBIO AQUÍ
              className="hover:underline underline-offset-4"
            >
              Ayuda
            </button>

            <button
              type="button"
              onClick={() => nav("/orders")}
              className="flex items-center gap-1 hover:underline underline-offset-4"
            >
              <Package size={13} />
              <span>Rastrear pedido</span>
            </button>
          </div>
        </Container>
      </div>

      {/* Barra principal desktop/tablet */}
      <div className="hidden sm:block border-b border-[rgb(var(--border-rgb))]">
        <Container
          className="
            !max-w-none px-3 sm:px-4 md:px-6 lg:px-10 xl:px-14
            grid items-center gap-2 md:gap-3
            grid-cols-[auto_minmax(0,1.6fr)_auto]
            lg:grid-cols-[auto_minmax(0,2fr)_auto]
            xl:grid-cols-[auto_minmax(0,2.3fr)_auto]
            h-16 lg:h-20
          "
        >
          {/* Logo + ubicación */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              aria-label="Ir al inicio"
              className="
                font-extrabold tracking-tight text-transparent bg-clip-text
                bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)]
                text-lg md:text-xl xl:text-2xl select-none whitespace-nowrap
              "
            >
              tienda
            </Link>
            <button
              type="button"
              onClick={() => nav("/account/addresses/map")}
              className="
    hidden lg:flex items-center gap-1 px-2 py-1 rounded-lg
    hover:bg-[rgb(var(--card-2-rgb))]
    text-xs
  "
            >
              <MapPin size={14} />
              <span className="flex flex-col leading-tight text-left">
                <span className="text-[10px] opacity-60">Enviar a</span>
                <span className="text-[11px] font-medium truncate">
                  tu zona / dirección
                </span>
              </span>
            </button>
          </div>

          {/* Buscador grande (más ancho y alto) */}
          <form
            onSubmit={submit}
            role="search"
            aria-label="Buscar productos"
            className="w-full justify-self-center max-w-4xl xl:max-w-5xl 2xl:max-w-6xl"
          >
            <div
              className="
                group flex items-stretch w-full
                rounded-xl overflow-hidden
                bg-[rgb(var(--bg-rgb))]
                border border-[rgb(var(--border-rgb))]
                focus-within:ring-2 focus-within:ring-[rgb(var(--ring-rgb))]
                focus-within:border-transparent
                transition
              "
            >
              {/* Select de categoría ~25% */}
              <div
                className="
                  relative flex items-center
                  shrink-0
                  basis-[25%]
                  min-w-[140px] md:min-w-[160px] xl:min-w-[190px]
                  max-w-[260px] xl:max-w-[320px]
                  bg-[rgb(var(--card-2-rgb))]
                  border-r border-[rgb(var(--border-rgb))]
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
                    w-full
                    h-10 md:h-11 lg:h-12 xl:h-[3.05rem]
                    pl-3 pr-7
                    text-[11px] md:text-xs lg:text-sm xl:text-[15px]
                    bg-transparent
                    border-0
                    appearance-none
                    outline-none
                    cursor-pointer
                    truncate
                  "
                >
                  <option value="all">Todas las categorías</option>
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
                <span
                  className="
                    pointer-events-none
                    absolute right-2 top-1/2 -translate-y-1/2
                    text-[rgb(var(--fg-rgb)/0.6)]
                  "
                >
                  <ChevronDown size={16} />
                </span>
              </div>

              {/* Input */}
              <div className="relative flex-1 min-w-0">
                <label htmlFor="navbar-q" className="sr-only">
                  Buscar
                </label>
                <Input
                  id="navbar-q"
                  name="q"
                  autoComplete="off"
                  placeholder="Buscar productos, marcas, categorías..."
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="
                    h-10 md:h-11 lg:h-12 xl:h-[3.05rem]
                    border-0
                    rounded-none
                    bg-transparent
                    pl-3 pr-12
                    text-sm md:text-[15px] lg:text-base xl:text-[17px]
                    focus:ring-0 focus:outline-none
                  "
                />
                <button
                  type="submit"
                  aria-label="Buscar"
                  className="
                    absolute right-1.5 top-1/2 -translate-y-1/2
                    inline-flex items-center justify-center
                    h-8 w-8 md:h-9 md:w-9 lg:h-10 lg:w-10
                    rounded-lg transition
                    text-[rgb(var(--bg-rgb))]
                    bg-[rgb(var(--primary-rgb))]
                    hover:bg-[rgb(var(--primary-rgb)/0.9)]
                    focus-visible:outline-none
                  "
                >
                  <Search className="h-4 w-4 md:h-5 md:w-5" />
                </button>
              </div>
            </div>
          </form>

          {/* Derecha: idioma/moneda/tema + cuenta + carrito */}
          <div className="flex items-center gap-2 justify-self-end">
            <div className="hidden lg:flex items-center gap-2">
              <LangSwitcher />
              <CurrencySwitcher />
              <ThemeToggle />
            </div>

            {/* Cuenta */}
            <Dropdown
              trigger={
                <button
                  aria-label="Cuenta"
                  className="
                    hidden md:flex flex-col items-start px-2 py-1 rounded-lg
                    hover:bg-[rgb(var(--card-2-rgb))]
                    text-xs lg:text-[13px] leading-tight
                  "
                  title={user?.email || ""}
                >
                  <span className="opacity-80 text-[11px] lg:text-xs">
                    {greeting}
                  </span>
                  <span className="font-semibold text-[11px] lg:text-xs">
                    Cuenta y listas
                  </span>
                </button>
              }
              items={[
                ...(user
                  ? [
                      { label: "Mi cuenta", onSelect: () => nav("/me") },
                      {
                        label: "Mis pedidos",
                        onSelect: () => nav("/orders"),
                      },
                      ...(user.role === "ADMIN"
                        ? [
                            {
                              label: "Admin",
                              onSelect: () => nav("/admin"),
                            },
                            {
                              label: "Soporte",
                              onSelect: () => nav("/support"),
                            },
                          ]
                        : user.role === "SUPPORT"
                        ? [
                            {
                              label: "Soporte",
                              onSelect: () => nav("/support"),
                            },
                          ]
                        : []),
                      { label: "Salir", onSelect: logout },
                    ]
                  : [
                      {
                        label: "Entrar",
                        onSelect: () => nav("/login"),
                      },
                      {
                        label: "Crear cuenta",
                        onSelect: () => nav("/register"),
                      },
                    ]),
              ]}
            />
            {/* Avatar extra en lg+ */}
            {user && (
              <button
                aria-label="Perfil"
                title={user.name || user.email}
                className="
                  hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold
                  border bg-[rgb(var(--card-2-rgb))] border-[rgb(var(--border-rgb))]
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
            )}

            {/* Carrito */}
            <Link
              to="/cart"
              aria-label="Ir al carrito"
              className="
                relative inline-flex items-center gap-1.5 px-2 py-1 rounded-lg
                hover:bg-[rgb(var(--card-2-rgb))]
              "
            >
              <IconButton aria-label="Carrito" className="shadow-sm h-9 w-9">
                <ShoppingCart size={18} />
              </IconButton>
              <div className="hidden xl:flex flex-col leading-tight text-xs lg:text-[13px]">
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
          </div>
        </Container>

        {/* Segunda fila: links rápidos tipo Amazon */}
        <Container className="!max-w-none px-3 sm:px-4 md:px-6 lg:px-10 xl:px-14 hidden md:flex items-center gap-4 h-10 lg:h-11 text-[12px] lg:text-[13px] xl:text-sm text-[rgb(var(--fg-rgb)/0.9)]">
          <button
            type="button"
            onClick={() => nav("/categorias")}
            className="
              inline-flex items-center gap-1 px-2 py-1 rounded-lg
              hover:bg-[rgb(var(--card-2-rgb))]
              font-medium
            "
          >
            <Menu size={14} />
            <span>Todas las categorías</span>
          </button>

          <button
            type="button"
            onClick={() => nav("/?sort=createdAt:desc")}
            className="hover:underline underline-offset-4"
          >
            Novedades
          </button>
          <button
            type="button"
            onClick={() => nav("/ofertas")}
            className="hover:underline underline-offset-4"
          >
            Ofertas del día
          </button>
          <button
            type="button"
            onClick={() => nav("/?sort=best_sellers:desc")}
            className="hover:underline underline-offset-4"
          >
            Más vendidos
          </button>
          <button
            type="button"
            onClick={() => nav("/orders")}
            className="hover:underline underline-offset-4"
          >
            Mis pedidos
          </button>
          <button
            type="button"
            onClick={() => nav("/help")} // ⬅ CAMBIO AQUÍ
            className="hover:underline underline-offset-4"
          >
            Ayuda
          </button>

          <div className="ml-auto flex items-center gap-2 lg:hidden">
            <LangSwitcher />
            <CurrencySwitcher />
          </div>
        </Container>
      </div>

      {/* Móvil: barra compacta + buscador full-width */}
      <div className="sm:hidden border-b border-[rgb(var(--border-rgb))]">
        {/* Fila superior móvil */}
        <Container className="!max-w-none px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link
              to="/"
              aria-label="Ir al inicio"
              className="
                font-extrabold tracking-tight text-transparent bg-clip-text
                bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)]
                text-lg select-none
              "
            >
              tienda
            </Link>
            <button
              type="button"
              onClick={() => nav("/categorias")}
              className="
                inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px]
                bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))]
                hover:bg-[rgb(var(--muted-rgb))]
              "
            >
              <Menu size={14} />
              <span>Categorías</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <LangSwitcher />
            <CurrencySwitcher />
            <ThemeToggle />
            <Link
              to="/cart"
              aria-label="Ir al carrito"
              className="relative inline-flex items-center justify-center"
            >
              <IconButton aria-label="Carrito" className="h-9 w-9">
                <ShoppingCart size={18} />
              </IconButton>
              {count > 0 && (
                <span className="absolute -right-1 -top-1">
                  <Badge className="bg-[rgb(var(--primary-rgb))] text-[rgb(var(--bg-rgb))] border-none text-[10px]">
                    {count}
                  </Badge>
                </span>
              )}
            </Link>
          </div>
        </Container>

        {/* Buscador móvil */}
        <Container className="!max-w-none px-3 pb-3 space-y-2">
          <form
            onSubmit={submit}
            role="search"
            aria-label="Buscar productos"
            className="flex flex-col gap-2"
          >
            <div
              className="
                group flex items-stretch w-full
                rounded-xl overflow-hidden
                bg-[rgb(var(--bg-rgb))]
                border border-[rgb(var(--border-rgb))]
                focus-within:ring-2 focus-within:ring-[rgb(var(--ring-rgb))]
                focus-within:border-transparent
              "
            >
              <div className="relative flex items-center shrink-0 w-[110px] bg-[rgb(var(--card-2-rgb))] border-r border-[rgb(var(--border-rgb))]">
                <label htmlFor="navbar-cat-mobile" className="sr-only">
                  Categoría
                </label>
                <select
                  id="navbar-cat-mobile"
                  name="cat"
                  value={cat}
                  onChange={(e) => setCat(e.target.value)}
                  disabled={catsLoading || catsError}
                  className="
                    w-full h-9
                    pl-2 pr-6
                    text-[11px]
                    bg-transparent border-0
                    outline-none
                    appearance-none
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
                <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[rgb(var(--fg-rgb)/0.6)]">
                  <ChevronDown size={12} />
                </span>
              </div>

              <div className="relative flex-1 min-w-0">
                <Input
                  id="navbar-q-mobile"
                  name="q"
                  autoComplete="off"
                  placeholder="Buscar productos…"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="
                    h-9
                    border-0
                    rounded-none
                    bg-transparent
                    pl-2 pr-9
                    text-[13px]
                    focus:ring-0 focus:outline-none
                  "
                />
                <button
                  type="submit"
                  aria-label="Buscar"
                  className="
                    absolute right-1 top-1/2 -translate-y-1/2
                    inline-flex h-7 w-7 items-center justify-center
                    rounded-md
                    bg-[rgb(var(--primary-rgb))]
                    text-[rgb(var(--bg-rgb))]
                    hover:bg-[rgb(var(--primary-rgb)/0.9))]
                    text-xs
                  "
                >
                  <Search size={15} />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-[rgb(var(--fg-rgb)/0.8)]">
              <button
                type="button"
                onClick={() => nav("/ofertas")}
                className="hover:underline underline-offset-4"
              >
                Ofertas del día
              </button>
              <button
                type="button"
                onClick={() => nav("/orders")}
                className="hover:underline underline-offset-4"
              >
                Mis pedidos
              </button>
              <button
                type="button"
                onClick={() => nav("/help")} // ⬅ CAMBIO AQUÍ
                className="hover:underline underline-offset-4"
              >
                Ayuda
              </button>
            </div>
          </form>
        </Container>
      </div>
    </header>
  );
}
