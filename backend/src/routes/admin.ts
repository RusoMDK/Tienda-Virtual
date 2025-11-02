// src/routes/admin.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { Role, InventoryReason } from "@prisma/client";
import { requireAdmin, requireRole } from "../utils/rbac.js";
import { cloudinary } from "../lib/cloudinary.js";

// ──────────────────────────────────────────────────────────────
// Utils
// ──────────────────────────────────────────────────────────────
const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const sortMap: Record<string, any> = {
  "createdAt:desc": { createdAt: "desc" },
  "createdAt:asc": { createdAt: "asc" },
  "updatedAt:desc": { updatedAt: "desc" },
  "updatedAt:asc": { updatedAt: "asc" },
  "price:asc": { price: "asc" },
  "price:desc": { price: "desc" },
  "name:asc": { name: "asc" },
  "name:desc": { name: "desc" },
  "stock:asc": { stock: "asc" },
  "stock:desc": { stock: "desc" },
};

// Para Cloudinary
const CLOUD_FOLDER = process.env.CLOUDINARY_FOLDER || "tienda/products";

// Acepta string URL o {url, publicId, position}
const ImageInput = z.object({
  url: z.string().url(),
  publicId: z.string().optional().default(""),
  position: z.number().int().min(0).optional().default(0),
});

// ──────────────────────────────────────────────────────────────
// PASO 1) Helper para normalizar imágenes (anti-choques de posición,
//         dedup por publicId/url, reindex 0..N-1, una sola isPrimary)
// ──────────────────────────────────────────────────────────────
type ImgInput = string | z.infer<typeof ImageInput>;

function normalizeImages(
  imgs: ImgInput[] | undefined,
  productId: string,
  productName?: string
) {
  if (!imgs?.length) return [];

  // 1) Uniformar a shape {url, publicId, position}
  const raw = imgs.map((img, idx) =>
    typeof img === "string"
      ? { url: img, publicId: "", position: idx }
      : {
          url: img.url,
          publicId: img.publicId || "",
          position: typeof img.position === "number" ? img.position : idx,
        }
  );

  // 2) Dedup: primero por publicId si existe; si no, por url
  const seen = new Set<string>();
  const dedup = raw.filter((r) => {
    const key = (
      r.publicId ? `pid:${r.publicId}` : `url:${r.url}`
    ).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 3) Orden estable y reindex estricto
  dedup.sort((a, b) => a.position - b.position);

  // 4) Construir filas para createMany: 0..N-1, sólo una primaria
  return dedup.map((r, i) => {
    const row: any = {
      productId,
      url: r.url,
      position: i,
      isPrimary: i === 0,
    };
    // Evitar conflictos con unique(publicId): sólo setear si viene
    if (r.publicId) row.publicId = r.publicId;
    // Alt opcional si tu modelo lo soporta
    if (productName) row.alt = `${productName} (${i + 1})`;
    return row;
  });
}

// ──────────────────────────────────────────────────────────────
export default async function adminRoutes(app: FastifyInstance) {
  // 🚨 authenticate → guard
  const guard = { preHandler: [app.authenticate, requireAdmin] };

  // =========================== Dashboard summary ===========================
  app.get("/admin/summary", guard, async () => {
    const [products, orders, users, pending, paid] = await Promise.all([
      app.prisma.product.count(),
      app.prisma.order.count(),
      app.prisma.user.count(),
      app.prisma.order.count({ where: { status: "PENDING" } }),
      app.prisma.order.count({ where: { status: "PAID" } }),
    ]);
    return { products, orders, users, pending, paid };
  });

  // =========================== Uploads (Cloudinary) ===========================
  // Firma para "direct upload" (acepta folder opcional)
  app.post("/admin/uploads/signature", guard, async (req, reply) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret)
      return reply.serviceUnavailable("Cloudinary no configurado");

    const body = z
      .object({
        folder: z.string().optional(),
        publicId: z.string().optional(),
      })
      .parse(req.body ?? {});
    const folder = body.folder || CLOUD_FOLDER;
    const timestamp = Math.floor(Date.now() / 1000);

    const paramsToSign: Record<string, any> = { timestamp, folder };
    if (body.publicId) paramsToSign.public_id = body.publicId;

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      apiSecret
    );
    return { cloudName, apiKey, timestamp, folder, signature };
  });

  // Borrado seguro por publicId
  app.post("/admin/uploads/delete", guard, async (req, reply) => {
    const { publicId } = z
      .object({ publicId: z.string().min(1) })
      .parse(req.body);
    try {
      const res = await cloudinary.uploader.destroy(publicId, {
        invalidate: true,
      });
      if (res.result !== "ok" && res.result !== "not found") {
        (req as any).log?.warn?.({ res }, "Cloudinary destroy no-ok");
      }
      // Limpieza en DB si guardas publicId en ProductImage
      try {
        await (app.prisma as any).productImage.deleteMany({
          where: { publicId },
        });
      } catch {
        // si no hay tabla ProductImage → noop
      }
      return { ok: true };
    } catch (err) {
      (req as any).log?.error?.({ err }, "cloudinary.delete failed");
      return reply.badRequest("No se pudo borrar la imagen");
    }
  });

  // =========================== Products (LIST) ===========================
  const ListQuery = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().optional(),
    cat: z.string().trim().optional(), // slug del padre o subcat
    status: z.enum(["active", "inactive", "all"]).default("all"),
    sort: z
      .enum([
        "createdAt:desc",
        "createdAt:asc",
        "updatedAt:desc",
        "updatedAt:asc",
        "price:asc",
        "price:desc",
        "name:asc",
        "name:desc",
        "stock:asc",
        "stock:desc",
      ])
      .default("createdAt:desc"),
  });

  app.get("/admin/products", guard, async (req) => {
    const Q = ListQuery.parse(req.query);

    const AND: any[] = [];
    if (Q.q) {
      AND.push({
        OR: [
          { name: { contains: Q.q, mode: "insensitive" } },
          { description: { contains: Q.q, mode: "insensitive" } },
          { slug: { contains: Q.q, mode: "insensitive" } },
        ],
      });
    }
    if (Q.status !== "all") AND.push({ active: Q.status === "active" });

    if (Q.cat && Q.cat !== "all") {
      AND.push({
        OR: [
          { category: { slug: Q.cat } },
          { category: { parent: { slug: Q.cat } } }, // requiere relación parent en Category
        ],
      });
    }

    const where = AND.length ? { AND } : {};
    const orderBy = sortMap[Q.sort] ?? { createdAt: "desc" };
    const skip = (Q.page - 1) * Q.pageSize;

    const [total, rows] = await app.prisma.$transaction([
      app.prisma.product.count({ where }),
      app.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: Q.pageSize,
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
          updatedAt: true,
          category: {
            select: { id: true, name: true, slug: true, parentId: true },
          },
          // images: { select: { url: true, publicId: true, position: true, isPrimary: true }, orderBy: { position: "asc" } },
        },
      }),
    ]);

    return {
      items: rows,
      page: Q.page,
      pageSize: Q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / Q.pageSize)),
    };
  });

  // =========================== Products (GET ONE / detalle) ===========================
  app.get("/admin/products/:id", guard, async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params as any);

    // 1) Traemos el producto + su categoría
    const base = await app.prisma.product.findUnique({
      where: { id },
      include: { category: { select: { name: true, slug: true } } },
    });

    if (!base) return reply.notFound("Producto no encontrado");

    // 2) Intentamos traer imágenes si existe la tabla ProductImage
    let images: Array<{
      url: string;
      publicId?: string | null;
      position: number;
      isPrimary?: boolean;
      alt?: string | null;
    }> = [];

    try {
      const imgs = await (app.prisma as any).productImage.findMany({
        where: { productId: id },
        orderBy: { position: "asc" },
        select: {
          url: true,
          publicId: true,
          position: true,
          isPrimary: true,
          alt: true,
        },
      });
      images = Array.isArray(imgs) ? imgs : [];
    } catch {
      // si no existe el modelo ProductImage en tu esquema, lo ignoramos
    }

    // 3) Devolvemos shape amigable
    return {
      ...base,
      categoryName: base.category?.name ?? null,
      categorySlug: base.category?.slug ?? null,
      images,
    };
  });

  // =========================== Products (CREATE) ===========================
  const UpsertProduct = z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(2000).default(""),
    price: z.number().int().nonnegative(), // cents
    currency: z.string().min(1).default("usd"),
    active: z.boolean().default(true),
    categorySlug: z.string().trim().optional(),
    // Acepta array de strings o array de objetos ImageInput
    images: z
      .union([z.array(z.string().url()), z.array(ImageInput)])
      .optional()
      .default([]),
  });

  app.post("/admin/products", guard, async (req, reply) => {
    const body = UpsertProduct.parse(req.body);

    // slug único
    const base = slugify(body.name) || "producto";
    let slug = base;
    let i = 1;
    while (await app.prisma.product.findUnique({ where: { slug } })) {
      slug = `${base}-${++i}`;
    }

    // categoría (opcional, por slug)
    let categoryConnect: any = undefined;
    if (body.categorySlug) {
      const cat = await app.prisma.category.findUnique({
        where: { slug: body.categorySlug },
      });
      if (!cat) return reply.badRequest("categorySlug inválida");
      categoryConnect = { connect: { id: cat.id } };
    }

    const created = await app.prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          slug,
          name: body.name,
          description: body.description,
          price: body.price,
          currency: body.currency,
          active: body.active,
          stock: 0, // arranca en 0 → usar ajuste de stock
          ...(categoryConnect ? { category: categoryConnect } : {}),
        },
      });

      // PASO 2) Crear imágenes normalizadas
      const imgs = (body.images ?? []) as ImgInput[];
      if (imgs.length) {
        try {
          const rows = normalizeImages(imgs, p.id, body.name);
          await (tx as any).productImage.createMany({ data: rows });
        } catch {
          // si no existe ProductImage, lo ignoramos
        }
      }

      return p;
    });

    return reply.code(201).send(created);
  });

  // =========================== Products (UPDATE parcial) ===========================
  app.patch("/admin/products/:id", guard, async (req, reply) => {
    const id = z
      .string()
      .min(1)
      .parse((req.params as any).id);
    const body = UpsertProduct.partial().parse(req.body);

    const data: any = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.description !== undefined) data.description = body.description;
    if (body.price !== undefined) data.price = body.price;
    if (body.currency !== undefined) data.currency = body.currency;
    if (body.active !== undefined) data.active = body.active;

    if ("categorySlug" in body) {
      if (!body.categorySlug) {
        data.category = { disconnect: true };
      } else {
        const cat = await app.prisma.category.findUnique({
          where: { slug: body.categorySlug },
        });
        if (!cat) return reply.badRequest("categorySlug inválida");
        data.category = { connect: { id: cat.id } };
      }
    }

    try {
      const updated = await app.prisma.$transaction(async (tx) => {
        const p = await tx.product.update({ where: { id }, data });

        // PASO 3) Reemplazar imágenes (delete + create) con normalización
        if (body.images) {
          try {
            await (tx as any).productImage.deleteMany({
              where: { productId: id },
            });
            const imgs = body.images as ImgInput[];
            if (imgs.length) {
              const rows = normalizeImages(imgs, id, p.name);
              await (tx as any).productImage.createMany({ data: rows });
            }
          } catch {
            // sin tabla ProductImage → noop
          }
        }

        return p;
      });

      return updated;
    } catch (err) {
      (req as any).log?.error?.({ err }, "admin.updateProduct failed");
      return reply.notFound("Producto no encontrado");
    }
  });

  // =========================== Products (activar/desactivar) ===========================
  app.patch("/admin/products/:id/active", guard, async (req, reply) => {
    const id = z
      .string()
      .min(1)
      .parse((req.params as any).id);
    const { active } = z.object({ active: z.boolean() }).parse(req.body);
    const p = await app.prisma.product.update({
      where: { id },
      data: { active },
      select: { id: true, active: true },
    });
    return p;
  });

  // =========================== Products (ajuste de stock + ledger) ===========================
  const AdjustStock = z.object({
    delta: z
      .number()
      .int()
      .refine((n) => n !== 0, "delta != 0"),
    reason: z.string().optional(), // libre → se normaliza a InventoryReason
    note: z.string().max(200).optional(),
    orderId: z.string().optional(),
  });

  const VALID_REASONS = new Set<string>(Object.values(InventoryReason));
  function coerceReason(input?: string): InventoryReason {
    if (input && VALID_REASONS.has(input)) return input as InventoryReason;
    return InventoryReason.MANUAL_ADJUSTMENT;
  }

  app.post("/admin/products/:id/stock-adjust", guard, async (req, reply) => {
    const id = z
      .string()
      .min(1)
      .parse((req.params as any).id);
    const { delta, reason, note, orderId } = AdjustStock.parse(req.body);

    const prod = await app.prisma.product.findUnique({ where: { id } });
    if (!prod) return reply.notFound("Producto no encontrado");

    const next = prod.stock + delta;
    if (next < 0) return reply.badRequest("El stock no puede quedar negativo");

    await app.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: { stock: next } });

      // Registrar en el ledger
      try {
        await (tx as any).stockLedger.create({
          data: {
            productId: id,
            delta,
            reason: coerceReason(reason),
            note: note?.trim() || undefined,
            orderId: orderId || undefined,
          },
        });
      } catch {
        (req as any).log?.warn?.("StockLedger no existe; se omite");
      }
    });

    return { ok: true, stock: next };
  });

  // Historial de stock (alias: stock-ledger y stock-movements)
  const LedgerQuery = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
  });

  async function listLedgerHandler(req: any, reply: any) {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const { limit } = LedgerQuery.parse(req.query);

    const exists = await app.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) return reply.notFound("Producto no encontrado");

    let items: any[] = [];
    try {
      items = await (app.prisma as any).stockLedger.findMany({
        where: { productId: id },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          delta: true,
          reason: true,
          note: true,
          orderId: true,
          createdAt: true,
        },
      });
    } catch {
      // si no existe la tabla → lista vacía
      items = [];
    }

    return { items };
  }

  app.get("/admin/products/:id/stock-ledger", guard, listLedgerHandler);
  app.get("/admin/products/:id/stock-movements", guard, listLedgerHandler);

  // =========================== Products (delete) ===========================
  app.delete("/admin/products/:id", guard, async (req, reply) => {
    const id = z
      .string()
      .min(1)
      .parse((req.params as any).id);
    try {
      await app.prisma.product.delete({ where: { id } });
      return { ok: true };
    } catch (err: any) {
      if (err?.code === "P2003") {
        return reply
          .status(409)
          .send({ error: "No se puede eliminar: tiene referencias" });
      }
      (req as any).log?.error?.({ err }, "admin.deleteProduct failed");
      return reply.badRequest("No se pudo eliminar");
    }
  });

  // =========================== Categories (list + CRUD) ===========================
  app.get("/admin/categories", guard, async () => {
    return app.prisma.category.findMany({
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        parentId: true,
        imageUrl: true,
        imagePublicId: true,
      },
    });
  });

  const UpsertCategory = z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    parentId: z.string().nullable().optional(),
    imageUrl: z.string().url().nullable().optional(),
    imagePublicId: z.string().nullable().optional(),
  });

  app.post("/admin/categories", guard, async (req, reply) => {
    const body = UpsertCategory.parse(req.body);
    const exists = await app.prisma.category.findUnique({
      where: { slug: body.slug },
    });
    if (exists) return reply.conflict("Slug en uso");
    const created = await app.prisma.category.create({ data: body as any });
    reply.code(201);
    return created;
  });

  app.patch("/admin/categories/:id", guard, async (req, reply) => {
    const { id } = req.params as { id: string };
    const data = UpsertCategory.partial().parse(req.body);
    try {
      const updated = await app.prisma.category.update({
        where: { id },
        data: data as any,
      });
      return updated;
    } catch {
      return reply.notFound("Categoría no encontrada");
    }
  });

  app.delete("/admin/categories/:id", guard, async (req, reply) => {
    const { id } = req.params as { id: string };
    const children = await app.prisma.category.count({
      where: { parentId: id },
    });
    const products = await app.prisma.product.count({
      where: { categoryId: id },
    });
    if (children > 0 || products > 0) {
      return reply.badRequest(
        "No se puede eliminar: tiene subcategorías o productos"
      );
    }
    await app.prisma.category.delete({ where: { id } });
    return { ok: true };
  });

  // =========================== Orders (list + update) ===========================
  const OrdersQuery = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    status: z.enum(["PENDING", "PAID", "CANCELLED", "FULFILLED"]).optional(),
    q: z.string().optional(), // email
  });

  app.get("/admin/orders", guard, async (req) => {
    const q = OrdersQuery.parse(req.query);
    const where: any = {
      ...(q.status ? { status: q.status } : null),
      ...(q.q
        ? { user: { email: { contains: q.q, mode: "insensitive" } } }
        : null),
    };

    const [total, items] = await Promise.all([
      app.prisma.order.count({ where }),
      app.prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        select: {
          id: true,
          status: true,
          total: true,
          currency: true,
          createdAt: true,
          user: { select: { email: true } },
          items: {
            select: {
              quantity: true,
              unitPrice: true,
              product: { select: { name: true, slug: true } },
            },
          },
        },
      }),
    ]);

    return {
      items,
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    };
  });

  app.patch("/admin/orders/:id/status", guard, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({ status: z.enum(["PENDING", "PAID", "CANCELLED", "FULFILLED"]) })
      .parse(req.body);
    try {
      const updated = await app.prisma.order.update({
        where: { id },
        data: { status: body.status },
      });
      return updated;
    } catch {
      return reply.notFound("Orden no encontrada");
    }
  });

  // Ejemplo de ruta que requiere CUSTOMER o ADMIN (aquí uso ADMIN explícito)
  app.get(
    "/admin/whoami",
    { preHandler: [app.authenticate, requireRole(Role.ADMIN)] },
    async (req) => {
      return { user: (req as any).user };
    }
  );

  // =========================== Users (list + role update) ===========================
  const UsersQuery = z.object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    q: z.string().optional(), // nombre o email
    // ✅ incluye SUPPORT en el filtro
    role: z.enum(["ALL", "ADMIN", "SUPPORT", "CUSTOMER"]).default("ALL"),
  });

  app.get("/admin/users", guard, async (req) => {
    const q = UsersQuery.parse(req.query);

    const AND: any[] = [];
    if (q.q) {
      AND.push({
        OR: [
          { email: { contains: q.q, mode: "insensitive" } },
          { name: { contains: q.q, mode: "insensitive" } },
        ],
      });
    }
    if (q.role !== "ALL") {
      AND.push({ role: q.role as Role });
    }

    const where = AND.length ? { AND } : {};
    const skip = (q.page - 1) * q.pageSize;

    const [total, items] = await app.prisma.$transaction([
      app.prisma.user.count({ where }),
      app.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: q.pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          _count: { select: { orders: true } }, // si no tienes relación orders, quita esta línea
        },
      }),
    ]);

    return {
      items,
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    };
  });

  app.patch("/admin/users/:id/role", guard, async (req, reply) => {
    const { id } = req.params as { id: string };
    // ✅ ahora acepta SUPPORT
    const body = z.object({ role: z.nativeEnum(Role) }).parse(req.body);
    try {
      const updated = await app.prisma.user.update({
        where: { id },
        data: { role: body.role },
        select: { id: true, role: true },
      });
      return updated;
    } catch {
      return reply.notFound("Usuario no encontrado");
    }
  });
}
