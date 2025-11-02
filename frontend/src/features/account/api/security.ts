// src/features/account/api/security.ts
import { api } from "@/lib/api";
import axios, { AxiosError } from "axios";

/** Tipos normalizados que usará el frontend siempre */
export type TwoFAStatus = {
  enabled: boolean;
  method: "totp" | null;
  recoveryCodesRemaining?: number;
  email?: string | null;
};

export type Start2FAResponse = {
  secret: string;        // base32
  otpauthUrl: string;
  qr?: string;           // data URL (png/svg) o SVG inline
};

function isNotFound(err: unknown) {
  return axios.isAxiosError(err) && err.response?.status === 404;
}

/* =========================
   STATUS
   ========================= */
export async function get2FAStatus(): Promise<TwoFAStatus> {
  try {
    // Preferimos /me/2fa/status si existe
    const r = await api.get("/me/2fa/status");
    const d = r.data || {};
    return {
      enabled: !!d.enabled,
      method: (d.method ?? (d.enabled ? "totp" : null)) as "totp" | null,
      recoveryCodesRemaining: d.recoveryCodesRemaining ?? undefined,
      email: d.email ?? null,
    };
  } catch (e) {
    if (!isNotFound(e)) throw e;
    // Fallback a /me/2fa (algunas versiones lo exponían así)
    const r2 = await api.get("/me/2fa");
    const d = r2.data || {};
    return {
      enabled: !!d.enabled,
      method: (d.method ?? (d.enabled ? "totp" : null)) as "totp" | null,
      recoveryCodesRemaining: d.recoveryCodesRemaining ?? undefined,
      email: d.email ?? null,
    };
  }
}

/* =========================
   START (setup TOTP)
   ========================= */
export async function start2FASetup(): Promise<Start2FAResponse> {
  const res = await api.post("/me/2fa/start", {});
  const d = res.data || {};
  // Acepta distintos nombres de campos desde backend
  const secret =
    d.secret ??
    d.secretBase32 ??
    d.base32 ??
    ""; // si viniera vacío, el UI mostrará "…"
  const otpauthUrl = d.otpauthUrl ?? d.otpauth_url ?? d.otpauth ?? "";
  const qr = d.qr ?? d.qrDataUrl ?? d.qrCode ?? undefined;

  return { secret, otpauthUrl, qr };
}

/* =========================
   VERIFY (confirma y habilita)
   ========================= */
export async function verify2FASetup(
  code: string
): Promise<{ recoveryCodes: string[] }> {
  const res = await api.post("/me/2fa/verify", { code });
  const d = res.data || {};
  // Normaliza varias variantes: {recoveryCodes?}, {ok, enabled, recoveryCodes?}, etc.
  const list = Array.isArray(d.recoveryCodes) ? d.recoveryCodes : [];
  return { recoveryCodes: list.map(String) };
}

/* =========================
   DISABLE (puede requerir code/password)
   ========================= */
export async function disable2FA(payload?: {
  code?: string;
  password?: string;
}): Promise<{ ok: boolean }> {
  const res = await api.post("/me/2fa/disable", payload ?? {});
  const d = res.data || {};
  // Acepta {ok:true} o {enabled:false} o ambos
  if (typeof d.ok === "boolean") return { ok: d.ok };
  if (typeof d.enabled === "boolean") return { ok: d.enabled === false };
  return { ok: true };
}

/* =========================
   REGENERATE recovery codes
   ========================= */
export async function regenerateRecoveryCodes(): Promise<{
  recoveryCodes: string[];
}> {
  try {
    // Preferimos /me/2fa/recovery-codes si existe
    const r = await api.post("/me/2fa/recovery-codes", {});
    const d = r.data || {};
    const list = Array.isArray(d.recoveryCodes) ? d.recoveryCodes : [];
    return { recoveryCodes: list.map(String) };
  } catch (e) {
    if (!isNotFound(e)) throw e;
    // Fallback a /me/2fa/recovery/regenerate
    const r2 = await api.post("/me/2fa/recovery/regenerate", {});
    const d2 = r2.data || {};
    const list = Array.isArray(d2.recoveryCodes) ? d2.recoveryCodes : [];
    return { recoveryCodes: list.map(String) };
  }
}

/* =========================
   CHANGE PASSWORD
   ========================= */
export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: boolean }> {
  const r = await api.post("/me/change-password", payload);
  const d = r.data || {};
  return { ok: !!(d.ok ?? true) };
}
