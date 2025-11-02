import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getMyOrder } from "@/features/orders/api/myOrders";
import { Card, CardHeader, CardContent, Button, Badge } from "@/ui";

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(
    (cents || 0) / 100
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const query = useQuery({
    enabled: !!id,
    queryKey: ["myOrder", id],
    queryFn: () => getMyOrder(id!),
    refetchInterval: (data) =>
      data && data.status === "PENDING" ? 2000 : false,
  });

  if (query.isLoading) {
    return <div className="opacity-70">Cargando pedido…</div>;
  }
  if (query.isError || !query.data) {
    return (
      <div className="rounded-2xl border border-red-900/40 bg-red-900/10 p-4">
        <div className="text-sm">No pudimos cargar el pedido.</div>
        <div className="mt-2">
          <Button size="sm" onClick={() => query.refetch()}>
            Reintentar
          </Button>
          <Button size="sm" variant="ghost" asChild className="ml-2">
            <Link to="/account/orders">Volver a pedidos</Link>
          </Button>
        </div>
      </div>
    );
  }

  const o = query.data;
  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 space-y-3">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Pedido #{o.id}</h2>
              <Badge>{o.status}</Badge>
            </div>
            <div className="text-xs opacity-70">
              {new Date(o.createdAt).toLocaleString()}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {o.items.map((it) => (
              <div
                key={it.productId}
                className="flex items-center justify-between text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium line-clamp-1">{it.name}</div>
                  <div className="opacity-70">x{it.quantity}</div>
                </div>
                <div className="font-medium">
                  {money(it.unitPrice * it.quantity, o.currency)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <Card>
          <CardHeader>
            <h3 className="font-semibold">Resumen</h3>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Total</span>
              <b>{money(o.total, o.currency)}</b>
            </div>
            <Button asChild className="w-full mt-2">
              <Link to="/account/orders">Volver al historial</Link>
            </Button>
          </CardContent>
        </Card>

        {o.shippingAddress && (
          <Card>
            <CardHeader>
              <h3 className="font-semibold">Envío</h3>
            </CardHeader>
            <CardContent className="text-sm opacity-80">
              <div>{o.shippingAddress.recipientName}</div>
              <div>
                {o.shippingAddress.addressLine1}
                {o.shippingAddress.addressLine2
                  ? `, ${o.shippingAddress.addressLine2}`
                  : ""}
              </div>
              <div>
                {o.shippingAddress.city}
                {o.shippingAddress.state
                  ? `, ${o.shippingAddress.state}`
                  : ""}{" "}
                {o.shippingAddress.postalCode}
              </div>
              <div>{o.shippingAddress.country}</div>
              {o.shippingAddress.phone && (
                <div className="mt-1">Tel: {o.shippingAddress.phone}</div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
