// src/features/admin/api/fx.ts
import { api } from "@/lib/api";

export type AdminFxItem = {
  code: string;      // "USD", "EUR", etc.
  rate: number;      // número > 0
  source?: string;   // "manual" | "mirror" | "scrape" | ...
  effectiveAt: string;
  createdAt: string;
  updatedAt: string;
};

export type AdminFxList = {
  items: AdminFxItem[];
  asOf: string | null;
};

export async function fxGetAdminList(): Promise<AdminFxList> {
  const { data } = await api.get("/admin/fx");
  return data;
}

// Override de UNA moneda
export async function fxOverrideOne(code: string, rate: number, note?: string) {
  const { data } = await api.post("/admin/fx/override", { code, rate, note });
  return data;
}

// Override de VARIAS a la vez
export async function fxOverrideMany(rates: Record<string, number>, note?: string) {
  const { data } = await api.post("/admin/fx/override", { rates, note });
  return data;
}

// Forzar fetch automático (mirror o HTML)
export async function fxForceFetch() {
  const { data } = await api.post("/admin/fx/fetch", {});
  return data;
}

// Ruta pública opcional (si la usas en otras partes)
export async function fxGetPublic() {
  const { data } = await api.get("/fx/current");
  return data;
}
