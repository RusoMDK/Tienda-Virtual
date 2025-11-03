// frontend/src/features/account/api/profile.ts
import { api } from "@/lib/api";
// ❌ import { uploadToCloudinary } from "@/lib/cloudinary";
import { uploadAvatar } from "@/lib/cloudinary";

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

/** Sube el avatar firmado por el backend y devuelve { url, publicId }. */
export async function uploadAvatarToCloudinary(
  file: File,
  userId?: string // pásame el id si quieres publicId determinístico
): Promise<{ url: string; publicId: string }> {
  const { url, publicId } = await uploadAvatar(file, userId);
  return { url, publicId };
}
