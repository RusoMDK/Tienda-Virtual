import { api } from "@/lib/api";

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
      active: typeof params.active === "boolean" ? String(params.active) : undefined,
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

export async function adminUpdateProduct(id: string, input: Partial<{
  name: string;
  description: string;
  price: number;
  currency: string;
  active: boolean;
  categorySlug?: string | null;
  images: string[];
}>) {
  const res = await api.put(`/admin/products/${id}`, input);
  return res.data as AdminProduct;
}

export async function adminSetActive(id: string, active: boolean) {
  const res = await api.patch(`/admin/products/${id}/active`, { active });
  return res.data as { id: string; active: boolean };
}

export async function adminAdjustStock(id: string, delta: number, reason?: string) {
  const res = await api.post(`/admin/products/${id}/stock`, { delta, reason });
  return res.data as { ok: true; newStock: number };
}

export async function adminDeleteProduct(id: string) {
  const res = await api.delete(`/admin/products/${id}`);
  return res.data as { ok: true };
}
