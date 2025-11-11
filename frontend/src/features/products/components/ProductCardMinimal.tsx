// src/features/products/components/ProductCardMinimal.tsx
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Price } from "@/features/currency/Price";
import { cn } from "@/utils/cn";
import { IconButton } from "@/ui";

type ProductCardMinimalProps = {
  to: string;
  name: string;
  priceCents: number;
  currency?: string;
  imageUrl?: string | null;
  description?: string | null;
  categoryName?: string | null;
  badge?: string | null;
  /**
   * "grid"  → vista cómoda
   * "compact" → súper densa (más productos en pantalla)
   */
  variant?: "grid" | "compact";
  /** "landscape" (4/3) o "square" */
  aspect?: "landscape" | "square";
  className?: string;

  /** Estado de favorito (si no lo pasas, el icono no se rellena) */
  isFavorite?: boolean;
  /**
   * Si lo pasas, se muestra el botón de corazón.
   * El padre controla el estado (añadir / quitar de wishlist).
   */
  onToggleFavorite?: () => void;
  /** Para deshabilitar el botón (ej: mientras hace request) */
  favoriteDisabled?: boolean;
};

export function ProductCardMinimal({
  to,
  name,
  priceCents,
  currency = "USD",
  imageUrl,
  description,
  categoryName,
  badge,
  variant = "grid",
  aspect = "landscape",
  className,
  isFavorite,
  onToggleFavorite,
  favoriteDisabled,
}: ProductCardMinimalProps) {
  const safeImage = imageUrl || "https://placehold.co/800x600?text=Sin+foto";
  const isCompact = variant === "compact";
  const aspectCls = aspect === "square" ? "aspect-square" : "aspect-[4/3]";
  const currencyCode = (currency || "USD").toUpperCase();

  const showFavorite = typeof onToggleFavorite === "function";

  return (
    <Link
      to={to}
      className={cn(
        "group relative rounded-2xl bg-[rgb(var(--card-rgb))] border border-[rgb(var(--border-rgb))]",
        "overflow-hidden shadow-[0_0_0_1px_rgba(0,0,0,0.03)]",
        "transition-transform transition-shadow duration-150",
        "hover:-translate-y-0.5 hover:shadow-lg",
        className
      )}
      title={name}
    >
      {/* Botón de favoritos (opcional, sólo si se pasa onToggleFavorite) */}
      {showFavorite && (
        <div className="absolute right-2 top-2 z-10">
          <IconButton
            size="sm"
            variant="ghost"
            className={cn(
              "rounded-full border border-[rgb(var(--border-rgb))]/70",
              "bg-black/50 backdrop-blur text-white",
              "hover:bg-black/70",
              isFavorite &&
                "bg-red-500 text-white border-red-500 hover:bg-red-600"
            )}
            disabled={favoriteDisabled}
            aria-label={
              isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"
            }
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!favoriteDisabled && onToggleFavorite) {
                onToggleFavorite();
              }
            }}
          >
            <Heart
              className={cn(
                "h-4 w-4",
                isFavorite ? "fill-current" : "fill-transparent"
              )}
            />
          </IconButton>
        </div>
      )}

      {/* Imagen */}
      <div
        className={cn(
          aspectCls,
          "w-full overflow-hidden bg-[rgb(var(--muted-rgb))]"
        )}
      >
        <img
          src={safeImage}
          alt={name}
          className="h-full w-full object-cover group-hover:opacity-95 transition-opacity duration-150"
          loading="lazy"
          decoding="async"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "https://placehold.co/800x600?text=Sin+foto";
          }}
        />
      </div>

      {/* Contenido */}
      <div
        className={cn(
          "px-2.5 pb-2.5 pt-2",
          isCompact ? "space-y-1" : "space-y-1.5"
        )}
      >
        {badge && (
          <div className="mb-0.5 inline-flex items-center rounded-full border border-[rgb(var(--border-rgb))] bg-black/5 px-2 py-[2px] text-[10px] uppercase tracking-wide opacity-80">
            {badge}
          </div>
        )}

        <div
          className={cn(
            "font-medium line-clamp-2",
            isCompact ? "text-xs" : "text-sm"
          )}
        >
          {name}
        </div>

        {!isCompact && categoryName && (
          <div className="text-[11px] opacity-60 line-clamp-1">
            {categoryName}
          </div>
        )}

        {!isCompact && description && (
          <div className="text-[11px] opacity-70 line-clamp-2">
            {description}
          </div>
        )}

        <div
          className={cn(
            "font-semibold",
            isCompact ? "mt-1 text-xs" : "mt-2 text-sm"
          )}
        >
          <Price cents={priceCents} currency={currencyCode} />
        </div>
      </div>
    </Link>
  );
}
