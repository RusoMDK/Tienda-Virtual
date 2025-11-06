// src/routes/products.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ProductCondition, ConditionGrade } from "@prisma/client";
import { requireRole } from "../utils/rbac.js";

// ─────────────────────────────────────────────
// Schemas Zod para crear/actualizar producto
// (solo campos editables por admin)
// ─────────────────────────────────────────────

const baseProductEditableSchema = z.object({
  slug: z.string().min(1),
  sku: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().min(1),

  // Precio / stock / estado
  price: z.number().int().nonnegative(), // centavos
  stock: z.number().int().nonnegative().optional(),
  currency: z.string().min(1).optional(), // default "usd"
  active: z.boolean().optional(),

  // Categoría
  categoryId: z.string().nullable().optional(),

  // Marca / tipo / modelo
  brand: z.string().optional(),
  productType: z.string().optional(),
  modelName: z.string().optional(),

  // Identificadores físicos
  barcode: z.string().optional(),
  weightGrams: z.number().int().nonnegative().optional(),
  widthMm: z.number().int().nonnegative().optional(),
  heightMm: z.number().int().nonnegative().optional(),
  lengthMm: z.number().int().nonnegative().optional(),

  // Condición
  condition: z.nativeEnum(ProductCondition).optional(), // default NEW
  conditionGrade: z.nativeEnum(ConditionGrade).optional(),
  conditionNote: z.string().optional(),

  // Atributos visuales
  mainColor: z.string().optional(),
  colorVariants: z.array(z.string()).optional(), // se guarda como Json

  // Envío
  homeDeliveryAvailable: z.boolean().optional(), // default true
  storePickupAvailable: z.boolean().optional(), // default false
  deliveryArea: z.any().optional(), // Json

  // Garantía
  warrantyMonths: z.number().int().nonnegative().optional(),
  warrantyType: z.string().optional(),
  warrantyDescription: z.string().optional(),

  // Tags / metadata
  tags: z.array(z.string()).optional(), // text[]
  metadata: z.any().optional(), // Json
});

// Para crear (POST)
const productCreateSchema = baseProductEditableSchema;

// Para actualizar (PATCH) → todos los campos opcionales
const productUpdateSchema = baseProductEditableSchema.partial();

// ─────────────────────────────────────────────
// Query para listados públicos
// ─────────────────────────────────────────────
const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(12),
  q: z.string().optional(),
  sort: z
    .enum([
      "createdAt:desc",
      "createdAt:asc",
      "price:asc",
      "price:desc",
      "rating:desc",
    ])
    .default("createdAt:desc"),
  category: z.string().optional(), // slug de categoría padre
  subcategory: z.string().optional(), // slug de subcategoría (hija)

  // filtros extra básicos
  brand: z.string().optional(),
  productType: z.string().optional(),
});

export default async function products(app: FastifyInstance) {
  // ─────────────────────────────────────────
  // Listado público con filtros básicos
  // ─────────────────────────────────────────
  app.get("/products", async (req, reply) => {
    const {
      page,
      pageSize,
      q,
      sort,
      category,
      subcategory,
      brand,
      productType,
    } = listQuery.parse(req.query);

    // WHERE por categoría (similar a lo que ya tenías)
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

    const where: any = {
      active: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { brand: { contains: q, mode: "insensitive" } },
              { productType: { contains: q, mode: "insensitive" } },
              { modelName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(categoryWhere || {}),
      ...(brand ? { brand } : {}),
      ...(productType ? { productType } : {}),
    };

    const orderBy =
      sort === "price:asc"
        ? { price: "asc" as const }
        : sort === "price:desc"
        ? { price: "desc" as const }
        : sort === "createdAt:asc"
        ? { createdAt: "asc" as const }
        : sort === "rating:desc"
        ? [{ ratingAvg: "desc" as const }, { ratingCount: "desc" as const }]
        : { createdAt: "desc" as const };

    const prismaOrderBy = Array.isArray(orderBy) ? orderBy : [orderBy];

    const [total, rawItems] = await app.prisma.$transaction([
      app.prisma.product.count({ where }),
      app.prisma.product.findMany({
        where,
        orderBy: prismaOrderBy,
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
          brand: true,
          productType: true,
          modelName: true,
          mainColor: true,
          ratingAvg: true,
          ratingCount: true,
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

      // info extra útil para el front (no rompe nada)
      brand: p.brand,
      productType: p.productType,
      modelName: p.modelName,
      mainColor: p.mainColor,
      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,
    }));

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { items, page, pageSize, total, totalPages };
  });

  // ─────────────────────────────────────────
  // Detalle por slug (con todas las imágenes)
  // ─────────────────────────────────────────
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
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            parent: {
              select: { id: true, name: true, slug: true },
            },
          },
        },
        reviews: {
          select: {
            id: true,
            rating: true,
            title: true,
            content: true,
            createdAt: true,
            user: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
          where: { approved: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!p) return reply.notFound("Product not found");

    return {
      id: p.id,
      slug: p.slug,
      sku: p.sku,
      name: p.name,
      description: p.description,
      price: p.price,
      currency: p.currency,
      stock: p.stock,
      active: p.active,
      categoryId: p.categoryId,
      brand: p.brand,
      productType: p.productType,
      modelName: p.modelName,
      barcode: p.barcode,
      weightGrams: p.weightGrams,
      widthMm: p.widthMm,
      heightMm: p.heightMm,
      lengthMm: p.lengthMm,

      condition: p.condition,
      conditionGrade: p.conditionGrade,
      conditionNote: p.conditionNote,

      mainColor: p.mainColor,
      colorVariants: p.colorVariants,
      homeDeliveryAvailable: p.homeDeliveryAvailable,
      storePickupAvailable: p.storePickupAvailable,
      deliveryArea: p.deliveryArea,

      warrantyMonths: p.warrantyMonths,
      warrantyType: p.warrantyType,
      warrantyDescription: p.warrantyDescription,

      tags: p.tags,
      metadata: p.metadata,

      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,

      // Para compatibilidad con lo que tenías:
      images: p.images.map((i) => i.url), // array de URLs

      // Y además, versión "pro" con toda la info:
      gallery: p.images.map((i) => ({
        url: i.url,
        alt: i.alt,
        isPrimary: i.isPrimary,
        position: i.position,
        publicId: i.publicId,
      })),

      category: p.category,
      reviews: p.reviews,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
  });

  // ─────────────────────────────────────────
  // CRUD ADMIN: crear producto
  // ─────────────────────────────────────────
  app.post(
    "/products",
    { preHandler: [app.authenticate, requireRole("ADMIN")] },
    async (req, reply) => {
      const body = productCreateSchema.parse(req.body);

      // Normalizaciones / defaults
      const normalizedSlug = body.slug.trim().toLowerCase();
      const normalizedSku = body.sku?.trim() || undefined;

      const normalizedTags = body.tags
        ? Array.from(
            new Set(body.tags.map((t) => t.trim()).filter((t) => t.length > 0))
          )
        : undefined;

      const normalizedColorVariants = body.colorVariants
        ? body.colorVariants.map((c) => c.trim()).filter((c) => c.length > 0)
        : undefined;

      const data = {
        slug: normalizedSlug,
        sku: normalizedSku,
        name: body.name.trim(),
        description: body.description.trim(),
        price: body.price,
        stock: body.stock ?? 0,
        currency: (body.currency ?? "usd").toLowerCase(),
        active: body.active ?? true,
        categoryId: body.categoryId ?? null,

        brand: body.brand?.trim() || undefined,
        productType: body.productType?.trim() || undefined,
        modelName: body.modelName?.trim() || undefined,

        barcode: body.barcode?.trim() || undefined,
        weightGrams: body.weightGrams ?? null,
        widthMm: body.widthMm ?? null,
        heightMm: body.heightMm ?? null,
        lengthMm: body.lengthMm ?? null,

        condition: body.condition ?? ProductCondition.NEW,
        conditionGrade: body.conditionGrade ?? null,
        conditionNote: body.conditionNote?.trim() || undefined,

        mainColor: body.mainColor?.trim() || undefined,
        colorVariants: normalizedColorVariants ?? null,

        homeDeliveryAvailable: body.homeDeliveryAvailable ?? true,
        storePickupAvailable: body.storePickupAvailable ?? false,
        deliveryArea: body.deliveryArea ?? null,

        warrantyMonths: body.warrantyMonths ?? null,
        warrantyType: body.warrantyType?.trim() || undefined,
        warrantyDescription: body.warrantyDescription?.trim() || undefined,

        tags: normalizedTags ?? [],
        metadata: body.metadata ?? null,
      };

      const created = await app.prisma.product.create({ data });
      reply.code(201);
      return created;
    }
  );

  // ─────────────────────────────────────────
  // CRUD ADMIN: actualizar producto
  // ─────────────────────────────────────────
  app.patch(
    "/products/:id",
    { preHandler: [app.authenticate, requireRole("ADMIN")] },
    async (req) => {
      const { id } = req.params as { id: string };
      const body = productUpdateSchema.parse(req.body);

      const data: any = {};

      if (body.slug !== undefined) {
        data.slug = body.slug.trim().toLowerCase();
      }
      if (body.sku !== undefined) {
        data.sku = body.sku?.trim() || null;
      }
      if (body.name !== undefined) {
        data.name = body.name.trim();
      }
      if (body.description !== undefined) {
        data.description = body.description.trim();
      }
      if (body.price !== undefined) {
        data.price = body.price;
      }
      if (body.stock !== undefined) {
        data.stock = body.stock;
      }
      if (body.currency !== undefined) {
        data.currency = body.currency.toLowerCase();
      }
      if (body.active !== undefined) {
        data.active = body.active;
      }
      if (body.categoryId !== undefined) {
        data.categoryId = body.categoryId;
      }

      if (body.brand !== undefined) {
        data.brand = body.brand?.trim() || null;
      }
      if (body.productType !== undefined) {
        data.productType = body.productType?.trim() || null;
      }
      if (body.modelName !== undefined) {
        data.modelName = body.modelName?.trim() || null;
      }

      if (body.barcode !== undefined) {
        data.barcode = body.barcode?.trim() || null;
      }
      if (body.weightGrams !== undefined) {
        data.weightGrams = body.weightGrams;
      }
      if (body.widthMm !== undefined) {
        data.widthMm = body.widthMm;
      }
      if (body.heightMm !== undefined) {
        data.heightMm = body.heightMm;
      }
      if (body.lengthMm !== undefined) {
        data.lengthMm = body.lengthMm;
      }

      if (body.condition !== undefined) {
        data.condition = body.condition;
      }
      if (body.conditionGrade !== undefined) {
        data.conditionGrade = body.conditionGrade;
      }
      if (body.conditionNote !== undefined) {
        data.conditionNote = body.conditionNote?.trim() || null;
      }

      if (body.mainColor !== undefined) {
        data.mainColor = body.mainColor?.trim() || null;
      }
      if (body.colorVariants !== undefined) {
        data.colorVariants =
          body.colorVariants
            ?.map((c) => c.trim())
            .filter((c) => c.length > 0) ?? null;
      }

      if (body.homeDeliveryAvailable !== undefined) {
        data.homeDeliveryAvailable = body.homeDeliveryAvailable;
      }
      if (body.storePickupAvailable !== undefined) {
        data.storePickupAvailable = body.storePickupAvailable;
      }
      if (body.deliveryArea !== undefined) {
        data.deliveryArea = body.deliveryArea;
      }

      if (body.warrantyMonths !== undefined) {
        data.warrantyMonths = body.warrantyMonths;
      }
      if (body.warrantyType !== undefined) {
        data.warrantyType = body.warrantyType?.trim() || null;
      }
      if (body.warrantyDescription !== undefined) {
        data.warrantyDescription = body.warrantyDescription?.trim() || null;
      }

      if (body.tags !== undefined) {
        data.tags = Array.from(
          new Set(
            (body.tags || []).map((t) => t.trim()).filter((t) => t.length > 0)
          )
        );
      }

      if (body.metadata !== undefined) {
        data.metadata = body.metadata;
      }

      const updated = await app.prisma.product.update({
        where: { id },
        data,
      });
      return updated;
    }
  );

  // ─────────────────────────────────────────
  // CRUD ADMIN: eliminar producto
  // ─────────────────────────────────────────
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
