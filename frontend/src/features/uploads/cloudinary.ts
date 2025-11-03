// frontend/src/features/uploads/cloudinary.ts
// Punto único de verdad para Cloudinary (frontend).
// - Firma con backend (signed upload)
// - Subida con progreso, cancelación y reintentos
// - Helpers de uso por dominio (avatar/product/category) apuntando a Tienda-Virtual/*
// - Borrado centralizado

import { api } from "@/lib/api";

/* ──────────────────────────────────────────────────────────
   Constantes de rutas (raíz fija)
   ────────────────────────────────────────────────────────── */

const CLOUD_ROOT = "Tienda-Virtual";
export const PATHS = {
  root: CLOUD_ROOT,
  products: `${CLOUD_ROOT}/products`,
  categories: `${CLOUD_ROOT}/categories`,
  avatars: `${CLOUD_ROOT}/avatars`,
};

// Sanea segmentos para evitar barras dobles o '..'
const cleanSeg = (s?: string) =>
  (s ?? "").replace(/^\/*|\/*$/g, "").replace(/\.\./g, "");

/* ──────────────────────────────────────────────────────────
   Tipos
   ────────────────────────────────────────────────────────── */

export type CloudinarySignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  publicId?: string | null;
};

export type SignatureParams = {
  /** Raíz lógica que entiende el backend al firmar */
  alias?: "products" | "avatars" | "categories" | "root";
  /** Subcarpeta relativa dentro de la raíz firmada */
  folder?: string;
  /** Nombre fijo (sin extensión) */
  publicId?: string;
  /** Permitir reemplazo si ya existe el public_id */
  overwrite?: boolean;
  /** Invalidar CDN si se reemplaza */
  invalidate?: boolean;
};

type UploadOptions = SignatureParams & {
  /** image | video | raw | auto (default) */
  resourceType?: "auto" | "image" | "video" | "raw";
  /** progreso (0-100) */
  onProgress?: (pct: number) => void;
  /** AbortSignal para cancelar (ej. al cerrar modal) */
  signal?: AbortSignal;
  /** Validación opcional: tamaño máximo en bytes (ej: 5*1024*1024) */
  maxBytes?: number;
  /** Validación opcional: lista blanca de MIME */
  acceptMime?: string[];
  /** Reintentos ante 429/5xx (default 2) */
  retries?: number;
  /** Base ms para backoff exponencial (default 500) */
  retryBaseMs?: number;
};

/* ──────────────────────────────────────────────────────────
   Utils
   ────────────────────────────────────────────────────────── */

function compact<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: Record<string, any> = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

/** Devuelve la firma para un upload firmado. */
export async function getSignature(
  params: SignatureParams = {}
): Promise<CloudinarySignature> {
  const payload = compact({
    alias: params.alias,
    folder: params.folder,
    publicId: params.publicId,
    overwrite: params.overwrite,
    invalidate: params.invalidate,
  });

  const { data } = await api.post<CloudinarySignature>(
    "/cloudinary/signature",
    payload,
    { headers: { "Cache-Control": "no-store" } }
  );
  return data;
}

/** Sube un File/Blob a Cloudinary con firma del backend. */
export async function uploadToCloudinary(
  file: File | Blob,
  opts: UploadOptions = {}
): Promise<{
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
}> {
  // Validaciones opcionales previas
  const size = (file as File).size ?? undefined;
  const type = (file as File).type ?? undefined;

  if (opts.maxBytes && size && size > opts.maxBytes) {
    throw new Error(
      `Archivo demasiado grande: ${(size / (1024 * 1024)).toFixed(2)}MB`
    );
  }
  if (opts.acceptMime && type && !opts.acceptMime.includes(type)) {
    throw new Error(`Tipo no permitido: ${type}`);
  }

  const sig = await getSignature(opts);
  const endpoint = `https://api.cloudinary.com/v1_1/${sig.cloudName}/${
    opts.resourceType ?? "auto"
  }/upload`;

  // Prioriza el publicId explícito, luego el que devolvió el backend
  const publicId = opts.publicId ?? sig.publicId ?? undefined;

  const fd = new FormData();
  fd.set("file", file);
  fd.set("api_key", sig.apiKey);
  fd.set("timestamp", String(sig.timestamp));
  fd.set("signature", sig.signature);
  fd.set("folder", sig.folder); // ← carpeta firmada por el backend (Tienda-Virtual/…)
  if (publicId) fd.set("public_id", publicId);
  if (typeof opts.overwrite === "boolean")
    fd.set("overwrite", String(opts.overwrite));
  if (typeof opts.invalidate === "boolean")
    fd.set("invalidate", String(opts.invalidate));

  const maxRetries = opts.retries ?? 2;
  const baseMs = opts.retryBaseMs ?? 500;

  const doOnce = () =>
    new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint);

      if (opts.signal) {
        const onAbort = () => {
          xhr.abort();
          reject(new Error("Upload aborted"));
        };
        // @ts-expect-error onabort is optional
        opts.signal.addEventListener("abort", onAbort, { once: true });
      }

      xhr.upload.onprogress = (e) => {
        if (opts.onProgress && e.lengthComputable) {
          opts.onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300) resolve(json);
          else
            reject(
              new Error(
                json?.error?.message ??
                  `Cloudinary upload failed: ${xhr.status}`
              )
            );
        } catch (e) {
          reject(e);
        }
      };

      xhr.onerror = () =>
        reject(new Error("Network error while uploading to Cloudinary"));

      xhr.send(fd);
    });

  let attempt = 0;
  // Reintenta en 429/5xx con backoff exponencial
  while (true) {
    try {
      const resp: any = await doOnce();
      return {
        url: resp.secure_url ?? resp.url,
        publicId: resp.public_id ?? (publicId as string) ?? "",
        width: resp.width,
        height: resp.height,
        bytes: resp.bytes,
        format: resp.format,
      };
    } catch (err: any) {
      const msg = String(err?.message ?? "");
      const retriable =
        /429|5\d{2}|timeout|Network error|ECONNRESET|ETIMEDOUT/i.test(msg);
      if (attempt < maxRetries && retriable) {
        const delay = baseMs * Math.pow(2, attempt) + Math.random() * 100;
        await new Promise((r) => setTimeout(r, delay));
        attempt++;
        continue;
      }
      throw err;
    }
  }
}

/** Helper para validar si una URL es de Cloudinary. */
export function isCloudinaryUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (
      u.hostname.endsWith("res.cloudinary.com") ||
      u.hostname.endsWith("cloudinary.com")
    );
  } catch {
    return false;
  }
}

/** Intenta extraer el public_id desde una URL de Cloudinary. */
export function extractPublicIdFromUrl(url?: string | null): string | null {
  if (!isCloudinaryUrl(url || "")) return null;
  try {
    const u = new URL(url!);
    // …/upload/v1699999999/folder/sub/name.ext → "folder/sub/name"
    const idx = u.pathname.indexOf("/upload/");
    if (idx < 0) return null;
    let tail = decodeURIComponent(u.pathname.slice(idx + "/upload/".length));
    // quita vNNNNNNN/
    tail = tail.replace(/^v\d+\//, "");
    // quita extensión
    return tail.replace(/\.[a-z0-9]+$/i, "");
  } catch {
    return null;
  }
}

/** Borra por publicId a través del backend admin. */
export async function deleteCloudinary(publicId: string): Promise<boolean> {
  const { data } = await api.post<{ ok: boolean }>(
    "/admin/uploads/delete",
    { publicId },
    { headers: { "Cache-Control": "no-store" } }
  );
  return !!data?.ok;
}

/* ──────────────────────────────────────────────────────────
   Atajos de uso (apuntan SIEMPRE a Tienda-Virtual/*)
   ────────────────────────────────────────────────────────── */

export function uploadAvatar(
  file: File | Blob,
  userId?: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
) {
  return uploadToCloudinary(file, {
    alias: "root", // Firmamos la ruta completa
    folder: PATHS.avatars,
    publicId: userId ? `avatar_${userId}` : undefined,
    overwrite: !!userId,
    invalidate: !!userId,
    onProgress,
    signal,
    acceptMime: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 5 * 1024 * 1024,
  });
}

export function uploadProductImage(
  file: File | Blob,
  productSlug?: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
) {
  const finalFolder = productSlug
    ? `${PATHS.products}/${cleanSeg(productSlug)}`
    : PATHS.products;

  return uploadToCloudinary(file, {
    alias: "root", // Firmamos la ruta final exacta
    folder: finalFolder, // p.ej. Tienda-Virtual/products/mi-slug
    onProgress,
    signal,
    acceptMime: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 8 * 1024 * 1024,
  });
}

export function uploadCategoryImage(
  file: File | Blob,
  categorySlug?: string,
  onProgress?: (pct: number) => void,
  signal?: AbortSignal
) {
  const finalFolder = categorySlug
    ? `${PATHS.categories}/${cleanSeg(categorySlug)}`
    : PATHS.categories;

  return uploadToCloudinary(file, {
    alias: "root",
    folder: finalFolder, // p.ej. Tienda-Virtual/categories/ropa
    onProgress,
    signal,
    acceptMime: ["image/jpeg", "image/png", "image/webp"],
    maxBytes: 5 * 1024 * 1024,
  });
}
