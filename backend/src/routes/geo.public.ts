// src/routes/geo.public.ts
import type { FastifyInstance, FastifyPluginAsync } from "fastify";

// ─────────────────────────────────────────────────────────────
// País ➜ Moneda (solo USD, EUR, MXN, CAD, CHF)
// - USD: EE.UU. + territorios y países dolarizados
// - EUR: zona euro + microestados y territorios franceses con EUR
// - MXN: México
// - CAD: Canadá
// - CHF: Suiza y Liechtenstein
// El resto: sin asignar (null) para que el frontend use fallback.
// ─────────────────────────────────────────────────────────────
const COUNTRY_TO_CURRENCY: Record<string, "USD" | "EUR" | "MXN" | "CAD" | "CHF"> = {
  // USD (Estados Unidos y dolarizados)
  US: "USD", AS: "USD", GU: "USD", VI: "USD", PR: "USD", MP: "USD", UM: "USD",
  EC: "USD", SV: "USD", PA: "USD", TL: "USD", FM: "USD", MH: "USD", PW: "USD",
  BQ: "USD", VG: "USD", TC: "USD", IO: "USD", // BQ = Caribe Neerlandés
  // ZW usa multimoneda con USD; si te interesa, déjalo activo:
  ZW: "USD",

  // EUR (zona euro + microestados/territorios con euro)
  AT: "EUR", BE: "EUR", CY: "EUR", EE: "EUR", FI: "EUR", FR: "EUR", DE: "EUR",
  GR: "EUR", IE: "EUR", IT: "EUR", LV: "EUR", LT: "EUR", LU: "EUR", MT: "EUR",
  NL: "EUR", PT: "EUR", SK: "EUR", SI: "EUR", ES: "EUR", HR: "EUR", // HR desde 2023
  AD: "EUR", MC: "EUR", SM: "EUR", VA: "EUR", ME: "EUR", XK: "EUR", // micro y unilaterales
  AX: "EUR", // Åland
  GF: "EUR", GP: "EUR", MQ: "EUR", RE: "EUR", YT: "EUR", BL: "EUR", MF: "EUR",
  PM: "EUR", TF: "EUR",

  // MXN
  MX: "MXN",

  // CAD
  CA: "CAD",

  // CHF
  CH: "CHF", LI: "CHF",
};

const plugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/guess", async (_req, reply) => {
    try {
      const base = process.env.GEOIP_URL?.trim() || "https://ipapi.co/json/";
      const res = await fetch(base, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; tienda-geo/1.0; +https://example.local)",
          Accept: "application/json",
        },
      });
      if (!res.ok) return reply.code(200).send({ country: null, currency: null });

      const json: any = await res.json();
      const country = String(json?.country || json?.country_code || "").toUpperCase() || null;
      const currency = country && COUNTRY_TO_CURRENCY[country] ? COUNTRY_TO_CURRENCY[country] : null;

      return reply.send({ country, currency });
    } catch {
      return reply.code(200).send({ country: null, currency: null });
    }
  });
};

export default plugin;
