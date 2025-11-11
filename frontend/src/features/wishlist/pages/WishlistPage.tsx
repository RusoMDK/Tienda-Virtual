// src/features/wishlist/pages/WishlistPage.tsx
import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Container from "@/layout/Container";
import { Button, Skeleton } from "@/ui";
import { useWishlist } from "@/features/wishlist/hooks";
import { Price } from "@/features/currency/Price";
import { Heart, TrendingDown, TrendingUp, ShoppingCart, X } from "lucide-react";

export default function WishlistPage() {
  const {
    items,
    isLoading,
    isError,
    error,
    isFavorite,
    toggleFavorite,
    isUpdating,
  } = useWishlist();

  useEffect(() => {
    document.title = "Mis favoritos – Tienda";
  }, []);

  const status =
    (error as any)?.response?.status || (error as any)?.statusCode || 0;

  const total = items.length;
  const cheaperCount = items.filter((i) => i.priceDirection === "DOWN").length;
  const increasedCount = items.filter((i) => i.priceDirection === "UP").length;

  // Orden UX: primero los que bajaron, luego sin cambio, luego los que subieron
  const sortedItems = useMemo(() => {
    const score = (dir: "UP" | "DOWN" | "SAME") => {
      if (dir === "DOWN") return 0;
      if (dir === "SAME") return 1;
      return 2; // UP
    };

    return [...items].sort((a, b) => {
      const sA = score(a.priceDirection);
      const sB = score(b.priceDirection);
      if (sA !== sB) return sA - sB;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items]);

  // ================= ESTADOS ESPECIALES =================

  if (isLoading) {
    return (
      <Container className="py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold">Mis favoritos</h1>
          <div className="h-6 w-24 rounded-full bg-[rgb(var(--card-2-rgb))] animate-pulse" />
        </div>

        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[rgb(var(--border-rgb))]/80 bg-[rgb(var(--card-rgb))] p-3 sm:p-4 flex gap-3 sm:gap-4"
            >
              <Skeleton className="h-20 w-20 sm:h-24 sm:w-24 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <div className="hidden sm:flex flex-col gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
              </div>
            </div>
          ))}
        </div>
      </Container>
    );
  }

  // No autenticado
  if (isError && status === 401) {
    return (
      <Container className="py-12">
        <div className="max-w-xl mx-auto text-center space-y-5">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-[rgb(var(--card-2-rgb))] text-[rgb(var(--primary-rgb))]">
            <Heart className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold">
              Mis favoritos
            </h1>
            <p className="text-sm md:text-base text-[rgb(var(--muted-foreground-rgb))]">
              Inicia sesión para guardar productos en tu lista de deseos y
              recibir avisos cuando cambien de precio.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to={`/login?redirect=${encodeURIComponent("/wishlist")}`}>
                Iniciar sesión
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to="/">Volver al inicio</Link>
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  if (isError) {
    return (
      <Container className="py-12">
        <div className="max-w-xl mx-auto text-center space-y-4">
          <h1 className="text-2xl md:text-3xl font-semibold">Mis favoritos</h1>
          <p className="text-sm md:text-base text-[rgb(var(--muted-foreground-rgb))]">
            No se pudo cargar tu lista de deseos en este momento. Intenta de
            nuevo más tarde.
          </p>
          <Button asChild variant="secondary">
            <Link to="/">Volver al inicio</Link>
          </Button>
        </div>
      </Container>
    );
  }

  // Vacío
  if (!total) {
    return (
      <Container className="py-12">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/10 text-rose-500">
            <Heart className="h-10 w-10" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold">
              Tu lista de deseos está vacía
            </h1>
            <p className="text-sm md:text-base text-[rgb(var(--muted-foreground-rgb))]">
              Guarda tus productos favoritos para verlos rápidamente, seguir sus
              precios y comprarlos más tarde con calma.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/">Explorar productos</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link to="/ofertas">Ver ofertas del día</Link>
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  // ================= LISTA TIPO "EMPRESA" =================

  return (
    <Container className="py-8 space-y-6">
      {/* Header + resumen */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-xl md:text-2xl font-semibold">Mis favoritos</h1>
          <p className="text-xs md:text-sm text-[rgb(var(--muted-foreground-rgb))]">
            Revisa tus productos guardados, mira cómo cambian de precio y decide
            qué llevarte primero. Primero se muestran los que están más
            atractivos ahora mismo (bajaron de precio).
          </p>
          <div className="flex flex-wrap items-center gap-2 text-[11px] md:text-xs text-[rgb(var(--muted-foreground-rgb))]">
            <span>
              {total} producto{total !== 1 && "s"} guardado
              {total !== 1 && "s"}
            </span>
            {cheaperCount > 0 && (
              <>
                <span className="hidden sm:inline">·</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 px-2 py-0.5">
                  <TrendingDown className="h-3 w-3" />
                  {cheaperCount} más barato
                  {cheaperCount !== 1 && "s"} ahora
                </span>
              </>
            )}
            {increasedCount > 0 && (
              <>
                <span className="hidden sm:inline">·</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 px-2 py-0.5">
                  <TrendingUp className="h-3 w-3" />
                  {increasedCount} subió de precio
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-right text-[11px] md:text-xs text-[rgb(var(--muted-foreground-rgb))]">
            <div>
              <span className="font-semibold">{total}</span> en tu lista
            </div>
            {cheaperCount > 0 && (
              <div className="text-emerald-600">
                {cheaperCount} oportunidad
                {cheaperCount !== 1 && "es"} de ahorro
              </div>
            )}
          </div>
          <Button asChild size="sm" variant="ghost">
            <Link to="/ofertas">Ver ofertas recomendadas</Link>
          </Button>
        </div>
      </div>

      {/* Lista de productos (estilo filas) */}
      <div className="space-y-3">
        {sortedItems.map((item) => {
          const p = item.product;
          if (!p) return null;

          const productId = p.id;
          const firstImage =
            p.imageUrl || "https://placehold.co/800x600?text=Sin+foto";

          const savedDate = new Date(item.createdAt).toLocaleDateString(
            "es-ES"
          );

          const favorite = isFavorite(productId);

          return (
            <div
              key={item.id}
              className="
                group rounded-2xl border border-[rgb(var(--border-rgb))]/80
                bg-[rgb(var(--card-rgb))] hover:bg-[rgb(var(--card-2-rgb))]
                transition-colors shadow-sm/0 hover:shadow-sm
              "
            >
              <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
                {/* Imagen + badge de tendencia */}
                <Link
                  to={`/product/${p.slug}`}
                  className="
                    relative shrink-0
                    w-full sm:w-[120px]
                    aspect-[4/3] sm:aspect-square
                    overflow-hidden rounded-xl
                    bg-[rgb(var(--card-2-rgb))]
                  "
                >
                  <img
                    src={firstImage}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                  {/* Badge tendencia en la esquina */}
                  {item.priceDirection === "DOWN" &&
                    item.discountPercent != null &&
                    item.discountPercent > 0 && (
                      <span
                        className="
                          absolute left-2 top-2 inline-flex items-center gap-1
                          rounded-full bg-emerald-500 text-white text-[10px] px-2 py-0.5
                          shadow-sm
                        "
                      >
                        <TrendingDown className="h-3 w-3" />-
                        {item.discountPercent.toFixed(1)}%
                      </span>
                    )}
                  {item.priceDirection === "UP" && item.priceDiff > 0 && (
                    <span
                      className="
                        absolute left-2 top-2 inline-flex items-center gap-1
                        rounded-full bg-amber-500 text-white text-[10px] px-2 py-0.5
                        shadow-sm
                      "
                    >
                      <TrendingUp className="h-3 w-3" />
                      +
                      <Price
                        cents={item.priceDiff}
                        currency={p.currency || "USD"}
                      />
                    </span>
                  )}
                </Link>

                {/* Centro: info producto + precios */}
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div className="space-y-1">
                    <Link
                      to={`/product/${p.slug}`}
                      className="
                        text-sm sm:text-base font-medium
                        text-[rgb(var(--fg-rgb))]
                        line-clamp-2
                        hover:underline
                      "
                    >
                      {p.name}
                    </Link>
                    {p.description && (
                      <p className="text-[11px] sm:text-xs text-[rgb(var(--muted-foreground-rgb))] line-clamp-2">
                        {p.description}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {/* Precio actual + anterior */}
                    <div className="flex items-baseline gap-2">
                      <span className="text-[10px] uppercase tracking-wide text-[rgb(var(--muted-foreground-rgb))]">
                        Precio ahora
                      </span>
                      <span className="text-sm font-semibold text-[rgb(var(--fg-rgb))]">
                        <Price cents={p.price} currency={p.currency || "USD"} />
                      </span>
                      {item.priceChanged && (
                        <span className="text-[11px] text-[rgb(var(--muted-foreground-rgb))] line-through">
                          <Price
                            cents={item.priceAtAdd ?? p.price}
                            currency={p.currency || "USD"}
                          />
                        </span>
                      )}
                    </div>

                    {/* Texto de cambio */}
                    {item.priceDirection === "DOWN" && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                        <TrendingDown className="h-3 w-3" />
                        Bajó desde que lo guardaste
                      </span>
                    )}
                    {item.priceDirection === "UP" && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                        <TrendingUp className="h-3 w-3" />
                        Subió desde que lo guardaste
                      </span>
                    )}
                    {item.priceDirection === "SAME" && !item.priceChanged && (
                      <span className="text-[11px] text-[rgb(var(--muted-foreground-rgb))]">
                        Se mantiene al mismo precio
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[rgb(var(--muted-foreground-rgb))]">
                    <span>Guardado el {savedDate}</span>
                  </div>
                </div>

                {/* Derecha: acciones */}
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between gap-2 sm:gap-3">
                  {/* Botón corazón / quitar */}
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => toggleFavorite(productId)}
                    className={`
                      inline-flex items-center justify-center rounded-full
                      h-9 w-9 border border-[rgb(var(--border-rgb))]
                      bg-[rgb(var(--card-2-rgb))]
                      transition-all
                      ${
                        favorite
                          ? "text-rose-500"
                          : "text-[rgb(var(--muted-foreground-rgb))]"
                      }
                      hover:border-rose-400/70 hover:bg-rose-500/5
                      disabled:opacity-60
                    `}
                    aria-label={
                      favorite ? "Quitar de favoritos" : "Añadir a favoritos"
                    }
                  >
                    <Heart
                      className={favorite ? "fill-current" : ""}
                      size={18}
                    />
                  </button>

                  <div className="flex flex-row sm:flex-col gap-2">
                    <Button
                      asChild
                      size="xs"
                      variant="outline"
                      className="hidden sm:inline-flex"
                    >
                      <Link to={`/product/${p.slug}`}>
                        <ShoppingCart className="h-3 w-3 mr-1.5" />
                        Ver producto
                      </Link>
                    </Button>

                    <Button
                      type="button"
                      size="xs"
                      variant="ghost"
                      className="inline-flex items-center gap-1 text-[11px]"
                      onClick={() => toggleFavorite(productId)}
                      disabled={isUpdating}
                    >
                      <X className="h-3 w-3" />
                      Quitar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Container>
  );
}
