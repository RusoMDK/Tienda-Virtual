// src/routes/support.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  Role,
  MsgKind,
  ConvStatus,
  Channel,
  ConvPriority,
  NotificationType,
} from "@prisma/client";
import { SLA, addBusinessMinutes } from "../config/support";
import { notifyUserInApp } from "../services/notificationService.js";

/**
 * Registrar con:
 *   await app.register(supportRoutes, { prefix: "/support" });
 */
export default async function supportRoutes(app: FastifyInstance) {
  type Sink = (payload: any) => void;
  const staffSinks = new Set<Sink>();
  const convSinks = new Map<string, Set<Sink>>();

  function publishToStaff(event: any) {
    for (const send of staffSinks) {
      try {
        send(event);
      } catch {}
    }
  }
  function publishToConv(conversationId: string, event: any) {
    const set = convSinks.get(conversationId);
    if (!set) return;
    for (const send of set) {
      try {
        send(event);
      } catch {}
    }
  }

  async function verifyTokenFromQuery(req: any) {
    const token = (req.query?.token || "") as string;
    if (!token) throw new Error("token");
    return app.jwt.verify(token, { issuer: "tienda-api", audience: "web" });
  }

  // ... (todo lo anterior se mantiene IGUAL hasta la ruta de mensajes)
  // Para no hacer esto eterno, continúo desde la parte relevante completa:

  // ─────────────────────────────────────────────────────────
  // Mi última conversación
  // ─────────────────────────────────────────────────────────
  app.get(
    "/my/latest",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const me = req.user as { sub: string } | undefined;
      if (!me) return reply.unauthorized();

      const conversation = await app.prisma.conversation.findFirst({
        where: { userId: me.sub },
        orderBy: { updatedAt: "desc" },
      });

      if (!conversation) return { conversation: null, messages: [] };

      const messages = await app.prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, name: true, email: true, role: true } },
          attachments: {
            select: { id: true, url: true, mime: true, size: true },
          },
        },
      });

      const mapped = messages.map((m) => ({
        ...m,
        attachments: (m.attachments || []).map((a) => ({
          id: a.id,
          url: a.url,
          mime: a.mime,
          bytes: a.size ?? 0,
        })),
      }));

      return { conversation, messages: mapped };
    }
  );

  // ─────────────────────────────────────────────────────────
  // Crear conversación (usuario autenticado)
  // ─────────────────────────────────────────────────────────
  app.post(
    "/conversations",
    {
      preHandler: [app.authenticate],
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const me = req.user as { sub: string; role?: Role } | undefined;
      if (!me) return reply.unauthorized();

      const Body = z.object({
        subject: z.string().trim().min(1).max(160).optional(),
        firstMessage: z.string().trim().min(1).max(4000),
        priority: z.nativeEnum(ConvPriority).optional(),
      });
      const body = Body.parse(req.body);

      const now = new Date();
      const firstResponseSlaAt = addBusinessMinutes(now, SLA.firstResponseMins);
      const resolutionSlaAt = addBusinessMinutes(now, SLA.resolutionMins);

      try {
        const conv = await app.prisma.conversation.create({
          data: {
            userId: me.sub,
            subject: body.subject ?? null,
            channel: Channel.WEB,
            status: ConvStatus.OPEN,
            priority: body.priority ?? ConvPriority.NORMAL,
            lastCustomerMessageAt: now,
            lastMessageAt: now,
            firstResponseSlaAt,
            resolutionSlaAt,
            messages: {
              create: {
                authorId: me.sub,
                kind: MsgKind.USER,
                text: body.firstMessage,
                createdAt: now,
              },
            },
          },
        });

        const msg = await app.prisma.message.findFirst({
          where: { conversationId: conv.id },
          orderBy: { createdAt: "asc" },
          include: {
            attachments: {
              select: { id: true, url: true, mime: true, size: true },
            },
          },
        });

        publishToStaff({
          type: "conversation.created",
          conversation: {
            id: conv.id,
            userId: conv.userId,
            subject: conv.subject,
            status: conv.status,
            assignedToId: conv.assignedToId ?? null,
            channel: conv.channel,
            priority: conv.priority,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            lastMessageAt: conv.lastMessageAt ?? now,
            lastCustomerMessageAt: conv.lastCustomerMessageAt ?? now,
            lastAgentMessageAt: conv.lastAgentMessageAt ?? null,
            firstResponseSlaAt: conv.firstResponseSlaAt,
            resolutionSlaAt: conv.resolutionSlaAt,
          },
        });

        if (msg) {
          const payload = {
            type: "message.created",
            conversationId: conv.id,
            message: {
              id: msg.id,
              conversationId: msg.conversationId,
              authorId: msg.authorId,
              kind: msg.kind,
              text: msg.text,
              createdAt: msg.createdAt,
              attachments: (msg.attachments || []).map((a) => ({
                id: a.id,
                url: a.url,
                mime: a.mime,
                bytes: a.size ?? 0,
              })),
            },
          };
          publishToStaff(payload);
          publishToConv(conv.id, payload);
        }

        const userLite = await app.prisma.user.findUnique({
          where: { id: me.sub },
          select: { id: true, name: true, email: true },
        });

        return {
          ...conv,
          user: userLite,
          assignedTo: null,
        };
      } catch (e) {
        app.log.error(e, "Error creando conversación");
        return reply.internalServerError("No se pudo crear la conversación");
      }
    }
  );

  // (mantengo intactas las rutas de listar, get conversation, etc…)

  // ─────────────────────────────────────────────────────────
  // Enviar mensaje (dueño o staff) con adjuntos
  // ─────────────────────────────────────────────────────────
  const AttachmentInput = z.object({
    url: z.string().url(),
    mime: z.string().min(1).optional().default("application/octet-stream"),
    size: z.number().int().nonnegative().optional().default(0),
  });

  app.post(
    "/conversations/:id/messages",
    {
      preHandler: [app.authenticate],
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
    },
    async (req, reply) => {
      const Params = z.object({ id: z.string().cuid() });
      const Body = z
        .object({
          text: z.string().trim().max(4000).optional().default(""),
          kind: z.nativeEnum(MsgKind).default(MsgKind.USER),
          attachments: z.array(AttachmentInput).optional().default([]),
        })
        .refine(
          (b) =>
            (b.text && b.text.trim().length > 0) ||
            (b.attachments?.length ?? 0) > 0,
          { message: "Debes enviar texto o al menos un adjunto" }
        );

      const { id } = Params.parse(req.params);
      const body = Body.parse(req.body);

      const conv = await app.prisma.conversation.findUnique({ where: { id } });
      if (!conv) return reply.notFound("No existe");

      const me = req.user as { sub: string; role?: Role };
      const isStaff = me.role === Role.SUPPORT || me.role === Role.ADMIN;
      const isOwner = conv.userId && conv.userId === me.sub;
      if (!isStaff && !isOwner) return reply.forbidden("Sin permisos");

      let kind = body.kind;
      if (!isStaff) kind = MsgKind.USER;
      if (kind === MsgKind.SYSTEM) return reply.badRequest("SYSTEM reservado");

      const now = new Date();

      const { msg, atts } = await app.prisma.$transaction(async (tx) => {
        const created = await tx.message.create({
          data: {
            conversationId: id,
            authorId: me.sub,
            kind,
            text: body.text || "",
            createdAt: now,
          },
        });

        let createdAtts: Array<{
          id: string;
          url: string;
          mime: string;
          size: number;
        }> = [];
        if (body.attachments?.length) {
          const rows = body.attachments.map((a) => ({
            conversationId: id,
            messageId: created.id,
            url: a.url,
            mime: a.mime ?? "application/octet-stream",
            size: a.size ?? 0,
          }));
          await tx.attachment.createMany({ data: rows });
          createdAtts = await tx.attachment.findMany({
            where: { messageId: created.id },
            select: { id: true, url: true, mime: true, size: true },
          });
        }

        if (kind === MsgKind.AGENT || kind === MsgKind.INTERNAL) {
          const setFirstResponse =
            !conv.firstResponseAt && kind === MsgKind.AGENT;
          await tx.conversation.update({
            where: { id },
            data: {
              lastAgentMessageAt: now,
              lastMessageAt: now,
              ...(setFirstResponse ? { firstResponseAt: now } : null),
            },
          });
        } else {
          await tx.conversation.update({
            where: { id },
            data: { lastCustomerMessageAt: now, lastMessageAt: now },
          });
        }

        return { msg: created, atts: createdAtts };
      });

      // 🔔 Notificación: respuesta de soporte al cliente
      if (kind === MsgKind.AGENT && conv.userId) {
        try {
          await notifyUserInApp(app.prisma, {
            userId: conv.userId,
            type: NotificationType.SUPPORT_MESSAGE_REPLY,
            title: "Nueva respuesta de soporte",
            body:
              body.text && body.text.trim().length > 0
                ? body.text.slice(0, 200)
                : "Tienes una nueva respuesta de soporte.",
            data: {
              conversationId: conv.id,
              messageId: msg.id,
            },
          });
        } catch (err) {
          req.log.error(
            { err, conversationId: conv.id },
            "Failed to create SUPPORT_MESSAGE_REPLY notification"
          );
        }
      }

      if (
        kind === MsgKind.USER &&
        (conv.status === ConvStatus.RESOLVED ||
          conv.status === ConvStatus.CLOSED)
      ) {
        const updated = await app.prisma.conversation.update({
          where: { id },
          data: {
            status: ConvStatus.OPEN,
            resolvedAt: null,
            resolutionSlaAt: addBusinessMinutes(now, SLA.resolutionMins),
          },
        });
        const statusEvt = {
          type: "conversation.status",
          conversationId: id,
          status: updated.status,
        };
        publishToStaff(statusEvt);
        publishToConv(id, statusEvt);
      }

      const payload = {
        type: "message.created",
        conversationId: id,
        message: {
          id: msg.id,
          conversationId: msg.conversationId,
          authorId: msg.authorId,
          kind: msg.kind,
          text: msg.text,
          createdAt: msg.createdAt,
          attachments: atts.map((a) => ({
            id: a.id,
            url: a.url,
            mime: a.mime,
            bytes: a.size ?? 0,
          })),
        },
      };
      publishToStaff(payload);
      publishToConv(id, payload);

      return payload.message;
    }
  );

  // ─────────────────────────────────────────────────────────
  // Marcar visto
  // ─────────────────────────────────────────────────────────
  app.post(
    "/conversations/:id/seen",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const Params = z.object({ id: z.string().cuid() });
      const { id } = Params.parse(req.params);

      const conv = await app.prisma.conversation.findUnique({
        where: { id },
        select: { id: true, userId: true },
      });
      if (!conv) return reply.notFound("No existe");

      const me = req.user as { sub: string; role?: Role };
      const isStaff = me.role === Role.SUPPORT || me.role === Role.ADMIN;
      const isOwner = conv.userId && conv.userId === me.sub;
      if (!isStaff && !isOwner) return reply.forbidden("Sin permisos");

      const at = new Date();
      const updated = await app.prisma.conversation.update({
        where: { id },
        data: isStaff
          ? { lastSeenByStaffAt: at }
          : { lastSeenByCustomerAt: at },
        select: {
          id: true,
          lastSeenByCustomerAt: true,
          lastSeenByStaffAt: true,
        },
      });

      const payload = {
        type: "conversation.seen",
        conversationId: id,
        who: isStaff ? "STAFF" : "CUSTOMER",
        at,
      };
      publishToStaff(payload);
      publishToConv(id, payload);

      return { ok: true, ...updated };
    }
  );

  // ─────────────────────────────────────────────────────────
  // Asignar agente
  // ─────────────────────────────────────────────────────────
  app.post(
    "/conversations/:id/assign",
    { preHandler: [app.requireStaff] },
    async (req, reply) => {
      const Params = z.object({ id: z.string().cuid() });
      const Body = z.object({ agentId: z.string().cuid().nullable() });
      const { id } = Params.parse(req.params);
      const { agentId } = Body.parse(req.body);

      if (agentId) {
        const agent = await app.prisma.user.findUnique({
          where: { id: agentId },
          select: { id: true, role: true },
        });
        if (
          !agent ||
          (agent.role !== Role.SUPPORT && agent.role !== Role.ADMIN)
        ) {
          return reply.badRequest("Agente inválido");
        }
      }

      const updated = await app.prisma.conversation.update({
        where: { id },
        data: { assignedToId: agentId },
      });

      const payload = {
        type: "conversation.assigned",
        conversationId: id,
        assignedToId: agentId,
      };
      publishToStaff(payload);
      publishToConv(id, payload);

      return updated;
    }
  );

  // ─────────────────────────────────────────────────────────
  // Cambiar estado (marca resolvedAt cuando corresponde)
  // ─────────────────────────────────────────────────────────
  app.post(
    "/conversations/:id/status",
    { preHandler: [app.requireStaff] },
    async (req) => {
      const Params = z.object({ id: z.string().cuid() });
      const Body = z.object({ status: z.nativeEnum(ConvStatus) });
      const { id } = Params.parse(req.params);
      const { status } = Body.parse(req.body);

      const updated = await app.prisma.conversation.update({
        where: { id },
        data: {
          status,
          resolvedAt: status === ConvStatus.RESOLVED ? new Date() : null,
        },
      });

      const payload = {
        type: "conversation.status",
        conversationId: id,
        status,
      };
      publishToStaff(payload);
      publishToConv(id, payload);

      return updated;
    }
  );

  // ─────────────────────────────────────────────────────────
  // Cambiar prioridad
  // ─────────────────────────────────────────────────────────
  app.post(
    "/conversations/:id/priority",
    { preHandler: [app.requireStaff] },
    async (req) => {
      const Params = z.object({ id: z.string().cuid() });
      const Body = z.object({ priority: z.nativeEnum(ConvPriority) });
      const { id } = Params.parse(req.params);
      const { priority } = Body.parse(req.body);

      const updated = await app.prisma.conversation.update({
        where: { id },
        data: { priority },
      });

      const payload = {
        type: "conversation.priority",
        conversationId: id,
        priority,
      };
      publishToStaff(payload);
      publishToConv(id, payload);

      return updated;
    }
  );

  // ─────────────────────────────────────────────────────────
  // Tags: añadir / quitar
  // ─────────────────────────────────────────────────────────
  app.post(
    "/conversations/:id/tags",
    { preHandler: [app.requireStaff] },
    async (req) => {
      const Params = z.object({ id: z.string().cuid() });
      const Body = z.object({
        add: z.array(z.string().trim().min(1)).optional().default([]),
        remove: z.array(z.string().trim().min(1)).optional().default([]),
      });
      const { id } = Params.parse(req.params);
      const { add, remove } = Body.parse(req.body);

      await app.prisma.$transaction(async (tx) => {
        if (add.length) {
          for (const t of add) {
            try {
              await tx.conversationTag.create({
                data: { conversationId: id, tag: t },
              });
            } catch {}
          }
        }
        if (remove.length) {
          await tx.conversationTag.deleteMany({
            where: { conversationId: id, tag: { in: remove } },
          });
        }
      });

      const tags = await app.prisma.conversationTag.findMany({
        where: { conversationId: id },
        orderBy: { tag: "asc" },
      });

      const payload = {
        type: "conversation.tags",
        conversationId: id,
        tags: tags.map((t) => t.tag),
      };
      publishToStaff(payload);
      publishToConv(id, payload);

      return { ok: true, tags };
    }
  );

  app.get("/tags", { preHandler: [app.requireStaff] }, async () => {
    const rows = await app.prisma.conversationTag.groupBy({
      by: ["tag"],
      _count: { tag: true },
      orderBy: { _count: { tag: "desc" } },
      take: 100,
    });
    return rows.map((r) => ({ tag: r.tag, count: r._count.tag }));
  });

  // ─────────────────────────────────────────────────────────
  // STREAM staff
  // ─────────────────────────────────────────────────────────
  app.get("/stream", async (req, reply) => {
    try {
      const decoded: any = await verifyTokenFromQuery(req);
      if (decoded?.role !== "ADMIN" && decoded?.role !== "SUPPORT") {
        return reply.forbidden("Staff only");
      }

      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");

      const send: Sink = (payload) => {
        // @ts-ignore
        reply.sse({ data: JSON.stringify(payload) });
      };

      // ready
      // @ts-ignore
      reply.sse({ data: JSON.stringify({ type: "ready" }) });

      const ping = setInterval(() => {
        // @ts-ignore
        reply.sse({ event: "ping", data: "💓" });
      }, 25_000);

      staffSinks.add(send);
      req.raw.on("close", () => {
        clearInterval(ping);
        staffSinks.delete(send);
      });
    } catch {
      return reply.unauthorized();
    }
  });

  // ─────────────────────────────────────────────────────────
  // STREAM por conversación
  // ─────────────────────────────────────────────────────────
  app.get("/conversations/:id/stream", async (req, reply) => {
    const Params = z.object({ id: z.string().cuid() });
    const { id } = Params.parse(req.params);

    try {
      const decoded: any = await verifyTokenFromQuery(req);
      const conv = await app.prisma.conversation.findUnique({
        where: { id },
        select: { userId: true },
      });
      if (!conv) return reply.notFound();

      const role = decoded?.role as Role | undefined;
      const sub = decoded?.sub as string | undefined;
      const isStaff = role === Role.SUPPORT || role === Role.ADMIN;
      const isOwner = conv.userId && conv.userId === sub;
      if (!isStaff && !isOwner) return reply.forbidden("Sin permisos");

      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");

      const send: Sink = (payload) => {
        // @ts-ignore
        reply.sse({ data: JSON.stringify(payload) });
      };

      // ready
      // @ts-ignore
      reply.sse({ data: JSON.stringify({ type: "ready" }) });

      const ping = setInterval(() => {
        // @ts-ignore
        reply.sse({ event: "ping", data: "💓" });
      }, 25_000);

      let set = convSinks.get(id);
      if (!set) {
        set = new Set<Sink>();
        convSinks.set(id, set);
      }
      set.add(send);

      req.raw.on("close", () => {
        clearInterval(ping);
        set?.delete(send);
        if (set && set.size === 0) convSinks.delete(id);
      });
    } catch {
      return reply.unauthorized();
    }
  });
}
