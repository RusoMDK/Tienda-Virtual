// src/features/home/pages/HomePage.tsx
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Container from "@/layout/Container";
import { Button, Skeleton } from "@/ui";
import { fetchHomeSections } from "@/features/home/api/home";
import type { HomeSection, HomeProductSummary } from "@/features/home/types";
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
   HERO
   ========================= */

function HeroSection({ section }: { section: HomeSection }) {
  const cfg = section.config ?? {};
  const layout = section.layout ?? {};
  const align: "left" | "center" | "right" =
    layout.align === "center" || layout.align === "right"
      ? layout.align
      : "left";

  const alignCls =
    align === "center"
      ? "items-center text-center"
      : align === "right"
      ? "items-end text-right"
      : "items-start text-left";

  const bgUrl: string | null =
    cfg.backgroundImageUrl || cfg.backgroundImage?.url || null;

  return (
    <section className="mb-8">
      <div
        className={[
          "rounded-3xl border border-[rgb(var(--border-rgb))] overflow-hidden",
          "bg-gradient-to-r from-[rgb(var(--primary-rgb)/0.12)] to-[rgb(var(--primary-rgb)/0.04)]",
        ].join(" ")}
      >
        <div className="grid md:grid-cols-2">
          <div className="p-6 md:p-8 flex flex-col gap-4 justify-center">
            {section.title && (
              <h1 className="text-2xl md:text-3xl font-bold">
                {section.title}
              </h1>
            )}
            {section.subtitle && (
              <p className="text-sm md:text-base opacity-80">
                {section.subtitle}
              </p>
            )}

            <div className={["flex gap-3 mt-2", alignCls].join(" ")}>
              <div className="flex flex-col gap-2 w-full max-w-md">
                {cfg.ctaLabel && (
                  <Button
                    asChild
                    size="lg"
                    className="w-full md:w-auto inline-flex justify-center"
                  >
                    <Link to={cfg.ctaHref || "/tienda"}>{cfg.ctaLabel}</Link>
                  </Button>
                )}

                {cfg.showSearch && (
                  <div className="relative mt-1">
                    <input
                      type="search"
                      placeholder="Buscar productos..."
                      className="w-full rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] px-4 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="hidden md:block relative min-h-[220px]">
            {bgUrl ? (
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${bgUrl})` }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center opacity-30">
                <div className="w-40 h-40 rounded-full border border-dashed border-[rgb(var(--primary-rgb))]" />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================
   PRODUCT GRID
   ========================= */

function ProductsGridSection({ section }: { section: HomeSection }) {
  const products = section.products ?? [];
  const layout = section.layout ?? {};
  const variant = layout.variant ?? "grid-3";

  let gridCls = "grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
  if (variant === "grid-2") {
    gridCls = "grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2";
  }
  if (variant === "grid-3") {
    gridCls = "grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-3";
  }

  const showAddToCart = layout.showAddToCart ?? true;
  const showRating = layout.showRating ?? false;

  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-3">
        {section.title && (
          <h2 className="text-lg md:text-xl font-semibold">{section.title}</h2>
        )}
        {section.subtitle && (
          <p className="text-xs md:text-sm opacity-70 max-w-md text-right">
            {section.subtitle}
          </p>
        )}
      </div>

      {products.length === 0 ? (
        <p className="text-xs opacity-60">
          No hay productos para mostrar todavía.
        </p>
      ) : (
        <div className={gridCls}>
          {products.map((p) => (
            <article
              key={p.id}
              className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] overflow-hidden flex flex-col"
            >
              <Link to={`/product/${p.slug}`} className="block">
                <div className="aspect-[4/3] bg-[rgb(var(--muted-rgb))] flex items-center justify-center overflow-hidden">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] opacity-60">Sin imagen</span>
                  )}
                </div>
              </Link>
              <div className="p-3 flex flex-col gap-1 flex-1">
                <Link
                  to={`/product/${p.slug}`}
                  className="text-xs font-medium line-clamp-2 hover:underline"
                >
                  {p.name}
                </Link>
                {p.categoryName && (
                  <span className="text-[11px] opacity-60">
                    {p.categoryName}
                  </span>
                )}
                <div className="mt-1 text-sm font-semibold">
                  {formatPrice(p)}
                </div>
                {showRating && (
                  <div className="text-[11px] opacity-60">
                    {/* futuro: rating real */}
                    ⭐⭐⭐⭐⭐
                  </div>
                )}
                {showAddToCart && (
                  <div className="mt-2">
                    <Button
                      asChild
                      size="sm"
                      className="w-full text-xs justify-center"
                    >
                      <Link to={`/product/${p.slug}`}>Ver detalle</Link>
                    </Button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/* =========================
   PRODUCT STRIP
   ========================= */

function ProductsStripSection({ section }: { section: HomeSection }) {
  const products = section.products ?? [];
  const layout = section.layout ?? {};
  const showAddToCart = layout.showAddToCart ?? true;
  const showRating = layout.showRating ?? false;

  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-3">
        {section.title && (
          <h2 className="text-lg md:text-xl font-semibold">{section.title}</h2>
        )}
        {section.subtitle && (
          <p className="text-xs md:text-sm opacity-70 max-w-md text-right">
            {section.subtitle}
          </p>
        )}
      </div>
      {products.length === 0 ? (
        <p className="text-xs opacity-60">
          No hay productos para mostrar todavía.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {products.map((p) => (
            <article
              key={p.id}
              className="min-w-[160px] max-w-[200px] rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] overflow-hidden flex flex-col"
            >
              <Link to={`/product/${p.slug}`} className="block">
                <div className="aspect-[4/3] bg-[rgb(var(--muted-rgb))] flex items-center justify-center overflow-hidden">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] opacity-60">Sin imagen</span>
                  )}
                </div>
              </Link>
              <div className="p-3 flex flex-col gap-1 flex-1">
                <Link
                  to={`/product/${p.slug}`}
                  className="text-xs font-medium line-clamp-2 hover:underline"
                >
                  {p.name}
                </Link>
                <div className="mt-1 text-sm font-semibold">
                  {formatPrice(p)}
                </div>
                {showRating && (
                  <div className="text-[11px] opacity-60">⭐⭐⭐⭐⭐</div>
                )}
                {showAddToCart && (
                  <div className="mt-2">
                    <Button
                      asChild
                      size="sm"
                      className="w-full text-xs justify-center"
                    >
                      <Link to={`/product/${p.slug}`}>Ver detalle</Link>
                    </Button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
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
  const cfg = section.config ?? {};
  const layout = section.layout ?? {};
  const variant = layout.variant ?? "chips";

  // Lo que haya configurado el admin
  const configuredSlugs: string[] = Array.isArray(cfg.categories)
    ? cfg.categories.filter(
        (s: any) => typeof s === "string" && s.trim().length > 0
      )
    : [];

  // Cargamos árbol de categorías del backend
  const { data: catTree, isLoading: catsLoading } = useQuery<CategoryNode[]>({
    queryKey: ["home:categories"],
    queryFn: async () => {
      const { data } = await api.get("/categories");
      return data as CategoryNode[];
    },
    staleTime: 10 * 60_000,
  });

  const allCats: FlatCategory[] = catTree ? flattenCategories(catTree) : [];

  // Si el admin eligió categorías → usamos esas. Si no, auto-fill con las primeras N.
  let slugsToShow: string[] = configuredSlugs;
  if (!slugsToShow.length && allCats.length) {
    slugsToShow = allCats.slice(0, 10).map((c) => c.slug);
  }

  if (!slugsToShow.length) {
    if (catsLoading) {
      return (
        <section className="mb-8">
          <div className="flex items-end justify-between mb-3">
            {section.title && (
              <h2 className="text-lg md:text-xl font-semibold">
                {section.title}
              </h2>
            )}
            {section.subtitle && (
              <p className="text-xs md:text-sm opacity-70 max-w-md text-right">
                {section.subtitle}
              </p>
            )}
          </div>
          <p className="text-xs opacity-60">Cargando categorías…</p>
        </section>
      );
    }
    return null;
  }

  const labelFor = (slug: string) =>
    allCats.find((c) => c.slug === slug)?.label ?? slug.replace(/-/g, " ");

  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-3">
        {section.title && (
          <h2 className="text-lg md:text-xl font-semibold">{section.title}</h2>
        )}
        {section.subtitle && (
          <p className="text-xs md:text-sm opacity-70 max-w-md text-right">
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
    </section>
  );
}

/* =========================
   BANNER
   ========================= */

function BannerSection({ section }: { section: HomeSection }) {
  const cfg = section.config ?? {};
  const layout = section.layout ?? {};
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
    </section>
  );
}

/* =========================
   TEXT BLOCK
   ========================= */

function TextBlockSection({ section }: { section: HomeSection }) {
  const cfg = section.config ?? {};
  const layout = section.layout ?? {};
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
    </section>
  );
}

/* =========================
   Dispatcher
   ========================= */

function renderSection(section: HomeSection) {
  switch (section.type) {
    case "HERO":
      return <HeroSection section={section} />;
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
    staleTime: 0, // siempre se considera "stale"
  });

  if (isLoading) {
    return (
      <Container className="py-8 space-y-4">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
        <Skeleton className="h-32 rounded-3xl" />
      </Container>
    );
  }

  if (isError) {
    return (
      <Container className="py-10">
        <div className="rounded-2xl border border-red-900/40 bg-red-900/10 p-5 text-sm">
          <h2 className="text-base font-semibold mb-1">
            No se pudo cargar el inicio
          </h2>
          <p className="opacity-80">
            Intenta recargar la página. Si el problema persiste, revisa la
            configuración de las secciones en el panel de administración.
          </p>
        </div>
      </Container>
    );
  }

  const list = (sections ?? []).filter((s) => (s as any).active !== false);

  if (!list.length) {
    return (
      <Container className="py-10">
        <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-5 text-sm">
          <h2 className="text-base font-semibold mb-1">
            Inicio aún sin contenido
          </h2>
          <p className="opacity-80">
            Configura las secciones desde el panel de administración en{" "}
            <code>/admin</code> &rarr; “Secciones de inicio”.
          </p>
        </div>
      </Container>
    );
  }

  return (
    <div className="bg-[rgb(var(--background-rgb))]">
      <Container className="py-6 md:py-8">
        {list.map((section) => (
          <div key={section.id}>{renderSection(section)}</div>
        ))}
      </Container>
    </div>
  );
}
