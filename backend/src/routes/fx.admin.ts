// src/routes/fx.admin.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import * as cheerio from "cheerio";

const CODES = ["USD", "EUR", "MLC", "CAD", "CHF", "MXN", "CLA", "ZELLE"] as const;
type Code = (typeof CODES)[number];

/** Normaliza "400.00 CUP" / "1.234,56" → 400 / 1234.56 */
function toNumberLoose(input: unknown): number | null {
  const raw = String(input ?? "").replace(/[^\d.,-]/g, "").trim();
  if (!raw) return null;

  // 1.234,56 → 1234.56 (coma decimal + punto miles)
  if (raw.includes(".") && raw.includes(",")) {
    const normalized = raw.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  // 123,45 → 123.45 (solo coma)
  if (raw.includes(",") && !raw.includes(".")) {
    const normalized = raw.replace(",", ".");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  // 123.45 o 12345
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** 1) Parser de la tabla (si viene SSR) */
function parseTable(html: string): Partial<Record<Code, number>> {
  const $ = cheerio.load(html);
  const out: Partial<Record<Code, number>> = {};

  $("table tbody tr").each((_, tr) => {
    const codeText = $(tr).find(".name-cell .currency").text().trim(); // ej "1 USD"
    const priceText = $(tr).find(".price-cell .price-text").text().trim(); // ej "400.00 CUP"
    if (!codeText || !priceText) return;

    // "1 USD" → "USD"
    const code =
      codeText.match(/([A-Z]{2,6})\s*$/)?.[1] ??
      codeText.split(/\s+/).pop() ??
      "";
    const rate = toNumberLoose(priceText);
    if (!code || !rate || !Number.isFinite(rate)) return;

    const up = code.toUpperCase();
    if ((CODES as readonly string[]).includes(up)) {
      out[up as Code] = rate;
    }
  });

  return out;
}

/** 2) Parser desde __NEXT_DATA__ (SSR JSON embebido) */
function parseFromNextData(html: string): Partial<Record<Code, number>> {
  const $ = cheerio.load(html);
  const script = $("#__NEXT_DATA__").first().text().trim();
  if (!script) return {};

  try {
    const json = JSON.parse(script);
    const txt = JSON.stringify(json); // Buscamos por regex en el JSON serializado
    const out: Partial<Record<Code, number>> = {};

    for (const code of CODES) {
      // Busca el código y cerca un número con posible "CUP" alrededor
      // margen amplio por si hay etiquetas/propiedades intermedias
      const re = new RegExp(
        `${code}"?[^\\d]{0,160}?(\\d{2,4}(?:[.,]\\d{1,2})?)\\s*CUP`,
        "i"
      );
      const m = txt.match(re);
      if (m) {
        const n = toNumberLoose(m[1]);
        if (n && n > 0) out[code] = n;
      }
    }

    return out;
  } catch {
    return {};
  }
}

/** 3) Fallback regex en todo el HTML (por si cambian estructura) */
function parseByRegex(html: string): Partial<Record<Code, number>> {
  const out: Partial<Record<Code, number>> = {};
  for (const code of CODES) {
    const re = new RegExp(
      `${code}[\\s\\S]{0,160}?(\\d{2,4}(?:[.,]\\d{1,2})?)\\s*CUP`,
      "i"
    );
    const m = html.match(re);
    if (m) {
      const n = toNumberLoose(m[1]);
      if (n && n > 0) out[code] = n;
    }
  }
  return out;
}

/** Orquesta: tabla → __NEXT_DATA__ → regex */
function parseFromHtmlRobust(html: string): Partial<Record<Code, number>> {
  let out = parseTable(html);
  if (Object.keys(out).length) return out;

  out = parseFromNextData(html);
  if (Object.keys(out).length) return out;

  out = parseByRegex(html);
  return out;
}

const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  // Listar tasas actuales (admin)
  app.get("/", async (_req, reply) => {
    const rows = await app.prisma.informalFx.findMany({ orderBy: { code: "asc" } });
    const asOf =
      rows.length > 0
        ? rows
            .map((r) => r.effectiveAt)
            .reduce((max, d) => (d > max ? d : max), rows[0].effectiveAt)
            .toISOString()
        : null;

    return reply.send({ items: rows, asOf });
  });

  // Fijar tasa manual (1 code o varias)
  app.post("/override", async (req, reply) => {
    const body = (req.body ?? {}) as any;

    const toSave: Partial<Record<Code, number>> = {};
    const isSingle = typeof body.code === "string" && body.rate != null;
    const isBulk = body.rates && typeof body.rates === "object";

    if (isSingle) {
      const code = String(body.code).toUpperCase() as Code;
      if (!(CODES as readonly string[]).includes(code)) {
        return reply.code(400).send({ error: "code_invalid" });
      }
      const n = toNumberLoose(body.rate);
      if (!(n && n > 0)) return reply.code(400).send({ error: "rate_invalid" });
      toSave[code] = n;
    } else if (isBulk) {
      for (const c of CODES) {
        const v = body.rates[c] ?? body.rates[String(c).toLowerCase()];
        const n = toNumberLoose(v);
        if (n && n > 0) toSave[c] = n;
      }
      if (!Object.keys(toSave).length) {
        return reply.code(400).send({ error: "rates_empty" });
      }
    } else {
      return reply.code(400).send({ error: "payload_invalid" });
    }

    const now = new Date();
    await app.prisma.$transaction(
      Object.entries(toSave).map(([code, rate]) =>
        app.prisma.informalFx.upsert({
          where: { code },
          update: { rate: rate!, source: "manual", effectiveAt: now },
          create: { code, rate: rate!, source: "manual", effectiveAt: now },
        })
      )
    );

    const items = await app.prisma.informalFx.findMany({ orderBy: { code: "asc" } });
    return reply.send({ ok: true, source: "manual", asOf: now.toISOString(), items });
  });

  // Actualizar automáticamente (mirror JSON o HTML)
  app.post("/fetch", async (_req, reply) => {
    try {
      const mirror = process.env.FX_MIRROR_URL?.trim();
      const source = mirror || process.env.FX_SOURCE_URL?.trim();

      if (!source) {
        return reply.code(400).send({
          error: "no_source_configured",
          tip: "Define FX_MIRROR_URL (recomendado) o FX_SOURCE_URL en .env",
        });
      }

      const res = await fetch(source, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123 Safari/537.36",
          "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
          Accept: mirror ? "application/json" : "text/html",
        },
      });
      if (!res.ok) {
        return reply.code(502).send({ error: "upstream_unavailable", status: res.status });
      }

      let rates: Partial<Record<Code, number>> = {};
      let asOf = new Date().toISOString();

      if (mirror) {
        // { asOf?: string, rates: { USD, EUR, ... } }
        const json = (await res.json()) as any;
        if (json?.asOf) asOf = new Date(json.asOf).toISOString();
        if (json?.rates && typeof json.rates === "object") {
          for (const c of CODES) {
            const v = json.rates[c] ?? json.rates[String(c).toLowerCase()];
            const n = toNumberLoose(v);
            if (n && n > 0) rates[c] = n;
          }
        }
      } else {
        const html = await res.text();
        rates = parseFromHtmlRobust(html);
      }

      const found = Object.keys(rates) as Code[];
      if (found.length === 0) {
        return reply.code(424).send({
          error: "parse_empty",
          tip: mirror
            ? "Revisa el JSON del mirror (propiedad rates)."
            : "La página no devolvió la tabla SSR ni datos en __NEXT_DATA__. Intenta con otra URL del sitio o configura un mirror.",
        });
      }

      const effectiveAt = new Date(asOf);
      const srcLabel = mirror ? "mirror" : "scrape";

      await app.prisma.$transaction(
        found.map((code) =>
          app.prisma.informalFx.upsert({
            where: { code },
            update: { rate: rates[code]!, source: srcLabel, effectiveAt },
            create: { code, rate: rates[code]!, source: srcLabel, effectiveAt },
          })
        )
      );

      const items = await app.prisma.informalFx.findMany({ orderBy: { code: "asc" } });
      return reply.send({ ok: true, source: srcLabel, asOf: effectiveAt.toISOString(), items });
    } catch (err) {
      app.log.error({ err }, "fx.fetch_failed");
      return reply.code(500).send({ error: "fetch_failed" });
    }
  });
};

export default plugin;
