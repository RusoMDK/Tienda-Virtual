import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";

function FullscreenSpinner({ label = "Verificando rol…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] px-5 py-4 text-sm opacity-80">
        {label}
      </div>
    </div>
  );
}

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return <FullscreenSpinner />;

  // No logueado → a login con retorno
  if (!user) {
    const next = encodeURIComponent(loc.pathname + loc.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // Logueado pero sin rol ADMIN → fuera
  if (user.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
