// src/routes/me.notifications.ts
import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { notificationEvents } from "../services/notificationService.js";

type NotificationPreferencesPayload = {
  emailOrderUpdates?: boolean;
  emailSecurityAlerts?: boolean;
  emailPromotions?: boolean;
  inAppOrderUpdates?: boolean;
  inAppSecurityAlerts?: boolean;
  inAppPromotions?: boolean;
};

export default async function meNotificationsRoutes(
  app: FastifyInstance,
  _opts: FastifyPluginOptions
) {
  const prisma = (app as any).prisma;

  const getUserId = (request: any, reply: any): string | undefined => {
    const user = request.user as { id: string } | undefined;
    if (!user?.id) {
      reply.unauthorized("Authentication required");
      return;
    }
    return user.id;
  };

  // GET /me/notifications?page=1&pageSize=20
  app.get("/", async (request, reply) => {
    const userId = getUserId(request, reply);
    if (!userId) return;

    const q = request.query as any;
    const page = Math.max(parseInt(q.page ?? "1", 10) || 1, 1);
    const pageSizeRaw = parseInt(q.pageSize ?? "20", 10) || 20;
    const pageSize = Math.min(Math.max(pageSizeRaw, 1), 100);
    const skip = (page - 1) * pageSize;

    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId, archived: false },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.notification.count({
        where: { userId, archived: false },
      }),
      prisma.notification.count({
        where: { userId, archived: false, isRead: false },
      }),
    ]);

    return reply.send({
      items,
      page,
      pageSize,
      total,
      unreadCount,
    });
  });

  // GET /me/notifications/unread-count
  app.get("/unread-count", async (request, reply) => {
    const userId = getUserId(request, reply);
    if (!userId) return;

    const count = await prisma.notification.count({
      where: { userId, archived: false, isRead: false },
    });

    return reply.send({ count });
  });

  // PATCH /me/notifications/:id/read
  app.patch("/:id/read", async (request, reply) => {
    const userId = getUserId(request, reply);
    if (!userId) return;

    const { id } = request.params as { id: string };

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return reply.notFound("Notification not found");
    }

    if (notification.isRead) {
      return reply.send(notification);
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return reply.send(updated);
  });

  // POST /me/notifications/mark-all-read
  app.post("/mark-all-read", async (request, reply) => {
    const userId = getUserId(request, reply);
    if (!userId) return;

    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false, archived: false },
      data: { isRead: true, readAt: new Date() },
    });

    return reply.send({ updated: result.count });
  });

  // POST /me/notifications/:id/archive
  app.post("/:id/archive", async (request, reply) => {
    const userId = getUserId(request, reply);
    if (!userId) return;

    const { id } = request.params as { id: string };

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return reply.notFound("Notification not found");
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { archived: true },
    });

    return reply.send(updated);
  });

  // GET /me/notifications/preferences
  app.get("/preferences", async (request, reply) => {
    const userId = getUserId(request, reply);
    if (!userId) return;

    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: { userId },
      });
    }

    return reply.send(prefs);
  });

  // PATCH /me/notifications/preferences
  app.patch("/preferences", async (request, reply) => {
    const userId = getUserId(request, reply);
    if (!userId) return;

    const body = (request.body || {}) as NotificationPreferencesPayload;

    const data: NotificationPreferencesPayload = {};
    const allowed: (keyof NotificationPreferencesPayload)[] = [
      "emailOrderUpdates",
      "emailSecurityAlerts",
      "emailPromotions",
      "inAppOrderUpdates",
      "inAppSecurityAlerts",
      "inAppPromotions",
    ];

    for (const key of allowed) {
      if (key in body) {
        (data as any)[key] = Boolean((body as any)[key]);
      }
    }

    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: { userId, ...(data as any) },
      });
    } else {
      prefs = await prisma.notificationPreference.update({
        where: { userId },
        data: data as any,
      });
    }

    return reply.send(prefs);
  });

  // SSE: GET /me/notifications/stream
  app.get("/stream", async (request, reply) => {
    const userId = getUserId(request, reply);
    if (!userId) return;

    // Enviar un bootstrap con las últimas notificaciones
    const latest = await prisma.notification.findMany({
      where: { userId, archived: false },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    reply.sse({
      event: "bootstrap",
      data: JSON.stringify({ items: latest }),
    });

    const handler = (payload: any) => {
      if (!payload || payload.userId !== userId) return;

      reply.sse({
        event: "notification",
        data: JSON.stringify(payload.notification),
      });
    };

    notificationEvents.on("in-app", handler);

    request.raw.on("close", () => {
      notificationEvents.off("in-app", handler);
    });
  });
}
