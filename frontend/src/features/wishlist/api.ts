// src/features/wishlist/api.ts
import { api } from "@/lib/api";

export type WishlistProductDTO = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  stock: number;
  active: boolean;
  imageUrl: string | null;
};

export type WishlistItemDTO = {
  id: string; // id del registro en wishlist
  productId: string;
  createdAt: string;

  // info de precio histórico vs actual
  priceAtAdd: number;
  priceChanged: boolean;
  priceDirection: "UP" | "DOWN" | "SAME";
  priceDiff: number;
  discountPercent: number | null;

  product: WishlistProductDTO;
};

type WishlistResponse = {
  items: WishlistItemDTO[];
  total: number;
};

export async function fetchWishlist(): Promise<WishlistItemDTO[]> {
  const res = await api.get<WishlistResponse>("/me/wishlist");
  return res.data?.items ?? [];
}

export async function addToWishlist(productId: string): Promise<void> {
  await api.post(`/me/wishlist/${productId}`);
}

export async function removeFromWishlist(productId: string): Promise<void> {
  await api.delete(`/me/wishlist/${productId}`);
}

export async function clearWishlist(): Promise<void> {
  await api.delete("/me/wishlist");
}
