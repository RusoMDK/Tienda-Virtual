import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

export default function StaffRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.accessToken);
  const setToken = useAuthStore((s) => s.setToken);
  const [state, setState] = useState<"checking" | "allowed" | "denied">(
    token ? "checking" : "checking"
  );
  const [roleOk, setRoleOk] = useState<boolean | null>(null);
  const loc = useLocation();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Asegura access token (como ProtectedRoute)
        if (!token) {
          const res = await api.post("/auth/refresh");
          const newToken = res.data?.accessToken || null;
          if (!mounted) return;
          setToken(newToken);
          if (!newToken) {
            setState("denied");
            return;
          }
        }
        setState("allowed");

        // Consulta /me para validar rol
        const me = await api.get("/me");
        const role = me.data?.role as string | undefined;
        if (!mounted) return;
        setRoleOk(role === "ADMIN" || role === "SUPPORT");
      } catch {
        if (!mounted) return;
        setState("denied");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token, setToken]);

  if (state === "checking" || roleOk === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] px-5 py-4 text-sm opacity-80">
          Autenticando…
        </div>
      </div>
    );
  }

  if (state === "denied" || !roleOk) {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`}
        replace
      />
    );
  }

  return children;
}
