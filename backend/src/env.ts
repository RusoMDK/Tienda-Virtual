// src/env.ts
import * as dotenv from "dotenv";
import { z } from "zod";
dotenv.config();

// Helpers de coerción
const bool = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return /^(1|true|yes|y|on)$/i.test(v.trim());
  return false;
}, z.boolean());

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  // DB
  DATABASE_URL: z
    .string()
    .url({ message: "DATABASE_URL debe ser una URL válida" }),

  // Frontend (uno o varios orígenes permitidos)
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173").optional(),
  FRONTEND_ORIGINS: z.string().optional(), // coma-separado: https://a.com,https://b.com

  // JWT
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET debe tener ≥ 32 chars"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, "JWT_REFRESH_SECRET debe tener ≥ 32 chars"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),

  // Cookies
  COOKIE_SECURE: bool.default(false),
  COOKIE_SAME_SITE: z.enum(["Strict", "Lax", "None"]).default("Strict"),
  COOKIE_DOMAIN: z
    .string()
    .optional()
    .transform((v) => (v && v.trim().length ? v.trim() : undefined)),

  // Cloudinary (opcional pero recomendado)
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  CLOUDINARY_FOLDER: z.string().default("tienda/products"),

  // Stripe (opcional si no usas pagos aún)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Rate limit
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW: z.string().default("1 minute"),

  // Observabilidad (opcional)
  SENTRY_DSN: z.string().url().optional(),
  APP_NAME: z.string().default("Tienda API"),

  // 🌍 Geoapify (para geocoding / mapas)
  GEOAPIFY_KEY: z.string().optional(),
});

const raw = EnvSchema.parse(process.env);

// Derivar array de orígenes permitidos (CORS/CSP)
const FRONTEND_ORIGINS_ARRAY = (() => {
  const list =
    (raw.FRONTEND_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) || [];
  const fallback = raw.FRONTEND_ORIGIN
    ? [raw.FRONTEND_ORIGIN]
    : ["http://localhost:5173"];
  const arr = list.length ? list : fallback;
  return z.array(z.string().url()).parse(arr);
})();

export const env = {
  ...raw,
  FRONTEND_ORIGINS_ARRAY,
};

// Avisos útiles
if (env.COOKIE_SAME_SITE === "None" && !env.COOKIE_SECURE) {
  // eslint-disable-next-line no-console
  console.warn(
    "COOKIE_SAME_SITE=None requiere COOKIE_SECURE=true (política de navegadores)."
  );
}
if (env.NODE_ENV === "production" && !env.COOKIE_SECURE) {
  // eslint-disable-next-line no-console
  console.warn("Producción sin COOKIE_SECURE=true no es recomendable.");
}
const cloudOK = !!(
  env.CLOUDINARY_CLOUD_NAME &&
  env.CLOUDINARY_API_KEY &&
  env.CLOUDINARY_API_SECRET
);
if (!cloudOK) {
  // eslint-disable-next-line no-console
  console.warn(
    "Cloudinary no está completamente configurado; las rutas de uploads podrían no funcionar."
  );
}
const stripeOK = !!(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
if (!stripeOK) {
  // eslint-disable-next-line no-console
  console.warn(
    "Stripe no está completamente configurado; los pagos/webhooks podrían fallar."
  );
}

if (!env.GEOAPIFY_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    "GEOAPIFY_KEY no está configurada; el buscador de direcciones del mapa devolverá 0 resultados."
  );
}
