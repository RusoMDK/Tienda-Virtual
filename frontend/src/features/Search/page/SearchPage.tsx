import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Star, Truck, Store } from "lucide-react";
import { api } from "@/lib/api";
import { Price } from "@/features/currency/Price";
import SearchContainer from "../layout/container";
import SearchFilters from "../components/SearchFilters";

type ProductCondition = "NEW" | "USED" | "REFURBISHED";
type ConditionGrade = "LIKE_NEW" | "VERY_GOOD" | "GOOD" | "ACCEPTABLE";

type ProductMetadata = Record<string, unknown> | null | undefined;

type ProductHit = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  price: number; // centavos
  currency: string;
  imageUrl?: string | null;
  ratingAvg: number;
  ratingCount: number;
  brand?: string | null;
  condition?: ProductCondition;
  conditionGrade?: ConditionGrade | null;
  conditionNote?: string | null;
  mainColor?: string | null;
  homeDeliveryAvailable?: boolean;
  storePickupAvailable?: boolean;
  warrantyMonths?: number | null;
  warrantyType?: string | null;
  warrantyDescription?: string | null;
  metadata?: ProductMetadata;
};

type SearchProductsResponse = {
  items: ProductHit[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function formatCondition(condition?: ProductCondition) {
  if (!condition) return null;
  if (condition === "NEW") return "Nuevo";
  if (condition === "USED") return "Usado";
  return "Reacondicionado";
}

function formatConditionGrade(grade?: ConditionGrade | null) {
  if (!grade) return null;
  switch (grade) {
    case "LIKE_NEW":
      return "Como nuevo";
    case "VERY_GOOD":
      return "Muy bueno";
    case "GOOD":
      return "Bueno";
    case "ACCEPTABLE":
      return "Aceptable";
    default:
      return null;
  }
}

function formatSpecKey(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^\w/u, (c) => c.toUpperCase());
}

// Misma normalización que en Navbar (tildes, mayus, b/v, espacios)
function normalizeForSearch(q: string) {
  return q
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[v]/g, "b")
    .replace(/\s+/g, " ")
    .trim();
}

export default function SearchPage() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();

  const qRaw = sp.get("q") || ""; // lo que ve el usuario
  const qNormalized = normalizeForSearch(qRaw); // lo que va al backend

  const cat = sp.get("cat") || "all";
  const page = Math.max(1, Number(sp.get("page") || "1"));
  const sort = sp.get("sort") || "relevance";
  const ratingFilter = sp.get("rating") || "";
  const conditionFilter = sp.get("condition") || "";
  const minPriceParam = sp.get("minPrice") || "";
  const maxPriceParam = sp.get("maxPrice") || "";
  const colorParam = sp.get("color") || "";
  const homeDeliveryParam = sp.get("homeDelivery") || "";
  const minWarrantyParam = sp.get("minWarrantyMonths") || "";

  const [queryVersion, setQueryVersion] = useState(0);

  function updateParams(next: Record<string, string | null | undefined>) {
    const p = new URLSearchParams(sp);
    let pageTouched = false;

    Object.entries(next).forEach(([key, value]) => {
      if (key === "page") pageTouched = true;
      if (value == null || value === "") p.delete(key);
      else p.set(key, value);
    });

    if (!pageTouched) {
      p.set("page", "1");
    }

    setSp(p, { replace: true });
    setQueryVersion((v) => v + 1);
  }

  const { data, isLoading, isError } = useQuery<SearchProductsResponse>({
    queryKey: [
      "search-products",
      qNormalized,
      cat,
      page,
      sort,
      ratingFilter,
      conditionFilter,
      minPriceParam,
      maxPriceParam,
      colorParam,
      homeDeliveryParam,
      minWarrantyParam,
      queryVersion,
    ],
    queryFn: async () => {
      const { data } = await api.get("/search/products", {
        params: {
          q: qNormalized || undefined,
          cat: cat === "all" ? undefined : cat,
          page,
          sort,
          rating: ratingFilter || undefined,
          condition: conditionFilter || undefined,
          minPrice: minPriceParam || undefined,
          maxPrice: maxPriceParam || undefined,
          color: colorParam || undefined,
          homeDelivery: homeDeliveryParam || undefined,
          minWarrantyMonths: minWarrantyParam || undefined,
        },
      });
      return data as SearchProductsResponse;
    },
    keepPreviousData: true,
  });

  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;

  const subtitle = useMemo(() => {
    if (!qRaw && cat === "all") return "Todos los productos";
    if (qRaw && cat === "all") return `Resultados para “${qRaw}”`;
    if (!qRaw && cat !== "all") return `Productos de la categoría`;
    return `Resultados para “${qRaw}”`;
  }, [qRaw, cat]);

  const showConditionFilter = useMemo(() => {
    if (!data || data.items.length === 0) return false;
    return data.items.some(
      (p) => p.condition === "USED" || p.condition === "REFURBISHED"
    );
  }, [data]);

  const priceBuckets = useMemo(() => {
    if (!data || data.items.length < 2)
      return [] as Array<{ min?: number; max?: number }>;

    const pricesCents = data.items.map((p) => p.price);
    const minCents = Math.min(...pricesCents);
    const maxCents = Math.max(...pricesCents);

    if (!isFinite(minCents) || !isFinite(maxCents) || minCents === maxCents) {
      return [];
    }

    const minUnits = Math.floor(minCents / 100);
    const maxUnits = Math.ceil(maxCents / 100);

    const range = maxUnits - minUnits;
    const step = Math.max(Math.round(range / 3), 1);

    const b1Max = minUnits + step;
    const b2Max = minUnits + step * 2;

    const buckets: Array<{ min?: number; max?: number }> = [
      { min: undefined, max: b1Max },
      { min: b1Max, max: b2Max },
      { min: b2Max, max: undefined },
    ];

    return buckets;
  }, [data]);

  return (
    <SearchContainer>
      {/* Migas mínimas */}
      <div className="mb-3 text-[11px] md:text-xs text-[rgb(var(--fg-rgb)/0.7)]">
        <button
          type="button"
          onClick={() => nav("/")}
          className="hover:underline underline-offset-2"
        >
          Inicio
        </button>
        <span> / </span>
        <span>Búsqueda</span>
      </div>

      {/* Título + sort */}
      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-2 mb-4">
        <div>
          <h1 className="text-lg md:text-2xl font-semibold">{subtitle}</h1>
          <p className="text-xs md:text-sm text-[rgb(var(--fg-rgb)/0.7)] mt-1">
            {total === 0
              ? "No se encontraron resultados."
              : `${total} resultados`}
          </p>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <span className="text-[11px] md:text-sm text-[rgb(var(--fg-rgb)/0.7)]">
            Ordenar por
          </span>
          <select
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value })}
            className="
              text-xs md:text-sm
              border border-[rgb(var(--border-rgb))]
              rounded-md bg-[rgb(var(--card-2-rgb))]
              px-2 py-1
            "
          >
            <option value="relevance">Relevancia</option>
            <option value="price_asc">Precio: de menor a mayor</option>
            <option value="price_desc">Precio: de mayor a menor</option>
            <option value="rating_desc">Valoración</option>
            <option value="newest">Más nuevos</option>
          </select>
        </div>
      </div>

      {/* Layout: filtros izquierda, resultados derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 lg:gap-8">
        {/* Columna filtros */}
        <SearchFilters
          ratingFilter={ratingFilter}
          conditionFilter={conditionFilter}
          minPriceParam={minPriceParam}
          maxPriceParam={maxPriceParam}
          colorParam={colorParam}
          homeDeliveryParam={homeDeliveryParam}
          minWarrantyParam={minWarrantyParam}
          showConditionFilter={showConditionFilter}
          priceBuckets={priceBuckets}
          onUpdateParams={updateParams}
        />

        {/* Columna resultados */}
        <section className="min-w-0">
          {isLoading && (
            <div className="py-10 text-center text-sm text-[rgb(var(--fg-rgb)/0.7)]">
              Cargando resultados…
            </div>
          )}

          {isError && (
            <div className="py-10 text-center text-sm text-red-500">
              Ocurrió un error al buscar. Intenta de nuevo.
            </div>
          )}

          {!isLoading && !isError && data && data.items.length === 0 && (
            <div className="py-10 text-center text-sm text-[rgb(var(--fg-rgb)/0.8)]">
              No encontramos productos que coincidan con tu búsqueda.
            </div>
          )}

          {!isLoading && !isError && data && data.items.length > 0 && (
            <>
              {/* Lista vertical tipo Amazon */}
              <div className="bg-[rgb(var(--card-rgb))] rounded-xl border border-[rgb(var(--border-rgb))] divide-y divide-[rgb(var(--border-rgb))]">
                {data.items.map((p) => {
                  const conditionLabel = formatCondition(p.condition);
                  const gradeLabel = formatConditionGrade(p.conditionGrade);
                  const meta =
                    (p.metadata as Record<string, unknown> | null) ?? null;

                  const specEntries = meta
                    ? Object.entries(meta)
                        .filter(([key, value]) => {
                          if (value == null) return false;
                          if (
                            typeof value !== "string" &&
                            typeof value !== "number"
                          )
                            return false;
                          const lowerKey = key.toLowerCase();
                          if (
                            lowerKey.startsWith("_") ||
                            ["color", "maincolor", "brand"].includes(lowerKey)
                          )
                            return false;
                          return true;
                        })
                        .slice(0, 3)
                    : [];

                  return (
                    <article
                      key={p.id}
                      className="
                        flex flex-col sm:flex-row gap-3 sm:gap-4
                        px-3 sm:px-4 py-3
                        cursor-pointer group
                      "
                      onClick={() => nav(`/product/${p.slug}`)}
                    >
                      {/* Imagen izquierda */}
                      <Link
                        to={`/product/${p.slug}`}
                        onClick={(e) => e.stopPropagation()}
                        className="
                          w-full sm:w-[180px] md:w-[210px]
                          flex-shrink-0
                          flex items-center justify-center
                          bg-[rgb(var(--bg-rgb))]
                          rounded-lg overflow-hidden
                          aspect-[4/3]
                          group-hover:ring-2 group-hover:ring-[rgb(var(--primary-rgb)/0.6)]
                        "
                      >
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-contain"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[11px] text-[rgb(var(--fg-rgb)/0.5)]">
                            Sin imagen
                          </div>
                        )}
                      </Link>

                      {/* Centro: info */}
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <Link
                          to={`/product/${p.slug}`}
                          onClick={(e) => e.stopPropagation()}
                          className="
                            text-sm md:text-[15px] font-medium
                            text-[rgb(var(--fg-rgb))]
                            hover:text-[rgb(var(--primary-rgb))]
                            hover:underline underline-offset-2
                            line-clamp-2
                          "
                        >
                          {p.name}
                        </Link>

                        {p.brand && (
                          <span className="text-[11px] text-[rgb(var(--fg-rgb)/0.65)]">
                            Marca:{" "}
                            <span className="font-medium">{p.brand}</span>
                          </span>
                        )}

                        {/* Descripción corta */}
                        {p.description && (
                          <p className="text-[11px] md:text-xs text-[rgb(var(--fg-rgb)/0.78)] mt-0.5 line-clamp-2">
                            {p.description}
                          </p>
                        )}

                        {/* Color principal */}
                        {p.mainColor && (
                          <div className="flex items-center gap-1.5 text-[11px] text-[rgb(var(--fg-rgb)/0.7)]">
                            <span
                              className="inline-block w-3 h-3 rounded-full border border-[rgb(var(--border-rgb))]"
                              style={{
                                backgroundColor: p.mainColor || undefined,
                              }}
                            />
                            <span>Color: {p.mainColor}</span>
                          </div>
                        )}

                        {/* Specs desde metadata */}
                        {specEntries.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {specEntries.map(([key, value]) => (
                              <span
                                key={key}
                                className="
                                  inline-flex items-center gap-1
                                  px-1.5 py-0.5 rounded-full
                                  bg-[rgb(var(--card-2-rgb))]
                                  border border-[rgb(var(--border-rgb))]
                                  text-[10px] text-[rgb(var(--fg-rgb)/0.8)]
                                "
                              >
                                <span className="font-medium">
                                  {formatSpecKey(key)}:
                                </span>
                                <span className="truncate max-w-[9rem]">
                                  {String(value)}
                                </span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Rating */}
                        {p.ratingCount > 0 && (
                          <div className="flex items-center gap-1 text-[11px] mt-0.5">
                            <span className="flex">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  size={12}
                                  className={
                                    i < Math.round(p.ratingAvg)
                                      ? "fill-current text-[rgb(var(--accent-rgb))]"
                                      : "text-[rgb(var(--fg-rgb)/0.3)]"
                                  }
                                />
                              ))}
                            </span>
                            <span className="text-[rgb(var(--fg-rgb)/0.7)]">
                              {p.ratingAvg.toFixed(1)} · {p.ratingCount} reseñas
                            </span>
                          </div>
                        )}

                        {/* Condición */}
                        {conditionLabel && (
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <span className="inline-flex px-1.5 py-0.5 rounded-full border border-[rgb(var(--border-rgb))] text-[10px] text-[rgb(var(--fg-rgb)/0.8)]">
                              {conditionLabel}
                            </span>

                            {gradeLabel && (
                              <span className="text-[10px] text-[rgb(var(--fg-rgb)/0.65)]">
                                · {gradeLabel}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Nota de condición */}
                        {p.conditionNote && (
                          <p className="text-[10px] text-[rgb(var(--fg-rgb)/0.6)] line-clamp-2">
                            {p.conditionNote}
                          </p>
                        )}

                        {/* Garantía */}
                        {p.warrantyMonths && p.warrantyMonths > 0 && (
                          <div className="mt-1 text-[10px] text-[rgb(var(--fg-rgb)/0.75)]">
                            <span className="font-medium">
                              Garantía {p.warrantyMonths} meses
                            </span>
                            {p.warrantyType && (
                              <span className="ml-1">({p.warrantyType})</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Derecha: precio + shipping + CTA */}
                      <div
                        className="
                          w-full sm:w-[190px]
                          flex-shrink-0
                          flex sm:flex-col items-end justify-between sm:justify-start
                          text-right gap-2
                        "
                      >
                        <div className="sm:mt-1">
                          <div className="text-base md:text-lg font-semibold">
                            <Price
                              cents={p.price}
                              currency={(p.currency || "USD").toUpperCase()}
                            />
                          </div>

                          <Link
                            to={`/product/${p.slug}`}
                            onClick={(e) => e.stopPropagation()}
                            className="
                              inline-flex items-center justify-center
                              mt-2 px-3 py-1.5
                              text-[11px] md:text-xs
                              rounded-md border border-[rgb(var(--border-rgb))]
                              bg-[rgb(var(--card-2-rgb))]
                              hover:bg-[rgb(var(--primary-rgb))]
                              hover:text-[rgb(var(--bg-rgb))]
                              transition-colors
                            "
                          >
                            Ver detalles
                          </Link>
                        </div>

                        <div className="flex flex-col items-end gap-1 mt-1 text-[10px] text-[rgb(var(--fg-rgb)/0.8)]">
                          {p.homeDeliveryAvailable && (
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[rgb(var(--accent-rgb)/0.08)] border border-[rgb(var(--accent-rgb)/0.3)]">
                              <Truck size={11} className="flex-shrink-0" />
                              <span>Envío a domicilio</span>
                            </div>
                          )}
                          {p.storePickupAvailable && (
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))]">
                              <Store size={11} className="flex-shrink-0" />
                              <span>Recogida en tienda</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-6 text-xs md:text-sm">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => updateParams({ page: String(page - 1) })}
                    className={`
                      px-2.5 py-1 rounded-md border border-[rgb(var(--border-rgb))]
                      disabled:opacity-50 disabled:cursor-not-allowed
                      bg-[rgb(var(--card-2-rgb))]
                    `}
                  >
                    « Anterior
                  </button>
                  <span className="text-[rgb(var(--fg-rgb)/0.8)]">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => updateParams({ page: String(page + 1) })}
                    className={`
                      px-2.5 py-1 rounded-md border border-[rgb(var(--border-rgb))]
                      disabled:opacity-50 disabled:cursor-not-allowed
                      bg-[rgb(var(--card-2-rgb))]
                    `}
                  >
                    Siguiente »
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </SearchContainer>
  );
}
