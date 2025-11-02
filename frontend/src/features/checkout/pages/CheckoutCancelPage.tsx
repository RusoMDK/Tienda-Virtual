import Container from "@/layout/Container";
import { Button } from "@/ui";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/ui";

type OrderStatus = "PENDING" | "PAID" | "CANCELLED" | "FULFILLED";
type Order = { id: string; status: OrderStatus };

function StatusChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs border border-[var(--border)] bg-[var(--surface-1)]">
      {children}
    </span>
  );
}

export default function CheckoutCancelPage() {
  const [sp] = useSearchParams();
  const orderId = sp.get("order")?.trim() || "";
  const hasOrderId = !!orderId;

  const [cancelMsg, setCancelMsg] = useState<string>("");
  const [autoTriggered, setAutoTriggered] = useState(false);
  const firedOnce = useRef(false);
  const pollCount = useRef(0);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const { toast } = useToast();

  // Cancelación (idempotente) como mutation para reintentar desde UI
  const cancelMutation = useMutation({
    mutationKey: ["payments/cancel", orderId],
    mutationFn: async () => {
      if (!hasOrderId) throw new Error("Falta orderId");
      const res = await api.post("/payments/cancel", { orderId });
      return res.data;
    },
    onSuccess: () => {
      setCancelMsg("Hemos solicitado cancelar la orden y restaurar el stock.");
      toast({ title: "Solicitud de cancelación enviada", variant: "success" });
    },
    onError: (e: any) => {
      const s = e?.response?.status;
      if (s === 401) setCancelMsg("Inicia sesión para gestionar tu pedido.");
      else if (s === 404) setCancelMsg("No encontramos la orden indicada.");
      else setCancelMsg("No se pudo cancelar la orden, puedes reintentar.");
      toast({
        title: "No se pudo cancelar",
        description: "Prueba nuevamente o revisa tu sesión.",
        variant: "error",
      });
    },
  });

  // Lanza la cancelación una sola vez al entrar desde Stripe con ?order=
  useEffect(() => {
    if (!hasOrderId || firedOnce.current) return;
    firedOnce.current = true;
    setAutoTriggered(true);
    cancelMutation.mutate();
  }, [hasOrderId]); // eslint-disable-line

  // Consulta estado actual (con polling suave tras cancelar)
  const orderQuery = useQuery({
    enabled: hasOrderId,
    queryKey: ["order", orderId],
    queryFn: async () => {
      const { data } = await api.get<Order>(`/orders/${orderId}`);
      return data;
    },
    // detiene reintentos automáticos en auth/not found
    retry: (fails, err: any) => {
      const st = err?.response?.status;
      if (st === 401 || st === 404) return false;
      return fails < 2;
    },
    // Polling inteligente: tras la auto-cancelación, refresca hasta estado final o 6 veces (~9s)
    refetchInterval: (q) => {
      const status = (q.state.data as Order | undefined)?.status;
      const isFinal =
        status === "CANCELLED" || status === "PAID" || status === "FULFILLED";
      if (!autoTriggered) return false;
      if (isFinal) return false;
      if (pollCount.current >= 6) return false;
      pollCount.current += 1;
      return 1500;
    },
  });

  // Foco en el título al cargar para accesibilidad
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // helpers
  const copyOrderId = useCallback(async () => {
    if (!hasOrderId) return;
    try {
      await navigator.clipboard.writeText(orderId);
      toast({ title: "ID de pedido copiado", variant: "success" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "error" });
    }
  }, [hasOrderId, orderId, toast]);

  const title = useMemo(() => {
    if (!hasOrderId) return "Pago cancelado";
    if (orderQuery.isLoading) return "Procesando cancelación…";
    if (orderQuery.isError) {
      const s = (orderQuery.error as any)?.response?.status;
      if (s === 401) return "Inicia sesión para continuar";
      if (s === 404) return "Pedido no encontrado";
      return "No pudimos verificar el estado";
    }
    const st = orderQuery.data?.status;
    if (st === "CANCELLED") return "Pago cancelado";
    if (st === "PAID" || st === "FULFILLED") return "El pago ya fue confirmado";
    return "Pago cancelado";
  }, [
    hasOrderId,
    orderQuery.isLoading,
    orderQuery.isError,
    orderQuery.data,
    orderQuery.error,
  ]);

  const body = useMemo(() => {
    if (!hasOrderId)
      return "Volviste desde Stripe sin un identificador de pedido.";
    if (orderQuery.isLoading) return cancelMsg || "Verificando estado…";
    if (orderQuery.isError) {
      return (
        (orderQuery as any)?.error?.response?.data?.message ||
        cancelMsg ||
        "No pudimos verificar el estado actual del pedido."
      );
    }
    const st = orderQuery.data?.status;
    if (st === "CANCELLED") {
      return `Tu pedido ${orderId} ha sido cancelado y el stock ha sido restaurado.`;
    }
    if (st === "PAID" || st === "FULFILLED") {
      return `Tu pedido ${orderId} ya estaba pagado, por lo que no se pudo cancelar.`;
    }
    return cancelMsg || "Hemos intentado cancelar la orden.";
  }, [
    hasOrderId,
    orderQuery.isLoading,
    orderQuery.isError,
    orderQuery.data,
    cancelMsg,
    orderId,
  ]);

  const statusChip = useMemo(() => {
    if (!hasOrderId) return null;
    if (orderQuery.isError) return <StatusChip>Error</StatusChip>;
    if (orderQuery.isLoading) return <StatusChip>Comprobando…</StatusChip>;
    const st = orderQuery.data?.status as OrderStatus | undefined;
    if (!st) return null;
    const label =
      st === "PENDING"
        ? "Pendiente"
        : st === "CANCELLED"
        ? "Cancelado"
        : st === "PAID"
        ? "Pagado"
        : "Completado";
    return <StatusChip>{label}</StatusChip>;
  }, [
    hasOrderId,
    orderQuery.isError,
    orderQuery.isLoading,
    orderQuery.data?.status,
  ]);

  return (
    <Container className="py-10">
      <div
        className="mx-auto max-w-2xl rounded-2xl bg-[var(--card)] border border-[var(--border)] p-6 text-center"
        role="status"
        aria-live="polite"
      >
        <h2 ref={titleRef} tabIndex={-1} className="text-2xl font-bold mb-1">
          {title}
        </h2>
        <div className="mb-4">{statusChip}</div>
        <p className="opacity-80">{body}</p>

        {/* Info del pedido */}
        {hasOrderId && (
          <div className="mt-4 inline-flex items-center gap-2 text-sm">
            <span className="opacity-70">Pedido:</span>
            <code className="rounded-md px-2 py-1 bg-[var(--surface-1)] border border-[var(--border)]">
              {orderId}
            </code>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyOrderId}
              aria-label="Copiar ID de pedido"
            >
              Copiar
            </Button>
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-6">
          {hasOrderId && (
            <>
              <Button asChild>
                <Link to={`/orders/${orderId}`}>Ver pedido</Link>
              </Button>
              <Button
                variant="secondary"
                onClick={() => orderQuery.refetch()}
                disabled={orderQuery.isFetching}
              >
                {orderQuery.isFetching ? "Actualizando…" : "Actualizar estado"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isLoading}
              >
                {cancelMutation.isLoading
                  ? "Cancelando…"
                  : "Reintentar cancelación"}
              </Button>
            </>
          )}
          <Button variant="secondary" asChild>
            <Link to="/">Volver al catálogo</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/cart">Ir al carrito</Link>
          </Button>
        </div>

        {/* Consejos dependientes del estado */}
        {hasOrderId && !orderQuery.isLoading && !orderQuery.isError && (
          <div className="mt-6 text-xs opacity-70">
            {orderQuery.data?.status === "PENDING" && (
              <p>
                Si el cargo aparece como pendiente en tu banco, normalmente se
                revierte automáticamente. Puedes reanudar el proceso desde tu
                carrito.
              </p>
            )}
            {(orderQuery.data?.status === "PAID" ||
              orderQuery.data?.status === "FULFILLED") && (
              <p>
                Si necesitas cambios, contáctanos con tu ID de pedido para
                gestionar una devolución.
              </p>
            )}
            {orderQuery.data?.status === "CANCELLED" && (
              <p>
                El stock ya está disponible nuevamente para que completes una
                nueva compra.
              </p>
            )}
          </div>
        )}
      </div>
    </Container>
  );
}
