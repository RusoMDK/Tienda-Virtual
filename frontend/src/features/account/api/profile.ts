// src/features/account/api/profile.ts
import { api } from "@/lib/api";
import { uploadToCloudinary } from "@/lib/cloudinary";

export type Me = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: string;
  avatarUrl?: string | null;
  avatarPublicId?: string | null;
  twoFactorEnabled?: boolean;
};

// ── Perfil ───────────────────────────────────────────────────────────────────
export async function getMe(): Promise<Me> {
  const { data } = await api.get<Me>("/me");
  return data;
}

export type UpdateMePayload = Partial<
  Pick<Me, "name" | "phone" | "avatarUrl" | "avatarPublicId">
>;
export async function updateMe(patch: UpdateMePayload): Promise<Me> {
  const { data } = await api.patch<Me>("/me", patch);
  return data;
}

/**
 * Sube el avatar a Cloudinary con firma del backend y devuelve { url, publicId }.
 * Luego podrás persistir ambos campos con `updateMe({ avatarUrl, avatarPublicId })`.
 */
export async function uploadAvatarToCloudinary(
  file: File
): Promise<{ url: string; publicId: string }> {
  // Puedes cambiar la carpeta si quieres (coincide con el backend)
  const { url, publicId } = await uploadToCloudinary(file, {
    folder: "tienda/avatars",
  });
  return { url, publicId };
}
