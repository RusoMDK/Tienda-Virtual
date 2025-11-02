// src/lib/fx.ts
import { api } from "@/lib/api";
export type FxResp = { base: string; quote: string; rate: number; effectiveAt: string };

export async function getFx() {
  return (await api.get("/fx")).data as FxResp;
}

// Conversión: USD_cents → CUP_cents
export function usdCentsToCupCents(usdCents: number, rate: number) {
  // cup_cents = usd_cents * rate
  return Math.round(usdCents * rate);
}
