import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  adminSummary,
  adminListOrders,
  adminListProducts,
} from "@/features/admin/api";
import { Button, Skeleton, Badge, Card, CardHeader, CardContent } from "@/ui";
import {
  Package,
  ShoppingCart,
  Users,
  Banknote,
  ArrowUpRight,
  AlertTriangle,
} from "lucide-react";

// Recharts
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

/* ───────────────── helpers dinero/fecha ───────────────── */
const fmtUSD = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "USD",
});
const centsToStr = (cents: number) => fmtUSD.format(Math.max(0, cents) / 100);

function formatDay(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}
function daysBack(n: number) {
  const out: Date[] = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push(d);
  }
  return out;
}

/* ───────────────── mini componentes ───────────────── */
function StatTile({
  label,
  value,
  icon,
  footer,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <span className="text-xs opacity-70">{label}</span>
          <span className="opacity-70">{icon}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        {footer ? (
          <div className="text-xs opacity-70 mt-2">{footer}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SectionCard({
  title,
  hint,
  action,
  children,
  className = "",
}: {
  title: string;
  hint?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-medium">{title}</div>
            {hint ? <div className="text-xs opacity-60">{hint}</div> : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/* ───────────────── página ───────────────── */
export default function AdminDashboardPage() {
  // Summary
  const { data: summary, isLoading: sumLoading } = useQuery({
    queryKey: ["admin:summary"],
    queryFn: adminSummary,
    staleTime: 60_000,
  });

  // Últimas órdenes (para tabla y serie)
  const { data: ordersResp, isLoading: ordersLoading } = useQuery({
    queryKey: ["admin:orders", { page: 1, pageSize: 100 }],
    queryFn: () =>
      adminListOrders({
        page: 1,
        pageSize: 100,
      }),
    staleTime: 30_000,
  });

  // Productos con poco stock
  const { data: lowStockResp, isLoading: lowLoading } = useQuery({
    queryKey: [
      "admin:products",
      { page: 1, pageSize: 8, sort: "stock:asc", status: "active" },
    ],
    queryFn: () =>
      adminListProducts({
        page: 1,
        pageSize: 8,
        sort: "stock:asc",
        status: "active",
      }),
    staleTime: 30_000,
  });

  // Serie de ingresos últimos 14 días
  const revenueSeries = useMemo(() => {
    const days = daysBack(14);
    const buckets = days.map((d) => ({
      key: d.getTime(),
      label: formatDay(d),
      total: 0,
    }));

    const items = ordersResp?.items ?? [];
    for (const o of items) {
      const d = new Date(o.createdAt);
      d.setHours(0, 0, 0, 0);
      const key = d.getTime();
      const bucket = buckets.find((b) => b.key === key);
      if (bucket && (o.status === "PAID" || o.status === "FULFILLED")) {
        bucket.total += o.total || 0;
      }
    }
    return buckets.map((b) => ({
      name: b.label,
      value: Math.round(b.total / 100),
    }));
  }, [ordersResp]);

  // KPIs
  const revenueTotal = useMemo(() => {
    const sum = (ordersResp?.items ?? [])
      .filter((o) => o.status === "PAID" || o.status === "FULFILLED")
      .reduce((acc, o) => acc + (o.total || 0), 0);
    return centsToStr(sum);
  }, [ordersResp]);

  const lowStock = useMemo(() => {
    const list = lowStockResp?.items ?? [];
    return list.filter((p) => p.stock <= 3).slice(0, 8);
  }, [lowStockResp]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {sumLoading ? (
          <>
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </>
        ) : (
          <>
            <StatTile
              label="Productos"
              value={summary?.products ?? 0}
              icon={<Package size={18} />}
              footer={
                <Link
                  to="/admin/products"
                  className="underline underline-offset-2"
                >
                  Gestionar
                </Link>
              }
            />
            <StatTile
              label="Órdenes"
              value={summary?.orders ?? 0}
              icon={<ShoppingCart size={18} />}
              footer={
                <span className="opacity-70">
                  Pendientes: <b>{summary?.pending ?? 0}</b>
                </span>
              }
            />
            <StatTile
              label="Usuarios"
              value={summary?.users ?? 0}
              icon={<Users size={18} />}
            />
            <StatTile
              label="Ingresos (total listado)"
              value={revenueTotal}
              icon={<Banknote size={18} />}
              footer={<span className="opacity-70">PAID / FULFILLED</span>}
            />
          </>
        )}
      </div>

      {/* Grid 2 col: chart + low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8">
          <SectionCard
            title="Ingresos – últimos 14 días"
            hint="Suma diaria de órdenes en estado PAID o FULFILLED"
          >
            <div className="h-64">
              {ordersLoading ? (
                <Skeleton className="h-full w-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueSeries}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) =>
                        v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v}`
                      }
                      width={45}
                    />
                    <Tooltip
                      formatter={(value: any) => [
                        `${fmtUSD.format(value)}`,
                        "Ingresos",
                      ]}
                      labelClassName="text-xs"
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-4">
          <SectionCard
            title="Stock bajo"
            action={
              <Link to="/admin/products">
                <Button size="sm" variant="secondary">
                  Ver todo <ArrowUpRight size={14} className="ml-1" />
                </Button>
              </Link>
            }
          >
            {lowLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : lowStock.length ? (
              <div className="space-y-2">
                {lowStock.map((p) => {
                  const critical = p.stock === 0;
                  const warn = !critical && p.stock <= 3;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-tight line-clamp-1">
                          {p.name}
                        </div>
                        <div className="text-xs opacity-60 line-clamp-1">
                          {p.slug}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {critical ? (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle size={12} className="mr-1" />
                            Sin stock
                          </Badge>
                        ) : warn ? (
                          <Badge variant="secondary" className="text-xs">
                            Bajo: {p.stock}
                          </Badge>
                        ) : null}

                        <Link to={`/admin/products?adjust=${p.id}`}>
                          <Button size="sm">Ajustar</Button>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm opacity-70">Todo OK por aquí ✨</div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Últimas órdenes */}
      <SectionCard
        title="Últimas órdenes"
        hint={
          <span className="text-xs opacity-60">
            Mostrando {Math.min(ordersResp?.items.length || 0, 10)} de{" "}
            {ordersResp?.items.length || 0}
          </span>
        }
      >
        {ordersLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--surface-1)]">
                <tr>
                  <th className="text-left p-3">Fecha</th>
                  <th className="text-left p-3">Cliente</th>
                  <th className="text-left p-3">Estado</th>
                  <th className="text-right p-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {(ordersResp?.items ?? []).slice(0, 10).map((o) => (
                  <tr
                    key={o.id}
                    className="border-t border-[var(--border)] hover:bg-[var(--surface-1)]/60"
                  >
                    <td className="p-3">
                      {new Date(o.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">{o.user?.email || "—"}</td>
                    <td className="p-3">
                      <Badge
                        variant={
                          o.status === "PAID" || o.status === "FULFILLED"
                            ? "success"
                            : o.status === "PENDING"
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-xs"
                      >
                        {o.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right">{centsToStr(o.total)}</td>
                  </tr>
                ))}
                {!(ordersResp?.items?.length ?? 0) && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center opacity-70">
                      Sin órdenes recientes
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
