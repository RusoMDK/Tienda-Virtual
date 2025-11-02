// src/features/admin/pages/AdminFxPage.tsx
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fxGetAdminList,
  fxForceFetch,
  fxOverrideOne,
  fxOverrideMany,
  type AdminFxList,
} from "../api/fx";
import { Button, Input, Card, CardHeader, CardContent, CardFooter } from "@/ui";
import { useToast } from "@/ui";

const CODES = [
  "USD",
  "EUR",
  "MLC",
  "CAD",
  "CHF",
  "MXN",
  "CLA",
  "ZELLE",
] as const;
type Code = (typeof CODES)[number];

function parseRate(input: string) {
  const n = Number(
    String(input)
      .replace(/[^\d.,-]/g, "")
      .replace(",", ".")
  );
  return Number.isFinite(n) ? n : NaN;
}

export default function AdminFxPage() {
  const qc = useQueryClient();
  const toast = useToast();

  // Estado local de edición por fila y nota común
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const { data, isLoading, isFetching, isError, error } = useQuery<AdminFxList>(
    {
      queryKey: ["admin:fx:list"],
      queryFn: fxGetAdminList,
      staleTime: 60_000,
    }
  );

  const mutFetch = useMutation({
    mutationFn: fxForceFetch,
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["admin:fx:list"] });
      toast({
        title: "Tasas actualizadas automáticamente",
        description: `Fuente: ${res?.source || "desconocida"} • ${
          res?.items?.length || 0
        } moneda(s)`,
        variant: "success",
      });
    },
    onError: (e: any) => {
      const msg =
        e?.response?.data?.error ||
        e?.message ||
        "No se pudo actualizar automáticamente";
      toast({ title: msg, variant: "error" });
    },
  });

  const mutOne = useMutation({
    mutationFn: ({ code, rate }: { code: Code; rate: number }) =>
      fxOverrideOne(code, rate, note || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin:fx:list"] });
      toast({ title: "Tasa guardada", variant: "success" });
    },
    onError: (e: any) => {
      const msg =
        e?.response?.status === 401
          ? "Sesión expirada o sin permisos"
          : e?.response?.data?.error || "No se pudo guardar";
      toast({ title: msg, variant: "error" });
    },
  });

  const mutMany = useMutation({
    mutationFn: async (payload: { rates: Record<string, number> }) =>
      fxOverrideMany(payload.rates, note || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin:fx:list"] });
      setDrafts({});
      toast({ title: "Tasas guardadas", variant: "success" });
    },
    onError: (e: any) => {
      const msg =
        e?.response?.status === 401
          ? "Sesión expirada o sin permisos"
          : e?.response?.data?.error || "No se pudo guardar";
      toast({ title: msg, variant: "error" });
    },
  });

  const mapByCode = useMemo(() => {
    const m = new Map<
      string,
      { rate: number; source?: string; effectiveAt?: string }
    >();
    (data?.items || []).forEach((it) => m.set(it.code, it));
    return m;
  }, [data]);

  const asOf = data?.asOf ? new Date(data.asOf).toLocaleString() : "—";

  function saveOne(code: Code) {
    const v = drafts[code];
    const n = parseRate(v);
    if (!Number.isFinite(n) || n <= 0) return;
    mutOne.mutate({ code, rate: n });
  }

  function saveAllEdited() {
    const out: Record<string, number> = {};
    for (const code of CODES) {
      const raw = drafts[code];
      if (!raw) continue;
      const n = parseRate(raw);
      if (Number.isFinite(n) && n > 0) out[code] = n;
    }
    if (!Object.keys(out).length) {
      toast({ title: "No hay cambios para guardar", variant: "warning" });
      return;
    }
    mutMany.mutate({ rates: out });
  }

  return (
    <div className="max-w-3xl">
      <Card>
        <CardHeader>
          <div className="font-semibold">Tasas informales (CUP por unidad)</div>
          <div className="text-sm opacity-70">
            Última actualización: <b>{asOf}</b>
            {isFetching && <span className="ml-2">Actualizando…</span>}
          </div>
          {isError && (
            <div className="text-sm text-red-300 mt-1">
              {(error as any)?.message || "No se pudieron cargar las tasas"}
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Nota global opcional */}
          <Input
            placeholder="Nota (opcional, interna – se guarda junto a los cambios)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {/* Tabla simple */}
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
            <table className="min-w-full text-sm">
              <thead className="bg-[var(--surface-1)]">
                <tr>
                  <th className="text-left p-3 w-28">Moneda</th>
                  <th className="text-left p-3 w-40">Actual</th>
                  <th className="text-left p-3">Nuevo valor</th>
                  <th className="text-right p-3 w-44">Acción</th>
                </tr>
              </thead>
              <tbody>
                {CODES.map((code) => {
                  const row = mapByCode.get(code);
                  const current = row?.rate;
                  const val = drafts[code] ?? "";
                  return (
                    <tr key={code} className="border-t border-[var(--border)]">
                      <td className="p-3 font-medium">{code}</td>
                      <td className="p-3">
                        {isLoading ? "…" : current ?? "—"}{" "}
                        <span className="opacity-60 text-xs">
                          {row?.source ? `(${row.source})` : ""}
                        </span>
                      </td>
                      <td className="p-3">
                        <Input
                          placeholder="Ej: 295.50"
                          inputMode="decimal"
                          value={val}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [code]: e.target.value }))
                          }
                          className="max-w-[180px]"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          onClick={() => saveOne(code)}
                          disabled={mutOne.isPending}
                        >
                          Guardar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>

        <CardFooter className="flex flex-wrap gap-2 justify-between">
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() =>
                qc.invalidateQueries({ queryKey: ["admin:fx:list"] })
              }
            >
              Refrescar
            </Button>
            <Button
              variant="secondary"
              onClick={() => mutFetch.mutate()}
              disabled={mutFetch.isPending}
              title="Intentar obtener tasas desde el agregador configurado en el backend"
            >
              {mutFetch.isPending
                ? "Actualizando…"
                : "Actualizar automáticamente"}
            </Button>
          </div>

          <Button
            onClick={saveAllEdited}
            disabled={mutMany.isPending}
            title="Guardar todos los valores editados de una sola vez"
          >
            {mutMany.isPending ? "Guardando…" : "Guardar cambios editados"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
