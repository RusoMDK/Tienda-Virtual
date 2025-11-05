// backend/src/routes/home.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";

const SectionType = z.enum([
  "HERO",
  "PRODUCT_GRID",
  "PRODUCT_STRIP",
  "CATEGORY_STRIP",
  "BANNER",
  "TEXT_BLOCK",
]);
type SectionTypeValue = z.infer<typeof SectionType>;

const baseSectionSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9\-_:]+$/i, "Slug inválido. Usa letras, números, - _ :"),
  type: SectionType,
  title: z.string().min(1).max(200).optional().nullable(),
  subtitle: z.string().min(1).max(400).optional().nullable(),
  config: z.unknown().optional().nullable(),
  layout: z.unknown().optional().nullable(),
  active: z.boolean().optional().default(true),
});

const createSectionSchema = baseSectionSchema;
const updateSectionSchema = baseSectionSchema.partial();

const reorderSchema = z.object({
  order: z.array(z.string().cuid()).min(1),
});

// Config mínima para secciones de productos
const productConfigSchema = z
  .object({
    mode: z.enum(["LATEST", "BY_CATEGORY", "BEST_SELLERS"]).default("LATEST"),
    limit: z.number().int().min(1).max(24).optional(),
    categorySlug: z.string().min(1).optional(),
  })
  .partial()
  .catch({});

export default async function homeRoutes(app: FastifyInstance) {
  // prisma viene del plugin ./plugins/prisma
  const prisma = (app as any).prisma as any;

  function assertAdmin(req: any) {
    const user = (req as any).user;
    if (!user || user.role !== "ADMIN") {
      throw app.httpErrors.forbidden("Solo administradores");
    }
  }

  // 🔹 Público: /home → secciones + datos necesarios
  app.get("/home", async () => {
    const sections = await prisma.homeSection.findMany({
      where: { active: true },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });

    const enriched = await Promise.all(
      sections.map(async (section: any) => {
        const type = section.type as SectionTypeValue;

        if (type !== "PRODUCT_GRID" && type !== "PRODUCT_STRIP") {
          return section;
        }

        const cfg = productConfigSchema.parse(
          (section.config ?? {}) as unknown
        );
        const mode = cfg.mode ?? "LATEST";
        const limit = cfg.limit ?? 8;

        let products: any[] = [];

        if (mode === "LATEST") {
          products = await prisma.product.findMany({
            where: { active: true },
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
              images: {
                where: { isPrimary: true },
                orderBy: { position: "asc" },
                take: 1,
              },
              category: true,
            },
          });
        } else if (mode === "BY_CATEGORY" && cfg.categorySlug) {
          products = await prisma.product.findMany({
            where: {
              active: true,
              category: { slug: cfg.categorySlug },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            include: {
              images: {
                where: { isPrimary: true },
                orderBy: { position: "asc" },
                take: 1,
              },
              category: true,
            },
          });
        } else if (mode === "BEST_SELLERS") {
          const grouped = await prisma.orderItem.groupBy({
            by: ["productId"],
            _sum: { quantity: true },
            orderBy: { _sum: { quantity: "desc" } },
            take: limit * 3,
          });

          const ids = grouped.map((g: any) => g.productId);
          if (ids.length) {
            const prods = await prisma.product.findMany({
              where: { id: { in: ids }, active: true },
              include: {
                images: {
                  where: { isPrimary: true },
                  orderBy: { position: "asc" },
                  take: 1,
                },
                category: true,
              },
            });

            const map = new Map(prods.map((p: any) => [p.id, p]));
            products = ids
              .map((id) => map.get(id))
              .filter(Boolean)
              .slice(0, limit) as any[];
          }
        }

        const simplified = products.map((p: any) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          price: p.price,
          currency: p.currency,
          imageUrl: p.images[0]?.url ?? null,
          categoryName: p.category?.name ?? null,
        }));

        return {
          ...section,
          products: simplified,
        };
      })
    );

    return { sections: enriched };
  });

  // 🔹 Admin: listar todas
  app.get(
    "/admin/home/sections",
    { preHandler: [app.authenticate] },
    async (req) => {
      assertAdmin(req);
      const sections = await prisma.homeSection.findMany({
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      });
      return sections;
    }
  );

  // 🔹 Admin: crear
  app.post(
    "/admin/home/sections",
    { preHandler: [app.authenticate] },
    async (req) => {
      assertAdmin(req);

      const body = createSectionSchema.parse(req.body ?? {});

      const maxPos = await prisma.homeSection.aggregate({
        _max: { position: true },
      });
      const nextPosition = (maxPos._max.position ?? 0) + 1;

      const created = await prisma.homeSection.create({
        data: {
          slug: body.slug,
          type: body.type,
          title: body.title ?? null,
          subtitle: body.subtitle ?? null,
          config: body.config ?? {},
          layout: body.layout ?? {},
          active: body.active ?? true,
          position: nextPosition,
        },
      });

      return created;
    }
  );

  // 🔹 Admin: actualizar
  app.put(
    "/admin/home/sections/:id",
    { preHandler: [app.authenticate] },
    async (req) => {
      assertAdmin(req);
      const id = (req.params as any).id as string;
      if (!id) throw app.httpErrors.badRequest("Falta id");

      const body = updateSectionSchema.parse(req.body ?? {});

      const updated = await prisma.homeSection.update({
        where: { id },
        data: {
          ...(body.slug !== undefined && { slug: body.slug }),
          ...(body.type !== undefined && { type: body.type }),
          ...(body.title !== undefined && { title: body.title }),
          ...(body.subtitle !== undefined && { subtitle: body.subtitle }),
          ...(body.config !== undefined && { config: body.config }),
          ...(body.layout !== undefined && { layout: body.layout }),
          ...(body.active !== undefined && { active: body.active }),
        },
      });

      return updated;
    }
  );

  // 🔹 Admin: borrar
  app.delete(
    "/admin/home/sections/:id",
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      assertAdmin(req);
      const id = (req.params as any).id as string;
      if (!id) throw app.httpErrors.badRequest("Falta id");

      await prisma.homeSection.delete({ where: { id } });
      reply.code(204);
    }
  );

  // 🔹 Admin: reordenar
  app.post(
    "/admin/home/sections/reorder",
    { preHandler: [app.authenticate] },
    async (req) => {
      assertAdmin(req);
      const { order } = reorderSchema.parse(req.body ?? {});

      const sections = await prisma.homeSection.findMany({
        where: { id: { in: order } },
      });
      if (sections.length !== order.length) {
        throw app.httpErrors.badRequest(
          "Alguna sección no existe o no pertenece al sitio"
        );
      }

      await prisma.$transaction(
        order.map((id, index) =>
          prisma.homeSection.update({
            where: { id },
            data: { position: index },
          })
        )
      );

      return { ok: true };
    }
  );
}
