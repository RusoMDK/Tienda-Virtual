// src/app/providers.tsx
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BrowserRouter } from "react-router-dom";
import { ToastProvider } from "@/ui";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { CurrencyProvider } from "@/features/currency/CurrencyProvider"; // 👈 NUEVO

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    (async () => {
      try {
        const res = await api.post("/auth/refresh");
        const token = res.data?.accessToken as string;
        useAuthStore.getState().setToken(token || null);
      } catch {
        /* sin sesión inicial, no pasa nada */
      }
    })();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <CurrencyProvider>
          <ToastProvider>{children}</ToastProvider>
        </CurrencyProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
