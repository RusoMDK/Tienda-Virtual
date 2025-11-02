// src/features/support/pages/AdminSupportPage.tsx
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import SupportInbox from "@/features/support/components/SupportInbox";
import SupportThread from "@/features/support/components/SupportThread";
import { useSupportInboxStream } from "@/features/support/hooks";
import {
  AlertTriangle,
  Flag,
  Inbox,
  RotateCw,
  ExternalLink,
  X,
} from "lucide-react";
import { Button } from "@/ui";

export default function AdminSupportPage() {
  useSupportInboxStream();

  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();

  const selectedFromUrl = sp.get("c");
  const [selected, setSelected] = useState<string | null>(selectedFromUrl);

  // Altura de paneles (ajusta si tu navbar cambia)
  const paneH = "h-[calc(100dvh-var(--nav-h)-5.25rem)]";

  // URL sync (solo param "c")
  useEffect(() => {
    const next = new URLSearchParams(sp);
    selected ? next.set("c", selected) : next.delete("c");
    setSp(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // ESC = limpiar selección
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Acciones
  const recargar = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["support:conversations"] });
    qc.invalidateQueries({ queryKey: ["support:list"] });
  }, [qc]);

  return (
    <div className="py-4 space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight truncate">
            Centro de soporte
          </h1>
          <p className="text-sm opacity-70">
            Conversaciones, estados y respuestas en vivo.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          {/* Leyenda compacta */}
          <div className="hidden md:flex items-center gap-2">
            <Hint label="SLA en plazo">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                <AlertTriangle size={16} />
              </span>
            </Hint>
            <Hint label="SLA en riesgo (≤ 15m)">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
                <AlertTriangle size={16} />
              </span>
            </Hint>
            <Hint label="SLA vencida">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30">
                <AlertTriangle size={16} />
              </span>
            </Hint>
            <span className="mx-1 h-5 w-px bg-[rgb(var(--border-rgb))]" />
            <Hint label="Prioridad">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30">
                <Flag size={16} />
              </span>
            </Hint>
          </div>

          {/* Acciones: icon-only + tooltip */}
          <div className="flex items-center gap-1">
            <Hint label="Recargar bandeja">
              <Button
                variant="secondary"
                size="sm"
                onClick={recargar}
                aria-label="Recargar bandeja"
                className="h-9 w-9 p-0 grid place-items-center"
              >
                <RotateCw size={16} />
              </Button>
            </Hint>

            {selected && (
              <>
                <Link
                  to={`/admin/support/${selected}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Abrir conversación en pestaña"
                  title="Abrir conversación en pestaña"
                >
                  <Hint label="Abrir en pestaña nueva">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="h-9 w-9 p-0 grid place-items-center"
                    >
                      <ExternalLink size={16} />
                    </Button>
                  </Hint>
                </Link>

                <Hint label="Limpiar selección (Esc)">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelected(null)}
                    aria-label="Limpiar selección"
                    className="h-9 w-9 p-0 grid place-items-center"
                  >
                    <X size={16} />
                  </Button>
                </Hint>
              </>
            )}
          </div>
        </div>
      </div>

      {/* === CONTENIDO: SIEMPRE 2 PANELES === */}
      <div className="grid gap-4 grid-cols-[minmax(300px,420px)_1fr]">
        {/* Bandeja */}
        <div className="min-w-0">
          <div
            className={`rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] ${paneH} overflow-hidden`}
          >
            <SupportInbox selectedId={selected} onSelect={setSelected} />
          </div>
        </div>

        {/* Hilo */}
        <div className="min-w-0">
          <div
            className={`rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] ${paneH} overflow-hidden`}
          >
            {selected ? (
              <SupportThread id={selected} />
            ) : (
              <EmptyThreadPlaceholder />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyThreadPlaceholder() {
  return (
    <div className="h-full grid place-items-center p-6">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[rgb(var(--border-rgb))]">
          <Inbox size={18} className="opacity-80" />
        </div>
        <h2 className="text-base font-semibold">Selecciona una conversación</h2>
        <p className="text-sm opacity-70 mt-1">
          Elige un hilo para ver detalles y responder. Usa los filtros de la
          izquierda. Pulsa <kbd>Esc</kbd> para limpiar la selección.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Tooltip mínimo reutilizable
   ───────────────────────────────────────────────────────── */
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
