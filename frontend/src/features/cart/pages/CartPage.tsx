import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Container from "@/layout/Container";
import { Button, Input } from "@/ui";
import { useCartStore } from "../store";
import {
  ShoppingBag,
  ArrowLeft,
  Trash2,
  Minus,
  Plus,
  Tag,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { Price } from "@/features/currency/Price";

export default function CartPage() {
  const nav = useNavigate();
  const { items, remove, clear, setQty, increment, decrement } = useCartStore();
  const [confirmingClear, setConfirmingClear] = useState(false);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (acc, it) => acc + Math.max(0, Math.round(it.price)) * it.qty,
        0
      ),
    [items]
  );
  const shipping = 0;
  const total = subtotal + shipping;

  const totalItems = useMemo(
    () => items.reduce((acc, it) => acc + (it.qty || 0), 0),
    [items]
  );

  const hasItems = items.length > 0;
  const cartCurrency = items[0]?.currency || "USD";

  const goCheckout = () => {
    if (!items.length) return;
    nav("/checkout");
  };

  // carrito vacío
  if (!hasItems) {
    return (
      <Container className="py-10 sm:py-14">
        <div className="max-w-xl mx-auto text-center space-y-6">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))]">
            <ShoppingBag className="h-10 w-10 text-[rgb(var(--primary-rgb))]" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Tu carrito está vacío
            </h1>
            <p className="text-sm md:text-base text-[rgb(var(--muted-foreground-rgb))]">
              Añade productos al carrito para ver aquí el resumen de tu pedido y
              continuar con la compra cuando quieras.
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

  // carrito con items
  return (
    <Container className="py-6 sm:py-8 lg:py-10">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
            Carrito de compra
          </h1>
          <p className="text-xs sm:text-sm text-[rgb(var(--muted-foreground-rgb))]">
            Revisa los artículos y cantidades antes de continuar con el pedido.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))]">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-[rgb(var(--primary-rgb))]" />
            {totalItems} artículo{totalItems !== 1 && "s"} en el carrito
          </span>
          {!confirmingClear ? (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              className="inline-flex items-center gap-1 text-[rgb(var(--muted-foreground-rgb))] hover:text-[rgb(var(--danger-rgb,220_38_38))]"
            >
              <Trash2 size={14} />
              Vaciar carrito
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  clear();
                  setConfirmingClear(false);
                }}
                className="inline-flex items-center gap-1 text-[rgb(var(--danger-rgb,220_38_38))]"
              >
                Confirmar vaciado
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="text-[rgb(var(--muted-foreground-rgb))] hover:text-[rgb(var(--fg-rgb))]"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Layout principal */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-5 lg:gap-6">
        {/* Lista de ítems */}
        <div className="space-y-3">
          {items.map((it) => {
            const id = it.productId;
            const slug = it.slug;
            const qty = it.qty;
            const price = Math.max(0, Math.round(it.price));
            const lineTotal = price * qty;
            const currency = it.currency || cartCurrency;
            const imgUrl =
              it.imageUrl || "https://placehold.co/600x400?text=Producto";

            const stockLabel =
              typeof it.maxStock === "number"
                ? it.maxStock <= 0
                  ? "Sin stock disponible"
                  : it.maxStock < 5
                  ? `Quedan ${it.maxStock} unidad${
                      it.maxStock === 1 ? "" : "es"
                    }`
                  : `Hasta ${it.maxStock} unidades disponibles`
                : "Stock sujeto a disponibilidad";

            const handleQtyChange = (next: number) => {
              const safe = Number.isFinite(next) ? next : qty;
              setQty(id, safe);
            };

            return (
              <div
                key={id}
                className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] px-3 py-3 sm:px-4 sm:py-4 flex gap-3 sm:gap-4"
              >
                {/* Imagen */}
                <button
                  type="button"
                  onClick={() => slug && nav(`/product/${slug}`)}
                  className="shrink-0 w-[88px] sm:w-[110px] aspect-[4/3] rounded-xl overflow-hidden bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))] hover:border-[rgb(var(--primary-rgb))]/60"
                >
                  <img
                    src={imgUrl}
                    alt={it.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src =
                        "https://placehold.co/600x400?text=Producto";
                    }}
                  />
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0 flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => slug && nav(`/product/${slug}`)}
                        className="text-sm sm:text-[15px] font-medium text-left line-clamp-2 hover:underline underline-offset-2"
                      >
                        {it.name}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(id)}
                      className="shrink-0 text-[rgb(var(--muted-foreground-rgb))] hover:text-[rgb(var(--danger-rgb,220_38_38))]"
                      title={`Quitar ${it.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Controles + precios */}
                  <div className="flex flex-wrap items-end gap-3 justify-between">
                    {/* Cantidad */}
                    <div className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-2-rgb))] px-1.5 py-1">
                      <button
                        type="button"
                        onClick={() => decrement(id)}
                        className={cn(
                          "h-6 w-6 inline-flex items-center justify-center rounded-full text-xs",
                          qty <= 1
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-[rgb(var(--card-rgb))]"
                        )}
                        disabled={qty <= 1}
                      >
                        <Minus size={12} />
                      </button>
                      <Input
                        type="number"
                        min={1}
                        max={it.maxStock ?? 99}
                        value={qty}
                        onChange={(e) =>
                          handleQtyChange(Number(e.target.value))
                        }
                        className="w-12 h-7 text-center text-xs border-0 bg-transparent focus:ring-0 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => increment(id)}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-full text-xs hover:bg-[rgb(var(--card-rgb))]"
                      >
                        <Plus size={12} />
                      </button>
                    </div>

                    {/* Precios */}
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-xs text-[rgb(var(--muted-foreground-rgb))]">
                        Precio unitario
                      </span>
                      <span className="text-sm sm:text-base font-semibold">
                        <Price cents={price} currency={currency} />
                      </span>
                      <span className="text-[11px] text-[rgb(var(--muted-foreground-rgb))]">
                        Línea: <Price cents={lineTotal} currency={currency} />
                      </span>
                    </div>
                  </div>

                  {/* Meta / stock */}
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[rgb(var(--muted-foreground-rgb))]">
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))]">
                      <Tag size={12} /> {stockLabel}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Acciones inferiores */}
          <div className="flex flex-wrap gap-2 mt-2">
            <Button variant="ghost" asChild>
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Seguir comprando
              </Link>
            </Button>
            {!confirmingClear && (
              <Button
                variant="secondary"
                onClick={() => setConfirmingClear(true)}
                className="inline-flex items-center gap-1"
              >
                <Trash2 size={14} />
                Vaciar carrito
              </Button>
            )}
          </div>
        </div>

        {/* Resumen */}
        <aside className="space-y-3 lg:space-y-4 lg:pl-1 md:sticky md:top-24 self-start">
          <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-4 sm:p-5 space-y-4">
            <h2 className="text-sm sm:text-base font-semibold">
              Resumen del pedido
            </h2>

            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[rgb(var(--muted-foreground-rgb))]">
                  Subtotal ({totalItems} artículo{totalItems !== 1 && "s"})
                </span>
                <span className="font-medium">
                  <Price cents={subtotal} currency={cartCurrency} />
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[rgb(var(--muted-foreground-rgb))]">
                  Envío estimado
                </span>
                <span className="text-[rgb(var(--muted-foreground-rgb))] text-xs">
                  Se calcula en el siguiente paso
                </span>
              </div>
            </div>

            <div className="border-t border-[rgb(var(--border-rgb))] pt-3 mt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Total estimado</span>
                <span className="text-base font-semibold">
                  <Price cents={total} currency={cartCurrency} />
                </span>
              </div>
            </div>

            <Button
              className="w-full mt-1"
              size="lg"
              onClick={goCheckout}
              disabled={!hasItems}
            >
              Continuar con el pedido
            </Button>
          </div>

          <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-3 sm:p-4 space-y-2 text-[11px] sm:text-xs text-[rgb(var(--muted-foreground-rgb))]">
            <div className="flex items-start gap-2">
              <ShieldCheck size={14} className="mt-0.5" />
              <p>
                Tus datos y pedidos están protegidos. Podrás revisar todo antes
                de confirmar el pago.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Truck size={14} className="mt-0.5" />
              <p>
                Costes y tiempos de envío se calculan según tu dirección en el
                siguiente paso.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </Container>
  );
}
