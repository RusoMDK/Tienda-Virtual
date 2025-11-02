import Container from "@/layout/Container";
import { Button, Input, Label } from "@/ui";
import { useToast } from "@/ui";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCartStore } from "@/features/cart/store";
import { useAuthStore } from "@/store/auth";
import { listAddresses } from "@/features/account/api/addresses";
import {
  createOrder,
  startStripeCheckout,
} from "@/features/checkout/api/orders";
import { Link, useNavigate } from "react-router-dom";

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(
    cents / 100
  );
}

type Address = {
  id: string;
  recipientName: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode?: string | null;
  country: string;
  phone?: string | null;
};

export default function CheckoutPage() {
  const { toast } = useToast();
  const nav = useNavigate();

  const { items, clear } = useCartStore();
  const user = useAuthStore((s) => s.user);

  const {
    data: addresses,
    isLoading: addressesLoading,
    isError: addressesError,
  } = useQuery({
    queryKey: ["addresses"],
    queryFn: listAddresses,
    staleTime: 5 * 60_000,
  });

  const [addressId, setAddressId] = useState<string | null>(null);
  const [coupon, setCoupon] = useState("");
  const [notes, setNotes] = useState("");
  const [paying, setPaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const liveRef = useRef<HTMLDivElement | null>(null);

  // Totales (placeholder para impuestos / envío dinámico a futuro)
  const currency = "USD";
  const subtotal = useMemo(
    () => items.reduce((a, it) => a + it.price * it.qty, 0),
    [items]
  );

  // 🚚 Política de envío (por ahora gratis; fácil de cambiar aquí)
  const shipping = 0;
  const discount = 0; // si tu backend calcula descuento por cupón, aquí sólo mostramos 0
  const total = subtotal + shipping - discount;

  // Selección por defecto
  useEffect(() => {
    if (addresses?.length && !addressId) setAddressId(addresses[0].id);
  }, [addresses, addressId]);

  // Accesibilidad: anunciar errores
  useEffect(() => {
    if (errorMsg) {
      liveRef.current?.focus();
    }
  }, [errorMsg]);

  const selectedAddress: Address | undefined = useMemo(
    () => addresses?.find((a: Address) => a.id === addressId),
    [addresses, addressId]
  );

  const requiresLogin = !user?.email; // ajusta si tu user shape difiere
  const cartEmpty = items.length === 0;
  const canPay = !requiresLogin && !cartEmpty && !!selectedAddress && !paying;

  const onPay = useCallback(async () => {
    try {
      setErrorMsg(null);

      if (cartEmpty) {
        setErrorMsg("Tu carrito está vacío.");
        toast({ title: "Tu carrito está vacío", variant: "error" });
        return;
      }
      if (requiresLogin) {
        setErrorMsg("Debes iniciar sesión para continuar.");
        toast({ title: "Inicia sesión para pagar", variant: "error" });
        nav("/login?next=/checkout");
        return;
      }
      if (!selectedAddress) {
        setErrorMsg("Agrega o selecciona una dirección de envío.");
        toast({ title: "Agrega una dirección primero", variant: "error" });
        return;
      }

      setPaying(true);

      // Crea orden en backend (deja que el backend valide cupón/impuestos/envío)
      const { orderId } = await createOrder({
        currency: currency.toLowerCase(),
        items: items.map((it) => ({ productId: it.id, quantity: it.qty })),
        email: user?.email || "",
        recipientName: selectedAddress.recipientName,
        addressLine1: selectedAddress.addressLine1,
        addressLine2: selectedAddress.addressLine2 || undefined,
        city: selectedAddress.city,
        state: selectedAddress.state || undefined,
        postalCode: selectedAddress.postalCode || undefined,
        country: selectedAddress.country,
        phone: selectedAddress.phone || undefined,
        shippingTotal: shipping,
        couponCode: coupon || undefined,
        notes: notes || undefined,
      });

      // Stripe Checkout
      const { url } = await startStripeCheckout(orderId);

      // Recomendado: limpiar carrito en success (no aquí).
      // clear();

      window.location.href = url;
    } catch (e: any) {
      const msg = e?.response?.data?.message || "No se pudo iniciar el pago";
      setErrorMsg(msg);
      toast({ title: msg, variant: "error" });
      setPaying(false);
    }
  }, [
    cartEmpty,
    requiresLogin,
    selectedAddress,
    items,
    user?.email,
    coupon,
    notes,
    currency,
    shipping,
    toast,
    nav,
  ]);

  return (
    <Container className="py-8 grid gap-6 md:grid-cols-3">
      {/* Columna izquierda: Dirección + Carrito */}
      <div className="md:col-span-2 space-y-6">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="text-lg font-semibold mb-3">Dirección de envío</h2>

          {addressesLoading && (
            <div className="opacity-70 text-sm">Cargando direcciones…</div>
          )}

          {!addressesLoading &&
            (addressesError || !addresses || addresses.length === 0) && (
              <div className="text-sm opacity-80">
                No tienes direcciones guardadas.&nbsp;
                <Link className="underline" to="/account/addresses">
                  Crear una dirección
                </Link>
              </div>
            )}

          {!!addresses?.length && (
            <div className="grid gap-3">
              <Label htmlFor="addr">Selecciona una dirección</Label>
              <select
                id="addr"
                className="rounded-xl px-3 py-2 text-sm bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--ring)] transition"
                value={addressId ?? ""}
                onChange={(e) => setAddressId(e.target.value)}
              >
                {addresses.map((a: Address) => (
                  <option key={a.id} value={a.id}>
                    {a.recipientName} — {a.city}, {a.country}
                  </option>
                ))}
              </select>

              {/* Vista previa de dirección */}
              {selectedAddress && (
                <div className="mt-2 text-sm rounded-xl px-3 py-2 bg-[var(--surface-1)] border border-[var(--border)]">
                  <div className="font-medium">
                    {selectedAddress.recipientName}
                  </div>
                  <div>
                    {selectedAddress.addressLine1}
                    {selectedAddress.addressLine2
                      ? `, ${selectedAddress.addressLine2}`
                      : ""}
                  </div>
                  <div>
                    {selectedAddress.city}
                    {selectedAddress.state
                      ? `, ${selectedAddress.state}`
                      : ""}{" "}
                    {selectedAddress.postalCode
                      ? selectedAddress.postalCode
                      : ""}
                  </div>
                  <div>{selectedAddress.country}</div>
                  {selectedAddress.phone && (
                    <div>☎ {selectedAddress.phone}</div>
                  )}
                </div>
              )}

              <div className="text-xs opacity-70">
                ¿Editar o agregar otra?{" "}
                <Link className="underline" to="/account/addresses">
                  Gestionar direcciones
                </Link>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold mb-3">Tu carrito</h2>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/cart">Editar carrito</Link>
            </Button>
          </div>

          {items.length === 0 && (
            <div className="text-sm opacity-70">
              No hay productos.{" "}
              <Link to="/" className="underline">
                Seguir comprando
              </Link>
            </div>
          )}

          {!!items.length && (
            <div className="space-y-2">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between text-sm"
                >
                  <div className="opacity-90 line-clamp-1">
                    {it.name} × {it.qty}
                  </div>
                  <div className="font-medium">
                    {money(it.price * it.qty, currency)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Notas del pedido (opcional) */}
          <div className="mt-4">
            <Label htmlFor="notes">Notas para el pedido (opcional)</Label>
            <textarea
              id="notes"
              rows={3}
              className="mt-1 w-full rounded-xl px-3 py-2 text-sm bg-[var(--surface-1)] border border-[var(--border)] text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--ring)] focus:border-[var(--ring)] transition resize-y"
              placeholder="Indicaciones de entrega, referencia, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </section>

        {/* Mensajes en vivo (accesibilidad) */}
        <div ref={liveRef} tabIndex={-1} aria-live="polite" className="sr-only">
          {errorMsg || ""}
        </div>
      </div>

      {/* Columna derecha: Resumen (sticky) */}
      <aside className="space-y-4 md:sticky md:top-24">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="text-lg font-semibold mb-3">Resumen</h2>

          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{money(subtotal, currency)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Envío</span>
            <span>{money(shipping, currency)}</span>
          </div>
          {coupon && (
            <div className="flex justify-between text-sm">
              <span>Cupón</span>
              <span>— {money(discount, currency)}</span>
            </div>
          )}

          {/* Cupón */}
          <div className="mt-3 grid gap-2">
            <Label htmlFor="coupon">Cupón (opcional)</Label>
            <div className="flex gap-2">
              <Input
                id="coupon"
                placeholder="PROMO10"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.trim())}
                className="flex-1"
              />
              {coupon ? (
                <Button variant="ghost" onClick={() => setCoupon("")}>
                  Quitar
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (!coupon) {
                      toast({ title: "Introduce un cupón", variant: "error" });
                    } else {
                      toast({
                        title: "Se aplicará al pagar",
                        variant: "success",
                      });
                    }
                  }}
                >
                  Aplicar
                </Button>
              )}
            </div>
            <p className="text-xs opacity-70">
              El descuento se confirmará durante el pago si el cupón es válido.
            </p>
          </div>

          <div className="mt-3 flex justify-between font-semibold">
            <span>Total</span>
            <span>{money(total, currency)}</span>
          </div>

          <Button className="w-full mt-4" onClick={onPay} disabled={!canPay}>
            {paying ? "Redirigiendo a Stripe…" : "Pagar con Stripe"}
          </Button>

          {/* Estados bloqueantes */}
          {requiresLogin && (
            <p className="mt-3 text-xs opacity-80">
              Debes{" "}
              <Link className="underline" to="/login?next=/checkout">
                iniciar sesión
              </Link>{" "}
              para continuar.
            </p>
          )}
          {cartEmpty && (
            <p className="mt-3 text-xs opacity-80">
              Tu carrito está vacío.{" "}
              <Link className="underline" to="/">
                Explorar productos
              </Link>
            </p>
          )}
          {!selectedAddress && !addressesLoading && (
            <p className="mt-3 text-xs opacity-80">
              Agrega una dirección para habilitar el pago.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 text-xs opacity-70">
          Al pagar aceptas nuestros{" "}
          <Link to="/legal/terms" className="underline">
            términos y condiciones
          </Link>
          . Tu pago es procesado de forma segura por Stripe.
        </section>
      </aside>
    </Container>
  );
}
