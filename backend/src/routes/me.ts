// src/routes/me.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { cloudinary } from "../lib/cloudinary";

export default async function meRoutes(app: FastifyInstance) {
  // ───────────────── Helpers ─────────────────
  function joinFullName(
    first?: string | null,
    middle?: string | null,
    last?: string | null
  ) {
    return [first, middle, last]
      .map((x) => (x || "").trim())
      .filter(Boolean)
      .join(" ")
      .trim() || null;
  }

  // ───────────────── GET /me ─────────────────
  app.get("/me", { preHandler: [app.authenticate] }, async (req) => {
    const userId = (req as any).user.sub as string;
    return app.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        // nombre legacy y campos nuevos estructurados
        name: true,
        firstName: true,
        middleName: true,
        lastName: true,
        // identidad y contacto
        ci: true,
        phone: true, // E.164
        role: true,
        // avatar
        avatarUrl: true,
        avatarPublicId: true,
        // seguridad
        twoFactorEnabled: true,
      },
    });
  });

  // ───────────────── PATCH /me ───────────────
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  const PatchMeSchema = z.object({
    // Campos estructurados (null para limpiar)
    firstName: z.string().trim().max(60, "Máx. 60 caracteres").nullable().optional(),
    middleName: z.string().trim().max(60, "Máx. 60 caracteres").nullable().optional(),
    lastName: z.string().trim().max(120, "Máx. 120 caracteres").nullable().optional(),
    ci: z.string().trim().max(64, "Máx. 64 caracteres").nullable().optional(),

    // Legacy: por compatibilidad si aún mandas 'name' desde otro sitio
    name: z.string().trim().max(180, "Máx. 180 caracteres").nullable().optional(),

    // Teléfono E.164 (normalizamos por si llegan espacios/guiones)
    phone: z.preprocess(
      (v) =>
        typeof v === "string"
          ? v.replace(/[^\d+]/g, "") // deja + y dígitos
          : v === null
          ? null
          : v,
      z
        .string()
        .regex(/^\+\d{6,15}$/, "Teléfono inválido (usa formato internacional)")
        .nullable()
        .optional()
    ),

    // Avatar
    avatarUrl: z
      .string()
      .url("URL de avatar inválida")
      .nullable()
      .optional()
      .refine(
        (v) =>
          v == null ||
          !cloudName ||
          v.startsWith(`https://res.cloudinary.com/${cloudName}/`),
        "avatarUrl debe ser de tu Cloudinary"
      ),
    avatarPublicId: z.string().trim().nullable().optional(),
  });

  app.patch("/me", { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req as any).user.sub as string;

    let body: z.infer<typeof PatchMeSchema>;
    try {
      body = PatchMeSchema.parse(req.body ?? {});
    } catch (e: any) {
      reply.code(400);
      return { message: e?.errors?.[0]?.message || "Datos inválidos" };
    }

    // Cargamos lo actual SOLO si necesitamos calcular el 'name' a partir de piezas
    let current:
      | {
          firstName: string | null;
          middleName: string | null;
          lastName: string | null;
          name: string | null;
        }
      | null = null;

    const piecesTouched =
      "firstName" in body || "middleName" in body || "lastName" in body;

    if (piecesTouched && !("name" in body)) {
      current = await app.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, middleName: true, lastName: true, name: true },
      });
    }

    const data: Record<string, any> = {};

    // Campos simples: actualiza solo si vienen en el body
    if ("firstName" in body) data.firstName = body.firstName;
    if ("middleName" in body) data.middleName = body.middleName;
    if ("lastName" in body) data.lastName = body.lastName;
    if ("ci" in body) data.ci = body.ci;
    if ("phone" in body) data.phone = body.phone;
    if ("avatarUrl" in body) data.avatarUrl = body.avatarUrl;
    if ("avatarPublicId" in body) data.avatarPublicId = body.avatarPublicId;

    // name (legado): si lo mandaron explícito, lo respetamos.
    if ("name" in body) {
      data.name = body.name;
    } else if (piecesTouched) {
      // Si tocaron piezas, recalculamos 'name' combinado
      const first = "firstName" in body ? body.firstName : current?.firstName;
      const middle = "middleName" in body ? body.middleName : current?.middleName;
      const last = "lastName" in body ? body.lastName : current?.lastName;
      data.name = joinFullName(first, middle, last);
    }

    if (Object.keys(data).length === 0) {
      // Sin cambios → devolver estado actual
      const currentState = await app.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          firstName: true,
          middleName: true,
          lastName: true,
          ci: true,
          phone: true,
          role: true,
          avatarUrl: true,
          avatarPublicId: true,
          twoFactorEnabled: true,
        },
      });
      return currentState;
    }

    const updated = await app.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        middleName: true,
        lastName: true,
        ci: true,
        phone: true,
        role: true,
        avatarUrl: true,
        avatarPublicId: true,
        twoFactorEnabled: true,
      },
    });

    return updated;
  });

  // ──────────────── DELETE /me/avatar ───────────────
  app.delete("/me/avatar", { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req as any).user.sub as string;

    const me = await app.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true, avatarPublicId: true },
    });

    if (!me) {
      reply.code(404);
      return { message: "Usuario no encontrado" };
    }

    if (me.avatarPublicId) {
      try {
        await cloudinary.uploader.destroy(me.avatarPublicId);
      } catch (err) {
        req.log.warn({ err }, "No se pudo eliminar avatar en Cloudinary");
      }
    }

    const updated = await app.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null, avatarPublicId: null },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        middleName: true,
        lastName: true,
        ci: true,
        phone: true,
        role: true,
        avatarUrl: true,
        avatarPublicId: true,
        twoFactorEnabled: true,
      },
    });

    return updated;
  });
}
