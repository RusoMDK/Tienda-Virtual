// src/routes/searchProducts.ts
import type { FastifyInstance } from "fastify";
import { Prisma, ProductCondition, ConditionGrade } from "@prisma/client";
import {
  buildBaseProductWhere,
  buildSearchQueryInfo,
  buildTextSearchScore,
  buildTextSearchWhere,
  parseIntParam,
  parsePriceParamToCents,
} from "../utils/searchUtils.js";

type SearchProductsQuery = {
  q?: string;
  cat?: string;
  page?: string;
  sort?: "relevance" | "price_asc" | "price_desc" | "rating_desc" | "newest";
  rating?: string;
  condition?: ProductCondition | string;
  minPrice?: string;
  maxPrice?: string;
  color?: string;
  homeDelivery?: string; // "true" | "false" | undefined
  minWarrantyMonths?: string;

  // nuevos filtros
  brand?: string;
  productType?: string;
  model?: string; // modelName en BD
  tags?: string; // CSV: "electrico,urbano"
};

type ProductHitRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  imageUrl: string | null;
  ratingAvg: number;
  ratingCount: number;
  brand: string | null;
  productType: string | null;
  modelName: string | null;
  tags: string[] | null;
  condition: ProductCondition;
  conditionGrade: ConditionGrade | null;
  conditionNote: string | null;
  mainColor: string | null;
  homeDeliveryAvailable: boolean;
  storePickupAvailable: boolean;
  warrantyMonths: number | null;
  warrantyType: string | null;
  warrantyDescription: string | null;
  metadata: Prisma.JsonValue | null;
  score: number;
};

type FacetRow = {
  label: string | null;
  count: bigint | number | string;
};

type TagFacetRow = {
  label: string;
  count: bigint | number | string;
};

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 60;

export default async function searchProductsRoutes(app: FastifyInstance) {
  const { sql } = Prisma;

  // OJO: aquí solo "/products" porque en server.ts ya registras prefix "/search"
  app.get("/products", async (request, reply) => {
    try {
      const q = (request.query as SearchProductsQuery) || {};
      const {
        q: rawQ,
        cat,
        page: pageParam,
        sort: sortParam,
        rating: ratingParam,
        condition,
        minPrice,
        maxPrice,
        color,
        homeDelivery,
        minWarrantyMonths,

        brand,
        productType,
        model,
        tags: tagsParam,
      } = q;

      const searchInfo = buildSearchQueryInfo(rawQ);

      // Paginación
      const page = parseIntParam(pageParam, 1);
      const requestedPageSize = DEFAULT_PAGE_SIZE;
      const pageSize = Math.min(Math.max(requestedPageSize, 1), MAX_PAGE_SIZE);
      const offset = (page - 1) * pageSize;

      // Filtros numéricos
      const ratingFilter = ratingParam ? Number(ratingParam) || 0 : 0;
      const minPriceCents = parsePriceParamToCents(minPrice);
      const maxPriceCents = parsePriceParamToCents(maxPrice);
      const minWarranty = minWarrantyMonths
        ? Number(minWarrantyMonths) || 0
        : null;
      const homeDeliveryBool =
        homeDelivery === "true"
          ? true
          : homeDelivery === "false"
          ? false
          : null;

      // tags como CSV → array de strings (sin normalizar, se espera que vengan de las facetas)
      const tagsFilter =
        tagsParam && tagsParam.trim()
          ? tagsParam
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t.length > 0)
          : null;

      // Opciones compartidas para filtros base
      const baseFilterOptions = {
        catSlug: cat,
        ratingFilter: ratingFilter > 0 ? ratingFilter : null,
        condition: condition || null,
        minPriceCents,
        maxPriceCents,
        color: color || null,
        homeDelivery: homeDeliveryBool,
        minWarrantyMonths: minWarranty && minWarranty > 0 ? minWarranty : null,
        brand: brand || null,
        productType: productType || null,
        model: model || null,
        tags: tagsFilter,
      };

      // WHERE base (sin texto) para items
      const baseWhere = buildBaseProductWhere(baseFilterOptions);

      // WHERE por texto (puede ser null si no hay q)
      const textWhere = buildTextSearchWhere(searchInfo);
      const whereSql =
        textWhere != null ? sql`${baseWhere} AND ${textWhere}` : baseWhere;

      // Score de relevancia (para ORDER BY)
      const scoreSql = buildTextSearchScore(searchInfo);

      // ORDER BY
      let orderBySql: Prisma.Sql;
      const sort = sortParam || "relevance";

      if (sort === "price_asc") {
        orderBySql = sql`p."price" ASC`;
      } else if (sort === "price_desc") {
        orderBySql = sql`p."price" DESC`;
      } else if (sort === "rating_desc") {
        orderBySql = sql`p."ratingAvg" DESC, p."ratingCount" DESC`;
      } else if (sort === "newest") {
        orderBySql = sql`p."createdAt" DESC`;
      } else {
        // relevance
        if (searchInfo.normalized) {
          orderBySql = sql`
            score DESC,
            p."ratingAvg" DESC,
            p."ratingCount" DESC,
            p."createdAt" DESC
          `;
        } else {
          orderBySql = sql`p."createdAt" DESC`;
        }
      }

      // COUNT total
      const countRows = await app.prisma.$queryRaw<
        { total: bigint | number | string }[]
      >(sql`
        SELECT COUNT(*) AS total
        FROM "Product" p
        LEFT JOIN "Category" c ON c."id" = p."categoryId"
        WHERE ${whereSql}
      `);

      const totalRaw = countRows[0]?.total ?? 0;
      const total =
        typeof totalRaw === "bigint"
          ? Number(totalRaw)
          : typeof totalRaw === "string"
          ? Number(totalRaw)
          : (totalRaw as number);

      const totalPages =
        total === 0 ? 0 : Math.max(1, Math.ceil(total / pageSize));

      // Query principal
      const rows = await app.prisma.$queryRaw<ProductHitRow[]>(sql`
        SELECT
          p."id",
          p."slug",
          p."name",
          p."description",
          p."price",
          p."currency",
          p."ratingAvg",
          p."ratingCount",
          p."brand",
          p."productType",
          p."modelName",
          p."tags",
          p."condition",
          p."conditionGrade",
          p."conditionNote",
          p."mainColor",
          p."homeDeliveryAvailable",
          p."storePickupAvailable",
          p."warrantyMonths",
          p."warrantyType",
          p."warrantyDescription",
          p."metadata",
          (
            SELECT img."url"
            FROM "ProductImage" img
            WHERE img."productId" = p."id"
            ORDER BY img."isPrimary" DESC, img."position" ASC, img."createdAt" ASC
            LIMIT 1
          ) AS "imageUrl",
          ${scoreSql} AS score
        FROM "Product" p
        LEFT JOIN "Category" c ON c."id" = p."categoryId"
        WHERE ${whereSql}
        ORDER BY ${orderBySql}
        LIMIT ${pageSize}
        OFFSET ${offset}
      `);

      const items = rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        price: r.price,
        currency: r.currency,
        imageUrl: r.imageUrl,
        ratingAvg: r.ratingAvg,
        ratingCount: r.ratingCount,
        brand: r.brand,
        productType: r.productType,
        modelName: r.modelName,
        tags: r.tags,
        condition: r.condition,
        conditionGrade: r.conditionGrade,
        conditionNote: r.conditionNote,
        mainColor: r.mainColor,
        homeDeliveryAvailable: r.homeDeliveryAvailable,
        storePickupAvailable: r.storePickupAvailable,
        warrantyMonths: r.warrantyMonths,
        warrantyType: r.warrantyType,
        warrantyDescription: r.warrantyDescription,
        metadata: r.metadata,
      }));

      // ───────────────────────────────────────
      // FACETAS (para filtros dinámicos)
      // ───────────────────────────────────────

      // 1) Brands: ignorando el filtro de brand actual para que puedas cambiarlo
      const baseWhereNoBrand = buildBaseProductWhere({
        ...baseFilterOptions,
        brand: null,
      });
      const whereBrandFacet =
        textWhere != null
          ? sql`${baseWhereNoBrand} AND ${textWhere}`
          : baseWhereNoBrand;

      const brandRows = await app.prisma.$queryRaw<FacetRow[]>(sql`
        SELECT
          p."brand" AS "label",
          COUNT(*) AS "count"
        FROM "Product" p
        LEFT JOIN "Category" c ON c."id" = p."categoryId"
        WHERE ${whereBrandFacet}
          AND p."brand" IS NOT NULL
          AND btrim(p."brand") <> ''
        GROUP BY p."brand"
        ORDER BY COUNT(*) DESC, p."brand" ASC
        LIMIT 20
      `);

      // 2) Product types
      const baseWhereNoType = buildBaseProductWhere({
        ...baseFilterOptions,
        productType: null,
      });
      const whereTypeFacet =
        textWhere != null
          ? sql`${baseWhereNoType} AND ${textWhere}`
          : baseWhereNoType;

      const typeRows = await app.prisma.$queryRaw<FacetRow[]>(sql`
        SELECT
          p."productType" AS "label",
          COUNT(*) AS "count"
        FROM "Product" p
        LEFT JOIN "Category" c ON c."id" = p."categoryId"
        WHERE ${whereTypeFacet}
          AND p."productType" IS NOT NULL
          AND btrim(p."productType") <> ''
        GROUP BY p."productType"
        ORDER BY COUNT(*) DESC, p."productType" ASC
        LIMIT 20
      `);

      // 3) Models
      const baseWhereNoModel = buildBaseProductWhere({
        ...baseFilterOptions,
        model: null,
      });
      const whereModelFacet =
        textWhere != null
          ? sql`${baseWhereNoModel} AND ${textWhere}`
          : baseWhereNoModel;

      const modelRows = await app.prisma.$queryRaw<FacetRow[]>(sql`
        SELECT
          p."modelName" AS "label",
          COUNT(*) AS "count"
        FROM "Product" p
        LEFT JOIN "Category" c ON c."id" = p."categoryId"
        WHERE ${whereModelFacet}
          AND p."modelName" IS NOT NULL
          AND btrim(p."modelName") <> ''
        GROUP BY p."modelName"
        ORDER BY COUNT(*) DESC, p."modelName" ASC
        LIMIT 20
      `);

      // 4) Colors
      const baseWhereNoColor = buildBaseProductWhere({
        ...baseFilterOptions,
        color: null,
      });
      const whereColorFacet =
        textWhere != null
          ? sql`${baseWhereNoColor} AND ${textWhere}`
          : baseWhereNoColor;

      const colorRows = await app.prisma.$queryRaw<FacetRow[]>(sql`
        SELECT
          p."mainColor" AS "label",
          COUNT(*) AS "count"
        FROM "Product" p
        LEFT JOIN "Category" c ON c."id" = p."categoryId"
        WHERE ${whereColorFacet}
          AND p."mainColor" IS NOT NULL
          AND btrim(p."mainColor") <> ''
        GROUP BY p."mainColor"
        ORDER BY COUNT(*) DESC, p."mainColor" ASC
        LIMIT 20
      `);

      // 5) Tags (unnest array)
      const baseWhereNoTags = buildBaseProductWhere({
        ...baseFilterOptions,
        tags: null,
      });
      const whereTagFacet =
        textWhere != null
          ? sql`${baseWhereNoTags} AND ${textWhere}`
          : baseWhereNoTags;

      const tagRows = await app.prisma.$queryRaw<TagFacetRow[]>(sql`
        SELECT
          t.tag AS "label",
          COUNT(*) AS "count"
        FROM "Product" p
        LEFT JOIN "Category" c ON c."id" = p."categoryId"
        CROSS JOIN LATERAL unnest(coalesce(p."tags", ARRAY[]::text[])) AS t(tag)
        WHERE ${whereTagFacet}
          AND btrim(t.tag) <> ''
        GROUP BY t.tag
        ORDER BY COUNT(*) DESC, t.tag ASC
        LIMIT 30
      `);

      const normalizeCount = (c: bigint | number | string): number =>
        typeof c === "bigint"
          ? Number(c)
          : typeof c === "string"
          ? Number(c)
          : (c as number);

      const facets = {
        brands: brandRows
          .filter((r) => r.label && r.label.trim() !== "")
          .map((r) => ({
            value: r.label as string,
            count: normalizeCount(r.count),
          })),
        productTypes: typeRows
          .filter((r) => r.label && r.label.trim() !== "")
          .map((r) => ({
            value: r.label as string,
            count: normalizeCount(r.count),
          })),
        models: modelRows
          .filter((r) => r.label && r.label.trim() !== "")
          .map((r) => ({
            value: r.label as string,
            count: normalizeCount(r.count),
          })),
        colors: colorRows
          .filter((r) => r.label && r.label.trim() !== "")
          .map((r) => ({
            value: r.label as string,
            count: normalizeCount(r.count),
          })),
        tags: tagRows
          .filter((r) => r.label && r.label.trim() !== "")
          .map((r) => ({
            value: r.label,
            count: normalizeCount(r.count),
          })),
      };

      return reply.send({
        items,
        total,
        page,
        pageSize,
        totalPages,
        facets,
      });
    } catch (err) {
      request.log.error({ err }, "search/products failed");
      return reply.status(500).send({ error: "Error en búsqueda" });
    }
  });
}
