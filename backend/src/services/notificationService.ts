// src/services/notificationService.ts
import { EventEmitter } from "node:events";
import type {
  PrismaClient,
  Notification,
  NotificationPreference,
} from "@prisma/client";
import { NotificationType } from "@prisma/client";

export const notificationEvents = new EventEmitter();
// Por si hay muchos usuarios conectados
notificationEvents.setMaxListeners(1000);

export type NotifyInAppInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, any> | null;
};

// Clasificación por tipo (para usar preferencias)
const ORDER_TYPES = new Set<NotificationType>([
  NotificationType.ORDER_CREATED,
  NotificationType.ORDER_PAID,
  NotificationType.ORDER_SHIPPED,
  NotificationType.ORDER_DELIVERED,
  NotificationType.ORDER_CANCELLED,
  NotificationType.PAYMENT_FAILED,
]);

const SECURITY_TYPES = new Set<NotificationType>([
  NotificationType.ACCOUNT_PASSWORD_CHANGED,
  NotificationType.ACCOUNT_EMAIL_CHANGED,
  NotificationType.NEW_LOGIN,
]);

const PROMO_TYPES = new Set<NotificationType>([
  NotificationType.WISHLIST_ITEM_ON_SALE,
  NotificationType.WISHLIST_ITEM_BACK_IN_STOCK,
  NotificationType.PROMOTION_COUPON,
]);

function shouldSendInApp(
  type: NotificationType,
  prefs: NotificationPreference
): boolean {
  if (SECURITY_TYPES.has(type)) {
    // Seguridad SIEMPRE se manda in-app (modo serio)
    return true;
  }
  if (ORDER_TYPES.has(type)) {
    return prefs.inAppOrderUpdates;
  }
  if (PROMO_TYPES.has(type)) {
    return prefs.inAppPromotions;
  }
  // Por defecto, mandar
  return true;
}

function emitInAppNotification(notification: Notification) {
  notificationEvents.emit("in-app", {
    userId: notification.userId,
    notification,
  });
}

/**
 * Crea una notificación in-app respetando las preferencias del usuario.
 * Devuelve la notificación creada o null si se decidió no enviarla.
 */
export async function notifyUserInApp(
  prisma: PrismaClient,
  input: NotifyInAppInput
): Promise<Notification | null> {
  const { userId, type, title, body, data } = input;

  // Asegurar que el usuario existe (si quieres puedes quitar esto por performance)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) return null;

  // Obtener/crear preferencias
  const prefs = await prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  if (!shouldSendInApp(type, prefs)) {
    return null;
  }

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      channel: "IN_APP",
      title,
      body,
      data: data ?? undefined,
    },
  });

  emitInAppNotification(notification);
  return notification;
}

/**
 * Helper específico para órdenes creadas.
 * Ejemplo de uso desde rutas de órdenes.
 */
export async function notifyOrderCreated(
  prisma: PrismaClient,
  params: {
    userId: string;
    orderId: string;
    total: number;
    currency: string;
  }
) {
  const { userId, orderId, total, currency } = params;

  return notifyUserInApp(prisma, {
    userId,
    type: NotificationType.ORDER_CREATED,
    title: "Pedido creado",
    body: `Tu pedido ${orderId} ha sido creado correctamente por ${
      total / 100
    } ${currency.toUpperCase()}.`,
    data: {
      orderId,
      status: "PENDING",
      total,
      currency,
    },
  });
}

/**
 * Helper para cambios de estado de órdenes.
 */
export async function notifyOrderStatusChanged(
  prisma: PrismaClient,
  params: {
    userId: string;
    orderId: string;
    newStatus: string;
  }
) {
  const { userId, orderId, newStatus } = params;

  let type: NotificationType = NotificationType.ORDER_CREATED;
  let title = "Actualización de pedido";

  switch (newStatus) {
    case "PAID":
      type = NotificationType.ORDER_PAID;
      title = "Pago confirmado";
      break;
    case "FULFILLED":
      type = NotificationType.ORDER_SHIPPED;
      title = "Pedido enviado";
      break;
    case "CANCELLED":
      type = NotificationType.ORDER_CANCELLED;
      title = "Pedido cancelado";
      break;
    default:
      type = NotificationType.ORDER_CREATED;
      break;
  }

  return notifyUserInApp(prisma, {
    userId,
    type,
    title,
    body: `Tu pedido ${orderId} ahora está en estado: ${newStatus}.`,
    data: {
      orderId,
      status: newStatus,
    },
  });
}
