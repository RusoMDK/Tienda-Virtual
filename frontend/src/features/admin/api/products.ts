import { api } from "@/lib/api";
import { uploadProductImage } from "@/lib/cloudinary";

export type AdminProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  stock: number;
  active: boolean;
  category?: { id: string; name: string; slug: string } | null;
  images?: { id: string; url: string; position: number }[];
  createdAt?: string;
  updatedAt?: string;
};

export async function adminListProducts(params: {
  q?: string;
  cat?: string;
  active?: boolean;
  page?: number;
  pageSize?: number;
  sort?: "createdAt:desc" | "createdAt:asc" | "price:asc" | "price:desc";
}) {
  const res = await api.get("/admin/products", {
    params: {
      ...params,
      active:
        typeof params.active === "boolean" ? String(params.active) : undefined,
    },
  });
  return res.data as {
    items: AdminProduct[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export async function adminGetProduct(id: string) {
  const res = await api.get(`/admin/products/${id}`);
  return res.data as AdminProduct;
}

export async function adminCreateProduct(input: {
  name: string;
  description?: string;
  price: number; // cents
  currency?: string;
  active?: boolean;
  categorySlug?: string;
  images?: string[];
}) {
  const res = await api.post("/admin/products", input);
  return res.data as AdminProduct;
}

export async function adminUpdateProduct(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    price: number;
    currency: string;
    active: boolean;
    categorySlug?: string | null;
    images: string[];
  }>
) {
  const res = await api.put(`/admin/products/${id}`, input);
  return res.data as AdminProduct;
}

export async function adminSetActive(id: string, active: boolean) {
  const res = await api.patch(`/admin/products/${id}/active`, { active });
  return res.data as { id: string; active: boolean };
}

export async function adminAdjustStock(
  id: string,
  delta: number,
  reason?: string
) {
  const res = await api.post(`/admin/products/${id}/stock`, { delta, reason });
  return res.data as { ok: true; newStock: number };
}

export async function adminDeleteProduct(id: string) {
  const res = await api.delete(`/admin/products/${id}`);
  return res.data as { ok: true };
}

export async function uploadProductFiles(
  files: Array<File | Blob>,
  productSlug?: string,
  onProgress?: (pct: number) => void
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    // Progreso total aproximado (por archivo)
    const step = 100 / Math.max(1, files.length);
    const { url } = await uploadProductImage(f, productSlug, (p) => {
      onProgress?.(Math.min(100, Math.round(i * step + (p / 100) * step)));
    });
    urls.push(url);
  }
  return urls;
}

/**
 * Flujo recomendado:
 * 1) Crear producto sin imágenes (backend te devuelve id y slug)
 * 2) Subir imágenes a Cloudinary en /Tienda-Virtual/products/<slug>
 * 3) Actualizar producto con las URLs
 */
// ⬇️ Reemplaza ESTE bloque
export async function adminCreateProductWithUploads(
  input: {
    name: string;
    description?: string;
    price: number; // cents
    currency?: string;
    active?: boolean;
    categorySlug?: string;
  },
  files: Array<File | Blob>,
  onProgress?: (pct: number) => void
) {
  const created = await adminCreateProduct({ ...input, images: [] });

  // ❌ Antes:
  // const urls = await uploadProductFiles(files, created.slug, onProgress);

  // ✅ Ahora (paralelo):
  const urls = await uploadProductFilesParallel(
    files,
    created.slug,
    onProgress
  );

  const updated = await adminUpdateProduct(created.id, { images: urls });
  return updated;
}

// ⬇️ Reemplaza ESTE bloque
export async function adminReplaceProductImages(
  productId: string,
  productSlug: string,
  files: Array<File | Blob>,
  onProgress?: (pct: number) => void
) {
  // ❌ Antes:
  // const urls = await uploadProductFiles(files, productSlug, onProgress);

  // ✅ Ahora (paralelo):
  const urls = await uploadProductFilesParallel(files, productSlug, onProgress);

  const updated = await adminUpdateProduct(productId, { images: urls });
  return updated;
}

export async function uploadProductFilesParallel(
  files: Array<File | Blob>,
  productSlug?: string,
  onProgress?: (pct: number) => void
): Promise<string[]> {
  if (!files?.length) return [];

  // Progreso por archivo (0..100), luego agregamos el promedio
  const perFile = new Array(files.length).fill(0);

  const setProgress = (i: number, p: number) => {
    perFile[i] = Math.max(0, Math.min(100, p | 0));
    const avg = perFile.reduce((a, b) => a + b, 0) / files.length;
    onProgress?.(Math.round(avg));
  };

  const uploads = files.map((f, i) =>
    uploadProductImage(f, productSlug, (p) => setProgress(i, p)).then(
      ({ url }) => url
    )
  );

  const urls = await Promise.all(uploads);
  onProgress?.(100);
  return urls;
}
