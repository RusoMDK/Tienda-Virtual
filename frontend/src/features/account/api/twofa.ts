// src/features/account/api/twofa.ts
import { api } from "@/lib/api";

export type TwoFAStatus = {
  enabled: boolean;
  email: string | null;
};

export type InitiateTwoFAResponse = {
  secretBase32: string;
  otpauthUrl: string;
  qrDataUrl: string; // data:image/png;base64,...
};

export async function get2FAStatus() {
  return (await api.get("/me/2fa")).data as TwoFAStatus;
}

export async function initiate2FA() {
  return (await api.post("/me/2fa/initiate", {})).data as InitiateTwoFAResponse;
}

export async function verify2FA(token: string) {
  return (await api.post("/me/2fa/verify", { token })).data as { ok: true; enabled: true };
}

export async function disable2FA(token: string) {
  return (await api.post("/me/2fa/disable", { token })).data as { ok: true; enabled: false };
}
