// src/layout/Navbar.tsx
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input, Badge, Dropdown } from "@/ui";
import {
  ShoppingCart,
  Search,
  Globe,
  ChevronDown,
  MapPin,
  Menu,
  Package,
  Heart,
} from "lucide-react";
import Container from "./Container";
import { useCartStore } from "@/features/cart/store";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import ThemeToggle from "@/theme/ThemeToggle";
import { useCurrency } from "@/features/currency/CurrencyProvider";
import { Price } from "@/features/currency/Price";
import SearchBox from "@/features/Search/components/SearchBox";
import { NotificationDropdown } from "@/features/notifications/components/NotificationDropdown";
import { fetchWishlist, type WishlistItemDTO } from "@/features/wishlist/api";

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

  // Estado compartido de búsqueda (desktop + móvil)
  const [term, setTerm] = useState("");
  const [cat, setCat] = useState<string>("all");

  useEffect(() => {
    setTerm(sp.get("q") || "");
    setCat(sp.get("cat") || "all");
  }, [sp]);

  function goToSearch(params?: { q?: string; cat?: string }) {
    const qRaw = (params?.q ?? term).trim();
    const c = params?.cat ?? cat;

    const next = new URLSearchParams();
    if (qRaw) next.set("q", qRaw);
    if (c && c !== "all") next.set("cat", c);
    next.set("page", "1");

    nav(`/search?${next.toString()}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    goToSearch({});
  }

  // Cart
  const items = useCartStore((s) => s.items);
  const count = useMemo(() => items.reduce((a, b) => a + b.qty, 0), [items]);
  const totalCentsUSD = useMemo(
    () => items.reduce((a, b) => a + b.price * b.qty, 0),
    [items]
  );

  // Animación del carrito cuando cambia el número de ítems
  const [cartBump, setCartBump] = useState(false);
  const lastCount = useRef(count);

  useEffect(() => {
    if (count > lastCount.current) {
      setCartBump(true);
      const t = setTimeout(() => setCartBump(false), 350);
      return () => clearTimeout(t);
    }
    lastCount.current = count;
  }, [count]);

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
  const { user, logout, accessToken } = useAuth();

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

  // Wishlist: mismo fetch y key que useWishlist
  const { data: wishlistItems } = useQuery<WishlistItemDTO[]>({
    queryKey: ["wishlist"],
    enabled: !!user,
    queryFn: fetchWishlist,
    staleTime: 60_000,
  });

  const wishlistCount = wishlistItems?.length ?? 0;
  const hasWishlist = wishlistCount > 0;

  // Animación del corazón cuando aumenta la cantidad de favoritos
  const [favBump, setFavBump] = useState(false);
  const lastWishlistCount = useRef(wishlistCount);

  useEffect(() => {
    if (wishlistCount > lastWishlistCount.current) {
      setFavBump(true);
      const t = setTimeout(() => setFavBump(false), 350);
      return () => clearTimeout(t);
    }
    lastWishlistCount.current = wishlistCount;
  }, [wishlistCount]);

  const userInitials = user
    ? initials(user.name as any, user.email as any)
    : "U";
  const showAvatar = !!(avatarUrl && !avatarError);

  const greeting = user
    ? `Hola, ${user.name?.split(" ")[0] || "usuario"}`
    : "Hola, identifícate";

  // Hide / show navbar según scroll
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY || 0;
      const prev = lastScrollY.current;
      const diff = current - prev;

      if (Math.abs(diff) < 4) return;

      if (current < 40) {
        setNavHidden(false);
      } else if (diff > 0 && current > 80) {
        setNavHidden(true);
      } else if (diff < 0) {
        setNavHidden(false);
      }

      lastScrollY.current = current;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`
        sticky top-0 z-40 shadow-sm
        bg-[rgb(var(--card-rgb)/0.9)] backdrop-blur-md
        transition-transform duration-300
        ${navHidden ? "-translate-y-full" : "translate-y-0"}
      `}
    >
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
              onClick={() => nav("/help")}
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
            !max-w-none w-full
            px-3 sm:px-4 md:px-6 lg:px-10 xl:px-14
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

          {/* Buscador grande */}
          <SearchBox
            term={term}
            setTerm={setTerm}
            cat={cat}
            setCat={setCat}
            onSearch={goToSearch}
          />

          {/* Derecha */}
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
                      { label: "Mis pedidos", onSelect: () => nav("/orders") },
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

            {/* Notificaciones */}
            {user && (
              <NotificationDropdown
                accessToken={accessToken}
                onViewAll={() => nav("/notifications")}
              />
            )}

            {/* Favoritos */}
            <Link
              to="/wishlist"
              aria-label="Ver favoritos"
              className="
                relative inline-flex h-9 w-9 items-center justify-center
                rounded-full hover:bg-[rgb(var(--card-2-rgb))]
                transition-colors
              "
            >
              <Heart
                size={18}
                className={`
                  ${favBump ? "nav-icon-bounce" : ""}
                  ${
                    hasWishlist
                      ? "text-rose-500"
                      : "text-[rgb(var(--fg-rgb)/0.9)]"
                  }
                `}
                fill={hasWishlist ? "currentColor" : "none"}
              />
              {hasWishlist && (
                <span
                  className="
                    absolute -top-1 right-0
                    text-[9px] font-semibold
                    text-[rgb(var(--fg-rgb)/0.85)]
                  "
                >
                  {wishlistCount > 99 ? "99+" : wishlistCount}
                </span>
              )}
            </Link>

            {/* Carrito */}
            <Link
              to="/cart"
              aria-label="Ir al carrito"
              className="
                relative inline-flex items-center gap-1.5 px-2 py-1
                rounded-full hover:bg-[rgb(var(--card-2-rgb))]
                transition-colors
              "
            >
              <div
                className={`
                  relative inline-flex h-9 w-9 items-center justify-center rounded-full
                  ${cartBump ? "nav-icon-bounce" : ""}
                `}
              >
                <ShoppingCart
                  size={18}
                  className="text-[rgb(var(--fg-rgb)/0.95)]"
                />
                {count > 0 && (
                  <span className="absolute -right-1 -top-1">
                    <Badge className="bg-[rgb(var(--primary-rgb))] text-[rgb(var(--bg-rgb))] border-none">
                      {count}
                    </Badge>
                  </span>
                )}
              </div>
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
            </Link>
          </div>
        </Container>

        {/* Segunda fila */}
        <Container className="!max-w-none px-3 sm:px-4 md:px-6 lg:px-10 xl:px-14 hidden md:flex items-center gap-4 h-10 lg:h-11 text-[12px] lg:text-[13px] xl:text-sm text-[rgb(var(--fg-rgb)/0.9)]">
          <Dropdown
            trigger={({ open, toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className="
                  inline-flex items-center gap-1.5 rounded-lg px-2 py-1
                  text-xs lg:text-[13px] xl:text-sm
                  border bg-[rgb(var(--card-2-rgb))] border-[rgb(var(--border-rgb))]
                  hover:bg-[rgb(var(--muted-rgb))]
                  font-medium
                "
              >
                <Menu size={14} className="opacity-80" />
                <span>Todas las categorías</span>
                <ChevronDown
                  size={14}
                  className={`opacity-80 transition-transform duration-150 ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>
            )}
            items={[
              {
                label: "Todas las categorías",
                onSelect: () => nav("/categorias"),
              },
              ...(parentCats || []).flatMap((p) => [
                {
                  label: `${p.name} (todo)`,
                  onSelect: () => nav(`/categorias/${p.slug}`),
                },
                ...(p.sub || []).map((s) => ({
                  label: `· ${s.name}`,
                  onSelect: () => nav(`/categorias/${s.slug}`),
                })),
              ]),
            ]}
          />

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
            onClick={() => nav("/help")}
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

      {/* Móvil */}
      <div className="sm:hidden border-b border-[rgb(var(--border-rgb))]">
        <Container
          className="
            !max-w-none px-3 py-2
            flex flex-wrap items-center justify-between
            gap-x-2 gap-y-1
          "
        >
          <div className="flex items-center gap-2 min-w-0">
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
                border bg-[rgb(var(--card-2-rgb))] border-[rgb(var(--border-rgb))]
                hover:bg-[rgb(var(--muted-rgb))]
                font-medium
              "
            >
              <Menu size={14} className="opacity-80" />
              <span>Categorías</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <LangSwitcher />
            <CurrencySwitcher />
            <ThemeToggle />

            {/* Notificaciones móvil */}
            {user && (
              <NotificationDropdown
                accessToken={accessToken}
                onViewAll={() => nav("/notifications")}
              />
            )}

            {/* Favoritos móvil */}
            <Link
              to="/wishlist"
              aria-label="Ver favoritos"
              className="
                relative inline-flex h-9 w-9 items-center justify-center
                rounded-full hover:bg-[rgb(var(--card-2-rgb))]
                transition-colors
              "
            >
              <Heart
                size={18}
                className={`
                  ${favBump ? "nav-icon-bounce" : ""}
                  ${
                    hasWishlist
                      ? "text-rose-500"
                      : "text-[rgb(var(--fg-rgb)/0.9)]"
                  }
                `}
                fill={hasWishlist ? "currentColor" : "none"}
              />
              {hasWishlist && (
                <span
                  className="
                    absolute -top-1 right-0
                    text-[9px] font-semibold
                    text-[rgb(var(--fg-rgb)/0.85)]
                  "
                >
                  {wishlistCount > 99 ? "99+" : wishlistCount}
                </span>
              )}
            </Link>

            {/* Carrito móvil */}
            <Link
              to="/cart"
              aria-label="Ir al carrito"
              className="
                relative inline-flex h-9 w-9 items-center justify-center
                rounded-full hover:bg-[rgb(var(--card-2-rgb))]
                transition-colors
              "
            >
              <ShoppingCart
                size={18}
                className={`
                  text-[rgb(var(--fg-rgb)/0.95)]
                  ${cartBump ? "nav-icon-bounce" : ""}
                `}
              />
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
            onSubmit={handleSearchSubmit}
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
                    hover:bg-[rgb(var(--primary-rgb)/0.9)]
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
                onClick={() => nav("/help")}
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
