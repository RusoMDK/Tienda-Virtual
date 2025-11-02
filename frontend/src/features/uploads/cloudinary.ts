// src/features/uploads/cloudinary.ts
import { adminUploadSignature } from "@/features/admin/api";
import { api } from "@/lib/api";

export type CloudinarySignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
};

/** Intenta firmar con /admin/uploads/signature, y si falla, usa /cloudinary/signature (legacy). */
export async function getSignature(params?: {
  folder?: string;
  publicId?: string;
}): Promise<CloudinarySignature> {
  try {
    // firma admin (no recibe params hoy; si pasas folderOverride, lo aplicamos “encima”)
    const sig = await adminUploadSignature();
    return {
      ...sig,
      folder: params?.folder ?? sig.folder,
    };
  } catch {
    // fallback legacy
    const { data } = await api.post<CloudinarySignature>(
      "/cloudinary/signature",
      params ?? {}
    );
    return data;
  }
}

/** Sube un File/Blob a Cloudinary con firma del backend. Devuelve { url, publicId, ... } */
export async function uploadToCloudinary(
  file: File | Blob,
  folderOverride?: string
): Promise<{
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
}> {
  const sig = await getSignature({ folder: folderOverride });

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("signature", sig.signature);
  form.append("folder", sig.folder);

  // resource_type=auto → acepta imágenes, pdfs, etc.
  const url = `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`;
  const res = await fetch(url, { method: "POST", body: form });
  const json = await res.json();

  if (!res.ok) {
    const msg =
      json?.error?.message || `Cloudinary upload failed: ${res.status}`;
    throw new Error(msg);
  }

  return {
    url: json.secure_url as string,
    publicId: json.public_id as string,
    width: json.width as number | undefined,
    height: json.height as number | undefined,
    bytes: json.bytes as number | undefined,
    format: json.format as string | undefined,
  };
}

/** Helper para validar si una URL es de Cloudinary. */
export function isCloudinaryUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.hostname.endsWith("res.cloudinary.com");
  } catch {
    return false;
  }
}
