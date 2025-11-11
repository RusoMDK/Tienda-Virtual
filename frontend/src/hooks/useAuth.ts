//src/hooks/useAuth.ts

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  me as apiMe,
  login as apiLogin,
  logout as apiLogout,
  refresh as apiRefresh,
} from "@/features/auth/api";
import { useAuthStore } from "@/store/auth";
import type { User } from "@/features/auth/types";

export function useAuth() {
  const qc = useQueryClient();
  const setToken = useAuthStore((s) => s.setToken);
  const setUser = useAuthStore((s) => s.setUser);
  const logoutLocal = useAuthStore((s) => s.logoutLocal);

  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ["me"],
    queryFn: apiMe,
    staleTime: 60_000,
  });

  const login = async (email: string, password: string, totp?: string) => {
    const token = await apiLogin(email, password, totp);
    setToken(token || null);

    const u = await apiMe(); // sincroniza UI
    setUser(u);
    await qc.invalidateQueries({ queryKey: ["me"] });
  };

  const refresh = async () => {
    const token = await apiRefresh();
    setToken(token);
    if (token) {
      const u = await apiMe();
      setUser(u);
      await qc.invalidateQueries({ queryKey: ["me"] });
    } else {
      setUser(null);
    }
    return token;
  };

  const logout = async () => {
    await apiLogout(); // revoca refresh cookie en backend
    logoutLocal(); // limpia token/user en front
    await qc.invalidateQueries({ queryKey: ["me"] });
  };

  return { user, loading: isLoading, login, logout, refresh };
}
