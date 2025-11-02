// src/features/admin/pages/AdminUsersPage.tsx
import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Button, Input, Skeleton } from "@/ui";
import { useToast } from "@/ui";
import { adminListUsers, adminUpdateUserRole, type AdminUserDTO } from "../api";
import {
  Search,
  ArrowUpDown,
  CheckSquare,
  Square,
  Upload,
  Copy,
} from "lucide-react";

/* =========================
   Tipos de lista
========================= */
type ListResp = {
  items: AdminUserDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/* =========================
   Helpers
========================= */
function RoleBadge({ role }: { role: AdminUserDTO["role"] }) {
  const map: Record<string, string> = {
    ADMIN: "bg-emerald-500/15 border-emerald-500/40 text-emerald-500",
    SUPPORT: "bg-sky-500/15 border-sky-500/40 text-sky-500",
    CUSTOMER:
      "bg-[rgb(var(--muted-rgb))] border-[rgb(var(--border-rgb))] text-[rgb(var(--fg-rgb))]",
  };
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        map[role] ||
          "bg-[rgb(var(--card-2-rgb))] border-[rgb(var(--border-rgb))]",
      ].join(" ")}
    >
      {role}
    </span>
  );
}

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

const initials = (name?: string | null, email?: string | null) => {
  if (name && name.trim()) {
    const p = name.trim().split(/\s+/);
    return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase();
  }
  return (email?.[0] || "U").toUpperCase();
};

/* =========================
   Página
========================= */
export default function AdminUsersPage() {
  const [sp, setSp] = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();

  // Query params
  const page = Number(sp.get("page") || 1);
  const pageSize = Number(sp.get("pageSize") || 20);
  const qParam = sp.get("q") || "";
  const role =
    (sp.get("role") as "ALL" | "ADMIN" | "SUPPORT" | "CUSTOMER") || "ALL";

  // Ordenamiento (client-side)
  const sort = sp.get("sort") || "date"; // "date" | "orders" | "email"
  const dir = sp.get("dir") || "desc"; // "asc" | "desc"

  // Búsqueda con debounce
  const [qLocal, setQLocal] = useState(qParam);
  useEffect(() => setQLocal(qParam), [qParam]);
  const debounceRef = useRef<number | null>(null);
  const applyDebounced = (next: string) => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      const nxt = new URLSearchParams(sp);
      next ? nxt.set("q", next) : nxt.delete("q");
      nxt.set("page", "1");
      setSp(nxt, { replace: true });
    }, 300);
  };

  // Query
  const { data, isLoading, isError } = useQuery<ListResp>({
    queryKey: ["admin:users", { page, pageSize, q: qParam, role }],
    queryFn: () =>
      adminListUsers({
        page,
        pageSize,
        q: qParam || undefined,
        role,
      }),
    keepPreviousData: true,
    staleTime: 30_000,
  });

  // Selección múltiple
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => setSelected(new Set()), [page, pageSize, qParam, role]);

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleSelectAllVisible = () => {
    const items = data?.items || [];
    const allIds = items.map((u) => u.id);
    const allSelected =
      allIds.length > 0 && allIds.every((id) => selected.has(id));
    setSelected(new Set(allSelected ? [] : allIds));
  };

  // Mutación: cambiar rol (optimista) — ahora soporta SUPPORT
  const updateRoleMut = useMutation({
    mutationFn: ({
      id,
      role,
    }: {
      id: string;
      role: "ADMIN" | "SUPPORT" | "CUSTOMER";
    }) => adminUpdateUserRole(id, role),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["admin:users"] });
      const key = ["admin:users", { page, pageSize, q: qParam, role }];
      const prev = qc.getQueryData<ListResp>(key);
      if (prev) {
        const next: ListResp = {
          ...prev,
          items: prev.items.map((u) =>
            u.id === vars.id ? { ...u, role: vars.role } : u
          ),
        };
        qc.setQueryData(key, next);
      }
      return { prev, key };
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key!, ctx.prev);
      toast({ title: "No se pudo actualizar el rol", variant: "error" });
    },
    onSuccess: () => {
      toast({ title: "Rol actualizado", variant: "success" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["admin:users"] });
    },
  });

  // Acciones masivas — ahora con SUPPORT
  const [bulkBusy, setBulkBusy] = useState(false);
  async function bulkSetRole(nextRole: "ADMIN" | "SUPPORT" | "CUSTOMER") {
    if (!selected.size) return;
    setBulkBusy(true);
    try {
      const ids = Array.from(selected);
      for (const id of ids) {
        // eslint-disable-next-line no-await-in-loop
        await updateRoleMut.mutateAsync({ id, role: nextRole });
      }
      toast({ title: "Usuarios actualizados", variant: "success" });
      setSelected(new Set());
    } catch {
      toast({
        title: "Algunos usuarios no pudieron actualizarse",
        variant: "error",
      });
    } finally {
      setBulkBusy(false);
    }
  }

  // Ordenamiento client-side
  const sortedItems = useMemo(() => {
    const items = data?.items || [];
    const copy = [...items];
    copy.sort((a, b) => {
      const mult = dir === "asc" ? 1 : -1;
      if (sort === "orders") {
        const ao = (a as any)?._count?.orders ?? 0;
        const bo = (b as any)?._count?.orders ?? 0;
        return mult * (ao - bo);
      }
      if (sort === "email") {
        return mult * a.email.localeCompare(b.email);
      }
      // date
      return (
        mult *
        (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      );
    });
    return copy;
  }, [data?.items, sort, dir]);

  const setSort = (key: "date" | "orders" | "email") => {
    const nxt = new URLSearchParams(sp);
    const nextDir = key === sort ? (dir === "asc" ? "desc" : "asc") : "desc";
    nxt.set("sort", key);
    nxt.set("dir", nextDir);
    setSp(nxt, { replace: true });
  };

  // Export CSV (página visible)
  function exportCSV() {
    if (!sortedItems.length) return;
    const headers = [
      "id",
      "email",
      "name",
      "role",
      "createdAt",
      "createdAt_local",
      "orders_count",
    ];
    const rows = sortedItems.map((u) => [
      u.id,
      u.email,
      u.name || "",
      u.role,
      new Date(u.createdAt).toISOString(),
      fmtDate(u.createdAt),
      String((u as any)?._count?.orders ?? 0),
    ]);
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
    a.download = `users_page${data?.page || 1}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const totalPages = data?.totalPages ?? 1;

  const copy = async (t: string) => {
    try {
      await navigator.clipboard.writeText(t);
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
      {/* Filtros + acciones */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70"
            />
            <Input
              className="pl-8 md:w-[320px]"
              placeholder="Buscar por email o nombre…"
              value={qLocal}
              onChange={(e) => {
                setQLocal(e.target.value);
                applyDebounced(e.target.value);
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

          {/* Tabs por rol (incluye SUPPORT) */}
          <div className="flex items-center gap-1">
            {[
              { k: "ALL", label: "Todos" },
              { k: "CUSTOMER", label: "Customers" },
              { k: "SUPPORT", label: "Support" },
              { k: "ADMIN", label: "Admins" },
            ].map((t) => {
              const active = role === (t.k as any);
              return (
                <Button
                  key={t.k}
                  size="sm"
                  variant={active ? "primary" : "secondary"}
                  onClick={() => {
                    const nxt = new URLSearchParams(sp);
                    nxt.set("role", t.k);
                    nxt.set("page", "1");
                    setSp(nxt, { replace: true });
                  }}
                >
                  {t.label}
                </Button>
              );
            })}
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
              <span className="opacity-70">{selected.size} seleccionad@s</span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkSetRole("ADMIN")}
                disabled={bulkBusy}
                title="Hacer Admin"
              >
                Hacer Admin
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkSetRole("SUPPORT")}
                disabled={bulkBusy}
                title="Hacer Support"
              >
                Hacer Support
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => bulkSetRole("CUSTOMER")}
                disabled={bulkBusy}
                title="Hacer Customer"
              >
                Hacer Customer
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

      {/* Sumario */}
      <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-3 flex items-center justify-between text-sm">
        <div className="opacity-80">
          Página {data?.page || 1} de {totalPages} • {data?.total || 0} usuarios
          en total
        </div>
        <div className="flex items-center gap-4">
          <div className="opacity-70">En esta página:</div>
          <div className="font-medium">
            {(data?.items || []).length} usuarios
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
                  (data.items || []).every((u) => selected.has(u.id)) ? (
                    <CheckSquare size={16} />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
              <th className="text-left p-3">
                <button
                  className="inline-flex items-center gap-1 hover:underline underline-offset-4"
                  onClick={() => setSort("email")}
                  title="Ordenar por email"
                >
                  Email
                  <ArrowUpDown size={14} />
                </button>
              </th>
              <th className="text-left p-3">Nombre</th>
              <th className="text-left p-3">
                <button
                  className="inline-flex items-center gap-1 hover:underline underline-offset-4"
                  onClick={() => setSort("date")}
                  title="Ordenar por fecha de registro"
                >
                  Registrado
                  <ArrowUpDown size={14} />
                </button>
              </th>
              <th className="text-left p-3">
                <button
                  className="inline-flex items-center gap-1 hover:underline underline-offset-4"
                  onClick={() => setSort("orders")}
                  title="Ordenar por # de pedidos"
                >
                  Pedidos
                  <ArrowUpDown size={14} />
                </button>
              </th>
              <th className="text-left p-3">Rol</th>
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
                    <Skeleton className="h-4 w-48" />
                  </td>
                  <td className="p-3">
                    <Skeleton className="h-4 w-40" />
                  </td>
                  <td className="p-3">
                    <Skeleton className="h-4 w-36" />
                  </td>
                  <td className="p-3">
                    <Skeleton className="h-4 w-12" />
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
              (data?.items || []).map((u) => (
                <Fragment key={u.id}>
                  <tr className="border-t border-[rgb(var(--border-rgb))]/70 hover:bg-[rgb(var(--muted-rgb))]/60">
                    <td className="p-3 align-top">
                      <button
                        className="inline-flex items-center justify-center rounded hover:bg-[rgb(var(--muted-rgb))] p-1"
                        onClick={() => toggleSelect(u.id)}
                        title={
                          selected.has(u.id)
                            ? "Quitar selección"
                            : "Seleccionar"
                        }
                      >
                        {selected.has(u.id) ? (
                          <CheckSquare size={16} />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </td>

                    <td className="p-3 align-top">
                      <div className="flex items-center gap-2">
                        {/* Avatar */}
                        <div className="h-7 w-7 rounded-full bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))] flex items-center justify-center text-[11px] font-semibold">
                          {initials(u.name, u.email)}
                        </div>
                        <div className="leading-tight">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{u.email}</span>
                            <button
                              className="p-1 rounded hover:bg-[rgb(var(--muted-rgb))]"
                              onClick={() => copy(u.email)}
                              title="Copiar email"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                          <div className="text-[11px] opacity-60">
                            ID: {u.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 align-top">
                      {u.name || <span className="opacity-60">—</span>}
                    </td>

                    <td className="p-3 align-top">
                      <div className="leading-tight">
                        {fmtDate(u.createdAt)}
                      </div>
                      <div className="text-[11px] opacity-60">
                        {relTime(u.createdAt)}
                      </div>
                    </td>

                    <td className="p-3 align-top">
                      {(u as any)?._count?.orders ?? 0}
                    </td>

                    <td className="p-3 align-top">
                      <div className="flex items-center gap-2">
                        <RoleBadge role={u.role} />
                        <select
                          className="bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))] rounded-lg px-2 py-1 text-xs"
                          value={u.role}
                          onChange={(e) =>
                            updateRoleMut.mutate({
                              id: u.id,
                              role: e.target.value as
                                | "ADMIN"
                                | "SUPPORT"
                                | "CUSTOMER",
                            })
                          }
                          title="Cambiar rol"
                        >
                          <option value="CUSTOMER">CUSTOMER</option>
                          <option value="SUPPORT">SUPPORT</option>
                          <option value="ADMIN">ADMIN</option>
                        </select>
                      </div>
                    </td>

                    <td className="p-3 align-top text-right">
                      {/* Acciones rápidas (opcionales) */}
                      <div className="inline-flex gap-2">
                        {u.role !== "ADMIN" && (
                          <Button
                            size="sm"
                            onClick={() =>
                              updateRoleMut.mutate({ id: u.id, role: "ADMIN" })
                            }
                          >
                            Hacer Admin
                          </Button>
                        )}
                        {u.role !== "SUPPORT" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              updateRoleMut.mutate({
                                id: u.id,
                                role: "SUPPORT",
                              })
                            }
                          >
                            Hacer Support
                          </Button>
                        )}
                        {u.role !== "CUSTOMER" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              updateRoleMut.mutate({
                                id: u.id,
                                role: "CUSTOMER",
                              })
                            }
                          >
                            Hacer Customer
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                </Fragment>
              ))}

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
      {!!data && totalPages > 1 && (
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
