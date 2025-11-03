// frontend/src/lib/cloudinary.ts
export {
  getSignature,
  uploadToCloudinary,
  uploadAvatar,
  uploadProductImage,
  uploadCategoryImage,
  deleteCloudinary,
  isCloudinaryUrl,
  extractPublicIdFromUrl,
  type CloudinarySignature,
  type SignatureParams,
} from "@/features/uploads/cloudinary";
