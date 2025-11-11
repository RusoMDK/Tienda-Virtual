import { Card, CardHeader, CardContent, Badge, Button, IconButton } from "@/ui";
import { useCartStore } from "@/features/cart/store";
import { Link } from "react-router-dom";
import { useToast } from "@/ui";
import { Price } from "@/features/currency/Price";
import { Heart } from "lucide-react";
import { cn } from "@/utils/cn";

export type ProductDTO = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number; // en cents
  currency: string;
  stock: number;
  active: boolean;
};

type Props = {
  p: ProductDTO;
  showViewButton?: boolean;
  showAddButton?: boolean;

  // Wishlist (opcionales, solo si quieres ver el corazón)
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  favoriteDisabled?: boolean;
};

export default function ProductCard({
  p,
  showViewButton = true,
  showAddButton = true,
  isFavorite,
  onToggleFavorite,
  favoriteDisabled,
}: Props) {
  const add = useCartStore((s) => s.add);
  const toast = useToast();

  const canAdd = p.active && p.stock > 0;
  const showFavorite = typeof onToggleFavorite === "function";

  function handleAdd() {
    if (!canAdd) return;
    add(
      {
        productId: p.id,
        slug: p.slug,
        name: p.name,
        price: p.price,
        maxStock: p.stock,
      },
      1
    );
    toast({ title: "Añadido al carrito", variant: "success" });
  }

  let status: string | null = null;
  if (!p.active) status = "No disponible";
  else if (p.stock === 0) status = "Sin stock";
  else if (p.stock > 0 && p.stock <= 3) status = `Quedan ${p.stock}`;

  return (
    <Card className="relative h-full rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] shadow-sm">
      {/* Corazón opcional */}
      {showFavorite && (
        <div className="absolute right-2 top-2 z-10">
          <IconButton
            size="sm"
            variant="ghost"
            className={cn(
              "rounded-full border border-[rgb(var(--border-rgb))]/70 bg-black/5",
              "hover:bg-black/10",
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
              onToggleFavorite?.();
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

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={`/product/${p.slug}`}
            className="text-sm font-semibold leading-snug line-clamp-2 hover:underline"
          >
            {p.name}
          </Link>
          {status && (
            <Badge className="text-[10px] px-2 py-[2px] whitespace-nowrap">
              {status}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex flex-col gap-3">
        {p.description && (
          <p className="text-xs opacity-70 line-clamp-3">{p.description}</p>
        )}

        <div className="mt-auto pt-2 border-t border-[rgb(var(--border-rgb))]/70 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">
            <Price cents={p.price} currency={p.currency || "USD"} />
          </span>

          <div className="flex items-center gap-1.5">
            {showViewButton && (
              <Button asChild variant="ghost" size="sm">
                <Link to={`/product/${p.slug}`}>Ver</Link>
              </Button>
            )}

            {showAddButton && (
              <Button size="sm" disabled={!canAdd} onClick={handleAdd}>
                Añadir
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
