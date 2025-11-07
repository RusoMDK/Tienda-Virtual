import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import CategoryBar from "@/features/categories/components/CategoryBar";
import SubcategoryCarousel from "@/features/categories/components/SubcategoryCarousel";
import { fetchCategories, type CategoryNode } from "@/features/categories/api";
import { Skeleton } from "@/ui";
import { ProductCardMinimal } from "@/features/products/components/ProductCardMinimal";

type CatalogItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number; // cents
  currency: string;
  stock: number;
  active: boolean;
  createdAt: string;
  imageUrl: string | null;
};

export default function CatalogPage() {
  const [sp, setSp] = useSearchParams();

  const page = Number(sp.get("page") || 1);
  const pageSize = Number(sp.get("pageSize") || 12);
  const q = sp.get("q") || "";
  const sort = (sp.get("sort") as any) || "createdAt:desc";
  const catParam = sp.get("cat") || "";

  // densidad: compact = mini cards / comfortable = un poco más grandes
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");

  const catalogRef = useRef<HTMLDivElement | null>(null);

  const { data: categories = [], isLoading: loadingCats } = useQuery<
    CategoryNode[]
  >({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });

  const parents = useMemo(
    () => (categories || []).filter((c) => c.slug !== "all"),
    [categories]
  );

  const isParentSlug = useMemo(() => {
    if (!catParam) return true;
    return !!parents.find((c) => c.slug === catParam);
  }, [catParam, parents]);

  const firstParent = parents[0];

  const [parentSlug, setParentSlug] = useState<string>("");

  useEffect(() => {
    if (!parents.length) return;
    if (!catParam) {
      setParentSlug((prev) => prev || firstParent?.slug || "");
      return;
    }
    const parent = parents.find(
      (p) =>
        p.slug === catParam || (p.sub || []).some((s) => s.slug === catParam)
    );
    setParentSlug(parent?.slug || firstParent?.slug || "");
  }, [catParam, parents, firstParent?.slug]);

  const resolvedParent = useMemo(() => {
    if (!parents.length) return undefined;
    return parents.find((p) => p.slug === parentSlug) || firstParent;
  }, [parents, parentSlug, firstParent]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["products", { page, pageSize, q, sort, catParam }],
    queryFn: async () => {
      const params: any = { page, pageSize, q, sort };
      if (catParam) {
        if (isParentSlug) params.category = catParam;
        else params.subcategory = catParam;
      }
      const res = await api.get("/products", { params });
      return res.data as {
        items: CatalogItem[];
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    },
    keepPreviousData: true,
  });

  function onSelectParent(slug: string) {
    const next = new URLSearchParams(sp);
    if (slug === "all") {
      next.delete("cat");
      setParentSlug(firstParent?.slug || "");
    } else {
      next.set("cat", slug);
      setParentSlug(slug);
    }
    next.set("page", "1");
    setSp(next, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function onPickSub(slug: string) {
    const next = new URLSearchParams(sp);
    next.set("cat", slug);
    next.set("page", "1");
    setSp(next, { replace: true });
    requestAnimationFrame(() => {
      catalogRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  const { currentCategoryName, isSubcategory } = useMemo(() => {
    if (!catParam)
      return { currentCategoryName: "Catálogo", isSubcategory: false };
    const p = parents.find((x) => x.slug === catParam);
    if (p) return { currentCategoryName: p.name, isSubcategory: false };
    const parent = parents.find((x) =>
      (x.sub || []).some((s) => s.slug === catParam)
    );
    const sub = parent?.sub?.find((s) => s.slug === catParam);
    return {
      currentCategoryName: sub?.name || "Catálogo",
      isSubcategory: !!sub,
    };
  }, [catParam, parents]);

  const controlClass =
    "rounded-xl px-3 py-2 text-sm bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--ring)] transition";
  const subtleBorder = "border border-[var(--border)]";

  const carouselItems = useMemo(() => {
    if (!resolvedParent) return [];
    const parentCover =
      resolvedParent.imageUrl ||
      resolvedParent.sub?.find((s) => !!s.imageUrl)?.imageUrl ||
      null;

    return [
      {
        slug: resolvedParent.slug,
        name: `Todo ${resolvedParent.name}`,
        imageUrl: parentCover,
      },
      ...((resolvedParent.sub || []).map((s) => ({
        slug: s.slug,
        name: s.name,
        imageUrl: s.imageUrl ?? null,
      })) as { slug: string; name: string; imageUrl?: string | null }[]),
    ];
  }, [resolvedParent]);

  // clases del grid según densidad
  const gridClass =
    density === "compact"
      ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-3"
      : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4";

  return (
    <div>
      {!loadingCats && parents.length > 0 && (
        <CategoryBar
          categories={[{ slug: "all", name: "Todos" } as any, ...parents]}
          selectedParent={resolvedParent?.slug || ""}
          onSelectParent={onSelectParent}
        />
      )}

      {!loadingCats && parents.length > 0 && (
        <SubcategoryCarousel
          items={carouselItems}
          title="Explorar categorías"
          subtitle="Desliza para ver más opciones"
          onPick={onPickSub}
          selectedSlug={catParam || resolvedParent?.slug}
          width="full"
        />
      )}

      <div ref={catalogRef} className="container py-6 space-y-6 scroll-mt-24">
        {/* Header catálogo + controles */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-semibold">
            {isSubcategory
              ? `Ofertas — ${currentCategoryName}`
              : currentCategoryName}
          </h2>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <select
              className={controlClass}
              value={sort}
              onChange={(e) => {
                sp.set("sort", e.target.value);
                sp.set("page", "1");
                setSp(sp, { replace: true });
              }}
            >
              <option value="createdAt:desc">Nuevos primero</option>
              <option value="createdAt:asc">Antiguos primero</option>
              <option value="price:asc">Precio ↑</option>
              <option value="price:desc">Precio ↓</option>
            </select>

            <select
              className={controlClass}
              value={String(pageSize)}
              onChange={(e) => {
                sp.set("pageSize", e.target.value);
                sp.set("page", "1");
                setSp(sp, { replace: true });
              }}
            >
              {[12, 24, 36].map((n) => (
                <option key={n} value={n}>
                  {n}/página
                </option>
              ))}
            </select>

            {/* Toggle densidad */}
            <div className="inline-flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-1)] p-[2px] text-xs">
              <button
                type="button"
                onClick={() => setDensity("compact")}
                className={cnDensity(density === "compact")}
              >
                Compacta
              </button>
              <button
                type="button"
                onClick={() => setDensity("comfortable")}
                className={cnDensity(density === "comfortable")}
              >
                Cómoda
              </button>
            </div>
          </div>
        </div>

        {isLoading && (
          <div className={gridClass}>
            {Array.from({ length: Math.min(pageSize, 12) }).map((_, i) => (
              <div
                key={i}
                className={`rounded-2xl ${subtleBorder} bg-[var(--card)] overflow-hidden`}
              >
                <Skeleton
                  className={
                    density === "compact" ? "aspect-square" : "aspect-[4/3]"
                  }
                />
                <div className="p-2.5 space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && (isError || !data?.items) && (
          <div className="rounded-2xl border border-red-900/40 bg-red-900/10 dark:bg-red-900/15 p-5 text-sm">
            No se pudo cargar el catálogo. Intenta más tarde.
          </div>
        )}

        {!isLoading && data?.items && data.items.length === 0 && (
          <div
            className={`rounded-2xl ${subtleBorder} p-6 text-center text-sm opacity-80`}
          >
            No hay productos para esta búsqueda.
          </div>
        )}

        {!isLoading && !!data?.items?.length && (
          <div className={gridClass}>
            {data.items.map((p) => {
              let badge: string | null = null;
              if (!p.active) badge = "No disponible";
              else if (p.stock === 0) badge = "Sin stock";
              else if (p.stock > 0 && p.stock <= 3) badge = `Quedan ${p.stock}`;

              return (
                <ProductCardMinimal
                  key={p.id}
                  to={`/product/${p.slug}`}
                  name={p.name}
                  description={p.description}
                  priceCents={p.price}
                  currency={p.currency}
                  imageUrl={p.imageUrl}
                  badge={badge}
                  variant={density === "compact" ? "compact" : "grid"}
                  aspect={density === "compact" ? "square" : "landscape"}
                />
              );
            })}
          </div>
        )}

        {!!data && data.totalPages > 1 && (
          <div className="flex justify-center gap-2 pt-2">
            <button
              className={`${subtleBorder} rounded-xl px-3 py-1 text-sm disabled:opacity-50 bg-[var(--surface-1)]`}
              disabled={data.page <= 1}
              onClick={() => {
                sp.set("page", String(data.page - 1));
                setSp(sp, { replace: true });
                catalogRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
            >
              Anterior
            </button>
            <div className="text-sm opacity-80 self-center">
              {data.page} / {data.totalPages}
            </div>
            <button
              className={`${subtleBorder} rounded-2xl px-3 py-1 text-sm disabled:opacity-50 bg-[var(--surface-1)]`}
              disabled={data.page >= data.totalPages}
              onClick={() => {
                sp.set("page", String(data.page + 1));
                setSp(sp, { replace: true });
                catalogRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** small helper local para el toggle de densidad */
function cnDensity(active: boolean) {
  return [
    "px-2.5 py-1 rounded-lg transition text-[11px]",
    active
      ? "bg-[var(--accent)] text-black"
      : "bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-2)]",
  ].join(" ");
}
