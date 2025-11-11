// src/features/wishlist/pages/WishlistPage.tsx
import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import Container from "@/layout/Container";
import { Button, Skeleton } from "@/ui";
import { ProductCardMinimal } from "@/features/products/components/ProductCardMinimal";
import { useWishlist } from "@/features/wishlist/hooks";
import { Price } from "@/features/currency/Price";

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
      // dentro del mismo grupo, más recientes primero
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items]);

  if (isLoading) {
    return (
      <Container className="py-6">
        <h1 className="mb-4 text-xl font-semibold">Mis favoritos</h1>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] overflow-hidden"
            >
              <Skeleton className="aspect-[4/3]" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
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
      <Container className="py-10 space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Mis favoritos</h1>
        <p className="text-sm opacity-80">
          Inicia sesión para guardar productos en tu lista de deseos.
        </p>
        <div className="flex justify-center gap-2">
          <Button asChild>
            <Link to={`/login?redirect=${encodeURIComponent("/wishlist")}`}>
              Iniciar sesión
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/">Volver al inicio</Link>
          </Button>
        </div>
      </Container>
    );
  }

  if (isError) {
    return (
      <Container className="py-10 text-center space-y-3">
        <h1 className="text-2xl font-semibold">Mis favoritos</h1>
        <p className="text-sm opacity-80">
          No se pudo cargar tu lista. Intenta más tarde.
        </p>
        <Button asChild variant="secondary">
          <Link to="/">Volver al inicio</Link>
        </Button>
      </Container>
    );
  }

  if (!total) {
    return (
      <Container className="py-10 text-center space-y-4">
        <h1 className="text-2xl font-semibold">Mis favoritos</h1>
        <p className="text-sm opacity-80">
          Aún no tienes productos en tu lista de deseos.
        </p>
        <Button asChild>
          <Link to="/catalog">Ver catálogo</Link>
        </Button>
      </Container>
    );
  }

  return (
    <Container className="py-6 space-y-5">
      {/* Header + resumen */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-semibold">Mis favoritos</h1>
          <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm text-[rgb(var(--muted-foreground-rgb))]">
            <span>
              {total} producto{total !== 1 && "s"} guardado{total !== 1 && "s"}
            </span>
            <span className="hidden sm:inline">·</span>
            {cheaperCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 px-2 py-0.5">
                🔻 {cheaperCount} más barato{cheaperCount !== 1 && "s"} ahora
              </span>
            )}
            {increasedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 text-amber-700 px-2 py-0.5">
                🔺 {increasedCount} subió de precio
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/catalog">Seguir comprando</Link>
          </Button>
        </div>
      </div>

      {/* Grid de productos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
        {sortedItems.map((item) => {
          const p = item.product;
          if (!p) return null;

          const productId = p.id;
          const firstImage =
            p.imageUrl || "https://placehold.co/800x600?text=Sin+foto";

          return (
            <div
              key={item.id}
              className="flex flex-col rounded-2xl border border-[rgb(var(--border-rgb))]/80 bg-[rgb(var(--card-rgb))] overflow-hidden"
            >
              {/* Card principal (imagen + nombre + corazón) */}
              <ProductCardMinimal
                className="h-full"
                to={`/product/${p.slug}`}
                name={p.name}
                description={p.description || ""}
                priceCents={p.price}
                currency={p.currency || "USD"}
                imageUrl={firstImage}
                variant="grid"
                isFavorite={isFavorite(productId)}
                onToggleFavorite={() => toggleFavorite(productId)}
                favoriteDisabled={isUpdating}
              />

              {/* Footer info precios */}
              <div className="px-3 pb-3 pt-1 text-[11px] leading-snug text-[rgb(var(--muted-foreground-rgb))] border-t border-[rgb(var(--border-rgb))]/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="opacity-75">
                    Guardado el {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                  {item.priceDirection === "DOWN" &&
                    item.discountPercent != null &&
                    item.discountPercent > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-emerald-500/10 text-emerald-700 text-[10px] font-semibold">
                        🔻 -{item.discountPercent.toFixed(1)}%
                      </span>
                    )}
                  {item.priceDirection === "UP" && item.priceDiff > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-amber-500/10 text-amber-700 text-[10px] font-semibold">
                      🔺 +
                      <Price
                        cents={item.priceDiff}
                        currency={p.currency || "USD"}
                      />
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="opacity-75">Precio al guardar:</span>
                  <Price
                    cents={item.priceAtAdd ?? p.price}
                    currency={p.currency || "USD"}
                  />
                  {item.priceChanged && (
                    <>
                      <span className="opacity-60">·</span>
                      <span className="opacity-75">Precio actual:</span>
                      <Price cents={p.price} currency={p.currency || "USD"} />
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Container>
  );
}
