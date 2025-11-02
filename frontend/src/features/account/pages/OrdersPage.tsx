import { useQuery } from "@tanstack/react-query";
import { listMyOrders } from "@/features/orders/api/myOrders";
import { Card, CardHeader, CardContent, Badge, Button } from "@/ui";
import { Link } from "react-router-dom";

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(
    (cents || 0) / 100
  );
}
function statusBadge(s: string) {
  switch (s) {
    case "PAID":
      return <Badge>Pagado</Badge>;
    case "PENDING":
      return <Badge>Pendiente</Badge>;
    case "FULFILLED":
      return <Badge>Completado</Badge>;
    case "CANCELLED":
      return <Badge>Cancelado</Badge>;
    default:
      return <Badge>{s}</Badge>;
  }
}

export default function OrdersPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["myOrders"],
    queryFn: listMyOrders,
  });

  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold">Historial de pedidos</h2>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <div className="text-sm opacity-70">Cargando…</div>}
        {isError && (
          <div className="text-sm opacity-80">
            No pudimos cargar tus pedidos.{" "}
            <Button size="sm" variant="ghost" onClick={() => refetch()}>
              Reintentar
            </Button>
          </div>
        )}
        {data?.length ? (
          data.map((o) => (
            <div
              key={o.id}
              className="rounded-xl border border-[var(--border)] p-3 bg-[var(--card)] flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-medium">Pedido #{o.id}</div>
                <div className="text-xs opacity-70">
                  {new Date(o.createdAt).toLocaleString()}
                </div>
                <div className="text-sm mt-1">
                  Total: <b>{money(o.total, o.currency)}</b>
                </div>
                <div className="mt-1">{statusBadge(o.status)}</div>
              </div>
              <div className="shrink-0">
                <Button asChild>
                  <Link to={`/account/orders/${o.id}`}>Ver detalles</Link>
                </Button>
              </div>
            </div>
          ))
        ) : !isLoading && !isError ? (
          <div className="text-sm opacity-70">Aún no tienes pedidos.</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
