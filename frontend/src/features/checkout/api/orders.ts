import { api } from "@/lib/api";

export async function createOrder(payload: {
  currency: string;
  items: { productId: string; quantity: number }[];
  email: string;
  recipientName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  shippingTotal?: number;
  couponCode?: string;
}) {
  return (await api.post("/orders", payload)).data as { orderId: string; total: number; currency: string };
}

export async function startStripeCheckout(orderId: string) {
  return (await api.post("/payments/stripe/checkout", { orderId })).data as { url: string };
}

export async function cancelPayment(orderId: string) {
  return (await api.post("/payments/cancel", { orderId })).data;
}
