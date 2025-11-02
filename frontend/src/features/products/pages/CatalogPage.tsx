import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import CategoryBar from "@/features/categories/components/CategoryBar";
import SubcategoryCarousel from "@/features/categories/components/SubcategoryCarousel";
import { fetchCategories, type CategoryNode } from "@/features/categories/api";
import { Skeleton } from "@/ui";
import { Price } from "@/features/currency/Price";

type CatalogItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number; // cents USD
  currency: string;
  stock: number;
  active: boolean;
  createdAt: string;
  imageUrl: string | null;
};

export default function CatalogPage() {
  const [sp, setSp] = useSearchParams();

  // Query params
  const page = Number(sp.get("page") || 1);
  const pageSize = Number(sp.get("pageSize") || 12);
  const q = sp.get("q") || "";
  const sort = (sp.get("sort") as any) || "createdAt:desc";
  const catParam = sp.get("cat") || "";

  const catalogRef = useRef<HTMLDivElement | null>(null);

  // Categorías
  const { data: categories = [], isLoading: loadingCats } = useQuery<
    CategoryNode[]
  >({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60_000,
  });

  // Padres (excluye "all")
  const parents = useMemo(
    () => (categories || []).filter((c) => c.slug !== "all"),
    [categories]
  );

  // ¿catParam es un padre?
  const isParentSlug = useMemo(() => {
    if (!catParam) return true;
    return !!parents.find((c) => c.slug === catParam);
  }, [catParam, parents]);

  // Primer padre como fallback
  const firstParent = parents[0];

  // parentSlug controlado
  const [parentSlug, setParentSlug] = useState<string>("");

  // Sincroniza parentSlug cuando llegan categorías o cambia catParam
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

  // Padre activo resuelto SIEMPRE
  const resolvedParent = useMemo(() => {
    if (!parents.length) return undefined;
    return parents.find((p) => p.slug === parentSlug) || firstParent;
  }, [parents, parentSlug, firstParent]);

  // Productos (lista) → category/subcategory según catParam
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
  const cardClass =
    "group rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden hover:-translate-y-0.5 hover:shadow-md transition";
  const subtleBorder = "border border-[var(--border)]";

  // ITEMS CARRUSEL — siempre al menos la tarjeta "Todo <padre>"
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

  return (
    <div>
      {!loadingCats && parents.length > 0 && (
        <CategoryBar
          categories={[{ slug: "all", name: "Todos" } as any, ...parents]}
          selectedParent={resolvedParent?.slug || ""}
          onSelectParent={onSelectParent}
        />
      )}

      {/* CARRUSEL: visible si hay al menos 1 padre */}
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">
            {isSubcategory
              ? `Ofertas — ${currentCategoryName}`
              : currentCategoryName}
          </h2>

          <div className="flex items-center gap-2">
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
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: Math.min(pageSize, 12) }).map((_, i) => (
              <div
                key={i}
                className={`rounded-2xl ${subtleBorder} bg-[var(--card)] overflow-hidden`}
              >
                <Skeleton className="aspect-[4/3]" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.items.map((p) => (
              <Link
                key={p.id}
                to={`/product/${p.slug}`}
                className={cardClass}
                title={p.name}
              >
                <div className="aspect-[4/3] w-full overflow-hidden">
                  <img
                    src={
                      p.imageUrl ?? "https://placehold.co/800x600?text=Sin+foto"
                    }
                    alt={p.name}
                    className="h-full w-full object-cover group-hover:opacity-95"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        "https://placehold.co/800x600?text=Sin+foto";
                    }}
                  />
                </div>
                <div className="p-3">
                  <div className="text-sm font-semibold leading-snug line-clamp-2">
                    {p.name}
                  </div>
                  <div className="text-xs opacity-70 mt-1 line-clamp-2">
                    {p.description}
                  </div>
                  <div className="text-sm font-semibold mt-2">
                    <Price cents={p.price} currency="USD" />
                  </div>
                </div>
              </Link>
            ))}
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
