// src/features/support/components/SupportInbox.tsx
import { useMemo, useState, useEffect, useCallback } from "react";
import { ConvStatus, ConvPriority, type Conversation } from "../types";
import { useSupportList } from "../hooks/hooks";
import { Button, Input, Skeleton, useToast } from "@/ui";
import {
  Search,
  Inbox,
  UserRound,
  Users,
  Hash,
  Clock,
  Flag,
  AlertTriangle,
  CheckSquare,
  Square,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignConversation, setConversationStatus, getMe } from "../api";

type Props = { selectedId?: string | null; onSelect: (id: string) => void };
type SlaFilter = "" | "breached" | "atRisk" | "ok";
type SortKey = "" | "lastMessageDesc" | "timeToBreachAsc";

const AT_RISK_MIN = 15;

export default function SupportInbox({ selectedId, onSelect }: Props) {
  const qc = useQueryClient();
  const toast = useToast();

  // pestañas / filtros
  const [tab, setTab] = useState<"unassigned" | "mine" | "all">("unassigned");
  const [status, setStatus] = useState<ConvStatus | "">("");
  const [priority, setPriority] = useState<ConvPriority | "">("");
  const [sla, setSla] = useState<SlaFilter>("");
  const [sort, setSort] = useState<SortKey>("lastMessageDesc");
  const [tag, setTag] = useState<string>("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  // debounce búsqueda
  const [qEff, setQEff] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQEff(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // data
  const { data, isLoading, isError, refetch, isRefetching } = useSupportList({
    box: tab,
    status: status || undefined,
    priority: priority || undefined,
    sla: sla || undefined,
    sort: sort || undefined,
    tag: tag.trim() || undefined,
    q: qEff || undefined,
    p: page,
    ps: 20,
  });

  // reset página al cambiar filtros
  useEffect(() => setPage(1), [tab, status, priority, sla, sort, tag, qEff]);

  // selección múltiple
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => setSelected([]), [data?.page, data?.items?.length]);

  const allIdsOnPage = useMemo(
    () => (data?.items || []).map((c) => c.id),
    [data?.items]
  );
  const allSelectedOnPage = useMemo(
    () =>
      allIdsOnPage.length > 0 &&
      allIdsOnPage.every((id) => selected.includes(id)),
    [allIdsOnPage, selected]
  );
  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (allSelectedOnPage)
        return prev.filter((id) => !allIdsOnPage.includes(id));
      const toAdd = allIdsOnPage.filter((id) => !prev.includes(id));
      return [...prev, ...toAdd];
    });
  }, [allSelectedOnPage, allIdsOnPage]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  // me para "Asignarme"
  const meQ = useQuery({
    queryKey: ["me-lite"],
    queryFn: getMe,
    staleTime: 60_000,
  });

  // ── acciones masivas ────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["support:conversations"] });
    qc.invalidateQueries({ queryKey: ["support:list"] });
  };
  const bulkAssign = useMutation({
    mutationFn: async (agentId: string | null) => {
      const ids = selected.slice();
      await Promise.all(ids.map((id) => assignConversation(id, agentId)));
    },
    onSuccess: () => {
      setSelected([]);
      invalidate();
      toast({ title: "Asignación actualizada" });
    },
    onError: (e: any) =>
      toast({ title: e?.message || "No se pudo asignar", variant: "error" }),
  });
  const bulkStatus = useMutation({
    mutationFn: async (next: ConvStatus) => {
      const ids = selected.slice();
      await Promise.all(ids.map((id) => setConversationStatus(id, next)));
    },
    onSuccess: () => {
      setSelected([]);
      invalidate();
      toast({ title: "Estado actualizado" });
    },
    onError: (e: any) =>
      toast({
        title: e?.message || "No se pudo cambiar el estado",
        variant: "error",
      }),
  });

  const clearFilters = () => {
    setStatus("");
    setPriority("");
    setSla("");
    setSort("lastMessageDesc");
    setTag("");
    setQ("");
  };

  return (
    <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] h-[calc(100vh-220px)] md:h-[calc(100vh-190px)] flex flex-col">
      {/* ───────────────── HEADER REORGANIZADO ───────────────── */}
      <div className="p-3 border-b border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] sticky top-0 z-10">
        {/* Fila 1: selectores */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <select
            className="rounded-xl px-2 py-1.5 text-sm bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))]"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            title="Estado"
          >
            <option value="">Estado: Todos</option>
            {Object.values(ConvStatus).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl px-2 py-1.5 text-sm bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))]"
            value={priority}
            onChange={(e) => setPriority(e.target.value as any)}
            title="Prioridad"
          >
            <option value="">Prioridad: Todas</option>
            {Object.values(ConvPriority).map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            className="rounded-xl px-2 py-1.5 text-sm bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))]"
            value={sla}
            onChange={(e) => setSla(e.target.value as SlaFilter)}
            title="SLA"
          >
            <option value="">SLA: Todas</option>
            <option value="breached">Vencidas</option>
            <option value="atRisk">En riesgo</option>
            <option value="ok">En plazo</option>
          </select>

          <select
            className="rounded-xl px-2 py-1.5 text-sm bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))]"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            title="Ordenar por"
          >
            <option value="lastMessageDesc">Último mensaje ↓</option>
            <option value="timeToBreachAsc">Tiempo a incumplir ↑</option>
          </select>
        </div>

        {/* Fila 2: buscadores */}
        <div className="mt-2 grid grid-cols-1 md:grid-cols-[1fr_260px] gap-2">
          <div className="relative min-w-0">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70"
            />
            <Input
              placeholder="Buscar asunto, email, nombre…"
              className="pl-8 w-full"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              title="Buscar"
            />
          </div>
          <Input
            placeholder="Filtrar por etiqueta (p. ej. VIP)"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            title="Etiqueta"
          />
        </div>

        {/* Fila 3: tabs + acciones (icon-only) */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="inline-flex rounded-xl overflow-hidden border border-[rgb(var(--border-rgb))] overflow-x-auto whitespace-nowrap no-scrollbar">
              <SegBtn
                active={tab === "unassigned"}
                onClick={() => setTab("unassigned")}
                icon={<Inbox size={14} />}
                label="Sin asignar"
              />
              <SegBtn
                active={tab === "mine"}
                onClick={() => setTab("mine")}
                icon={<UserRound size={14} />}
                label="Mías"
              />
              <SegBtn
                active={tab === "all"}
                onClick={() => setTab("all")}
                icon={<Users size={14} />}
                label="Todas"
              />
            </div>
          </div>

          <Button
            variant="secondary"
            onClick={() => refetch()}
            disabled={isRefetching}
            title="Actualizar"
            aria-label="Actualizar"
            className="h-9 w-9 p-0 grid place-items-center"
          >
            <RotateCcw size={16} />
          </Button>
          <Button
            variant="secondary"
            onClick={clearFilters}
            title="Limpiar filtros"
            aria-label="Limpiar filtros"
            className="h-9 w-9 p-0 grid place-items-center"
          >
            <XCircle size={16} />
          </Button>
        </div>

        {/* Bulk bar */}
        {selected.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <button
              onClick={toggleSelectAll}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border hover:bg-[rgb(var(--muted-rgb))]"
              title={
                allSelectedOnPage
                  ? "Quitar selección de esta página"
                  : "Seleccionar todos (página)"
              }
            >
              {allSelectedOnPage ? (
                <CheckSquare size={14} />
              ) : (
                <Square size={14} />
              )}
              {allSelectedOnPage ? "Desmarcar" : "Marcar página"}
            </button>

            <div className="opacity-70">
              {selected.length} seleccionada{selected.length !== 1 ? "s" : ""}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => bulkAssign.mutate(meQ.data?.id || null)}
                disabled={bulkAssign.isPending || !meQ.data?.id}
                title="Asignarme"
              >
                Asignarme
              </Button>
              <Button
                variant="secondary"
                onClick={() => bulkAssign.mutate(null)}
                disabled={bulkAssign.isPending}
                title="Quitar asignación"
              >
                Quitar asignación
              </Button>
              <Button
                variant="secondary"
                onClick={() => bulkStatus.mutate(ConvStatus.OPEN)}
                disabled={bulkStatus.isPending}
              >
                Marcar ABIERTO
              </Button>
              <Button
                variant="secondary"
                onClick={() => bulkStatus.mutate(ConvStatus.PENDING)}
                disabled={bulkStatus.isPending}
              >
                Marcar PENDIENTE
              </Button>
              <Button
                variant="secondary"
                onClick={() => bulkStatus.mutate(ConvStatus.RESOLVED)}
                disabled={bulkStatus.isPending}
              >
                Marcar RESUELTO
              </Button>
              <Button
                variant="secondary"
                onClick={() => bulkStatus.mutate(ConvStatus.CLOSED)}
                disabled={bulkStatus.isPending}
              >
                Marcar CERRADO
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-auto p-2">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <div className="p-4 text-sm text-[rgb(var(--danger-rgb))]">
            No se pudo cargar la bandeja.
          </div>
        )}

        {!isLoading && !isError && data && data.items.length === 0 && (
          <div className="p-6 text-center text-sm opacity-70">
            Sin resultados.
          </div>
        )}

        {!isLoading && !isError && data && data.items.length > 0 && (
          <ul className="space-y-2">
            {data.items.map((c) => (
              <li key={c.id}>
                <div
                  className={cn(
                    "w-full rounded-xl border border-[rgb(var(--border-rgb))] p-3 hover:bg-[rgb(var(--muted-rgb))] transition",
                    selectedId === c.id
                      ? "ring-2 ring-[rgb(var(--ring-rgb))]"
                      : ""
                  )}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleOne(c.id)}
                      aria-label="Seleccionar"
                      className="mt-0.5"
                      title={
                        selected.includes(c.id)
                          ? "Quitar de selección"
                          : "Seleccionar"
                      }
                    >
                      {selected.includes(c.id) ? (
                        <CheckSquare size={18} className="opacity-80" />
                      ) : (
                        <Square size={18} className="opacity-60" />
                      )}
                    </button>

                    <button
                      onClick={() => onSelect(c.id)}
                      className="flex-1 text-left min-w-0"
                      title={c.subject || "(sin asunto)"}
                    >
                      <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border">
                          <Hash size={12} /> {c.id.slice(0, 6)}
                        </span>

                        <StatusBadge status={c.status} />
                        <PriorityBadge priority={c.priority as ConvPriority} />

                        {renderSlaPill(c)}

                        {c.assignedTo ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full border">
                            {c.assignedTo.name || c.assignedTo.email}
                          </span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-full border">
                            Sin asignar
                          </span>
                        )}

                        <span className="ml-auto inline-flex items-center gap-1 text-[11px] opacity-60">
                          <Clock size={12} /> {fmtDateTime(c.updatedAt)}
                        </span>
                      </div>

                      <div className="mt-1 text-sm font-medium line-clamp-1">
                        {c.subject || "(sin asunto)"}
                      </div>

                      <div className="text-[12px] opacity-70 line-clamp-1">
                        {c.user?.email || c.user?.name || c.channel}
                        {c._count?.messages
                          ? ` • ${c._count.messages} mensajes`
                          : ""}
                        {!!(c as any)?.tags?.length && (
                          <>
                            {" • "}
                            {(c as any).tags.map((t: any) => t.tag).join(", ")}
                          </>
                        )}
                      </div>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Paginación */}
      {!isLoading && !isError && data && data.totalPages > 1 && (
        <div className="p-2 border-t border-[rgb(var(--border-rgb))] flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={data.page <= 1}
          >
            Anterior
          </Button>
          <div className="text-sm opacity-80">
            {data.page} / {data.totalPages}
          </div>
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
            disabled={data.page >= data.totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: ConvStatus }) {
  const map: Record<ConvStatus, string> = {
    OPEN: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    PENDING:
      "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
    RESOLVED: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    CLOSED:
      "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
  };
  return (
    <span
      className={cn("text-[10px] px-2 py-0.5 rounded-full border", map[status])}
    >
      {status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority?: ConvPriority }) {
  if (!priority) return null;
  const map: Record<ConvPriority, string> = {
    LOW: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300 border-zinc-500/30",
    NORMAL:
      "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
    HIGH: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
    URGENT: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  };
  return (
    <span
      className={cn(
        "text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1",
        map[priority]
      )}
      title={`Prioridad: ${priority}`}
    >
      <Flag size={12} /> {priority}
    </span>
  );
}

function renderSlaPill(c: Conversation) {
  const hasFirst = (c as any).firstResponseAt as string | null;
  const firstSla = (c as any).firstResponseSlaAt as string | null;
  const resSla = (c as any).resolutionSlaAt as string | null;
  const resolvedAt = (c as any).resolvedAt as string | null;

  if (resolvedAt) return null;

  const deadline = !hasFirst ? firstSla : resSla;
  if (!deadline) return null;

  const due = new Date(deadline).getTime();
  const now = Date.now();
  const diffMin = Math.round((due - now) / 60000);

  const overdue = diffMin < 0;
  const atRisk = diffMin >= 0 && diffMin <= AT_RISK_MIN;

  const cls = overdue
    ? "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30"
    : atRisk
    ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30"
    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";

  const label = overdue
    ? `SLA vencida hace ${Math.abs(diffMin)}m`
    : `SLA en ${diffMin}m`;

  return (
    <span
      className={cn(
        "text-[10px] px-2 py-0.5 rounded-full border inline-flex items-center gap-1",
        cls
      )}
      title={label}
    >
      <AlertTriangle size={12} /> {label}
    </span>
  );
}

function fmtDateTime(s: string) {
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

/* Tabs + tooltip CSS mínimo */
function SegBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active?: boolean;
  onClick?: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Hint label={label}>
      <button
        onClick={onClick}
        aria-pressed={!!active}
        aria-label={label}
        className={[
          "px-3 py-1.5 text-sm inline-flex items-center gap-1 shrink-0",
          active
            ? "bg-[rgb(var(--card-rgb))]"
            : "bg-[rgb(var(--card-2-rgb))] hover:bg-[rgb(var(--card-rgb))]",
        ].join(" ")}
      >
        {icon}
        <span className="hidden xl:inline">{label}</span>
      </button>
    </Hint>
  );
}
function Hint({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
}) {
  const pos = side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5";
  return (
    <div className="relative group inline-flex">
      {children}
      <span
        role="tooltip"
        className={[
          "pointer-events-none absolute left-1/2 -translate-x-1/2",
          pos,
          "z-50 rounded-md px-2 py-1 text-xs",
          "bg-[rgb(var(--fg-rgb))] text-[rgb(var(--bg-rgb))] shadow-sm border border-[rgb(var(--border-rgb))]",
          "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity",
          "whitespace-nowrap",
        ].join(" ")}
      >
        {label}
      </span>
    </div>
  );
}
