// backend/src/routes/auth.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { env } from "../env.js";
import { authenticator } from "otplib";
import argon2 from "argon2";
import { newTokenString } from "../utils/tokens.js";
import { NotificationType } from "@prisma/client";
import { notifyUserInApp } from "../services/notificationService.js";

/** TTL parser seguro: "10s", "15m", "2h", "7d" (case-insensitive).
 *  Si viene vacío/undefined o formato inválido → fallback 7d.
 */
function parseTtlMs(ttl?: string) {
  if (!ttl) return 7 * 24 * 60 * 60 * 1000; // 7d
  const m = ttl.toLowerCase().match(/^(\d+)([smhd])$/);
  if (!m) return 7 * 24 * 60 * 60 * 1000; // 7d
  const n = Number(m[1]);
  const u = m[2];
  return n * (u === "s" ? 1e3 : u === "m" ? 6e4 : u === "h" ? 36e5 : 864e5);
}

const RegisterSchema = z.object({
  email: z
    .string()
    .email()
    .transform((e) => e.trim().toLowerCase()),
  password: z.string().min(8).max(72),
  name: z.string().min(1).optional(),
});

const LoginSchema = z.object({
  email: z
    .string()
    .email()
    .transform((e) => e.trim().toLowerCase()),
  password: z.string().min(1),
  totp: z.string().length(6).optional(),
});

export default async function authRoutes(app: FastifyInstance) {
  // ---------------------------------------------
  // Helper: crear refresh + setear cookie (opaco)
  // ---------------------------------------------
  async function setRefreshCookieAndPersist(
    reply: any,
    userId: string,
    role: string
  ) {
    const accessToken = app.signAccess({ sub: userId, role });

    const refreshMs = parseTtlMs(env.JWT_REFRESH_TTL);
    const expiresAt = new Date(Date.now() + refreshMs);

    let createdToken: string | null = null;
    for (let i = 0; i < 3; i++) {
      const candidate = newTokenString();
      try {
        await app.prisma.refreshToken.create({
          data: {
            userId,
            token: candidate,
            expiresAt,
          },
        });
        createdToken = candidate;
        break;
      } catch (e: any) {
        if (e?.code === "P2002" && e?.meta?.target?.includes?.("token")) {
          continue;
        }
        throw e;
      }
    }

    if (!createdToken) {
      reply.header("Cache-Control", "no-store");
      return reply.unauthorized();
    }

    reply.setCookie("refresh_token", createdToken, {
      httpOnly: true,
      secure: env.COOKIE_SECURE,
      sameSite: env.COOKIE_SAME_SITE as any,
      domain: env.COOKIE_DOMAIN,
      path: "/",
      maxAge: Math.floor(refreshMs / 1000),
    });

    reply.header("Cache-Control", "no-store");
    return accessToken;
  }

  // =========================
  // REGISTER
  // =========================
  app.post(
    "/auth/register",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req, reply) => {
      try {
        const body = RegisterSchema.parse(req.body);

        const exists = await app.prisma.user.findUnique({
          where: { email: body.email },
        });
        if (exists) return reply.conflict("Email ya registrado");

        const passwordHash = await argon2.hash(body.password, {
          type: argon2.argon2id,
        });
        const user = await app.prisma.user.create({
          data: { email: body.email, name: body.name ?? null, passwordHash },
          select: { id: true, email: true, name: true, role: true },
        });

        reply.header("Cache-Control", "no-store");
        return reply.code(201).send({ user });
      } catch (err: any) {
        if (err?.issues?.[0]?.message)
          return reply.badRequest(err.issues[0].message);
        req.log.error({ err }, "auth/register failed");
        return reply.internalServerError("No se pudo registrar");
      }
    }
  );

  // =========================
  // LOGIN (errores claros)
  // =========================
  app.post(
    "/auth/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      try {
        const { email, password, totp } = LoginSchema.parse(req.body ?? {});

        const user = await app.prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash)
          return reply.unauthorized("Credenciales inválidas");

        const ok = await argon2.verify(user.passwordHash, password);
        if (!ok) return reply.unauthorized("Credenciales inválidas");

        if (user.twoFactorEnabled) {
          if (!totp) return reply.badRequest("Se requiere 2FA");
          const valid = authenticator.check(totp, user.twoFactorSecret ?? "");
          if (!valid) return reply.unauthorized("Código 2FA inválido");
        }

        const accessToken = await setRefreshCookieAndPersist(
          reply,
          user.id,
          user.role
        );

        // 🔔 Notificación: nuevo inicio de sesión
        try {
          await notifyUserInApp(app.prisma, {
            userId: user.id,
            type: NotificationType.NEW_LOGIN,
            title: "Nuevo inicio de sesión",
            body: "Se inició sesión en tu cuenta.",
            data: {
              ip: req.ip,
              userAgent: req.headers["user-agent"] || null,
              at: new Date().toISOString(),
            },
          });
        } catch (err) {
          req.log.error(
            { err },
            "Failed to create NEW_LOGIN notification (/auth/login)"
          );
        }

        const userSafe = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
        return { accessToken, user: userSafe };
      } catch (err: any) {
        if (err?.issues?.[0]?.message)
          return reply.badRequest(err.issues[0].message);
        req.log.error({ err }, "auth/login failed");
        return reply.internalServerError("No se pudo iniciar sesión");
      }
    }
  );

  // =========================
  // REFRESH
  // =========================
  app.post(
    "/auth/refresh",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (req, reply) => {
      try {
        const token = req.cookies["refresh_token"];
        if (!token) {
          reply.header("Cache-Control", "no-store");
          return reply.unauthorized();
        }

        const stored = await app.prisma.refreshToken.findUnique({
          where: { token },
        });

        if (!stored) {
          try {
            if (token.includes(".")) {
              const decoded: any = app.jwt.decode(token);
              const sub = decoded?.sub as string | undefined;
              if (sub) {
                await app.prisma.refreshToken.updateMany({
                  where: { userId: sub, revoked: false },
                  data: { revoked: true },
                });
                req.log.warn(
                  { sub },
                  "Refresh reuse detected (opaque miss + JWT fallback) → revoked all"
                );
              }
            }
          } catch {}
          reply.header("Cache-Control", "no-store");
          return reply.unauthorized();
        }

        if (stored.revoked || stored.expiresAt < new Date()) {
          reply.header("Cache-Control", "no-store");
          return reply.unauthorized();
        }

        const user = await app.prisma.user.findUnique({
          where: { id: stored.userId },
        });
        if (!user) {
          reply.header("Cache-Control", "no-store");
          return reply.unauthorized();
        }

        await app.prisma.refreshToken.update({
          where: { token },
          data: { revoked: true },
        });

        const refreshMs = parseTtlMs(env.JWT_REFRESH_TTL);
        const expiresAt = new Date(Date.now() + refreshMs);

        let createdToken: string | null = null;
        for (let i = 0; i < 3; i++) {
          const candidate = newTokenString();
          try {
            await app.prisma.refreshToken.create({
              data: {
                userId: user.id,
                token: candidate,
                expiresAt,
              },
            });
            createdToken = candidate;
            break;
          } catch (e: any) {
            if (e?.code === "P2002" && e?.meta?.target?.includes?.("token")) {
              continue;
            }
            throw e;
          }
        }

        if (!createdToken) {
          reply.header("Cache-Control", "no-store");
          return reply.unauthorized();
        }

        const accessToken = app.signAccess({
          sub: user.id,
          role: user.role,
        });

        reply.setCookie("refresh_token", createdToken, {
          httpOnly: true,
          secure: env.COOKIE_SECURE,
          sameSite: env.COOKIE_SAME_SITE as any,
          domain: env.COOKIE_DOMAIN,
          path: "/",
          maxAge: Math.floor(refreshMs / 1000),
        });

        reply.header("Cache-Control", "no-store");
        return { accessToken };
      } catch (err) {
        req.log.error({ err }, "auth/refresh failed");
        reply.header("Cache-Control", "no-store");
        return reply.unauthorized();
      }
    }
  );

  // =========================
  // LOGOUT
  // =========================
  app.post("/auth/logout", async (req, reply) => {
    try {
      const token = req.cookies["refresh_token"];
      if (token) {
        await app.prisma.refreshToken.updateMany({
          where: { token },
          data: { revoked: true },
        });
      }
      reply.clearCookie("refresh_token", {
        path: "/",
        domain: env.COOKIE_DOMAIN,
      });
      reply.header("Cache-Control", "no-store");
      return { ok: true };
    } catch (err) {
      req.log.error({ err }, "auth/logout failed");
      reply.header("Cache-Control", "no-store");
      return { ok: true };
    }
  });

  // =========================
  // 2FA (TOTP) flujo /auth/*
  // =========================
  app.post(
    "/auth/2fa/setup",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      try {
        const userId = (req as any).user.sub as string;
        const secret = authenticator.generateSecret();
        const otpauth = authenticator.keyuri(
          userId,
          env.APP_NAME || "Tienda",
          secret
        );
        await app.prisma.user.update({
          where: { id: userId },
          data: { twoFactorSecret: secret },
        });
        return { otpauth };
      } catch (err) {
        req.log.error({ err }, "2fa/setup failed");
        return reply.internalServerError(
          "No se pudo iniciar configuración 2FA"
        );
      }
    }
  );

  app.post(
    "/auth/2fa/enable",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      try {
        const body = z.object({ code: z.string().length(6) }).parse(req.body);
        const userId = (req as any).user.sub as string;
        const user = await app.prisma.user.findUnique({
          where: { id: userId },
        });
        if (!user?.twoFactorSecret)
          return reply.badRequest("Primero llama a /auth/2fa/setup");
        const valid = authenticator.check(body.code, user.twoFactorSecret);
        if (!valid) return reply.unauthorized("Código inválido");
        await app.prisma.user.update({
          where: { id: userId },
          data: { twoFactorEnabled: true },
        });

        // 🔔 Notificación de seguridad: 2FA activado
        try {
          await notifyUserInApp(app.prisma, {
            userId,
            type: NotificationType.ACCOUNT_PASSWORD_CHANGED,
            title: "Autenticación en dos pasos activada",
            body: "Has activado la verificación en dos pasos (2FA) en tu cuenta.",
            data: {
              at: new Date().toISOString(),
              kind: "2FA_ENABLED",
            },
          });
        } catch (err) {
          req.log.error(
            { err },
            "Failed to create 2FA enabled notification (/auth/2fa/enable)"
          );
        }

        return { enabled: true };
      } catch (err: any) {
        if (err?.issues?.[0]?.message)
          return reply.badRequest(err.issues[0].message);
        req.log.error({ err }, "2fa/enable failed");
        return reply.internalServerError("No se pudo activar 2FA");
      }
    }
  );

  app.post(
    "/auth/2fa/disable",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      try {
        const body = z.object({ code: z.string().length(6) }).parse(req.body);
        const userId = (req as any).user.sub as string;
        const user = await app.prisma.user.findUnique({
          where: { id: userId },
        });
        if (!user?.twoFactorSecret)
          return reply.badRequest("2FA no está configurado");
        const valid = authenticator.check(body.code, user.twoFactorSecret);
        if (!valid) return reply.unauthorized("Código inválido");
        await app.prisma.user.update({
          where: { id: userId },
          data: { twoFactorEnabled: false, twoFactorSecret: null },
        });

        // 🔔 Notificación de seguridad: 2FA desactivado
        try {
          await notifyUserInApp(app.prisma, {
            userId,
            type: NotificationType.ACCOUNT_PASSWORD_CHANGED,
            title: "Autenticación en dos pasos desactivada",
            body: "Has desactivado la verificación en dos pasos (2FA) en tu cuenta.",
            data: {
              at: new Date().toISOString(),
              kind: "2FA_DISABLED",
            },
          });
        } catch (err) {
          req.log.error(
            { err },
            "Failed to create 2FA disabled notification (/auth/2fa/disable)"
          );
        }

        return { enabled: false };
      } catch (err: any) {
        if (err?.issues?.[0]?.message)
          return reply.badRequest(err.issues[0].message);
        req.log.error({ err }, "2fa/disable failed");
        return reply.internalServerError("No se pudo desactivar 2FA");
      }
    }
  );
}
