// backend/src/lib/cloudinary.ts
// Config & helpers de Cloudinary (backend)
// - Respeta una raíz (ROOT) tipo "Tienda-Virtual"
// - Mapas de carpetas por alias (root/products/avatars/categories)
// - Normalización de subcarpetas sin duplicar prefijos
// - Guardas para evitar salirte de ROOT

import { v2 as cloudinary } from "cloudinary";

const {
  CLOUDINARY_URL,
  CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
  CLOUDINARY_ROOT,
  CLOUDINARY_PRODUCTS_FOLDER,
  CLOUDINARY_AVATARS_FOLDER,
  CLOUDINARY_CATEGORIES_FOLDER,
  NODE_ENV,
} = process.env;

/* ─────────────────── Config SDK ─────────────────── */

if (CLOUDINARY_URL) {
  cloudinary.config({ secure: true });
} else if (
  CLOUDINARY_CLOUD_NAME &&
  CLOUDINARY_API_KEY &&
  CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  if (NODE_ENV !== "test") {
    console.warn(
      "[cloudinary] Falta CLOUDINARY_URL o {CLOUD_NAME,API_KEY,API_SECRET}"
    );
  }
}

/* ─────────────────── Raíz y utilidades ─────────────────── */

// Normaliza PATH eliminando barras de más y '..'
const norm = (s: string) =>
  s
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/*|\/*$/g, "");

// Raíz fija (por defecto Tienda-Virtual), sin barra final
const ROOT = norm(CLOUDINARY_ROOT || "Tienda-Virtual");

// Mapa oficial de carpetas por alias
export const FOLDERS = {
  root: ROOT,
  products: norm(CLOUDINARY_PRODUCTS_FOLDER || `${ROOT}/products`),
  avatars: norm(CLOUDINARY_AVATARS_FOLDER || `${ROOT}/avatars`),
  categories: norm(CLOUDINARY_CATEGORIES_FOLDER || `${ROOT}/categories`),
} as const;

export type CloudinaryAlias = keyof typeof FOLDERS; // 'root' | 'products' | 'avatars' | 'categories'

/**
 * Asegura que la ruta final esté bajo ROOT.
 * Lanza si intenta escapar (defensa básica).
 */
export function ensureUnderRootOrThrow(path: string): string {
  const p = norm(path);
  if (p === ROOT) return p;
  if (!p.startsWith(`${ROOT}/`)) {
    throw new Error(
      `[cloudinary] Carpeta fuera de ROOT: "${p}" (ROOT="${ROOT}")`
    );
  }
  return p;
}

/**
 * Une alias + folder de forma segura:
 * - Si folder viene con "Tienda-Virtual/..." → se respeta tal cual (y se valida).
 * - Si folder viene con "products/..." → se cuelga de FOLDERS.products.
 * - Si folder es "mi-slug" con alias 'products' → ROOT/products/mi-slug.
 * - Si no pasa folder → base del alias.
 */
export function resolveFolder(input?: {
  alias?: CloudinaryAlias;
  folder?: string;
}) {
  const base = input?.alias ? FOLDERS[input.alias] : FOLDERS.root;
  const sub = input?.folder ? norm(input.folder.replace(/\.\./g, "")) : "";

  let finalFolder: string;

  if (!sub) {
    finalFolder = base;
  } else if (sub.startsWith(`${ROOT}/`)) {
    // Ya vino absoluto bajo ROOT → se respeta
    finalFolder = sub;
  } else if (sub.startsWith("products/")) {
    finalFolder = norm(`${FOLDERS.products}/${sub.replace(/^products\//, "")}`);
  } else if (sub.startsWith("avatars/")) {
    finalFolder = norm(`${FOLDERS.avatars}/${sub.replace(/^avatars\//, "")}`);
  } else if (sub.startsWith("categories/")) {
    finalFolder = norm(
      `${FOLDERS.categories}/${sub.replace(/^categories\//, "")}`
    );
  } else {
    // Relativo al alias/base
    finalFolder = norm(`${base}/${sub}`);
  }

  return ensureUnderRootOrThrow(finalFolder);
}

export { cloudinary };
