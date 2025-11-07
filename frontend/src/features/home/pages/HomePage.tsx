// src/features/home/pages/HomePage.tsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button, Skeleton } from "@/ui";
import { fetchHomeSections } from "@/features/home/api/home";
import type { HomeSection, HomeProductSummary } from "@/features/home/types";
import CarouselFromHome from "@/features/home/components/CarouselFromHome";
import HomeLayout from "@/features/home/layout/HomeLayout";
import { api } from "@/lib/api";

/* =========================
   Helpers
   ========================= */

function formatPrice(p: HomeProductSummary) {
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: p.currency.toUpperCase(),
    }).format(p.price / 100);
  } catch {
    return `${(p.price / 100).toFixed(2)} ${p.currency.toUpperCase()}`;
  }
}

/* =========================
   PRODUCT GRID (minimalista / mini catálogo)
   ========================= */

function ProductsGridSection({ section }: { section: HomeSection }) {
  const products = section.products ?? [];
  const layout: any = section.layout ?? {};
  const variant: string = layout.variant ?? "grid-3";
  const style: string = layout.style ?? "panel";
  const cardShape: "square" | "portrait" =
    layout.cardShape === "square" ? "square" : "portrait";
  const density: "compact" | "comfortable" =
    layout.density === "compact" ? "compact" : "comfortable";

  const isFloating = style === "floating-panel";
  const isMini = variant === "grid-mini";

  // GAP entre cards
  const gapCls =
    isMini || density === "compact" ? "gap-1.5 sm:gap-2" : "gap-3 sm:gap-4";

  // COLUMNAS según variante
  let gridCols = "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  if (variant === "grid-2") {
    gridCols = "grid-cols-1 sm:grid-cols-2";
  } else if (variant === "grid-3") {
    gridCols = "grid-cols-2 md:grid-cols-3";
  } else if (variant === "grid-4") {
    gridCols = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
  } else if (variant === "grid-mini") {
    // 👇 modo mini: muchas columnas
    gridCols =
      "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";
  }

  const gridCls = `grid ${gapCls} ${gridCols}`;

  const imageAspectCls =
    cardShape === "square"
      ? "aspect-square"
      : // para mini lo hago un poco más bajito
      isMini
      ? "aspect-[4/3]"
      : "aspect-[4/3]";

  const cardPaddingCls = isMini || density === "compact" ? "p-2" : "p-3";

  const nameTextCls = isMini
    ? "text-[11px] leading-snug line-clamp-2"
    : "text-xs sm:text-sm leading-snug line-clamp-2";

  const priceTextCls = isMini
    ? "text-xs font-semibold"
    : "text-sm font-semibold";

  const outerSectionCls = isFloating
    ? "relative z-20 -mt-24 md:-mt-32 mb-10"
    : "mb-8";

  const panelCls = isFloating
    ? "rounded-3xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] shadow-xl shadow-black/12 px-3 py-3 sm:px-4 sm:py-4"
    : "";

  return (
    <section className={outerSectionCls}>
      <div className="max-w-6xl mx-auto px-2 sm:px-0">
        <div className={panelCls || ""}>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-1 mb-3">
            <div>
              {section.title && (
                <h2 className="text-sm md:text-base font-semibold">
                  {section.title}
                </h2>
              )}
            </div>
            {section.subtitle && (
              <p className="text-[11px] md:text-xs opacity-60 max-w-xl md:text-right">
                {section.subtitle}
              </p>
            )}
          </div>

          {products.length === 0 ? (
            <p className="text-xs opacity-50">
              No hay productos para mostrar todavía.
            </p>
          ) : (
            <div className={gridCls}>
              {products.map((p) => (
                <article
                  key={p.id}
                  className={[
                    "group border border-[rgb(var(--border-rgb))]/80 bg-[rgb(var(--card-rgb))] overflow-hidden shadow-sm transition-transform",
                    isMini
                      ? "rounded-lg hover:-translate-y-0.5 hover:shadow-md"
                      : "rounded-xl hover:-translate-y-0.5 hover:shadow-md",
                  ].join(" ")}
                >
                  <Link to={`/product/${p.slug}`} className="block h-full">
                    <div className="flex flex-col h-full">
                      <div
                        className={[
                          imageAspectCls,
                          "bg-[rgb(var(--muted-rgb))] overflow-hidden",
                        ].join(" ")}
                      >
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[11px] opacity-60">
                            Sin imagen
                          </div>
                        )}
                      </div>
                      <div
                        className={[
                          cardPaddingCls,
                          "flex flex-col gap-1.5 flex-1",
                        ].join(" ")}
                      >
                        <div className={nameTextCls}>{p.name}</div>
                        <div className={priceTextCls}>{formatPrice(p)}</div>
                      </div>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* =========================
   PRODUCT STRIP (fila tipo carril, minimal)
   ========================= */

function ProductsStripSection({ section }: { section: HomeSection }) {
  const products = section.products ?? [];
  const layout: any = section.layout ?? {};

  const variant: string = layout.variant ?? "strip-md";
  const railStyle: string =
    layout.railStyle ?? (variant === "strip-sm" ? "tight" : "default");

  const railGapCls = railStyle === "tight" ? "gap-2" : "gap-3";
  const railPbCls = railStyle === "tight" ? "pb-2" : "pb-1";
  const cardWidthCls =
    railStyle === "tight"
      ? "min-w-[140px] max-w-[180px]"
      : "min-w-[160px] max-w-[200px]";

  return (
    <section className="mb-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-1 mb-3">
          <div>
            {section.title && (
              <h2 className="text-lg md:text-xl font-semibold">
                {section.title}
              </h2>
            )}
          </div>
          {section.subtitle && (
            <p className="text-xs md:text-sm opacity-70 max-w-xl md:text-right">
              {section.subtitle}
            </p>
          )}
        </div>
        {products.length === 0 ? (
          <p className="text-xs opacity-60">
            No hay productos para mostrar todavía.
          </p>
        ) : (
          <div
            className={[
              "flex overflow-x-auto scroll-smooth",
              railGapCls,
              railPbCls,
            ].join(" ")}
          >
            {products.map((p) => (
              <article
                key={p.id}
                className={[
                  cardWidthCls,
                  "group rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] overflow-hidden hover:-translate-y-0.5 hover:shadow-md hover:border-[rgb(var(--primary-rgb))]/40 transition",
                ].join(" ")}
              >
                <Link to={`/product/${p.slug}`} className="block h-full">
                  <div className="flex flex-col h-full">
                    <div className="aspect-[4/3] bg-[rgb(var(--muted-rgb))] overflow-hidden">
                      {p.imageUrl ? (
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="w-full h-full object-cover group-hover:opacity-95 transition-opacity"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[11px] opacity-60">
                          Sin imagen
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-1 flex-1">
                      <div className="text-xs font-medium line-clamp-2">
                        {p.name}
                      </div>
                      <div className="mt-1 text-sm font-semibold">
                        {formatPrice(p)}
                      </div>
                    </div>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* =========================
   CATEGORY STRIP (AUTO-FILL)
   ========================= */

type CategoryNode = {
  slug: string;
  name: string;
  sub?: CategoryNode[];
};

type FlatCategory = { slug: string; label: string };

function flattenCategories(nodes: CategoryNode[], prefix = ""): FlatCategory[] {
  const out: FlatCategory[] = [];
  for (const n of nodes) {
    const label = prefix ? `${prefix} / ${n.name}` : n.name;
    out.push({ slug: n.slug, label });
    if (n.sub && n.sub.length) {
      out.push(...flattenCategories(n.sub, label));
    }
  }
  return out;
}

function CategoryStripSection({ section }: { section: HomeSection }) {
  const cfg: any = section.config ?? {};
  const layout: any = section.layout ?? {};
  const variant = layout.variant ?? "chips";

  const configuredSlugs: string[] = Array.isArray(cfg.categories)
    ? cfg.categories.filter(
        (s: any) => typeof s === "string" && s.trim().length > 0
      )
    : [];

  const { data: catTree, isLoading: catsLoading } = useQuery<CategoryNode[]>({
    queryKey: ["home:categories"],
    queryFn: async () => {
      const { data } = await api.get("/categories");
      return data as CategoryNode[];
    },
    staleTime: 10 * 60_000,
  });

  const allCats: FlatCategory[] = catTree ? flattenCategories(catTree) : [];

  let slugsToShow: string[] = configuredSlugs;
  if (!slugsToShow.length && allCats.length) {
    slugsToShow = allCats.slice(0, 10).map((c) => c.slug);
  }

  if (!slugsToShow.length) {
    if (catsLoading) {
      return (
        <section className="mb-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-1 mb-3">
              <div>
                {section.title && (
                  <h2 className="text-lg md:text-xl font-semibold">
                    {section.title}
                  </h2>
                )}
              </div>
              {section.subtitle && (
                <p className="text-xs md:text-sm opacity-70 max-w-xl md:text-right">
                  {section.subtitle}
                </p>
              )}
            </div>
            <p className="text-xs opacity-60">Cargando categorías…</p>
          </div>
        </section>
      );
    }
    return null;
  }

  const labelFor = (slug: string) =>
    allCats.find((c) => c.slug === slug)?.label ?? slug.replace(/-/g, " ");

  return (
    <section className="mb-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-1 mb-3">
          <div>
            {section.title && (
              <h2 className="text-lg md:text-xl font-semibold">
                {section.title}
              </h2>
            )}
          </div>
          {section.subtitle && (
            <p className="text-xs md:text-sm opacity-70 max-w-xl md:text-right">
              {section.subtitle}
            </p>
          )}
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {slugsToShow.map((slug) => (
            <Link
              key={slug}
              to={`/tienda?category=${encodeURIComponent(slug)}`}
              className={
                variant === "cards"
                  ? "min-w-[140px] rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] px-3 py-2 text-xs flex flex-col gap-1"
                  : "inline-flex items-center rounded-full border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] px-3 py-1 text-xs"
              }
            >
              <span className="font-medium">{labelFor(slug)}</span>
              {variant === "cards" && (
                <span className="text-[11px] opacity-60">Ver productos</span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================
   BANNER
   ========================= */

function BannerSection({ section }: { section: HomeSection }) {
  const cfg: any = section.config ?? {};
  const layout: any = section.layout ?? {};
  const tone = layout.tone ?? "brand";

  let toneCls =
    "bg-[rgb(var(--primary-rgb)/0.12)] border-[rgb(var(--primary-rgb)/0.5)]";
  if (tone === "soft") {
    toneCls = "bg-[rgb(var(--muted-rgb))] border-[rgb(var(--border-rgb))]";
  } else if (tone === "dark") {
    toneCls = "bg-zinc-900 border-zinc-700 text-zinc-50";
  }

  return (
    <section className="mb-8">
      <div className="max-w-5xl mx-auto">
        <div
          className={[
            "rounded-2xl border px-4 py-3 md:px-6 md:py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3",
            toneCls,
          ].join(" ")}
        >
          <div>
            {section.title && (
              <h2 className="text-sm md:text-base font-semibold">
                {section.title}
              </h2>
            )}
            {section.subtitle && (
              <p className="text-xs md:text-sm opacity-80 mt-1">
                {section.subtitle}
              </p>
            )}
          </div>
          {cfg.ctaLabel && (
            <Button
              asChild
              size="sm"
              variant={tone === "dark" ? "outline" : "default"}
            >
              <Link to={cfg.ctaHref || "/tienda"}>{cfg.ctaLabel}</Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}

/* =========================
   TEXT BLOCK
   ========================= */

function TextBlockSection({ section }: { section: HomeSection }) {
  const cfg: any = section.config ?? {};
  const layout: any = section.layout ?? {};
  const align: "left" | "center" | "right" =
    layout.align === "center" || layout.align === "right"
      ? layout.align
      : "left";

  const alignCls =
    align === "center"
      ? "text-center"
      : align === "right"
      ? "text-right"
      : "text-left";

  return (
    <section className="mb-6">
      <div className="max-w-5xl mx-auto">
        <div
          className={[
            "rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] px-4 py-3 md:px-5 md:py-4",
            alignCls,
          ].join(" ")}
        >
          {section.title && (
            <h2 className="text-sm md:text-base font-semibold mb-1">
              {section.title}
            </h2>
          )}
          {section.subtitle && (
            <p className="text-xs md:text-sm opacity-70 mb-2">
              {section.subtitle}
            </p>
          )}
          {cfg.text && (
            <p className="text-xs md:text-sm whitespace-pre-line">{cfg.text}</p>
          )}
        </div>
      </div>
    </section>
  );
}

/* =========================
   Dispatcher
   ========================= */

function renderSection(section: HomeSection) {
  switch (section.type) {
    case "HERO":
      // El HERO se muestra aparte en el slot `hero`
      return null;
    case "PRODUCT_GRID":
      return <ProductsGridSection section={section} />;
    case "PRODUCT_STRIP":
      return <ProductsStripSection section={section} />;
    case "CATEGORY_STRIP":
      return <CategoryStripSection section={section} />;
    case "BANNER":
      return <BannerSection section={section} />;
    case "TEXT_BLOCK":
      return <TextBlockSection section={section} />;
    default:
      return null;
  }
}

/* =========================
   Página Home
   ========================= */

export default function HomePage() {
  const {
    data: sections,
    isLoading,
    isError,
  } = useQuery<HomeSection[]>({
    queryKey: ["home:sections"],
    queryFn: fetchHomeSections,
    staleTime: 0,
  });

  if (isLoading) {
    return (
      <HomeLayout>
        <div className="py-8 space-y-4 max-w-5xl mx-auto">
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
        </div>
      </HomeLayout>
    );
  }

  if (isError) {
    return (
      <HomeLayout>
        <div className="py-10">
          <div className="max-w-5xl mx-auto rounded-2xl border border-red-900/40 bg-red-900/10 p-5 text-sm">
            <h2 className="text-base font-semibold mb-1">
              No se pudo cargar el inicio
            </h2>
            <p className="opacity-80">
              Intenta recargar la página. Si el problema persiste, revisa la
              configuración de las secciones en el panel de administración.
            </p>
          </div>
        </div>
      </HomeLayout>
    );
  }

  const list = (sections ?? []).filter((s) => (s as any).active !== false);

  if (!list.length) {
    return (
      <HomeLayout>
        <div className="py-10">
          <div className="max-w-5xl mx-auto rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-5 text-sm">
            <h2 className="text-base font-semibold mb-1">
              Inicio aún sin contenido
            </h2>
            <p className="opacity-80">
              Configura las secciones desde el panel de administración en{" "}
              <code>/admin</code> &rarr; “Secciones de inicio”.
            </p>
          </div>
        </div>
      </HomeLayout>
    );
  }

  const heroSection = list.find((s) => s.type === "HERO");
  const otherSections = list.filter((s) => s.id !== heroSection?.id);

  return (
    <HomeLayout
      hero={heroSection ? <CarouselFromHome section={heroSection} /> : null}
    >
      {otherSections.map((section) => (
        <div key={section.id}>{renderSection(section)}</div>
      ))}
    </HomeLayout>
  );
}
