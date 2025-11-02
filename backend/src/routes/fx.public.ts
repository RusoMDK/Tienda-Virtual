// src/routes/fx.public.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";

const PUBLIC_CODES = ["CUP", "USD", "EUR", "MXN", "CAD", "CHF", "CLA"] as const;
type PublicCode = (typeof PUBLIC_CODES)[number];

const ALL_KNOWN_CODES = [
  "CUP", "USD", "EUR", "MXN", "CAD", "CHF", // públicas
  "MLC", "CLA", "ZELLE",                   // internas/admin
] as const;
type AnyCode = (typeof ALL_KNOWN_CODES)[number];

function isPublicCode(x: string): x is PublicCode {
  return (PUBLIC_CODES as readonly string[]).includes(x as any);
}
function isKnownCode(x: string): x is AnyCode {
  return (ALL_KNOWN_CODES as readonly string[]).includes(x as any);
}

/**
 * Lee todas las filas de informalFx y arma:
 * - ratesPublic: sólo códigos públicos + CUP=1 garantizado
 * - ratesAll: todos los códigos que existan (para legacy)
 * - asOf: fecha más reciente (effectiveAt)
 * - lastSource: la fuente del registro más reciente (manual/scrape/mirror)
 */
async function readAllRates(app: FastifyInstance) {
  const rows = await app.prisma.informalFx.findMany();

  // asOf: la más reciente
  let asOf: string | null = null;
  let lastSource: string | undefined;

  if (rows.length) {
    const latest = rows.reduce((a, b) =>
      a.effectiveAt > b.effectiveAt ? a : b
    );
    asOf = latest.effectiveAt.toISOString();
    lastSource = latest.source ?? undefined;
  }

  // ratesAll (legacy) – incluye todo lo que esté en DB y sea conocido
  const ratesAll: Partial<Record<AnyCode, number>> = {};
  for (const r of rows) {
    const code = String(r.code || "").toUpperCase();
    const rate = Number(r.rate);
    if (isKnownCode(code) && Number.isFinite(rate) && rate > 0) {
      ratesAll[code] = rate;
    }
  }

  // ratesPublic – sólo lo que consume el front
  const ratesPublic: Partial<Record<PublicCode, number>> = { CUP: 1 };
  for (const c of PUBLIC_CODES) {
    if (c === "CUP") continue; // ya fijo 1
    const val = ratesAll[c];
    if (typeof val === "number" && val > 0) {
      ratesPublic[c] = val;
    }
  }

  return { asOf, lastSource, ratesAll, ratesPublic };
}

const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * NUEVO: Endpoint para el frontend
   * Siempre devuelve 200 con:
   * { asOf: string|null, rates: { CUP:1, USD?, EUR?, MXN?, CAD?, CHF? } }
   * Si todavía no hay scrape/manual, al menos tendrás CUP:1.
   */
  app.get("/public", async (_req, reply) => {
    const { asOf, ratesPublic } = await readAllRates(app);

    // Cache corto: 1 minuto (ajusta a tu gusto)
    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    return reply.send({ asOf, rates: ratesPublic });
  });

  /**
   * Legacy: /fx/rates  → { rates: {USD, EUR, ...}, updatedAt, source? }
   * Devuelve TODOS los códigos presentes (incluye MLC/CLA/ZELLE si existen).
   */
  app.get("/rates", async (_req, reply) => {
    const { asOf, lastSource, ratesAll } = await readAllRates(app);

    if (!Object.keys(ratesAll).length) {
      return reply.code(404).send({ error: "No hay tasas aún" });
    }

    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    return reply.send({
      rates: ratesAll,
      updatedAt: asOf,       // mismo campo que tenías
      source: lastSource,    // opcional
    });
  });

  /**
   * Legacy: /fx/rate → USD únicamente (back-compat con tu front viejo)
   */
  app.get("/rate", async (_req, reply) => {
    const usd = await app.prisma.informalFx.findUnique({
      where: { code: "USD" },
    });
    if (!usd) {
      return reply.code(404).send({ error: "No hay tasa disponible todavía" });
    }
    reply.header("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
    return reply.send({
      rate: Number(usd.rate),
      updatedAt: usd.effectiveAt.toISOString(),
      source: usd.source ?? undefined,
    });
  });
};

export default plugin;
