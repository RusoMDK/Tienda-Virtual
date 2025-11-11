import type { FastifyInstance } from "fastify";
import { z } from "zod";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { NotificationType } from "@prisma/client";
import { notifyUserInApp } from "../services/notificationService.js";

export default async function meTwoFaRoutes(app: FastifyInstance) {
  const ISSUER = process.env.APP_NAME || "Tienda";

  // GET /api/me/2fa/status
  app.get("/me/2fa/status", { preHandler: [app.authenticate] }, async (req) => {
    const userId = (req as any).user.sub as string;
    const me = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorEnabled: true, twoFactorSecret: true, email: true },
    });
    return {
      enabled: !!me?.twoFactorEnabled,
      method: me?.twoFactorEnabled ? "totp" : null,
      recoveryCodesRemaining: 0,
    };
  });

  // POST /api/me/2fa/start
  app.post(
    "/me/2fa/start",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req as any).user.sub as string;
      const me = await app.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, twoFactorEnabled: true },
      });
      if (!me) return reply.notFound("Usuario no encontrado");
      if (me.twoFactorEnabled) return reply.badRequest("2FA ya está activo");

      const secret = speakeasy.generateSecret({
        length: 20,
        name: `${ISSUER}:${me.email}`,
        issuer: ISSUER,
      });

      await app.prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: secret.base32, twoFactorEnabled: false },
      });

      let qr: string | undefined;
      try {
        if (secret.otpauth_url) qr = await QRCode.toDataURL(secret.otpauth_url);
      } catch {}

      return {
        secret: secret.base32,
        otpauthUrl: secret.otpauth_url,
        qr,
      };
    }
  );

  // POST /api/me/2fa/verify
  const verifySchema = z.object({ code: z.string().regex(/^\d{6}$/) });
  app.post(
    "/me/2fa/verify",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req as any).user.sub as string;
      const { code } = verifySchema.parse(req.body || {});
      const me = await app.prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorSecret: true },
      });
      if (!me?.twoFactorSecret)
        return reply.badRequest("No hay secreto activo");

      const ok = speakeasy.totp.verify({
        secret: me.twoFactorSecret,
        encoding: "base32",
        token: code,
        window: 1,
      });
      if (!ok) return reply.badRequest("Código inválido");

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
        req.log?.error?.(
          { err },
          "Failed to create 2FA enabled notification (/me/2fa/verify)"
        );
      }

      const codes = Array.from({ length: 10 }, () =>
        Math.random().toString(36).slice(2, 10).toUpperCase()
      );
      return { recoveryCodes: codes };
    }
  );

  // POST /api/me/2fa/disable
  app.post(
    "/me/2fa/disable",
    { preHandler: [app.authenticate] },
    async (req) => {
      const userId = (req as any).user.sub as string;
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
        req.log?.error?.(
          { err },
          "Failed to create 2FA disabled notification (/me/2fa/disable)"
        );
      }

      return { ok: true };
    }
  );

  // POST /api/me/2fa/recovery-codes
  app.post(
    "/me/2fa/recovery-codes",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req as any).user.sub as string;
      const me = await app.prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true },
      });
      if (!me?.twoFactorEnabled) return reply.badRequest("Activa 2FA primero");

      const codes = Array.from({ length: 10 }, () =>
        Math.random().toString(36).slice(2, 10).toUpperCase()
      );
      return { recoveryCodes: codes };
    }
  );
}
