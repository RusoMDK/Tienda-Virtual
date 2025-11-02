// src/routes/me.orders.ts
import type { FastifyInstance } from "fastify";

export default async function meOrdersRoutes(app: FastifyInstance) {
  // ─────────────── GET /me/orders (lista simple) ───────────────
  app.get("/me/orders", { preHandler: [app.authenticate] }, async (req) => {
    const userId = (req as any).user.sub as string;

    const orders = await app.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        total: true,
        currency: true,
        createdAt: true,
      },
    });

    // Devuelve exactamente MyOrder[] (sin items ni direcciones aquí)
    return orders.map((o) => ({
      id: o.id,
      status: o.status,
      total: o.total,
      currency: (o.currency || "USD").toUpperCase(),
      createdAt: o.createdAt, // Fastify serializa Date → ISO string
      // items y shippingAddress NO se incluyen en la lista
    }));
  });

  // ───────────── GET /me/orders/:id (detalle) ─────────────
  app.get(
    "/me/orders/:id",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const userId = (req as any).user.sub as string;
      const orderId = (req.params as any).id as string;

      const o = await app.prisma.order.findFirst({
        where: { id: orderId, userId },
        select: {
          id: true,
          status: true,
          total: true,
          currency: true,
          createdAt: true,

          // Ítems
          items: {
            select: {
              productId: true,
              quantity: true,
              unitPrice: true,
              nameSnapshot: true,
              skuSnapshot: true,
              product: { select: { slug: true, name: true } }, // opcional
            },
          },

          // Snapshots simples en Order
          recipientName: true,
          phone: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,

          // Si guardaste address como JSON (preferente)
          shippingAddressJson: true,
        },
      });

      if (!o) {
        reply.code(404);
        return { message: "Pedido no encontrado" };
      }

      const currency = (o.currency || "USD").toUpperCase();

      const items = o.items.map((it) => ({
        productId: it.productId,
        slug: it.product?.slug ?? undefined,
        name:
          it.nameSnapshot ||
          it.product?.name ||
          `Producto${it.skuSnapshot ? ` ${it.skuSnapshot}` : ""}`,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      }));

      // Preferir shippingAddressJson si existe; si no, construir con los snapshots sueltos
      const shippingAddress =
        (o as any).shippingAddressJson ??
        {
          recipientName: o.recipientName,
          phone: o.phone,
          addressLine1: o.addressLine1,
          addressLine2: o.addressLine2,
          city: o.city,
          state: o.state,
          postalCode: o.postalCode,
          country: o.country,
        };

      return {
        id: o.id,
        status: o.status,
        total: o.total,
        currency,
        createdAt: o.createdAt,
        items,
        shippingAddress,
      };
    }
  );
}
