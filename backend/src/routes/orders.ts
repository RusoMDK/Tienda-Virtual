import type { FastifyInstance } from "fastify";
import { z } from "zod";

/** Schemas */
const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(999),
});

const createOrderSchema = z.object({
  currency: z.enum(["usd"]).default("usd"),
  items: z.array(itemSchema).min(1),

  // datos contacto/envío (snapshots)
  email: z.string().email(),
  recipientName: z.string().min(1),
  phone: z.string().min(5).max(32).optional(),
  addressLine1: z.string().min(3),
  addressLine2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().optional(),
  postalCode: z.string().min(2),
  country: z.string().min(2),

  // costos
  shippingTotal: z.number().int().min(0).default(0),
  notes: z.string().max(500).optional(),

  // descuento opcional
  couponCode: z.string().min(2).max(64).optional(),
});

const listQuery = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(10),
});

const setDefaultQuery = z.object({
  type: z.enum(["shipping", "billing"]),
});

/** Helpers */
function computePercent(bps: number, baseCents: number) {
  // bps = basis points: 1000 = 10.00%
  return Math.floor((baseCents * bps) / 10_000);
}

export default async function ordersRoutes(app: FastifyInstance) {
  // Crear orden desde carrito (AUTENTICADO)
  app.post("/orders", { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req as any).user.sub as string;
    const body = createOrderSchema.parse(req.body);

    // 1) Cargar productos
    const ids = body.items.map((i) => i.productId);
    const products = await app.prisma.product.findMany({
      where: { id: { in: ids }, active: true },
      select: {
        id: true, name: true, price: true, stock: true, currency: true, sku: true,
        images: { select: { url: true, isPrimary: true }, orderBy: [{ isPrimary: "desc" }, { position: "asc" }] },
        categoryId: true,
      },
    });
    const map = new Map(products.map((p) => [p.id, p]));

    // 2) Validaciones
    for (const it of body.items) {
      const p = map.get(it.productId);
      if (!p) return reply.badRequest(`Producto inválido: ${it.productId}`);
      if (p.currency !== body.currency) return reply.badRequest(`Moneda inconsistente para ${p.name}`);
      if (it.quantity > p.stock) return reply.badRequest(`Stock insuficiente en ${p.name}`);
    }

    // 3) Subtotal y líneas
    const lines = body.items.map((it) => {
      const p = map.get(it.productId)!;
      const unit = p.price;
      const lineSubtotal = unit * it.quantity;
      const imageUrl = p.images[0]?.url ?? null;
      return {
        productId: p.id,
        quantity: it.quantity,
        unitPrice: unit,
        currency: body.currency,
        taxAmount: 0,
        discountAmount: 0,
        lineTotal: lineSubtotal, // de momento sin tax/discount
        nameSnapshot: p.name,
        skuSnapshot: p.sku ?? null,
        imageUrlSnapshot: imageUrl,
        categoryId: p.categoryId ?? null,
      };
    });
    const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);

    // 4) Cupón (opcional)
    let couponAppliedId: string | null = null;
    let couponAmount = 0;
    if (body.couponCode) {
      const now = new Date();
      const coupon = await app.prisma.coupon.findUnique({ where: { code: body.couponCode } });
      if (!coupon || !coupon.active) return reply.badRequest("Cupón inválido o inactivo");
      if (coupon.startsAt && coupon.startsAt > now) return reply.badRequest("Cupón aún no válido");
      if (coupon.endsAt && coupon.endsAt < now) return reply.badRequest("Cupón expirado");
      if (coupon.minSubtotal && subtotal < coupon.minSubtotal) return reply.badRequest("No alcanzas el mínimo para el cupón");

      // Si aplica a categoría, solo descuenta sobre líneas que pertenecen a esa categoría (simple: exacta)
      const baseForDiscount = lines
        .filter((l) => !coupon.appliesToCategoryId || l.categoryId === coupon.appliesToCategoryId)
        .reduce((a, l) => a + l.lineTotal, 0);

      if (baseForDiscount <= 0) return reply.badRequest("El cupón no aplica a estos productos");

      if (coupon.type === "PERCENT") couponAmount = computePercent(coupon.value, baseForDiscount);
      else couponAmount = Math.min(coupon.value, baseForDiscount);

      couponAppliedId = coupon.id;
    }

    // 5) Impuestos (placeholder: 0)
    const taxTotal = 0;

    // 6) Total final
    const shippingTotal = body.shippingTotal;
    const discountTotal = couponAmount;
    const total = Math.max(0, subtotal - discountTotal + taxTotal + shippingTotal);

    // 7) Transacción: crear orden + líneas + cupones + descontar stock + ledger
    const created = await app.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          status: "PENDING",
          currency: body.currency,
          subtotal,
          discountTotal,
          taxTotal,
          shippingTotal,
          total,
          emailSnapshot: body.email,
          recipientName: body.recipientName,
          phone: body.phone,
          addressLine1: body.addressLine1,
          addressLine2: body.addressLine2,
          city: body.city,
          state: body.state,
          postalCode: body.postalCode,
          country: body.country,
          notes: body.notes,
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              currency: l.currency,
              taxAmount: l.taxAmount,
              discountAmount: l.discountAmount,
              lineTotal: l.lineTotal,
              nameSnapshot: l.nameSnapshot,
              skuSnapshot: l.skuSnapshot,
              imageUrlSnapshot: l.imageUrlSnapshot,
            })),
          },
          coupons: couponAppliedId
            ? { create: [{ couponId: couponAppliedId, amountApplied: discountTotal }] }
            : undefined,
        },
        select: { id: true },
      });

      // Descuento de stock + ledger
      for (const it of body.items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.quantity } },
        });
        await tx.stockLedger.create({
          data: {
            productId: it.productId,
            delta: -it.quantity,
            reason: "ORDER_PLACED",
            orderId: order.id,
            note: "Reserva por orden",
          },
        });
      }

      // Incrementa usos del cupón
      if (couponAppliedId) {
        await tx.coupon.update({
          where: { id: couponAppliedId },
          data: { uses: { increment: 1 } },
        });
      }

      return order;
    });

    reply.code(201);
    return { orderId: created.id, subtotal, discountTotal, taxTotal, shippingTotal, total, currency: body.currency };
  });

  // Cancelar orden PENDING → repone stock y escribe ledger (AUTENTICADO)
  app.post("/orders/:id/cancel", { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req as any).user.sub as string;
    const { id } = req.params as { id: string };

    const order = await app.prisma.order.findFirst({
      where: { id, userId },
      include: { items: true, payment: true },
    });
    if (!order) return reply.notFound("Order not found");
    if (order.status !== "PENDING") return reply.badRequest("Solo se pueden cancelar órdenes pendientes");

    await app.prisma.$transaction(async (tx) => {
      // Restock
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
            note: "Cancelación de orden",
          },
        });
      }

      // Estado orden + pago (si existía)
      await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
      if (order.payment) {
        await tx.payment.update({
          where: { orderId: order.id },
          data: { status: "cancelled" },
        });
      }
    });

    return { ok: true };
  });

  // Mis órdenes (paginado)
  app.get("/orders", { preHandler: [app.authenticate] }, async (req) => {
    const userId = (req as any).user.sub as string;
    const q = listQuery.parse(req.query);

    const [total, items] = await app.prisma.$transaction([
      app.prisma.order.count({ where: { userId } }),
      app.prisma.order.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true, status: true, subtotal: true, discountTotal: true, taxTotal: true, shippingTotal: true, total: true, currency: true, createdAt: true,
          items: { select: { quantity: true, unitPrice: true, nameSnapshot: true, imageUrlSnapshot: true } },
          payment: { select: { status: true, provider: true } },
        },
      }),
    ]);

    return { items, page: q.page, pageSize: q.pageSize, total, totalPages: Math.max(1, Math.ceil(total / q.pageSize)) };
    });

  // Detalle
  app.get("/orders/:id", { preHandler: [app.authenticate] }, async (req, reply) => {
    const userId = (req as any).user.sub as string;
    const { id } = req.params as { id: string };
    const order = await app.prisma.order.findFirst({
      where: { id, userId },
      include: {
        items: { select: { quantity: true, unitPrice: true, lineTotal: true, nameSnapshot: true, imageUrlSnapshot: true } },
        payment: { select: { status: true, provider: true, amount: true, currency: true } },
        coupons: { include: { coupon: true } },
        shipments: true,
      },
    });
    if (!order) return reply.notFound("Order not found");
    return order;
  });
}
