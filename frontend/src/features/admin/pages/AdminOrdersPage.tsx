// src/features/admin/pages/AdminOrdersPage.tsx
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { Button, Input, Skeleton } from "@/ui";
import { useToast } from "@/ui";
import { adminListOrders, adminUpdateOrderStatus } from "../api";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Upload,
  ArrowUpDown,
  CheckSquare,
  Square,
  CheckCircle2,
  XCircle,
  PackageCheck,
  Copy,
} from "lucide-react";

/* =========================
   Tipos (igual a tu API)
========================= */
type OrderItem = {
  quantity: number;
  unitPrice: number;
  product: { name: string; slug: string };
};
type OrderRow = {
  id: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "FULFILLED" | string;
  total: number; // centavos
  currency: string; // "usd", "eur"...
  createdAt: string;
  user: { email: string };
  items: OrderItem[];
};
type ListResp = {
  items: OrderRow[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/* =========================
   Helpers
========================= */
const normCurrency = (c: string) => (c || "USD").toUpperCase();
const fmtMoney = (amountCents: number, currency: string) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: normCurrency(currency),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.max(0, amountCents) / 100);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function relTime(iso: string) {
  try {
    const rtf = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
    const from = new Date(iso).getTime();
    const diff = Date.now() - from;
    const mins = Math.round(diff / 60000);
    if (Math.abs(mins) < 60) return rtf.format(-mins, "minute");
    const hours = Math.round(mins / 60);
    if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
    const days = Math.round(hours / 24);
    return rtf.format(-days, "day");
  } catch {
    return "";
  }
}

function StatusBadge({ s }: { s: OrderRow["status"] }) {
  const map: Record<string, string> = {
    PENDING:
      "bg-[rgb(var(--muted-rgb))] border-[rgb(var(--border-rgb))] text-[rgb(var(--fg-rgb))]",
    PAID: "bg-[rgb(16_185_129/0.15)] border-[rgb(var(--primary-rgb))] text-[rgb(var(--primary-rgb))]",
    FULFILLED:
      "bg-[rgb(34_211_238/0.15)] border-[rgb(var(--accent-rgb))] text-[rgb(var(--accent-rgb))]",
    CANCELLED:
      "bg-[rgb(248_113_113/0.15)] border-[rgb(var(--danger-rgb))] text-[rgb(var(--danger-rgb))]",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        map[s] || "bg-[rgb(var(--card-2-rgb))] border-[rgb(var(--border-rgb))]",
      ].join(" ")}
    >
      {s}
    </span>
  );
}

/* =========================
   Página
========================= */
export default function AdminOrdersPage() {
  const [sp, setSp] = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();

  // Query params
  const page = Number(sp.get("page") || 1);
  const pageSize = Number(sp.get("pageSize") || 20);
  const qParam = sp.get("q") || "";
  const status = (sp.get("status") as OrderRow["status"]) || "ALL";

  // ordenamiento (client-side si el backend no lo hace)
  const sort = sp.get("sort") || "date"; // "date" | "total"
  const dir = sp.get("dir") || "desc"; // "asc" | "desc"

  // Búsqueda con debounce
  const [qLocal, setQLocal] = useState(qParam);
  useEffect(() => setQLocal(qParam), [qParam]);
  const debounceRef = useRef<number | null>(null);
  function applySearchDebounced(next: string) {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const nxt = new URLSearchParams(sp);
      next ? nxt.set("q", next) : nxt.delete("q");
      nxt.set("page", "1");
      setSp(nxt, { replace: true });
    }, 350);
  }

  // Fecha (opcional)
  const from = sp.get("from") || "";
  const to = sp.get("to") || "";

  // Query
  const { data, isLoading, isError } = useQuery<ListResp>({
    queryKey: ["admin:orders", { page, pageSize, q: qParam, status, from, to }],
    queryFn: () =>
      adminListOrders({
        page,
        pageSize,
        q: qParam || undefined,
        status: status === "ALL" ? undefined : status,
        // si el backend ignora estos, no rompe
        from: from || undefined,
        to: to || undefined,
      } as any),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  // Selección múltiple
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    // al cambiar página/filtros, limpia selección
    setSelected(new Set());
  }, [page, pageSize, qParam, status]);

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleSelectAllVisible = () => {
    if (!data?.items?.length) return;
    const allIds = data.items.map((o) => o.id);
    const allSelected = allIds.every((id) => selected.has(id));
    setSelected(new Set(allSelected ? [] : allIds));
  };

  // Fila expandida (detalles)
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggleRow = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  // Mutaciones estado (optimista)
  const updateStatusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderRow["status"] }) =>
      adminUpdateOrderStatus(id, status),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["admin:orders"] });
      const prev = qc.getQueryData<ListResp>([
        "admin:orders",
        { page, pageSize, q: qParam, status, from, to },
      ]);
      if (prev) {
        const next: ListResp = {
          ...prev,
          items: prev.items.map((o) =>
            o.id === vars.id ? { ...o, status: vars.status } : o
          ),
        };
        qc.setQueryData(
          ["admin:orders", { page, pageSize, q: qParam, status, from, to }],
          next
        );
      }
      return { prev };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev)
        qc.setQueryData(
          ["admin:orders", { page, pageSize, q: qParam, status, from, to }],
          ctx.prev
        );
      toast({ title: "No se pudo actualizar el estado", variant: "error" });
    },
    onSuccess: () => {
      toast({ title: "Estado actualizado", variant: "success" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin:orders"] });
    },
  });

  // Acciones masivas
  const [bulkBusy, setBulkBusy] = useState(false);
  async function bulkUpdate(nextStatus: OrderRow["status"]) {
    if (!selected.size) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      // secuencial para no saturar
      for (const id of ids) {
        // eslint-disable-next-line no-await-in-loop
        await updateStatusMut.mutateAsync({ id, status: nextStatus });
      }
      toast({ title: "Órdenes actualizadas", variant: "success" });
      setSelected(new Set());
    } catch {
      toast({
        title: "Algunas órdenes no se pudieron actualizar",
        variant: "error",
      });
    } finally {
      setBulkBusy(false);
    }
  }

  // Export CSV (página actual, visible)
  function exportCSV() {
    if (!data?.items?.length) return;
    const headers = [
      "id",
      "createdAt",
      "createdAt_local",
      "email",
      "status",
      "currency",
      "total_cents",
      "items_count",
      "items_preview",
    ];
    const rows = sortedItems.map((o) => {
      const preview = o.items
        .slice(0, 3)
        .map((it) => `${it.quantity}x ${it.product.name}`)
        .join(" | ");
      return [
        o.id,
        new Date(o.createdAt).toISOString(),
        fmtDate(o.createdAt),
        o.user?.email || "",
        o.status,
        normCurrency(o.currency),
        String(o.total),
        String(o.items.length),
        preview,
      ];
    });
    const csv =
      headers.join(",") +
      "\n" +
      rows
        .map((r) =>
          r
            .map((c) => (/,|\n|"/.test(c) ? `"${c.replace(/"/g, '""')}"` : c))
            .join(",")
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_page${data.page}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Sort client-side si hace falta
  const sortedItems = useMemo(() => {
    const items = data?.items || [];
    const copy = [...items];
    copy.sort((a, b) => {
      const m = dir === "asc" ? 1 : -1;
      if (sort === "total") return m * (a.total - b.total);
      // date
      return (
        m * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      );
    });
    return copy;
  }, [data?.items, sort, dir]);

  const pageSum = useMemo(
    () =>
      sortedItems.reduce(
        (acc, o) => {
          acc.count += 1;
          acc.total += o.total;
          return acc;
        },
        { count: 0, total: 0 }
      ),
    [sortedItems]
  );

  const setSort = (key: "date" | "total") => {
    const nxt = new URLSearchParams(sp);
    const nextDir = key === sort ? (dir === "asc" ? "desc" : "asc") : dir;
    nxt.set("sort", key);
    nxt.set("dir", key === sort ? nextDir : "desc");
    setSp(nxt, { replace: true });
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copiado" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "error" });
    }
  };

  /* =========================
     UI
  ========================= */
  return (
    <div className="space-y-5">
      {/* Fila superior: filtros + acciones */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70"
            />
            <Input
              className="pl-8 md:w-[320px]"
              placeholder="Buscar por email o ID…"
              value={qLocal}
              onChange={(e) => {
                setQLocal(e.target.value);
                applySearchDebounced(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const nxt = new URLSearchParams(sp);
                  qLocal ? nxt.set("q", qLocal) : nxt.delete("q");
                  nxt.set("page", "1");
                  setSp(nxt, { replace: true });
                }
              }}
            />
          </div>

          {/* Tabs de estado */}
          <div className="flex items-center gap-1">
            {[
              { k: "ALL", label: "Todos" },
              { k: "PENDING", label: "Pendientes" },
              { k: "PAID", label: "Pagadas" },
              { k: "FULFILLED", label: "Entregadas" },
              { k: "CANCELLED", label: "Canceladas" },
            ].map((t) => {
              const active = status === (t.k as any);
              return (
                <Button
                  key={t.k}
                  size="sm"
                  variant={active ? "primary" : "secondary"}
                  onClick={() => {
                    const nxt = new URLSearchParams(sp);
                    nxt.set("status", t.k);
                    nxt.set("page", "1");
                    setSp(nxt, { replace: true });
                  }}
                >
                  {t.label}
                </Button>
              );
            })}
          </div>

          {/* Rango de fechas */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))] rounded-xl px-3 py-2 text-sm"
              value={from}
              onChange={(e) => {
                const nxt = new URLSearchParams(sp);
                e.target.value
                  ? nxt.set("from", e.target.value)
                  : nxt.delete("from");
                nxt.set("page", "1");
                setSp(nxt, { replace: true });
              }}
              title="Desde"
            />
            <span className="opacity-60 text-sm">—</span>
            <input
              type="date"
              className="bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))] rounded-xl px-3 py-2 text-sm"
              value={to}
              onChange={(e) => {
                const nxt = new URLSearchParams(sp);
                e.target.value
                  ? nxt.set("to", e.target.value)
                  : nxt.delete("to");
                nxt.set("page", "1");
                setSp(nxt, { replace: true });
              }}
              title="Hasta"
            />
          </div>

          {/* PageSize */}
          <select
            className="bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))] rounded-xl px-3 py-2 text-sm"
            value={String(pageSize)}
            onChange={(e) => {
              const nxt = new URLSearchParams(sp);
              nxt.set("pageSize", e.target.value);
              nxt.set("page", "1");
              setSp(nxt, { replace: true });
            }}
            title="Tamaño de página"
          >
            {[20, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} / página
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {!!selected.size && (
            <div className="flex items-center gap-2 mr-2 text-sm">
              <span className="opacity-70">
                {selected.size} seleccionada(s)
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkUpdate("PAID")}
                disabled={bulkBusy}
                title="Marcar como pagadas"
              >
                <CheckCircle2 size={16} className="mr-1" />
                Pagadas
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkUpdate("FULFILLED")}
                disabled={bulkBusy}
                title="Marcar como entregadas"
              >
                <PackageCheck size={16} className="mr-1" />
                Entregadas
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => bulkUpdate("CANCELLED")}
                disabled={bulkBusy}
                title="Cancelar seleccionadas"
              >
                <XCircle size={16} className="mr-1" />
                Cancelar
              </Button>
            </div>
          )}

          <Button
            variant="secondary"
            onClick={exportCSV}
            title="Exportar CSV (esta página)"
          >
            <Upload size={16} className="mr-1" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Sumario de página */}
      <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-3 flex items-center justify-between text-sm">
        <div className="opacity-80">
          Página {data?.page || 1} de {data?.totalPages || 1} •{" "}
          {data?.total || 0} órdenes en total
        </div>
        <div className="flex items-center gap-4">
          <div className="opacity-70">En esta página:</div>
          <div className="font-medium">
            {pageSum.count} orden(es) ·{" "}
            {sortedItems[0]?.currency
              ? fmtMoney(pageSum.total, sortedItems[0].currency)
              : `${(pageSum.total / 100).toFixed(2)}`}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-2xl border border-[rgb(var(--border-rgb))]">
        <table className="min-w-full text-sm">
          <thead className="bg-[rgb(var(--card-2-rgb))] sticky top-0 z-10">
            <tr>
              <th className="p-3 w-10">
                <button
                  className="inline-flex items-center justify-center rounded hover:bg-[rgb(var(--muted-rgb))] p-1"
                  onClick={toggleSelectAllVisible}
                  title="Seleccionar todo (visible)"
                >
                  {data?.items?.length &&
                  data.items.every((o) => selected.has(o.id)) ? (
                    <CheckSquare size={16} />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
              <th className="text-left p-3">Orden</th>
              <th className="text-left p-3">
                <button
                  className="inline-flex items-center gap-1 hover:underline underline-offset-4"
                  onClick={() => setSort("date")}
                  title="Ordenar por fecha"
                >
                  Fecha
                  <ArrowUpDown size={14} />
                </button>
              </th>
              <th className="text-left p-3">Cliente</th>
              <th className="text-left p-3">
                <button
                  className="inline-flex items-center gap-1 hover:underline underline-offset-4"
                  onClick={() => setSort("total")}
                  title="Ordenar por total"
                >
                  Total
                  <ArrowUpDown size={14} />
                </button>
              </th>
              <th className="text-left p-3">Estado</th>
              <th className="text-right p-3">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {isLoading &&
              Array.from({ length: 10 }).map((_, i) => (
                <tr
                  key={i}
                  className="border-t border-[rgb(var(--border-rgb))]/70"
                >
                  <td className="p-3">
                    <Skeleton className="h-4 w-4" />
                  </td>
                  <td className="p-3">
                    <Skeleton className="h-4 w-40" />
                  </td>
                  <td className="p-3">
                    <Skeleton className="h-4 w-36" />
                  </td>
                  <td className="p-3">
                    <Skeleton className="h-4 w-44" />
                  </td>
                  <td className="p-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="p-3">
                    <Skeleton className="h-6 w-20" />
                  </td>
                  <td className="p-3 text-right">
                    <Skeleton className="h-8 w-40 ml-auto" />
                  </td>
                </tr>
              ))}

            {!isLoading && isError && (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-[rgb(var(--danger-rgb))]"
                >
                  No se pudo cargar la lista. Intenta más tarde.
                </td>
              </tr>
            )}

            {!isLoading &&
              sortedItems.map((o) => {
                const opened = open.has(o.id);
                const allQty = o.items.reduce((a, b) => a + b.quantity, 0);
                return (
                  <Fragment key={o.id}>
                    <tr className="border-t border-[rgb(var(--border-rgb))]/70 hover:bg-[rgb(var(--muted-rgb))]/60">
                      <td className="p-3 align-top">
                        <button
                          className="mr-2 inline-flex items-center justify-center rounded hover:bg-[rgb(var(--muted-rgb))] p-1"
                          onClick={() => toggleSelect(o.id)}
                          title={
                            selected.has(o.id)
                              ? "Quitar selección"
                              : "Seleccionar"
                          }
                        >
                          {selected.has(o.id) ? (
                            <CheckSquare size={16} />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                        <button
                          aria-label={opened ? "Contraer" : "Expandir"}
                          className="p-1 rounded hover:bg-[rgb(var(--muted-rgb))]"
                          onClick={() => toggleRow(o.id)}
                        >
                          {opened ? (
                            <ChevronUp size={16} />
                          ) : (
                            <ChevronDown size={16} />
                          )}
                        </button>
                      </td>

                      <td className="p-3 align-top font-medium">
                        <div className="inline-flex items-center gap-2">
                          <span className="truncate">{o.id}</span>
                          <button
                            className="p-1 rounded hover:bg-[rgb(var(--muted-rgb))]"
                            onClick={() => copyToClipboard(o.id)}
                            title="Copiar ID"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                        <div className="text-[11px] opacity-60">
                          {allQty} ítem(s)
                        </div>
                      </td>

                      <td className="p-3 align-top">
                        <div className="leading-tight">
                          {fmtDate(o.createdAt)}
                        </div>
                        <div className="text-[11px] opacity-60">
                          {relTime(o.createdAt)}
                        </div>
                      </td>

                      <td className="p-3 align-top">
                        <div className="leading-tight">
                          {o.user?.email || "—"}
                        </div>
                      </td>

                      <td className="p-3 align-top">
                        <div className="font-semibold">
                          {fmtMoney(o.total, o.currency)}
                        </div>
                        <div className="text-[11px] opacity-60">
                          {normCurrency(o.currency)}
                        </div>
                      </td>

                      <td className="p-3 align-top">
                        <div className="flex items-center gap-2">
                          <StatusBadge s={o.status} />
                          <select
                            aria-label="Cambiar estado"
                            className="bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))] rounded-lg px-2 py-1 text-xs"
                            value={o.status}
                            onChange={(e) =>
                              updateStatusMut.mutate({
                                id: o.id,
                                status: e.target.value as OrderRow["status"],
                              })
                            }
                          >
                            <option value="PENDING">PENDING</option>
                            <option value="PAID">PAID</option>
                            <option value="FULFILLED">FULFILLED</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        </div>
                      </td>

                      <td className="p-3 align-top text-right">
                        <div className="inline-flex gap-2">
                          {o.status !== "PAID" && o.status !== "CANCELLED" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() =>
                                updateStatusMut.mutate({
                                  id: o.id,
                                  status: "PAID",
                                })
                              }
                            >
                              <CheckCircle2 size={16} className="mr-1" />
                              Pagada
                            </Button>
                          )}
                          {o.status === "PAID" && (
                            <Button
                              size="sm"
                              onClick={() =>
                                updateStatusMut.mutate({
                                  id: o.id,
                                  status: "FULFILLED",
                                })
                              }
                            >
                              <PackageCheck size={16} className="mr-1" />
                              Entregada
                            </Button>
                          )}
                          {o.status !== "CANCELLED" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                updateStatusMut.mutate({
                                  id: o.id,
                                  status: "CANCELLED",
                                })
                              }
                            >
                              <XCircle size={16} className="mr-1" />
                              Cancelar
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {opened && (
                      <tr className="border-t border-[rgb(var(--border-rgb))]/70 bg-[rgb(var(--card-2-rgb))]">
                        <td className="p-3" />
                        <td colSpan={6} className="p-3">
                          <div className="grid gap-3 md:grid-cols-2">
                            {/* Items */}
                            <div className="rounded-xl border border-[rgb(var(--border-rgb))] p-3 bg-[rgb(var(--card-rgb))]">
                              <div className="text-xs opacity-70 mb-2">
                                Ítems
                              </div>
                              <div className="space-y-2">
                                {o.items.map((it, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <div className="truncate">
                                      <Link
                                        to={`/product/${it.product.slug}`}
                                        target="_blank"
                                        className="underline-offset-2 hover:underline"
                                      >
                                        {it.product.name}
                                      </Link>
                                      <span className="opacity-60 ml-2">
                                        ×{it.quantity}
                                      </span>
                                    </div>
                                    <div className="opacity-80">
                                      {fmtMoney(
                                        it.unitPrice * it.quantity,
                                        o.currency
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Totales */}
                            <div className="rounded-xl border border-[rgb(var(--border-rgb))] p-3 bg-[rgb(var(--card-rgb))]">
                              <div className="text-xs opacity-70 mb-2">
                                Totales
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span>Subtotal</span>
                                <span className="opacity-80">
                                  {fmtMoney(
                                    o.items.reduce(
                                      (acc, it) =>
                                        acc + it.unitPrice * it.quantity,
                                      0
                                    ),
                                    o.currency
                                  )}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span>Envío</span>
                                <span className="opacity-60">
                                  Incluido / n/a
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm font-semibold mt-2">
                                <span>Total</span>
                                <span>{fmtMoney(o.total, o.currency)}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}

            {!isLoading && !!data && data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center opacity-70">
                  Sin resultados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {!!data && data.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="secondary"
            disabled={data.page <= 1}
            onClick={() => {
              const nxt = new URLSearchParams(sp);
              nxt.set("page", String(data.page - 1));
              setSp(nxt, { replace: true });
            }}
          >
            Anterior
          </Button>
          <div className="self-center text-sm opacity-70">
            {data.page} / {data.totalPages}
          </div>
          <Button
            variant="secondary"
            disabled={data.page >= data.totalPages}
            onClick={() => {
              const nxt = new URLSearchParams(sp);
              nxt.set("page", String(data.page + 1));
              setSp(nxt, { replace: true });
            }}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
