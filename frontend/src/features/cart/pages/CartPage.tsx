import Container from "@/layout/Container";
import { Card, CardContent, CardFooter, Button } from "@/ui";
import { useCartStore } from "../store"; // mantiene tu import original
import { useNavigate, Link } from "react-router-dom";
import { useMemo, useState } from "react";

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(
    (cents || 0) / 100
  );
}

// Imagen coherente con el resto del sitio (fallback server que proxea Unsplash)
function productImageUrl(slug?: string, name?: string) {
  const backend = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
  const key = slug || name || "product";
  const sig = Math.abs(
    Array.from(key).reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
  );
  const q = encodeURIComponent(`${name || slug || "product"} product`);
  const upstream = `https://source.unsplash.com/featured/800x600/?${q}&sig=${sig}`;
  return `${backend}/img?u=${encodeURIComponent(upstream)}`;
}

export default function CartPage() {
  const { items, remove, clear } = useCartStore();
  const nav = useNavigate();
  const [confirmingClear, setConfirmingClear] = useState(false);

  const subtotal = useMemo(
    () => items.reduce((acc, it) => acc + it.price * it.qty, 0),
    [items]
  );
  const shipping = 0; // si luego cobras envío, actualiza aquí
  const total = subtotal + shipping;

  const goCheckout = () => {
    if (!items.length) return;
    nav("/checkout"); // ✅ flujo correcto: Cart -> /checkout (protegido)
    // si el user no está autenticado, ProtectedRoute lo envía a /login?next=/checkout
  };

  return (
    <Container className="py-6">
      <h2 className="text-xl font-semibold mb-4">Carrito</h2>

      {!items.length ? (
        <Card className="rounded-2xl bg-[var(--card)] border border-[var(--border)]">
          <CardContent className="p-6 text-center text-sm opacity-80">
            Tu carrito está vacío.
            <div className="mt-3">
              <Button asChild>
                <Link to="/">Explorar productos</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Lista de ítems */}
          <div className="md:col-span-2 space-y-3">
            {items.map((it) => (
              <Card
                key={it.productId}
                className="rounded-2xl bg-[var(--card)] border border-[var(--border)]"
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-24 h-18 rounded-xl overflow-hidden border border-[var(--border)]">
                      <img
                        src={productImageUrl((it as any).slug, it.name)}
                        alt={it.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src =
                            "https://placehold.co/400x300?text=Producto";
                        }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-medium leading-snug line-clamp-1">
                        {it.name}
                      </div>
                      <div className="text-xs opacity-70 mt-0.5">
                        {money(it.price)}{" "}
                        <span className="opacity-60">/ unidad</span>
                      </div>
                      <div className="text-sm opacity-80 mt-1">
                        Cantidad: {it.qty}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold">
                        {money(it.price * it.qty)}
                      </div>
                      <Button
                        className="mt-2"
                        variant="secondary"
                        size="sm"
                        onClick={() => remove(it.productId)}
                        aria-label={`Quitar ${it.name}`}
                      >
                        Quitar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Acciones lista */}
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" asChild>
                <Link to="/">Seguir comprando</Link>
              </Button>
              {!confirmingClear ? (
                <Button
                  variant="secondary"
                  onClick={() => setConfirmingClear(true)}
                >
                  Vaciar carrito
                </Button>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      clear();
                      setConfirmingClear(false);
                    }}
                  >
                    Confirmar vaciado
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmingClear(false)}
                  >
                    Cancelar
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Resumen (sticky) */}
          <aside className="md:sticky md:top-24 space-y-3">
            <Card className="rounded-2xl bg-[var(--card)] border border-[var(--border)]">
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold mb-3">Resumen</h3>

                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{money(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Envío</span>
                  <span>{money(shipping)}</span>
                </div>

                <div className="mt-3 flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{money(total)}</span>
                </div>

                <Button
                  className="w-full mt-4"
                  onClick={goCheckout}
                  disabled={!items.length}
                >
                  Ir al checkout
                </Button>

                <p className="text-xs opacity-70 mt-3">
                  Impuestos y descuentos se aplican en el checkout.
                </p>
              </CardContent>
              <CardFooter className="px-4 pb-4">
                <Button variant="ghost" className="w-full" asChild>
                  <Link to="/cart">Actualizar resumen</Link>
                </Button>
              </CardFooter>
            </Card>
          </aside>
        </div>
      )}
    </Container>
  );
}
