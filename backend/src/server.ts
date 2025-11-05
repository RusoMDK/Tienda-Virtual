// src/server.ts
import Fastify from "fastify";
import helmet from "@fastify/helmet";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import cookie from "@fastify/cookie";
import sse from "fastify-sse-v2";

import { env } from "./env";

// Plugins (sin .js)
import prismaPlugin from "./plugins/prisma";
import authPlugin from "./plugins/auth";

// Rutas (sin .js)
import productsRoutes from "./routes/products";
import ordersRoutes from "./routes/orders";
import authRoutes from "./routes/auth";
import meRoutes from "./routes/me";
import paymentsRoutes from "./routes/payments";
import categoriesRoutes from "./routes/categories";
import addressesRoutes from "./routes/addresses";
import imageProxy from "./routes/image-proxy";
import adminRoutes from "./routes/admin";
import cloudinaryRoutes from "./routes/cloudinary";
import meOrdersRoutes from "./routes/me.orders";
import twoFARoutes from "./routes/2fa";
import geoPublicRoutes from "./routes/geo.public";
import homeRoutes from "./routes/home";
import mapRoutes from "./routes/mapRoutes";

// 💬 Support (nuevo)
import supportRoutes from "./routes/support";

// 💱 FX
import fxPublicRoutes from "./routes/fx.public";
import fxAdminRoutes from "./routes/fx.admin";

const app = Fastify({
  logger: { level: env.NODE_ENV === "development" ? "debug" : "info" },
  trustProxy: true,
});

// ───────────────────────── Plugins base (orden recomendado)
await app.register(sensible);

await app.register(cookie, {
  parseOptions: {
    domain: env.COOKIE_DOMAIN,
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE, // "Strict" | "Lax" | "None"
    path: "/",
  },
});

await app.register(prismaPlugin);
await app.register(authPlugin);
await app.register(sse);

// Helmet + CSP segura (permitiendo Cloudinary / proxy / WebSockets)
await app.register(helmet, {
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https:",
        "https://res.cloudinary.com",
      ],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: [
        "'self'",
        ...env.FRONTEND_ORIGINS_ARRAY,
        "https://api.cloudinary.com",
        "ws:",
        "wss:",
      ],
      formAction: ["'self'", "https://api.cloudinary.com"],
      frameAncestors: ["'none'"],
    },
  },
});

// CORS usando orígenes permitidos del env
await app.register(cors, {
  origin: env.FRONTEND_ORIGINS_ARRAY,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
});

// Rate limit desde .env
await app.register(rateLimit, {
  max: env.RATE_LIMIT_MAX,
  timeWindow: env.RATE_LIMIT_WINDOW,
  ban: 0,
});

// ───────────────────────── Rutas
app.get("/health", async () => ({
  ok: true,
  env: env.NODE_ENV,
  now: new Date().toISOString(),
}));

// Públicas / autenticadas generales
await app.register(authRoutes);
await app.register(meRoutes);
await app.register(productsRoutes);
await app.register(ordersRoutes);
await app.register(paymentsRoutes);
await app.register(categoriesRoutes);
await app.register(addressesRoutes);
await app.register(imageProxy);
await app.register(meOrdersRoutes);
await app.register(twoFARoutes);
await app.register(homeRoutes);
await app.register(mapRoutes, { prefix: "/maps" });
// ...

// 💱 FX público: /fx/*
await app.register(fxPublicRoutes, { prefix: "/fx" });

// Cloudinary signature (autenticada)
await app.register(cloudinaryRoutes);

// Admin
await app.register(adminRoutes);

// 💱 FX admin: /admin/fx/*
await app.register(fxAdminRoutes, { prefix: "/admin/fx" });

await app.register(geoPublicRoutes, { prefix: "/geo" });

// 💬 Soporte (nuevo): /support/*
await app.register(supportRoutes, { prefix: "/support" });

// ───────────────────────── Error handler & listen
app.setErrorHandler((err, req, reply) => {
  req.log.error({ err }, "Unhandled");
  const status = err.statusCode || 500;
  const body =
    env.NODE_ENV === "development"
      ? { error: err.message, stack: err.stack, status }
      : { error: err.message, status };
  reply.status(status).send(body);
});

// ───────────────────────── Cron diario (opcional, minimal)
type FxStore = {
  asOf: string;
  source: string;
  rates: { USD_CUP: number; EUR_CUP?: number };
};

function ensureFxStore(): FxStore {
  const anyApp = app as any;
  if (!anyApp.fxStore) {
    anyApp.fxStore = {
      asOf: new Date(0).toISOString(),
      source: "unset",
      rates: { USD_CUP: 0 },
    } as FxStore;
  }
  return anyApp.fxStore as FxStore;
}

function scheduleDailyAt(
  hour: number,
  minute: number,
  job: () => void | Promise<void>
) {
  const planNext = () => {
    const now = new Date();
    const next = new Date();
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(now.getDate() + 1);
    const delay = next.getTime() - now.getTime();
    setTimeout(async () => {
      try {
        await job();
      } catch (err) {
        app.log.warn({ err }, "FX daily job failed");
      } finally {
        planNext();
      }
    }, delay);
  };
  planNext();
}

// Programa a las 9:00 (hora local). Ahora mismo es no-op con logging.
scheduleDailyAt(9, 0, async () => {
  ensureFxStore();
  app.log.info(
    "FX daily cron ran (no-op). Integra tu refresco automático cuando esté listo."
  );
});

// ───────────────────────── Listen
app.listen({ port: env.PORT, host: "0.0.0.0" }).then(() => {
  app.log.info(
    `API running → http://localhost:${
      env.PORT
    } | CORS: ${env.FRONTEND_ORIGINS_ARRAY.join(", ")}`
  );
});
