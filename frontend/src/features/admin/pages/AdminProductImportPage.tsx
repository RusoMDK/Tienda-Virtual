// src/features/admin/pages/AdminProductImportPage.tsx
import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useMutation } from "@tanstack/react-query";
import { Button, Input } from "@/ui";
import { useToast } from "@/ui";
import { adminCreateProduct, adminAdjustStock, type UImage } from "../api";

type RawRow = Record<string, string | number | boolean | null | undefined>;

type MappedRow = {
  name: string;
  description?: string;
  price_cents: number;
  currency?: string; // default: usd
  active?: boolean; // default: true
  categorySlug?: string; // ej: "calzado"
  stock?: number; // si > 0 → se ajusta luego
  images?: string[]; // URLs separadas por | o ,
};

// helpers
const toKey = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .trim();

const centsFromAny = (v: unknown) => {
  if (v === null || v === undefined) return null;
  const s = String(v)
    .replace(/[^\d.,-]/g, "")
    .replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return Math.round(n * 100);
};

const boolFromAny = (v: unknown) => {
  if (typeof v === "boolean") return v;
  const s = String(v || "")
    .toLowerCase()
    .trim();
  if (!s) return undefined;
  return ["1", "true", "si", "sí", "activo", "yes"].includes(s);
};

const intFromAny = (v: unknown) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(String(v).replace(/[^\d-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

const splitImages = (v: unknown): string[] | undefined => {
  if (!v) return undefined;
  const s = String(v);
  const parts = s
    .split(/[|,]/)
    .map((x) => x.trim())
    .filter(Boolean);
  return parts.length ? parts : undefined;
};

// Intentos de mapeo automático
const AUTO_MAP: Record<string, (key: string) => boolean> = {
  name: (k) => ["name", "titulo", "título", "nombre"].includes(k),
  description: (k) =>
    ["description", "descripcion", "descripción", "detalle"].includes(k),
  price: (k) =>
    ["price", "precio", "precio_sin_iva", "preciofinal"].includes(k),
  stock: (k) => ["stock", "inventario", "existencia"].includes(k),
  currency: (k) => ["currency", "moneda", "divisa"].includes(k),
  active: (k) => ["active", "activo", "habilitado"].includes(k),
  categorySlug: (k) =>
    [
      "category",
      "categoria",
      "categoría",
      "categoryslug",
      "slugcategoria",
    ].includes(k),
  images: (k) =>
    ["images", "fotos", "imagenes", "imágenes", "image_urls"].includes(k),
};

type ColumnMap = {
  name?: string;
  description?: string;
  price?: string;
  stock?: string;
  currency?: string;
  active?: string;
  categorySlug?: string;
  images?: string;
};

export default function AdminProductImportPage() {
  const toast = useToast();
  const [raw, setRaw] = useState<RawRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [map, setMap] = useState<ColumnMap>({});
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Array<{ ok: boolean; msg: string }>>(
    []
  );

  const fileRef = useRef<HTMLInputElement>(null);

  const onPick = () => fileRef.current?.click();

  const onFile = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    Papa.parse<RawRow>(f, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows = (res.data as any[]).filter((r) =>
          Object.values(r).some(
            (v) => v !== null && v !== undefined && String(v).trim() !== ""
          )
        );
        const cols = res.meta.fields || Object.keys(rows[0] || {});
        const normalized = cols.map(toKey);

        // mapeo automático por heurística
        const auto: ColumnMap = {};
        for (let i = 0; i < cols.length; i++) {
          const k = normalized[i];
          for (const field of Object.keys(AUTO_MAP) as (keyof ColumnMap)[]) {
            if (!auto[field] && AUTO_MAP[field](k)) auto[field] = cols[i];
          }
        }

        setRaw(rows);
        setHeaders(cols);
        setMap(auto);
        toast({ title: `Cargadas ${rows.length} filas`, variant: "success" });
      },
      error: (e) => {
        toast({
          title: e.message || "No se pudo leer el CSV",
          variant: "error",
        });
      },
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const preview = useMemo(() => raw.slice(0, 10), [raw]);

  const mappedRows: MappedRow[] = useMemo(() => {
    return raw.map((r) => {
      const pick = (col?: string) => (col ? r[col] : undefined);
      const name = String(pick(map.name) || "").trim();
      const description =
        String(pick(map.description) || "").trim() || undefined;
      const price_cents = centsFromAny(pick(map.price)) ?? 0;
      const currency = String(pick(map.currency) || "usd").toLowerCase();
      const active = boolFromAny(pick(map.active));
      const categorySlug =
        String(pick(map.categorySlug) || "").trim() || undefined;
      const stock = intFromAny(pick(map.stock));
      const images = splitImages(pick(map.images));
      return {
        name,
        description,
        price_cents,
        currency,
        active,
        categorySlug,
        stock,
        images,
      };
    });
  }, [raw, map]);

  const validCount = useMemo(
    () => mappedRows.filter((r) => r.name && r.price_cents >= 0).length,
    [mappedRows]
  );

  // Mutación por fila (crea producto + ajusta stock)
  const createOne = async (row: MappedRow) => {
    if (!row.name || row.price_cents === null) throw new Error("Fila inválida");
    const payload = {
      name: row.name,
      description: row.description || "",
      price: row.price_cents,
      currency: row.currency || "usd",
      active: row.active ?? true,
      categorySlug: row.categorySlug,
      images: (row.images || []).map((url): UImage => ({ url })),
    };
    const p = await adminCreateProduct(payload);
    if (row.stock && row.stock > 0) {
      await adminAdjustStock(p.id, row.stock, "import_csv");
    }
    return p.id;
  };

  const runImport = useMutation({
    mutationFn: async () => {
      setLoading(true);
      const res: Array<{ ok: boolean; msg: string }> = [];
      const concurrency = 3;
      let i = 0;

      const tasks = mappedRows.map((row, idx) => async () => {
        try {
          if (!row.name || row.price_cents === null) {
            res[idx] = {
              ok: false,
              msg: "Faltan campos obligatorios (name/price)",
            };
            return;
          }
          const id = await createOne(row);
          res[idx] = { ok: true, msg: `OK (${id})` };
        } catch (e: any) {
          res[idx] = {
            ok: false,
            msg: e?.response?.data?.error || e?.message || "Error",
          };
        }
      });

      // pool simple
      const pool: Promise<void>[] = [];
      for (; i < tasks.length && i < concurrency; i++) pool.push(tasks[i]());
      let next = i;
      while (pool.length) {
        await Promise.race(pool);
        // quita resueltos y lanza siguientes
        for (let j = pool.length - 1; j >= 0; j--) {
          if (
            Promise.resolve(pool[j]) &&
            res[next - (pool.length - j)] !== undefined
          ) {
            pool.splice(j, 1);
          }
        }
        if (next < tasks.length) {
          pool.push(tasks[next++]());
        }
      }

      setResults(res);
      setLoading(false);
      return res;
    },
    onSuccess: (res) => {
      const ok = res.filter((r) => r.ok).length;
      const fail = res.length - ok;
      toast({
        title: `Importación completada: ${ok} ok, ${fail} error(es)`,
        variant: "success",
      });
    },
    onError: (e: any) => {
      toast({ title: e?.message || "Error en importación", variant: "error" });
      setLoading(false);
    },
  });

  const progress = results.length
    ? Math.round((results.filter((r) => r).length / mappedRows.length) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Uploader */}
      <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-lg font-semibold">
              Importar productos (CSV)
            </div>
            <div className="text-sm opacity-70">
              Campos mínimos: <b>name</b>, <b>price</b>. Opcionales:
              description, currency, active, categorySlug, stock, images.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => onFile(e.target.files)}
            />
            <Button onClick={onPick}>Seleccionar CSV</Button>
          </div>
        </div>
      </div>

      {/* Mapeo de columnas */}
      {headers.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] p-4">
          <div className="text-base font-medium mb-3">Mapeo de columnas</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(
              [
                ["name", "Nombre *"],
                ["price", "Precio *"],
                ["description", "Descripción"],
                ["currency", "Moneda (ej: usd)"],
                ["active", "Activo (true/false)"],
                ["categorySlug", "Slug de categoría"],
                ["stock", "Stock"],
                ["images", "Imágenes (URL separadas por | o ,)"],
              ] as const
            ).map(([field, label]) => (
              <div key={field}>
                <label className="block text-xs opacity-70 mb-1">{label}</label>
                <select
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm"
                  value={(map as any)[field] || ""}
                  onChange={(e) =>
                    setMap((m) => ({
                      ...m,
                      [field]: e.target.value || undefined,
                    }))
                  }
                >
                  <option value="">— Sin asignar</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="text-xs opacity-70 mt-2">
            * Obligatorios. Si no especificas <i>currency</i>, se usará{" "}
            <b>usd</b>. Las imágenes se toman como URLs públicas.
          </div>
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] p-4 overflow-x-auto">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-base font-medium">
              Vista previa ({preview.length} de {raw.length})
            </div>
            <div className="text-sm opacity-70">
              Válidas: <b>{validCount}</b> / {mappedRows.length}
            </div>
          </div>

          <table className="min-w-full text-sm">
            <thead className="bg-zinc-900/50">
              <tr>
                <th className="p-2 text-left">name</th>
                <th className="p-2 text-left">price_cents</th>
                <th className="p-2 text-left">stock</th>
                <th className="p-2 text-left">categorySlug</th>
                <th className="p-2 text-left">images</th>
              </tr>
            </thead>
            <tbody>
              {mappedRows.slice(0, 10).map((r, i) => (
                <tr key={i} className="border-t border-zinc-800/70">
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{r.price_cents}</td>
                  <td className="p-2">{r.stock ?? ""}</td>
                  <td className="p-2">{r.categorySlug ?? ""}</td>
                  <td className="p-2 truncate max-w-[360px]">
                    {(r.images || []).join(" | ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Acciones */}
      {mappedRows.length > 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm opacity-80">
              Total filas: <b>{mappedRows.length}</b> | Válidas:{" "}
              <b>{validCount}</b>
            </div>
            <Button
              onClick={() => runImport.mutate()}
              disabled={runImport.isPending || validCount === 0}
            >
              {runImport.isPending ? "Importando…" : "Importar ahora"}
            </Button>
          </div>

          {/* Progreso simple */}
          {runImport.isPending && (
            <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full w-1/3 animate-[pulse_1.2s_ease_infinite] bg-zinc-300" />
            </div>
          )}

          {/* Resultados */}
          {results.length > 0 && (
            <div className="text-sm">
              <div className="mb-2 font-medium">Resultado por fila</div>
              <div className="max-h-[260px] overflow-auto rounded-xl border border-zinc-800">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-900/50">
                    <tr>
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Estado</th>
                      <th className="p-2 text-left">Mensaje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className="border-t border-zinc-800/70">
                        <td className="p-2">{i + 1}</td>
                        <td
                          className={`p-2 ${
                            r.ok ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {r.ok ? "OK" : "Error"}
                        </td>
                        <td className="p-2">{r.msg}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
