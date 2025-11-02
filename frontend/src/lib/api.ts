import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/auth";

// ─────────────────────────────────────────────────────────────
// Extiende axios para marcar un reintento
// ─────────────────────────────────────────────────────────────
declare module "axios" {
  export interface AxiosRequestConfig {
    _retry?: boolean;
  }
}

// ─────────────────────────────────────────────────────────────
// Instancia: baseURL "/api" (usa el proxy de Vite) + cookies
// ─────────────────────────────────────────────────────────────
export const api = axios.create({
  baseURL: "/api",
  withCredentials: true, // envía/recibe cookies HttpOnly (refresh)
  headers: {
    Accept: "application/json",
  },
});

/**
 * Base URL que usarán los EventSource (SSE) y cualquier consumidor
 * que necesite construir rutas absolutas hacia la API.
 *
 * Si cambias la base de axios (por env/proxy), aquí se refleja.
 */
export const apiBaseURL: string = api.defaults.baseURL || "/api";

// Adjunta Authorization si tenemos access token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    // No pisar si ya viene seteado explícitamente
    if (!("Authorization" in config.headers)) {
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─────────────────────────────────────────────────────────────
let isRefreshing = false;
let waiters: Array<(token: string | null) => void> = [];

const AUTH_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/refresh",
  "/auth/logout",
];

function extractPath(url?: string): string {
  if (!url) return "";
  try {
    // Asegura que siempre parseamos un pathname absoluto
    const u = new URL(url, window.location.origin);
    // Si pasa por el proxy, /api/... → normalizamos removiendo /api para comparar
    return u.pathname.replace(/^\/api/, "");
  } catch {
    // Fallback defensivo
    return url.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/api/, "");
  }
}

function isAuthRequest(url?: string): boolean {
  const path = extractPath(url);
  return AUTH_PATHS.some((p) => path.startsWith(p));
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    // Usa cookie HttpOnly (withCredentials:true ya está definido en la instancia)
    const res = await api.post("/auth/refresh");
    const newToken = (res.data?.accessToken ?? null) as string | null;
    useAuthStore.getState().setToken(newToken);
    return newToken;
  } catch {
    // Si falla el refresh, limpiamos la sesión
    useAuthStore.getState().clear?.();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    const status = err.response?.status;
    const original = err.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;

    // Si no hay config, no es 401 o es a rutas de auth → no hacer refresh
    if (!original || status !== 401 || isAuthRequest(original.url)) {
      return Promise.reject(err);
    }

    // Evitar loop de reintentos
    if (original._retry) {
      return Promise.reject(err);
    }
    original._retry = true;

    // Si ya hay un refresh en curso, cuélgate de la cola
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        waiters.push((newToken) => {
          if (newToken) {
            original.headers = original.headers ?? {};
            (original.headers as any).Authorization = `Bearer ${newToken}`;
            resolve(api(original));
          } else {
            reject(err);
          }
        });
      });
    }

    // Inicia refresh y notifica a los que esperan
    try {
      isRefreshing = true;
      const newToken = await refreshAccessToken();

      // Despertar a todos los que estaban esperando
      waiters.forEach((fn) => fn(newToken));
      waiters = [];

      if (!newToken) {
        return Promise.reject(err);
      }

      // Reintenta la request original con el nuevo token
      original.headers = original.headers ?? {};
      (original.headers as any).Authorization = `Bearer ${newToken}`;
      return api(original);
    } finally {
      isRefreshing = false;
    }
  }
);
