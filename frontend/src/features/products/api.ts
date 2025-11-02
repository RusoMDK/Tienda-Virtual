// src/features/products/api.ts
import { api } from "@/lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────
export type SortOption =
  | "createdAt:desc"
  | "createdAt:asc"
  | "price:asc"
  | "price:desc";

export type ProductDTO = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;      // centavos
  currency: string;   // "usd"
  stock: number;      // existencias
  active: boolean;
  categoryId?: string | null;
  createdAt: string;  // ISO
  updatedAt: string;  // ISO
};

export type ProductListResponse = {
  items: ProductDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12 as const;
const DEFAULT_SORT: SortOption = "createdAt:desc";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function normalizeListParams(input: {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: SortOption;
  cat?: string;            // <— coincide con el backend
  category?: string;       // alias opcional que convertimos a cat
  subcategory?: string;    // alias opcional que convertimos a cat
}) {
  // Acepta alias category/subcategory y los colapsa en "cat"
  const cat = input.cat ?? input.subcategory ?? input.category;

  const page = clamp(Number(input.page ?? DEFAULT_PAGE) | 0, 1, 10_000);
  const pageSize = clamp(Number(input.pageSize ?? DEFAULT_PAGE_SIZE) | 0, 1, 100);
  const q = (input.q ?? "").trim();
  const sort: SortOption =
    input.sort && ["createdAt:desc","createdAt:asc","price:asc","price:desc"].includes(input.sort)
      ? input.sort
      : DEFAULT_SORT;

  return { page, pageSize, q, sort, cat };
}

function unwrap<T>(p: Promise<{ data: T }>): Promise<T> {
  return p.then(r => r.data);
}

function isAxiosNotFound(e: any) {
  return !!(e?.response && e.response.status === 404);
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lista de productos con filtros/paginación.
 * Acepta alias `category` o `subcategory`, pero envía `cat` al backend.
 */
export async function listProducts(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  /** usa `cat` con slug de la cate (padre o sub). `category`/`subcategory` también valen. */
  cat?: string;
  category?: string;
  subcategory?: string;
  sort?: SortOption;
}): Promise<ProductListResponse> {
  const { page, pageSize, q, sort, cat } = normalizeListParams(params ?? {});
  // Nota: si cat está vacío, no lo mandamos para no “ensuciar” el cache key del servidor
  const query: Record<string, any> = { page, pageSize, q, sort };
  if (cat) query.cat = cat;

  try {
    return await unwrap(api.get<ProductListResponse>("/products", { params: query }));
  } catch (e: any) {
    // Propaga 404 tal cual, el resto lo envuelve con mensaje genérico
    if (isAxiosNotFound(e)) throw e;
    throw new Error(e?.response?.data?.message || "No se pudo cargar el catálogo");
  }
}

/** Trae un producto por slug. */
export async function getProduct(slug: string): Promise<ProductDTO> {
  if (!slug) throw new Error("slug requerido");
  try {
    return await unwrap(api.get<ProductDTO>(`/products/${encodeURIComponent(slug)}`));
  } catch (e: any) {
    if (isAxiosNotFound(e)) {
      const err = new Error("PRODUCT_NOT_FOUND");
      (err as any).code = "NOT_FOUND";
      throw err;
    }
    throw new Error(e?.response?.data?.message || "No se pudo cargar el producto");
  }
}

/**
 * Productos relacionados.
 * - Si das `cat`, busca en esa categoría (excluye el `excludeSlug`).
 * - Si no hay `cat`, devuelve “más del catálogo” ordenado por sort (excluye `excludeSlug`).
 */
export async function getRelatedProducts(opts: {
  excludeSlug: string;
  cat?: string;
  limit?: number;         // default: 6
  sort?: SortOption;      // default: createdAt:desc
}): Promise<ProductDTO[]> {
  const limit = clamp(Number(opts.limit ?? 6) | 0, 1, 24);
  const res = await listProducts({
    page: 1,
    pageSize: limit + 1, // pedimos uno extra por si el primero es el excluido
    sort: opts.sort ?? DEFAULT_SORT,
    cat: opts.cat,
  });
  const filtered = res.items.filter((p) => p.slug !== opts.excludeSlug);
  return filtered.slice(0, limit);
}

/**
 * Helper completo: trae un producto y una lista de relacionados en un solo call de alto nivel.
 * Si no pasas `cat`, los relacionados serán “más del catálogo”.
 */
export async function getProductWithRelated(slug: string, opts?: {
  relatedLimit?: number;
  relatedCat?: string;
  relatedSort?: SortOption;
}): Promise<{ product: ProductDTO; related: ProductDTO[] }> {
  const product = await getProduct(slug);
  const related = await getRelatedProducts({
    excludeSlug: product.slug,
    cat: opts?.relatedCat,
    limit: opts?.relatedLimit ?? 6,
    sort: opts?.relatedSort,
  });
  return { product, related };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utils opcionales (por si te vienen bien en las vistas/UI)
// ─────────────────────────────────────────────────────────────────────────────

/** Formatea centavos a USD (o la moneda del producto, si quisieras extenderlo). */
export function formatCentsUSD(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
    .format(Math.max(0, Math.round(cents)) / 100);
}
