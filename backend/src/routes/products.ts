// src/routes/products.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireRole } from "../utils/rbac.js";

// Validación del body de producto (CRUD admin público si lo usas aquí)
const productSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.number().int().nonnegative(), // centavos
  stock: z.number().int().nonnegative().default(0),
  currency: z.string().default("usd"),
  categoryId: z.string().optional(),
  active: z.boolean().optional(),
});

// Query para listados
const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(12),
  q: z.string().optional(),
  sort: z
    .enum(["createdAt:desc", "createdAt:asc", "price:asc", "price:desc"])
    .default("createdAt:desc"),
  category: z.string().optional(), // slug de categoría padre
  subcategory: z.string().optional(), // slug de subcategoría (hija)
});

export default async function products(app: FastifyInstance) {
  // -------- Listado público con filtros ----------
  app.get("/products", async (req, reply) => {
    const { page, pageSize, q, sort, category, subcategory } = listQuery.parse(
      req.query
    );

    // WHERE por categoría
    let categoryWhere: Record<string, any> | undefined;
    if (subcategory) {
      const sub = await app.prisma.category.findUnique({
        where: { slug: subcategory },
      });
      if (sub) categoryWhere = { categoryId: sub.id };
    } else if (category) {
      const top = await app.prisma.category.findUnique({
        where: { slug: category },
      });
      if (top) {
        const children = await app.prisma.category.findMany({
          where: { parentId: top.id },
          select: { id: true },
        });
        const ids = [top.id, ...children.map((c) => c.id)];
        categoryWhere = { categoryId: { in: ids } };
      }
    }

    const where = {
      active: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(categoryWhere || {}),
    };

    const orderBy =
      sort === "price:asc"
        ? { price: "asc" as const }
        : sort === "price:desc"
        ? { price: "desc" as const }
        : sort === "createdAt:asc"
        ? { createdAt: "asc" as const }
        : { createdAt: "desc" as const };

    const [total, rawItems] = await app.prisma.$transaction([
      app.prisma.product.count({ where }),
      app.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          price: true,
          currency: true,
          stock: true,
          active: true,
          createdAt: true,
          images: {
            select: { url: true, isPrimary: true, position: true },
            orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
            take: 1,
          },
        },
      }),
    ]);

    // Mapeamos imagen principal a imageUrl
    const items = rawItems.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      price: p.price,
      currency: p.currency,
      stock: p.stock,
      active: p.active,
      createdAt: p.createdAt,
      imageUrl: p.images[0]?.url ?? null,
    }));

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { items, page, pageSize, total, totalPages };
  });

  // -------- Detalle por slug (con TODAS las imágenes ordenadas) ----------
  app.get("/products/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };

    const p = await app.prisma.product.findUnique({
      where: { slug },
      include: {
        images: {
          select: {
            url: true,
            isPrimary: true,
            position: true,
            alt: true,
            publicId: true,
          },
          orderBy: [{ isPrimary: "desc" }, { position: "asc" }],
        },
        // agrega otras relaciones si las necesitas para tu detalle
      },
    });

    if (!p) return reply.notFound("Product not found");

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      price: p.price,
      currency: p.currency,
      stock: p.stock,
      active: p.active,
      categoryId: p.categoryId,
      images: p.images.map((i) => i.url), // ← solo URLs para el front
      // si quieres alt/publicId en el front, devuelve el objeto completo
    };
  });

  // -------- CRUD (sólo si mantienes estos endpoints públicos) ----------
  app.post(
    "/products",
    { preHandler: [app.authenticate, requireRole("ADMIN")] },
    async (req, reply) => {
      const body = productSchema.parse(req.body);
      const created = await app.prisma.product.create({ data: body });
      reply.code(201);
      return created;
    }
  );

  app.patch(
    "/products/:id",
    { preHandler: [app.authenticate, requireRole("ADMIN")] },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = productSchema.partial().parse(req.body);
      const updated = await app.prisma.product.update({
        where: { id },
        data: body,
      });
      return updated;
    }
  );

  app.delete(
    "/products/:id",
    { preHandler: [app.authenticate, requireRole("ADMIN")] },
    async (req) => {
      const { id } = req.params as { id: string };
      await app.prisma.product.delete({ where: { id } });
      return { ok: true };
    }
  );
}
