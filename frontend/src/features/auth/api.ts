import { api } from "@/lib/api";
import type { User } from "./types";

export async function me(): Promise<User | null> {
  try {
    const { data } = await api.get("/me");
    return data as User;
  } catch (e: any) {
    if (e?.response?.status === 401) return null;
    throw e;
  }
}

export async function login(email: string, password: string, totp?: string): Promise<string> {
  const { data } = await api.post("/auth/login", { email, password, totp });
  return data.accessToken as string; // el backend ya devuelve { accessToken }
}

export async function logout(): Promise<void> {
  try { await api.post("/auth/logout"); } catch {}
}

export async function refresh(): Promise<string | null> {
  try {
    const { data } = await api.post("/auth/refresh");
    return (data?.accessToken as string) ?? null;
  } catch {
    return null;
  }
}

export async function register(input: { email: string; password: string; name?: string }) {
  const { data } = await api.post("/auth/register", input);
  // Tu backend responde { user }
  return data.user as User;
}