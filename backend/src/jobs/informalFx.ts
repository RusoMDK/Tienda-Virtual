// src/jobs/informalFx.ts
import * as cheerio from "cheerio";

/**
 * Convierte un texto como "397.27 CUP" o "1.234,56 CUP" a número JS.
 * - Si solo hay comas -> asume coma decimal (es/latam)
 * - Si hay punto y coma -> elimina separadores de miles y deja el decimal
 * - Si solo hay punto -> asume punto decimal (en)
 */
function toNumberLoose(input: string): number | null {
  const raw = String(input).replace(/[^\d.,-]/g, "").trim();
  if (!raw) return null;

  // ambos símbolos
  if (raw.includes(".") && raw.includes(",")) {
    // asume que la coma es decimal y el punto miles: 1.234,56 -> 1234.56
    const normalized = raw.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  // solo comas -> decimal con coma
  if (raw.includes(",") && !raw.includes(".")) {
    const normalized = raw.replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  // solo puntos -> decimal con punto
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parsea la tabla del "mercado informal" del HTML dado.
 * Busca filas <tr> con:
 *   - código en:  .name-cell .currency  (ej: "1 USD")
 *   - precio en:  .price-cell .price-text (ej: "400.00 CUP")
 */
export function parseInformalTable(html: string): Record<string, number> {
  const $ = cheerio.load(html);
  const out: Record<string, number> = {};

  $("table tbody tr").each((_, tr) => {
    const codeText = $(tr).find(".name-cell .currency").text().trim();
    const priceText = $(tr).find(".price-cell .price-text").text().trim();

    if (!codeText || !priceText) return;

    // De "1 USD" o "1 EUR" -> "USD", "EUR", etc.
    const code =
      codeText.match(/([A-Z]{2,6})\s*$/)?.[1] ??
      codeText.split(/\s+/).pop() ??
      "";

    const rate = toNumberLoose(priceText);
    if (!code || !rate || !Number.isFinite(rate)) return;

    out[code.toUpperCase()] = rate;
  });

  return out;
}

/**
 * Descarga el HTML desde una URL y devuelve el map { code: rate }.
 * No menciona la fuente en logs ni responses; deja ese detalle para el llamador.
 */
export async function fetchInformalFromUrl(url: string): Promise<Record<string, number>> {
  const res = await fetch(url, {
    headers: {
      // Header tranquilo para evitar bloqueos tontos de bots
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
      "accept-language": "es-ES,es;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) {
    throw new Error(`upstream_unavailable status=${res.status}`);
  }
  const html = await res.text();
  const parsed = parseInformalTable(html);
  if (!Object.keys(parsed).length) {
    throw new Error("parse_empty");
  }
  return parsed;
}
