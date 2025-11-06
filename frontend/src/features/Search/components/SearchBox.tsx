import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Input, Dropdown } from "@/ui";
import { ChevronDown, Search } from "lucide-react";
import { api } from "@/lib/api";
import { Price } from "@/features/currency/Price";

type Cat = {
  slug: string;
  name: string;
  sub?: { slug: string; name: string }[];
};

type SearchSuggestion = {
  term: string;
  categories: {
    slug: string;
    name: string;
    count: number;
  }[];
  products: {
    id: string;
    slug: string;
    name: string;
    price: number;
    currency: string;
    thumbnailUrl?: string | null;
  }[];
};

type SearchBoxProps = {
  term: string;
  setTerm: (value: string) => void;
  cat: string;
  setCat: (value: string) => void;
  onSearch: (params?: { q?: string; cat?: string }) => void;
  className?: string;
};

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 220;

export default function SearchBox({
  term,
  setTerm,
  cat,
  setCat,
  onSearch,
  className,
}: SearchBoxProps) {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  // Mantener sincronía con la URL (por si entras de /search directamente)
  useEffect(() => {
    const qParam = sp.get("q") || "";
    const catParam = sp.get("cat") || "all";
    if (qParam !== term) setTerm(qParam);
    if (catParam !== cat) setCat(catParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  // Categorías (para el dropdown del buscador)
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

  const currentCatLabel = useMemo(() => {
    if (cat === "all") return "Todas las categorías";
    for (const p of parentCats) {
      if (p.slug === cat) return `${p.name} (todo)`;
      const sub = p.sub?.find((s) => s.slug === cat);
      if (sub) return sub.name;
    }
    return "Todas las categorías";
  }, [cat, parentCats]);

  // Autocompletar
  const [suggestions, setSuggestions] = useState<SearchSuggestion | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const searchBoxRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Ocultar autocompletado al hacer click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!searchBoxRef.current) return;
      if (!searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch de sugerencias
  useEffect(() => {
    const raw = term.trim();

    if (!raw || raw.length < MIN_QUERY_LENGTH) {
      setSuggestions(null);
      setShowSuggestions(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const timeoutId = setTimeout(async () => {
      try {
        setSuggestionsLoading(true);
        const { data } = await api.get("/search/suggest", {
          params: {
            q: raw,
            cat: cat === "all" ? undefined : cat,
            limit: 6,
          },
          signal: controller.signal as any,
        });

        if (!cancelled) {
          setSuggestions(data as SearchSuggestion);

          // Si el input sigue enfocado y la query es suficientemente larga,
          // abrimos el dropdown
          if (
            raw.length >= MIN_QUERY_LENGTH &&
            document.activeElement === inputRef.current
          ) {
            setShowSuggestions(true);
          }
        }
      } catch (err: any) {
        if (
          cancelled ||
          err?.name === "AbortError" ||
          err?.code === "ERR_CANCELED" ||
          err?.message?.includes("canceled")
        ) {
          return;
        }
        console.error("Error fetching suggestions", err);
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [term, cat]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSearch({});
    setShowSuggestions(false);
  }

  function handleSearchClick() {
    onSearch({});
    setShowSuggestions(false);
  }

  function handleSearchTerm(termOverride?: string, catOverride?: string) {
    onSearch({ q: termOverride, cat: catOverride });
    setShowSuggestions(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Buscar productos"
      className={`w-full justify-self-stretch ${className ?? ""}`}
    >
      <div className="relative" ref={searchBoxRef}>
        <div
          className="
            group flex items-stretch w-full
            rounded-xl
            bg-[rgb(var(--bg-rgb))]
            border border-[rgb(var(--border-rgb))]
            focus-within:ring-2 focus-within:ring-[rgb(var(--ring-rgb))]
            focus-within:border-transparent
            transition
          "
        >
          {/* Selector de categoría */}
          <div
            className="
              relative flex items-center
              shrink-0
              bg-[rgb(var(--card-2-rgb))]
              border-r border-[rgb(var(--border-rgb))]
              max-w-[50%]
              rounded-l-xl
            "
          >
            <span className="sr-only" id="navbar-cat-label">
              Categoría
            </span>
            <Dropdown
              align="left"
              trigger={({ open, toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  aria-labelledby="navbar-cat-label"
                  aria-expanded={open}
                  className="
                    inline-flex items-center justify-between
                    w-auto max-w-full
                    h-10 md:h-11 lg:h-12 xl:h-[3.05rem]
                    px-3
                    text-[11px] md:text-xs lg:text-sm xl:text-[15px]
                    bg-transparent
                  "
                  disabled={catsLoading || catsError}
                >
                  <span className="truncate whitespace-nowrap text-left">
                    {currentCatLabel}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`ml-1 shrink-0 opacity-70 transition-transform duration-150 ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>
              )}
              items={[
                {
                  label: "Todas las categorías",
                  onSelect: () => setCat("all"),
                },
                ...(parentCats || []).flatMap((p) => [
                  {
                    label: `${p.name} (todo)`,
                    onSelect: () => setCat(p.slug),
                  },
                  ...(p.sub || []).map((s) => ({
                    label: `· ${s.name}`,
                    onSelect: () => setCat(s.slug),
                  })),
                ]),
              ]}
            />
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
              ref={inputRef}
              placeholder="Buscar productos, marcas, categorías..."
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onFocus={() => {
                if (term.trim().length >= MIN_QUERY_LENGTH && suggestions) {
                  setShowSuggestions(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setShowSuggestions(false);
                  (e.currentTarget as HTMLInputElement).blur();
                }
              }}
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
              onClick={handleSearchClick}
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

        {/* Sugerencias de búsqueda tipo Amazon */}
        {showSuggestions && term.trim().length >= MIN_QUERY_LENGTH && (
          <div
            className="
              absolute left-0 right-0 top-full mt-1
              rounded-xl border border-[rgb(var(--border-rgb))]
              bg-[rgb(var(--card-rgb))]
              shadow-xl z-30
              max-h-[420px] overflow-y-auto
              text-sm
            "
          >
            <button
              type="button"
              onClick={() => handleSearchTerm(term)}
              className="
                w-full text-left px-3 py-2
                hover:bg-[rgb(var(--muted-rgb))]
                flex items-center gap-2
              "
            >
              <Search size={14} className="opacity-70" />
              <span>
                Buscar <span className="font-semibold">“{term}”</span> en todos
                los productos
              </span>
            </button>

            {suggestionsLoading && (
              <div className="px-3 py-2 text-[12px] text-[rgb(var(--fg-rgb)/0.7)]">
                Buscando sugerencias…
              </div>
            )}

            {suggestions && (
              <>
                {suggestions.products.length > 0 && (
                  <div className="border-t border-[rgb(var(--border-rgb))] pt-1 pb-2">
                    <p className="px-3 pt-1 pb-1 text-[11px] uppercase tracking-wide text-[rgb(var(--fg-rgb)/0.6)]">
                      Productos
                    </p>
                    <ul>
                      {suggestions.products.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => handleSearchTerm(p.name, cat)}
                            className="
                              w-full flex items-center gap-2 px-3 py-1.5
                              hover:bg-[rgb(var(--muted-rgb))/80]
                              text-sm
                            "
                          >
                            {p.thumbnailUrl ? (
                              <img
                                src={p.thumbnailUrl}
                                alt={p.name}
                                className="h-8 w-8 rounded object-cover flex-shrink-0"
                              />
                            ) : (
                              <div
                                className="
                                  h-8 w-8 rounded
                                  bg-[rgb(var(--card-2-rgb))]
                                  flex items-center justify-center
                                  text-[10px] text-[rgb(var(--fg-rgb)/0.6)]
                                  flex-shrink-0
                                "
                              >
                                IMG
                              </div>
                            )}
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{p.name}</span>
                              <span className="text-[11px] text-[rgb(var(--fg-rgb)/0.7)]">
                                <Price
                                  cents={p.price}
                                  currency={(p.currency || "USD").toUpperCase()}
                                />
                              </span>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {suggestions.categories.length > 0 && (
                  <div className="border-t border-[rgb(var(--border-rgb))] pt-1 pb-2">
                    <p className="px-3 pt-1 pb-1 text-[11px] uppercase tracking-wide text-[rgb(var(--fg-rgb)/0.6)]">
                      Categorías
                    </p>
                    <ul>
                      {suggestions.categories.map((categ) => (
                        <li key={categ.slug}>
                          <button
                            type="button"
                            onClick={() => handleSearchTerm(term, categ.slug)}
                            className="
                              w-full px-3 py-1.5
                              hover:bg-[rgb(var(--muted-rgb))/80]
                              flex items-center justify-between gap-2
                            "
                          >
                            <span>{categ.name}</span>
                            <span className="text-[11px] text-[rgb(var(--fg-rgb)/0.6)]">
                              {categ.count} resultados
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
