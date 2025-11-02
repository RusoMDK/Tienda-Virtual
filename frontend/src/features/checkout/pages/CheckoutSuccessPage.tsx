import Container from "@/layout/Container";
import { Button } from "@/ui";
import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useCartStore } from "@/features/cart/store";

type OrderStatus = "PENDING" | "PAID" | "CANCELLED" | "FULFILLED";
type Order = {
  id: string;
  status: OrderStatus;
  total: number; // cents
  currency: string; // "usd" | ...
  createdAt: string;
  items?: {
    id: string;
    quantity: number;
    unitPrice: number;
    product?: { name: string };
  }[];
};

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format((cents || 0) / 100);
}

function StatusChip({ status }: { status: OrderStatus }) {
  const label =
    status === "PENDING"
      ? "Pendiente"
      : status === "PAID"
      ? "Pagado"
      : status === "FULFILLED"
      ? "Completado"
      : "Cancelado";

  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-[var(--surface-1)] border border-[var(--border)]">
      {label}
    </span>
  );
}

function Timeline({ status }: { status: OrderStatus }) {
  const steps = ["Creado", "Pagado", "Preparado", "Completado"] as const;
  const activeIdx =
    status === "PENDING"
      ? 0
      : status === "PAID"
      ? 1
      : status === "FULFILLED"
      ? 3
      : -1;

  return (
    <ol className="mt-4 flex items-center justify-center gap-4 text-xs">
      {steps.map((s, i) => {
        const active = i <= activeIdx && activeIdx >= 0;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                active ? "bg-[var(--text)]" : "bg-[var(--border)]"
              }`}
            />
            <span className={active ? "font-medium" : "opacity-60"}>{s}</span>
            {i < steps.length - 1 && (
              <span className="w-8 h-px bg-[var(--border)]" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function CheckoutSuccessPage() {
  const [sp] = useSearchParams();
  const orderId = sp.get("order") || "";
  const clear = useCartStore((s) => s.clear);
  const clearedOnce = useRef(false);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const pollCount = useRef(0);

  const hasOrderId = !!orderId;

  const query = useQuery({
    enabled: hasOrderId,
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data } = await api.get<Order>(`/orders/${orderId}`);
      return data;
    },
    // Poll cada 1.5s mientras esté pendiente, con tope de 8 ciclos
    refetchInterval: (data) => {
      if (!data) return false;
      const pending = data.status === "PENDING";
      if (!pending) return false;
      if (pollCount.current >= 8) return false;
      pollCount.current += 1;
      return 1500;
    },
    refetchIntervalInBackground: true,
    retry: (failureCount, error: any) => {
      const status = error?.response?.status;
      if (status === 401 || status === 404) return false;
      return failureCount < 5;
    },
  });

  // Limpia carrito cuando la orden está confirmada o completada
  useEffect(() => {
    const st = query.data?.status;
    if ((st === "PAID" || st === "FULFILLED") && !clearedOnce.current) {
      clear();
      clearedOnce.current = true;
    }
  }, [query.data?.status, clear]);

  // Foco + título del documento
  useEffect(() => {
    titleRef.current?.focus();
  }, []);
  useEffect(() => {
    if (query.data?.id) {
      document.title =
        query.data.status === "PAID" || query.data.status === "FULFILLED"
          ? "Pago confirmado – Tienda"
          : "Confirmando pago – Tienda";
    }
  }, [query.data?.status, query.data?.id]);

  // Derivados
  const title = useMemo(() => {
    if (!hasOrderId) return "Pago procesado";
    if (query.isLoading) return "Confirmando pago…";
    if (query.isError) {
      const s = (query.error as any)?.response?.status;
      if (s === 401) return "Inicia sesión para ver tu pedido";
      if (s === 404) return "Pedido no encontrado";
      return "No pudimos validar el pago";
    }
    if (query.data?.status === "PAID") return "¡Pago confirmado! 🎉";
    if (query.data?.status === "FULFILLED") return "Pedido completado ✅";
    if (query.data?.status === "CANCELLED") return "Pedido cancelado";
    return "Confirmando pago…";
  }, [hasOrderId, query.isLoading, query.isError, query.data, query.error]);

  async function copyOrderId() {
    if (!query.data?.id) return;
    try {
      await navigator.clipboard.writeText(query.data.id);
    } catch {}
  }

  async function shareOrder() {
    if (!query.data?.id) return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Pedido confirmado",
          text: `Pedido ${query.data.id}`,
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {}
  }

  function printReceipt() {
    window.print();
  }

  const createdAt = query.data?.createdAt
    ? new Date(query.data.createdAt)
    : null;

  return (
    <Container className="py-10 space-y-6">
      <div className="mx-auto max-w-2xl rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 text-center">
        <h2 ref={titleRef} tabIndex={-1} className="text-2xl font-bold">
          {title}
        </h2>

        {/* mensajes por estados base */}
        {!hasOrderId && (
          <p className="opacity-80 mt-2">
            No recibimos el identificador del pedido. Vuelve al catálogo y
            revisa “Mis pedidos”.
          </p>
        )}

        {hasOrderId && query.isLoading && (
          <p className="opacity-80 mt-2">Esperando confirmación de Stripe…</p>
        )}

        {hasOrderId && query.isError && (
          <>
            <p className="opacity-80 mt-2">
              {(query.error as any)?.response?.data?.message ||
                "Intenta actualizar o revisa tu historial de pedidos."}
            </p>
            <div className="flex items-center justify-center gap-3 pt-4">
              <Button onClick={() => query.refetch()}>Reintentar</Button>
              <Button variant="secondary" asChild>
                <Link to="/">Volver al catálogo</Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link to="/orders">Mis pedidos</Link>
              </Button>
            </div>
          </>
        )}

        {hasOrderId && query.data && !query.isError && !query.isLoading && (
          <>
            <div className="mt-2 flex items-center justify-center gap-2">
              <StatusChip status={query.data.status} />
              {createdAt && (
                <time
                  className="text-xs opacity-70"
                  dateTime={createdAt.toISOString()}
                >
                  {createdAt.toLocaleString("es-ES")}
                </time>
              )}
            </div>

            <p className="opacity-80 mt-2">
              {query.data.status === "PAID" ||
              query.data.status === "FULFILLED" ? (
                <>
                  Tu pedido <b>{query.data.id}</b> ha sido confirmado.
                </>
              ) : query.data.status === "CANCELLED" ? (
                <>
                  Tu pedido <b>{query.data.id}</b> fue cancelado.
                </>
              ) : (
                <>
                  Seguimos confirmando tu pedido <b>{query.data.id}</b>…
                </>
              )}
            </p>

            {/* Timeline minimal */}
            <Timeline status={query.data.status} />

            {/* Resumen básico */}
            <div className="mt-4 inline-flex flex-col items-center gap-1 text-sm opacity-80">
              <div>
                Total: <b>{money(query.data.total, query.data.currency)}</b>
              </div>
              <div>
                Estado: <b>{query.data.status}</b>
              </div>
            </div>

            {/* Ítems (si vienen) */}
            {!!query.data.items?.length && (
              <div className="mt-6 text-left mx-auto max-w-md">
                <h3 className="text-sm font-semibold mb-2">
                  Resumen del pedido
                </h3>
                <div className="space-y-1">
                  {query.data.items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="opacity-90 line-clamp-1">
                        {it.product?.name || "Producto"} × {it.quantity}
                      </div>
                      <div className="font-medium">
                        {money(
                          it.unitPrice * it.quantity,
                          query.data?.currency?.toUpperCase() || "USD"
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Acciones */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-5">
              {query.data.status === "PENDING" && (
                <Button onClick={() => query.refetch()}>
                  Actualizar estado
                </Button>
              )}
              <Button asChild>
                <Link to={`/orders/${query.data.id}`}>Ver pedido</Link>
              </Button>
              <Button variant="secondary" onClick={printReceipt}>
                Imprimir recibo
              </Button>
              <Button variant="ghost" onClick={shareOrder}>
                Compartir
              </Button>
              <Button variant="ghost" onClick={copyOrderId}>
                Copiar ID
              </Button>
              <Button variant="secondary" asChild>
                <Link to="/">Seguir comprando</Link>
              </Button>
            </div>

            {/* Ayudas contextuales */}
            <div className="mt-6 text-xs opacity-70">
              {query.data.status === "PENDING" && (
                <p>
                  Si el pago tarda en confirmarse, puede deberse a validaciones
                  del banco. Te avisaremos por correo.
                </p>
              )}
              {(query.data.status === "PAID" ||
                query.data.status === "FULFILLED") && (
                <p>
                  Recibirás actualizaciones por email. Si necesitas factura o
                  cambios, visita la página del pedido.
                </p>
              )}
              {query.data.status === "CANCELLED" && (
                <p>
                  El stock ha sido liberado. Puedes crear un nuevo pedido desde
                  el catálogo.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Container>
  );
}
