// src/routes/searchSuggest.ts
import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  buildBaseProductWhere,
  buildSearchQueryInfo,
  buildTextSearchScore,
  buildTextSearchWhere,
  parseIntParam,
} from "../utils/searchUtils.js";

const searchSuggestQuerySchema = z.object({
  q: z.string().trim().optional(),
  cat: z.string().trim().optional(),
  limit: z.string().trim().optional(),
});

type ProductSuggestRow = {
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  thumbnailUrl: string | null;
  score: number;
};

type CategorySuggestRow = {
  slug: string;
  name: string;
  count: bigint | number | string;
};

export default async function searchSuggestRoutes(app: FastifyInstance) {
  const { sql } = Prisma;

  // OJO: aquí solo "/suggest" porque ya tienes prefix "/search"
  app.get("/suggest", async (request, reply) => {
    try {
      const parsed = searchSuggestQuerySchema.safeParse(request.query);

      if (!parsed.success) {
        return reply.status(400).send({
          term: "",
          categories: [],
          products: [],
        });
      }

      const { q, cat, limit } = parsed.data;
      const searchInfo = buildSearchQueryInfo(q);

      // Si la query normalizada es muy corta, no sugerimos nada
      if (!searchInfo.normalized || searchInfo.normalized.length < 2) {
        return reply.send({
          term: q || "",
          categories: [] as any[],
          products: [] as any[],
        });
      }

      const takeRaw = parseIntParam(limit, 6);
      const take = Math.min(Math.max(takeRaw, 1), 15);

      const baseWhere = buildBaseProductWhere({
        catSlug: cat && cat !== "all" ? cat : undefined,
        ratingFilter: null,
        condition: null,
        minPriceCents: null,
        maxPriceCents: null,
        color: null,
        homeDelivery: null,
        minWarrantyMonths: null,
        brand: null,
        productType: null,
        model: null,
        tags: null,
      });

      const textWhere = buildTextSearchWhere(searchInfo);
      const whereSql =
        textWhere != null ? sql`${baseWhere} AND ${textWhere}` : baseWhere;

      const scoreSql = buildTextSearchScore(searchInfo);

      // Productos sugeridos
      const productRows = await app.prisma.$queryRaw<ProductSuggestRow[]>(sql`
        SELECT
          p."id",
          p."slug",
          p."name",
          p."price",
          p."currency",
          (
            SELECT img."url"
            FROM "ProductImage" img
            WHERE img."productId" = p."id"
            ORDER BY img."isPrimary" DESC, img."position" ASC, img."createdAt" ASC
            LIMIT 1
          ) AS "thumbnailUrl",
          ${scoreSql} AS score
        FROM "Product" p
        LEFT JOIN "Category" c ON c."id" = p."categoryId"
        WHERE ${whereSql}
        ORDER BY score DESC, p."ratingAvg" DESC, p."createdAt" DESC
        LIMIT ${take}
      `);

      // Categorías sugeridas
      const catRows = await app.prisma.$queryRaw<CategorySuggestRow[]>(sql`
        SELECT
          c."slug",
          c."name",
          COUNT(*) AS "count"
        FROM "Product" p
        JOIN "Category" c ON c."id" = p."categoryId"
        WHERE
          p."active" = true
          AND (
            unaccent(lower(c."name")) ILIKE '%' || ${searchInfo.normalized} || '%'
            OR unaccent(lower(c."slug")) ILIKE '%' || ${searchInfo.normalized} || '%'
          )
      GROUP BY c."slug", c."name"
        ORDER BY COUNT(*) DESC
        LIMIT 6
      `);

      const categories = catRows.map((c) => ({
        slug: c.slug,
        name: c.name,
        count:
          typeof c.count === "bigint"
            ? Number(c.count)
            : typeof c.count === "string"
            ? Number(c.count)
            : (c.count as number),
      }));

      const products = productRows.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        price: p.price,
        currency: p.currency,
        thumbnailUrl: p.thumbnailUrl,
      }));

      return reply.send({
        term: q || "",
        categories,
        products,
      });
    } catch (err) {
      request.log.error({ err }, "search/suggest failed");
      return reply.status(500).send({
        term: "",
        categories: [],
        products: [],
      });
    }
  });
}
