import { api } from "@/lib/api";
import type { Address } from "@/features/account/api/addresses";

export type MyOrderItem = {
  productId: string;
  slug?: string;
  name: string;
  quantity: number;
  unitPrice: number; // cents
};
export type MyOrder = {
  id: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "FULFILLED";
  total: number;    // cents
  currency: string; // "usd"
  createdAt: string;
  items: MyOrderItem[];
  shippingAddress?: Address;
};

export async function listMyOrders() {
  return (await api.get("/me/orders")).data as MyOrder[];
}
export async function getMyOrder(id: string) {
  return (await api.get(`/me/orders/${id}`)).data as MyOrder;
}
