// backend/src/routes/me.wishlist.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

type AuthenticatedRequest = FastifyRequest & {
  user?: { sub: string; role?: string };
};

// Helper para sacar userId desde el JWT (sub)
function getUserIdOr401(
  req: AuthenticatedRequest,
  reply: FastifyReply
): string | undefined {
  const userId = req.user?.sub;
  if (!userId) {
    // @ts-ignore fastify-sensible
    if (typeof reply.unauthorized === "function") {
      // @ts-ignore
      reply.unauthorized("UNAUTHENTICATED");
    } else {
      reply.code(401).send({ error: "UNAUTHENTICATED" });
    }
    return undefined;
  }
  return userId;
}

export default async function meWishlistRoutes(app: FastifyInstance) {
  const prisma: any = (app as any).prisma;

  // Todas las rutas de este módulo requieren estar autenticado
  app.addHook("onRequest", (app as any).authenticate);

  // GET /me/wishlist → lista de favoritos + info de cambio de precio
  app.get("/", async (request, reply) => {
    const userId = getUserIdOr401(request as AuthenticatedRequest, reply);
    if (!userId) return;

    const items = await prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          include: {
            images: {
              orderBy: { position: "asc" },
              take: 1,
            },
          },
        },
      },
    });

    const result = items
      .map((it: any) => {
        const p = it.product;
        if (!p) return null;

        const firstImage = p.images?.[0]?.url ?? null;

        const priceAtAdd: number = it.priceAtAdd ?? p.price;
        const currentPrice: number = p.price;

        const diff = currentPrice - priceAtAdd; // >0 subió, <0 bajó
        const priceChanged = diff !== 0;
        const priceDirection: "UP" | "DOWN" | "SAME" =
          diff === 0 ? "SAME" : diff < 0 ? "DOWN" : "UP";
        const priceDiff = Math.abs(diff);

        const discountPercent =
          priceDirection === "DOWN" && priceAtAdd > 0
            ? Math.round((priceDiff * 10000) / priceAtAdd) / 100
            : null;

        return {
          id: it.id,
          productId: p.id,
          createdAt: it.createdAt.toISOString(),

          // info de precio histórico vs actual
          priceAtAdd,
          priceChanged,
          priceDirection,
          priceDiff,
          discountPercent,

          // datos del producto
          product: {
            id: p.id,
            slug: p.slug,
            name: p.name,
            description: p.description,
            price: currentPrice,
            currency: p.currency,
            stock: p.stock,
            active: p.active,
            imageUrl: firstImage,
          },
        };
      })
      .filter(Boolean);

    return reply.send({
      items: result,
      total: result.length,
    });
  });

  // POST /me/wishlist/:productId → añadir a favoritos (idempotente)
  app.post<{ Params: { productId: string } }>(
    "/:productId",
    async (request, reply) => {
      const userId = getUserIdOr401(request as AuthenticatedRequest, reply);
      if (!userId) return;

      const { productId } = request.params;

      if (!productId) {
        // @ts-ignore
        if (typeof reply.badRequest === "function") {
          // @ts-ignore
          return reply.badRequest("PRODUCT_ID_REQUIRED");
        }
        return reply.code(400).send({ error: "PRODUCT_ID_REQUIRED" });
      }

      // Verificar que el producto existe
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, price: true },
      });

      if (!product) {
        // @ts-ignore
        if (typeof reply.notFound === "function") {
          // @ts-ignore
          return reply.notFound("PRODUCT_NOT_FOUND");
        }
        return reply.code(404).send({ error: "PRODUCT_NOT_FOUND" });
      }

      // Idempotente: si ya existe, no falla
      const existing = await prisma.wishlistItem.findUnique({
        where: {
          userId_productId: {
            userId,
            productId,
          },
        },
      });

      if (existing) {
        return reply.send({ ok: true, created: false });
      }

      await prisma.wishlistItem.create({
        data: {
          userId,
          productId,
          priceAtAdd: product.price,
        },
      });

      return reply.code(201).send({ ok: true, created: true });
    }
  );

  // DELETE /me/wishlist/:productId → quitar un producto de favoritos
  app.delete<{ Params: { productId: string } }>(
    "/:productId",
    async (request, reply) => {
      const userId = getUserIdOr401(request as AuthenticatedRequest, reply);
      if (!userId) return;

      const { productId } = request.params;

      if (!productId) {
        // @ts-ignore
        if (typeof reply.badRequest === "function") {
          // @ts-ignore
          return reply.badRequest("PRODUCT_ID_REQUIRED");
        }
        return reply.code(400).send({ error: "PRODUCT_ID_REQUIRED" });
      }

      await prisma.wishlistItem.deleteMany({
        where: { userId, productId },
      });

      return reply.send({ ok: true });
    }
  );

  // DELETE /me/wishlist → limpiar todos los favoritos del usuario
  app.delete("/", async (request, reply) => {
    const userId = getUserIdOr401(request as AuthenticatedRequest, reply);
    if (!userId) return;

    const { count } = await prisma.wishlistItem.deleteMany({
      where: { userId },
    });

    return reply.send({ ok: true, removed: count });
  });
}
