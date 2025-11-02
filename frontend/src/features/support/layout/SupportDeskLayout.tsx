import { Outlet, Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function SupportDeskLayout() {
  const { logout, user } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[rgb(var(--bg-rgb))]">
      <header className="sticky top-0 z-30 border-b border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))]">
        <div className="container flex h-14 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)]"
              title="Volver a la tienda"
            >
              tienda
            </Link>
            <span className="opacity-40">/</span>
            <span className="font-semibold">Soporte</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="opacity-70 hidden sm:inline">
              {user?.name || user?.email}
            </span>
            <button
              onClick={() => {
                logout();
                nav("/login");
              }}
              className="inline-flex items-center gap-2 rounded-lg border px-2 py-1 hover:bg-[rgb(var(--muted-rgb))]"
              title="Salir"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="container py-4">
        <Outlet />
      </main>
    </div>
  );
}
