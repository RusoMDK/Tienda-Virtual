// src/utils/searchUtils.ts
import { Prisma } from "@prisma/client";

export type SearchQueryInfo = {
  raw: string; // lo que escribió el usuario
  normalized: string; // normalizado sin tildes, símbolos, minúsculas
  terms: string[]; // tokens básicos
  expandedTerms: string[]; // tokens + sinónimos (plano)
};

const MAX_TERMS = 6;

/**
 * Normaliza texto para búsqueda:
 * - pasa a minúsculas
 * - quita tildes / diacríticos
 * - unifica b/v
 * - quita símbolos raros
 * - colapsa espacios
 */
export function normalizeSearchText(input: string): string {
  if (!input) return "";

  let s = input.toLowerCase();

  // Normaliza Unicode y quita diacríticos (áéíóúüñ -> aeiouun)
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Unificar b/v (ayuda en errores típicos)
  s = s.replace(/b/g, "v");

  // Reemplazar cualquier cosa que no sea a-z0-9 por espacios
  s = s.replace(/[^a-z0-9]+/g, " ");

  // Colapsar espacios
  s = s.trim().replace(/\s+/g, " ");

  return s;
}

/**
 * Tokeniza la query normalizada en palabras.
 */
function tokenize(normalized: string): string[] {
  if (!normalized) return [];
  return normalized
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
    .slice(0, MAX_TERMS);
}

/**
 * Sinónimos / términos relacionados para e-commerce en español,
 * pensado en tus categorías.
 */
const SYNONYM_GROUPS: string[][] = [
  // ───── Alimento / comida / supermercado ─────
  [
    "alimento",
    "alimentos",
    "comida",
    "comestible",
    "comestibles",
    "mercado",
    "supermercado",
    "abasto",
    "abarrotes",
    "bodega",
    "snack",
    "snacks",
    "merienda",
    "galleta",
    "galletas",
    "dulce",
    "dulces",
    "confiteria",
    "arroz",
    "granos",
    "frijoles",
    "frijol",
    "azucar",
    "sal",
    "harina",
    "leche",
    "lacteos",
    "yogur",
    "queso",
    "cafe",
    "te",
    "bebida",
    "bebidas",
    "refresco",
    "refrescos",
    "gaseosa",
  ],

  // ───── Aseo y limpieza (hogar y personal) ─────
  [
    "aseo",
    "limpieza",
    "higiene",
    "detergente",
    "detergentes",
    "jabon",
    "jabones",
    "champu",
    "shampoo",
    "suavizante",
    "suavizantes",
    "cloro",
    "lejia",
    "desinfectante",
    "desinfectantes",
    "limpiador",
    "limpiadores",
    "lavaplatos",
    "lavavajillas",
    "esponja",
    "estropajo",
    "trapeador",
    "mopa",
    "escoba",
    "recogedor",
    "ambientador",
    "desodorante",
    "toalla",
    "toallas",
    "papel",
    "papel higienico",
  ],

  // ───── Electrodomésticos ─────
  [
    "electrodomestico",
    "electrodomesticos",
    "nevera",
    "refrigerador",
    "frigorifico",
    "heladera",
    "congelador",
    "freezer",
    "lavadora",
    "secadora",
    "lavasecarropas",
    "microondas",
    "horno",
    "cocina",
    "cocina electrica",
    "cocina gas",
    "batidora",
    "licuadora",
    "procesador",
    "procesadora",
    "ventilador",
    "clima",
    "aire",
    "aire acondicionado",
    "ac",
    "plancha",
    "cafetera",
    "tostadora",
    "freidora",
    "olla",
    "olla arrocera",
  ],

  // ───── Fontanería / plomería ─────
  [
    "fontaneria",
    "plomeria",
    "plomero",
    "grifo",
    "griferia",
    "llave",
    "llave de agua",
    "tuberia",
    "tuberias",
    "manguera",
    "pvc",
    "desague",
    "sifon",
    "valvula",
    "sanitario",
    "sanitarios",
    "lavamanos",
    "lavabo",
    "fregadero",
    "lavaplatos",
    "ducha",
    "regadera",
    "inodoro",
    "comoda",
    "cisterna",
    "tanque",
  ],

  // ───── Tecnología / electrónica ─────
  [
    "tecnologia",
    "electronica",
    "pc",
    "computadora",
    "ordenador",
    "laptop",
    "portatil",
    "notebook",
    "tablet",
    "movil",
    "celular",
    "telefono",
    "smartphone",
    "smartwatch",
    "reloj inteligente",
    "consola",
    "playstation",
    "ps4",
    "ps5",
    "xbox",
    "nintendo",
    "switch",
    "tv",
    "televisor",
    "television",
    "pantalla",
    "monitor",
    "impresora",
    "multifuncion",
    "router",
    "modem",
    "access point",
    "camara",
    "camara web",
    "webcam",
    "teclado",
    "mouse",
    "raton",
    "auriculares",
    "audifonos",
    "cascos",
    "usb",
    "memoria",
    "sd",
    "micro sd",
    "ssd",
    "hdd",
  ],

  // ───── Vehículos / piezas / accesorios ─────
  [
    "vehiculo",
    "vehiculos",
    "auto",
    "carro",
    "coche",
    "moto",
    "motocicleta",
    "bicicleta",
    "bici",
    "ebike",
    "bicicleta electrica",
    "patin",
    "patinete",
    "scooter",
    "camion",
    "camioneta",
    "pickup",
    "guagua",
    "bus",
    "llanta",
    "llantas",
    "goma",
    "gomas",
    "neumatico",
    "neumaticos",
    "aceite motor",
    "lubricante",
    "lubricantes",
    "filtro",
    "filtros",
    "bujia",
    "bujias",
    "bateria",
    "baterias",
    "amortiguador",
    "amortiguadores",
  ],

  // ───── Teléfonos (extra fino) ─────
  ["movil", "celular", "telefono", "smartphone", "cel"],

  // ───── Ordenadores (extra fino) ─────
  ["laptop", "portatil", "notebook", "ordenador", "computadora", "pc"],

  // ───── TV (extra fino) ─────
  ["tv", "televisor", "television", "pantalla"],

  // ───── Audio personal ─────
  ["auriculares", "audifonos", "cascos", "headset"],
];

/**
 * Construye un mapa palabra → sinónimos, a partir de los grupos.
 */
const SYNONYM_MAP: Map<string, Set<string>> = (() => {
  const map = new Map<string, Set<string>>();

  for (const group of SYNONYM_GROUPS) {
    const normGroup = group.map((w) => normalizeSearchText(w)).filter(Boolean);

    for (const w of normGroup) {
      if (!map.has(w)) map.set(w, new Set());
      const set = map.get(w)!;
      for (const other of normGroup) {
        if (other !== w) set.add(other);
      }
    }
  }

  return map;
})();

/**
 * Expande tokens con sinónimos, en el mismo espacio normalizado.
 */
function expandTokensWithSynonyms(tokens: string[]): string[] {
  const out = new Set<string>();
  for (const t of tokens) {
    if (!t) continue;
    out.add(t);
    const syns = SYNONYM_MAP.get(t);
    if (syns) {
      for (const s of syns) out.add(s);
    }
  }
  return Array.from(out);
}

/**
 * Info completa de la query para usar en las rutas.
 */
export function buildSearchQueryInfo(
  raw: string | undefined | null
): SearchQueryInfo {
  const trimmed = (raw || "").trim();
  const normalized = normalizeSearchText(trimmed);
  const terms = tokenize(normalized);
  const expandedTerms = expandTokensWithSynonyms(terms);

  return {
    raw: trimmed,
    normalized,
    terms,
    expandedTerms,
  };
}

/**
 * Helper para parsear ints de querystring.
 */
export function parseIntParam(
  value: string | undefined | null,
  fallback: number
): number {
  if (!value) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

/**
 * Helper para precios en centavos (minPrice/maxPrice en unidades).
 * Acepta "10", "10.50" o "10,50".
 */
export function parsePriceParamToCents(
  value: string | undefined | null
): number | null {
  if (!value) return null;
  const normalized = value.replace(",", ".");
  const n = Number(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/**
 * Build WHERE base común a /search/products y /search/suggest.
 * Devuelve el SQL parcial (sin la palabra WHERE).
 */
export function buildBaseProductWhere(opts: {
  catSlug?: string | null;
  ratingFilter?: number | null;
  condition?: string | null;
  minPriceCents?: number | null;
  maxPriceCents?: number | null;
  color?: string | null;
  homeDelivery?: boolean | null;
  minWarrantyMonths?: number | null;

  // nuevos filtros "estructurados"
  brand?: string | null;
  productType?: string | null;
  model?: string | null; // para p."modelName"
  tags?: string[] | null;
}): Prisma.Sql {
  const { sql } = Prisma;

  // Siempre pedimos productos activos
  let where: Prisma.Sql = sql`p."active" = true`;

  // Categoría por slug (padre o hijo directo)
  if (opts.catSlug && opts.catSlug !== "all") {
    const catSlug = opts.catSlug.trim().toLowerCase();
    if (catSlug) {
      where = sql`${where} AND (
        lower(coalesce(c."slug", '')) = ${catSlug}
        OR c."parentId" = (
          SELECT c2."id"
          FROM "Category" c2
          WHERE lower(c2."slug") = ${catSlug}
          LIMIT 1
        )
      )`;
    }
  }

  if (opts.ratingFilter && opts.ratingFilter > 0) {
    where = sql`${where} AND p."ratingAvg" >= ${opts.ratingFilter} AND p."ratingCount" > 0`;
  }

  if (
    opts.condition &&
    ["NEW", "USED", "REFURBISHED"].includes(opts.condition)
  ) {
    where = sql`${where} AND p."condition" = ${opts.condition}`;
  }

  if (opts.minPriceCents != null) {
    where = sql`${where} AND p."price" >= ${opts.minPriceCents}`;
  }

  if (opts.maxPriceCents != null) {
    where = sql`${where} AND p."price" <= ${opts.maxPriceCents}`;
  }

  if (opts.color && opts.color.trim()) {
    const normColor = normalizeSearchText(opts.color);
    if (normColor) {
      where = sql`${where} AND unaccent(lower(coalesce(p."mainColor", ''))) ILIKE '%' || ${normColor} || '%'`;
    }
  }

  if (opts.homeDelivery === true) {
    where = sql`${where} AND p."homeDeliveryAvailable" = true`;
  } else if (opts.homeDelivery === false) {
    where = sql`${where} AND p."homeDeliveryAvailable" = false`;
  }

  if (opts.minWarrantyMonths != null) {
    where = sql`${where} AND p."warrantyMonths" >= ${opts.minWarrantyMonths}`;
  }

  // ───── Filtros nuevos estructurados ─────

  if (opts.brand && opts.brand.trim()) {
    const normBrand = normalizeSearchText(opts.brand);
    if (normBrand) {
      // Igualamos en espacio normalizado
      where = sql`${where} AND unaccent(lower(coalesce(p."brand", ''))) = ${normBrand}`;
    }
  }

  if (opts.productType && opts.productType.trim()) {
    const normType = normalizeSearchText(opts.productType);
    if (normType) {
      where = sql`${where} AND unaccent(lower(coalesce(p."productType", ''))) = ${normType}`;
    }
  }

  if (opts.model && opts.model.trim()) {
    const normModel = normalizeSearchText(opts.model);
    if (normModel) {
      where = sql`${where} AND unaccent(lower(coalesce(p."modelName", ''))) = ${normModel}`;
    }
  }

  if (opts.tags && opts.tags.length > 0) {
    // filtros por tags: OR lógico → productos que contengan ALGUNO de los tags
    // p."tags" es text[], el parámetro también se envía como text[]
    where = sql`${where} AND p."tags" && ${opts.tags}`;
  }

  return where;
}

/**
 * WHERE específico para la query de texto (filtro duro).
 *
 * Estrategia:
 * - Usamos los tokens base (`terms`).
 * - Para cada token, generamos un grupo (token + sinónimos).
 * - Un producto debe cumplir TODOS los grupos (AND entre grupos).
 * - Dentro de cada grupo, basta con que aparezca uno de los términos
 *   (OR entre token y sinónimos).
 *
 * Ahora también se tiene en cuenta:
 * - brand
 * - productType
 * - modelName
 * - tags (unnest)
 */
export function buildTextSearchWhere(info: SearchQueryInfo): Prisma.Sql | null {
  const { sql } = Prisma;

  const tokens = info.terms;
  if (!tokens.length) return null;

  let combined: Prisma.Sql | null = null;

  for (const term of tokens) {
    if (!term || term.length < 2) continue;

    const candidates = new Set<string>();
    candidates.add(term);

    const syns = SYNONYM_MAP.get(term);
    if (syns) {
      for (const s of syns) candidates.add(s);
    }

    let group: Prisma.Sql | null = null;

    for (const cand of candidates) {
      const clause = sql`
        unaccent(lower(p."name")) ILIKE '%' || ${cand} || '%'
        OR unaccent(lower(coalesce(p."description", ''))) ILIKE '%' || ${cand} || '%'
        OR unaccent(lower(coalesce(p."brand", ''))) ILIKE '%' || ${cand} || '%'
        OR unaccent(lower(coalesce(p."productType", ''))) ILIKE '%' || ${cand} || '%'
        OR unaccent(lower(coalesce(p."modelName", ''))) ILIKE '%' || ${cand} || '%'
        OR unaccent(lower(coalesce(c."name", ''))) ILIKE '%' || ${cand} || '%'
        OR unaccent(lower(coalesce(c."slug", ''))) ILIKE '%' || ${cand} || '%'
        OR EXISTS (
          SELECT 1
          FROM unnest(coalesce(p."tags", ARRAY[]::text[])) AS t(tag)
          WHERE unaccent(lower(t.tag)) ILIKE '%' || ${cand} || '%'
        )
      `;

      if (!group) {
        group = sql`(${clause})`;
      } else {
        group = sql`${group} OR (${clause})`;
      }
    }

    if (!group) continue;

    if (!combined) {
      combined = group;
    } else {
      combined = sql`${combined} AND ${group}`;
    }
  }

  return combined;
}

/**
 * Expresión de score (para ORDER BY) basada en trigram.
 * Combina nombre, descripción, marca, tipo, modelo y categoría.
 * NO filtra, solo ordena.
 *
 * Requiere:
 *   CREATE EXTENSION IF NOT EXISTS unaccent;
 *   CREATE EXTENSION IF NOT EXISTS pg_trgm;
 */
export function buildTextSearchScore(info: SearchQueryInfo): Prisma.Sql {
  const { sql } = Prisma;
  if (!info.normalized) return sql`0`;

  const q = info.normalized;
  return sql`
    (
      similarity(unaccent(lower(p."name")), ${q}) * 0.45
      + similarity(unaccent(lower(coalesce(p."description", ''))), ${q}) * 0.2
      + similarity(unaccent(lower(coalesce(p."brand", ''))), ${q}) * 0.1
      + similarity(unaccent(lower(coalesce(p."productType", ''))), ${q}) * 0.1
      + similarity(unaccent(lower(coalesce(p."modelName", ''))), ${q}) * 0.1
      + similarity(unaccent(lower(coalesce(c."name", ''))), ${q}) * 0.03
      + similarity(unaccent(lower(coalesce(c."slug", ''))), ${q}) * 0.02
    )
  `;
}
