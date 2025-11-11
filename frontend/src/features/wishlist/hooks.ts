// src/features/wishlist/hooks.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchWishlist,
  addToWishlist,
  removeFromWishlist,
  type WishlistItemDTO,
} from "./api";

export function useWishlist() {
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery<WishlistItemDTO[]>({
    queryKey: ["wishlist"],
    queryFn: fetchWishlist,
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: (productId: string) => addToWishlist(productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => removeFromWishlist(productId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  const items = data ?? [];

  // 👇 IMPORTANTE: siempre trabajamos con IDs de PRODUCTO
  const isFavorite = (productId: string) =>
    items.some((it) => it.productId === productId);

  const toggleFavorite = async (productId: string) => {
    const alreadyFav = isFavorite(productId);
    if (alreadyFav) {
      await removeMutation.mutateAsync(productId);
    } else {
      await addMutation.mutateAsync(productId);
    }
  };

  const isUpdating = addMutation.isPending || removeMutation.isPending;

  return {
    items,
    isLoading,
    isError,
    error,
    isFavorite,
    toggleFavorite,
    isUpdating,
  };
}
