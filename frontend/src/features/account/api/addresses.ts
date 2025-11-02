import { api } from "@/lib/api";

export type Address = {
  id: string;
  recipientName: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string; // ISO 2 letters
  phone?: string | null;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateAddressInput = Omit<Address, "id" | "createdAt" | "updatedAt" | "isDefaultShipping" | "isDefaultBilling"> & {
  setDefaultShipping?: boolean;
  setDefaultBilling?: boolean;
};

export async function listAddresses() {
  return (await api.get("/me/addresses")).data as Address[];
}
export async function createAddress(data: CreateAddressInput) {
  return (await api.post("/me/addresses", data)).data as Address;
}
export async function updateAddress(id: string, data: Partial<CreateAddressInput>) {
  return (await api.patch(`/me/addresses/${id}`, data)).data as Address;
}
export async function setDefaultAddress(id: string, type: "shipping" | "billing") {
  return (await api.patch(`/me/addresses/${id}/default?type=${type}`)).data as Address;
}
export async function deleteAddress(id: string) {
  return (await api.delete(`/me/addresses/${id}`)).data as { ok: boolean };
}
