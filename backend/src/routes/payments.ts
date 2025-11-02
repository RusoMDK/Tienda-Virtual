// src/routes/payments.ts
import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import rawBody from "fastify-raw-body";
import { env } from "../env";

// -- Helpers -----------------------------

// Mapea items de la orden a line_items de Stripe Checkout
function toLineItems(order: any) {
  return order.items.map((it: any) => ({
    quantity: it.quantity,
    price_data: {
      currency: order.currency,
      unit_amount: it.unitPrice,
      product_data: { name: it.nameSnapshot ?? it.product?.name ?? "Producto" },
    },
  }));
}

// Restaura stock + ledger y cancela la orden (idempotente)
async function restoreStockAndCancel(app: FastifyInstance, orderId: string) {
  const order = await app.prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return { ok: false, reason: "order_not_found" };
  if (order.status !== "PENDING") return { ok: true, reason: "already_finalized" };

  await app.prisma.$transaction(async (tx) => {
    for (const it of order.items) {
      await tx.product.update({
        where: { id: it.productId },
        data: { stock: { increment: it.quantity } },
      });
      await tx.stockLedger.create({
        data: {
          productId: it.productId,
          delta: it.quantity,
          reason: "ORDER_CANCELLED_RESTORE",
          orderId: order.id,
          note: "Cancelación/expiración pago",
        },
      });
    }
    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
    await tx.payment.updateMany({
      where: { orderId },
      data: { status: "cancelled" },
    });
  });

  return { ok: true, reason: "cancelled" };
}

// ---------------------------------------

export default async function paymentsRoutes(app: FastifyInstance) {
  // Si no hay STRIPE_SECRET_KEY, deshabilita pagos
  if (!env.STRIPE_SECRET_KEY) {
    app.log.warn("STRIPE_SECRET_KEY not set. Payments disabled.");
    app.post("/payments/stripe/checkout", async () => ({ error: "Stripe disabled" }));
    return;
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: "2024-06-20" });

  // 1) Crear sesión de Checkout para una orden existente
  app.post("/payments/stripe/checkout", { preHandler: [app.authenticate] }, async (req, reply) => {
    const { orderId } = (req.body as any) || {};
    if (!orderId) return reply.badRequest("orderId required");

    const order = await app.prisma.order.findFirst({
      where: { id: orderId, userId: (req as any).user.sub },
      include: {
        items: {
          select: {
            productId: true, quantity: true, unitPrice: true,
            nameSnapshot: true,
            product: { select: { name: true } },
          },
        },
        payment: true,
      },
    });
    if (!order) return reply.notFound("Order not found");
    if (order.status !== "PENDING") return reply.badRequest("Order is not pending");
    if (order.total <= 0) return reply.badRequest("Order total must be > 0");
    if (order.payment && ["paid", "refunded"].includes(order.payment.status)) {
      return reply.badRequest("Order already has a finalized payment");
    }

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: toLineItems(order),
        success_url: `${env.FRONTEND_ORIGIN}/checkout/success?order=${order.id}`,
        cancel_url: `${env.FRONTEND_ORIGIN}/checkout/cancel?order=${order.id}`,
        customer_email: order.emailSnapshot, // prefill
        allow_promotion_codes: true,
        billing_address_collection: "auto",
        metadata: { orderId: order.id },
        payment_intent_data: { metadata: { orderId: order.id } },
      },
      { idempotencyKey: `checkout_${order.id}` }
    );

    // ⬇️ PATCH: sincroniza amount/currency en Payment
    await app.prisma.payment.upsert({
      where: { orderId: order.id },
      update: {
        providerSessionId: session.id,
        status: "created",
        amount: order.total,
        currency: order.currency,
      },
      create: {
        orderId: order.id,
        provider: "stripe",
        providerSessionId: session.id,
        status: "created",
        amount: order.total,
        currency: order.currency,
      },
    });

    return { url: session.url };
  });

  // 1.b) Cancelación explícita desde el cliente (tras volver del cancel_url)
  app.post("/payments/cancel", { preHandler: [app.authenticate] }, async (req, reply) => {
    const { orderId } = (req.body as any) || {};
    if (!orderId) return reply.badRequest("orderId required");

    // Asegura propiedad
    const belongs = await app.prisma.order.findFirst({
      where: { id: orderId, userId: (req as any).user.sub },
      select: { id: true },
    });
    if (!belongs) return reply.notFound("Order not found");

    const res = await restoreStockAndCancel(app, orderId);
    if (!res.ok && res.reason === "order_not_found") return reply.notFound();
    return { ok: true, status: "CANCELLED" };
  });

  // 2) Webhook de Stripe (requiere rawBody para verificar firma)
  await app.register(rawBody, { field: "rawBody", global: false, runFirst: true });

  app.post("/webhooks/stripe", { config: { rawBody: true } } as any, async (req, reply) => {
    try {
      if (!env.STRIPE_WEBHOOK_SECRET) return reply.forbidden();

      const sig = req.headers["stripe-signature"] as string;
      const event = stripe.webhooks.constructEvent(
        (req as any).rawBody,
        sig,
        env.STRIPE_WEBHOOK_SECRET
      );

      switch (event.type) {
        // Pago completado → marcar PAID y enriquecer Payment
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const orderId = session.metadata?.orderId;
          if (orderId) {
            await app.prisma.$transaction(async (tx) => {
              const order = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
              if (!order) return;

              // si ya está PAID, no hacemos nada (idempotente)
              if (order.status !== "PAID") {
                await tx.order.update({ where: { id: orderId }, data: { status: "PAID" } });
              }

              // Intentamos enriquecer con datos del PaymentIntent/charge
              let receiptUrl: string | undefined;
              let customerId: string | undefined;
              try {
                if (session.payment_intent) {
                  const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string, { expand: ["latest_charge"] });
                  const latest = pi.latest_charge as any;
                  receiptUrl = latest?.receipt_url ?? undefined;
                  customerId = typeof pi.customer === "string" ? pi.customer : (pi.customer as any)?.id;
                }
              } catch (e) {
                app.log.warn({ e }, "Could not enrich payment with receipt_url/customer");
              }

              await tx.payment.updateMany({
                where: { providerSessionId: session.id },
                data: {
                  status: "paid",
                  providerPaymentIntentId: session.payment_intent as string | null,
                  providerCustomerId: customerId,
                  capturedAt: new Date(),
                  receiptUrl: receiptUrl,
                },
              });
            });

            app.log.info({ orderId }, "Order marked as PAID");
          }
          break;
        }

        // Sesión expirada → restaurar stock y cancelar
        case "checkout.session.expired": {
          const session = event.data.object as Stripe.Checkout.Session;
          const orderId = session.metadata?.orderId;
          if (orderId) {
            const res = await restoreStockAndCancel(app, orderId);
            app.log.info({ orderId, res }, "Order expired → stock restored & cancelled");
          }
          break;
        }

        // Pago async falló → restaurar stock y cancelar
        case "checkout.session.async_payment_failed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const orderId = session.metadata?.orderId;
          if (orderId) {
            const res = await restoreStockAndCancel(app, orderId);
            app.log.info({ orderId, res }, "Async payment failed → stock restored & cancelled");
          }
          break;
        }

        // PaymentIntent falló (por si llega sin el completed/expired)
        case "payment_intent.payment_failed": {
          const pi = event.data.object as Stripe.PaymentIntent;
          const orderId = (pi.metadata as any)?.orderId;
          const code = pi.last_payment_error?.code ?? null;
          const message = pi.last_payment_error?.message ?? null;
          if (orderId) {
            await app.prisma.payment.updateMany({
              where: { orderId },
              data: {
                status: "failed",
                errorCode: code ?? undefined,
                errorMessage: message ?? undefined,
              },
            });
            const res = await restoreStockAndCancel(app, orderId);
            app.log.info({ orderId, res, code, message }, "PI failed → stock restored & cancelled");
          } else {
            app.log.warn({ piId: pi.id }, "payment_intent.payment_failed without orderId metadata");
          }
          break;
        }

        default:
          app.log.debug({ type: event.type }, "Unhandled Stripe event");
      }

      return reply.code(200).send({ received: true });
    } catch (err) {
      app.log.error({ err }, "Stripe webhook error");
      return reply.code(400).send("Webhook Error");
    }
  });
}
