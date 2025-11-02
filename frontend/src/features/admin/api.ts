// src/features/admin/api.ts
import { api } from "@/lib/api";

// ───────────────────────────────────────────
// Tipos compartidos
// ───────────────────────────────────────────
export type UImage = { url: string; publicId?: string; position?: number };

export type AdminProductDTO = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  price: number; // centavos
  currency: string;
  stock: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  category?: { name: string; slug: string } | null;
  images?: UImage[]; // si el backend las incluye en GET /admin/products/:id

  // Compatibilidad con UIs antiguas
  categoryName?: string | null;
  categorySlug?: string | null;
};

export type AdminProductsListResp = {
  items: AdminProductDTO[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

// Para categorías (añadimos imagen opcional para subcategorías)
export type AdminCategoryDTO = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  imageUrl?: string | null; // opcional: usado solo en subcategorías
  imagePublicId?: string | null; // opcional: usado solo en subcategorías
};

// ───────────────────────────────────────────
// Inventory / Ledger
// ───────────────────────────────────────────
export type InventoryReason =
  | "ORDER_PLACED"
  | "ORDER_CANCELLED_RESTORE"
  | "MANUAL_ADJUSTMENT"
  | "REFUND_RETURN"
  | string; // fallback por si el backend agrega alguno nuevo

export type StockLedgerItem = {
  id: string;
  delta: number;
  reason: InventoryReason;
  note?: string | null;
  orderId?: string | null;
  createdAt: string;
};

// ───────────────────────────────────────────
// Uploads (Cloudinary helpers del admin)
// ───────────────────────────────────────────
export async function adminUploadSignature() {
  const { data } = await api.post("/admin/uploads/signature");
  return data as {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    folder: string;
    signature: string;
  };
}

export async function adminUploadDelete(publicId: string) {
  const { data } = await api.post("/admin/uploads/delete", { publicId });
  return data as { ok: boolean };
}

// ───────────────────────────────────────────
// Dashboard
// ───────────────────────────────────────────
export async function adminSummary() {
  const { data } = await api.get("/admin/summary");
  return data as {
    products: number;
    orders: number;
    users: number;
    pending: number;
    paid: number;
  };
}

// ───────────────────────────────────────────
// Products
// ───────────────────────────────────────────
export async function adminListProducts(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: "active" | "inactive" | "all";
  cat?: string;
  sort?:
    | "createdAt:desc"
    | "createdAt:asc"
    | "updatedAt:desc"
    | "updatedAt:asc"
    | "price:asc"
    | "price:desc"
    | "name:asc"
    | "name:desc"
    | "stock:asc"
    | "stock:desc";
}) {
  const { data } = await api.get("/admin/products", { params });
  const resp = data as AdminProductsListResp;

  // Compat: añade categoryName/Slug a cada item si vienen anidadas
  resp.items = resp.items.map((p) => ({
    ...p,
    categoryName: p.category?.name ?? null,
    categorySlug: p.category?.slug ?? null,
  }));

  return resp;
}

// Detalle (requiere que tu backend tenga GET /admin/products/:id)
export async function adminGetProduct(id: string) {
  const { data } = await api.get(`/admin/products/${id}`);
  const p = data as AdminProductDTO;
  return {
    ...p,
    categoryName: p.category?.name ?? null,
    categorySlug: p.category?.slug ?? null,
  } as AdminProductDTO;
}

export async function adminCreateProduct(payload: {
  name: string;
  description: string;
  price: number; // centavos
  currency?: string; // "usd" por defecto en backend
  active?: boolean;
  categorySlug?: string;
  images?: UImage[];
}) {
  const { data } = await api.post("/admin/products", payload);
  const p = data as AdminProductDTO;
  return {
    ...p,
    categoryName: p.category?.name ?? null,
    categorySlug: p.category?.slug ?? null,
  } as AdminProductDTO;
}

export async function adminUpdateProduct(
  id: string,
  payload: Partial<{
    name: string;
    description: string;
    price: number; // centavos
    currency: string;
    active: boolean;
    categorySlug?: string | null;
    images: UImage[];
  }>
) {
  const { data } = await api.patch(`/admin/products/${id}`, payload);
  const p = data as AdminProductDTO;
  return {
    ...p,
    categoryName: p.category?.name ?? null,
    categorySlug: p.category?.slug ?? null,
  } as AdminProductDTO;
}

// Activar/desactivar con endpoint dedicado
export async function adminSetProductActive(id: string, active: boolean) {
  const { data } = await api.patch(`/admin/products/${id}/active`, { active });
  return data as { id: string; active: boolean };
}

// Ajuste de stock (ruta: /stock-adjust)
// Ahora acepta opcionalmente reason, note y orderId
export async function adminAdjustStock(
  id: string,
  delta: number,
  reason?: string,
  note?: string,
  orderId?: string
) {
  const body: any = { delta };
  if (typeof reason !== "undefined") body.reason = reason;
  if (typeof note !== "undefined") body.note = note;
  if (typeof orderId !== "undefined") body.orderId = orderId;

  const { data } = await api.post(`/admin/products/${id}/stock-adjust`, body);
  return data as { ok: true; stock: number };
}

// Historial de movimientos de stock (con fallback a alias)
// GET /admin/products/:id/stock-ledger  (alias: /stock-movements)
export async function adminGetStockLedger(productId: string, limit = 50) {
  try {
    const { data } = await api.get(
      `/admin/products/${productId}/stock-ledger`,
      { params: { limit } }
    );
    return data as { items: StockLedgerItem[] };
  } catch {
    // Fallback al alias si el deploy expone /stock-movements
    const { data } = await api.get(
      `/admin/products/${productId}/stock-movements`,
      { params: { limit } }
    );
    return data as { items: StockLedgerItem[] };
  }
}

export async function adminDeleteProduct(id: string) {
  const { data } = await api.delete(`/admin/products/${id}`);
  return data as { ok: boolean };
}

// ───────────────────────────────────────────
// Categories
// ───────────────────────────────────────────
export async function adminListCategories() {
  const { data } = await api.get("/admin/categories");
  // El backend puede o no devolver imageUrl/imagePublicId; lo tipamos como opcional
  return data as AdminCategoryDTO[];
}

// ⚡️ Acepta y envía imageUrl/imagePublicId (el backend puede ignorarlos sin romper)
export async function adminUpsertCategory(payload: {
  id?: string;
  name: string;
  slug: string;
  parentId?: string | null;
  imageUrl?: string | null;
  imagePublicId?: string | null;
}) {
  const body: any = {
    name: payload.name,
    slug: payload.slug,
    parentId: payload.parentId ?? null,
  };

  // Enviar solo si vienen definidos (el backend puede ignorarlos si aún no los soporta)
  if (Object.prototype.hasOwnProperty.call(payload, "imageUrl")) {
    body.imageUrl = payload.imageUrl ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, "imagePublicId")) {
    body.imagePublicId = payload.imagePublicId ?? null;
  }

  if (payload.id) {
    const { data } = await api.patch(`/admin/categories/${payload.id}`, body);
    return data as AdminCategoryDTO;
  } else {
    const { data } = await api.post(`/admin/categories`, body);
    return data as AdminCategoryDTO;
  }
}

export async function adminDeleteCategory(id: string) {
  const { data } = await api.delete(`/admin/categories/${id}`);
  return data as { ok: boolean };
}

// ───────────────────────────────────────────
// Orders
// ───────────────────────────────────────────
export async function adminListOrders(params: {
  page?: number;
  pageSize?: number;
  status?: "PENDING" | "PAID" | "CANCELLED" | "FULFILLED";
  q?: string;
}) {
  const { data } = await api.get("/admin/orders", { params });
  return data as {
    items: Array<{
      id: string;
      status: string;
      total: number;
      currency: string;
      createdAt: string;
      user: { email: string };
      items: Array<{
        quantity: number;
        unitPrice: number;
        product: { name: string; slug: string };
      }>;
    }>;
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export async function adminUpdateOrderStatus(
  id: string,
  status: "PENDING" | "PAID" | "CANCELLED" | "FULFILLED"
) {
  const { data } = await api.patch(`/admin/orders/${id}/status`, { status });
  return data;
}

// ───────────────────────────────────────────
// Users
// ───────────────────────────────────────────
export type AdminUserDTO = {
  id: string;
  email: string;
  name?: string | null;
  role: "ADMIN" | "SUPPORT" | "CUSTOMER" | string; // incluye SUPPORT
  createdAt: string;
  _count?: { orders?: number };
};

export async function adminListUsers(params: {
  page?: number;
  pageSize?: number;
  q?: string;
  role?: "ALL" | "ADMIN" | "SUPPORT" | "CUSTOMER"; // incluye SUPPORT
}) {
  const { data } = await api.get("/admin/users", { params });
  return data as {
    items: AdminUserDTO[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export async function adminUpdateUserRole(
  id: string,
  role: "ADMIN" | "SUPPORT" | "CUSTOMER" // ✅ acepta SUPPORT
) {
  const { data } = await api.patch(`/admin/users/${id}/role`, { role });
  // Retornamos el literal de rol completo (incluye SUPPORT)
  return data as { id: string; role: "ADMIN" | "SUPPORT" | "CUSTOMER" };
}
