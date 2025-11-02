// features/admin/layout/AdminLayout.tsx
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useMemo } from "react";
import Container from "@/layout/Container";
import {
  BarChart3,
  Package,
  FolderTree,
  Receipt,
  Users,
  Banknote,
  LifeBuoy,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function AdminLayout() {
  const loc = useLocation();
  const { user } = useAuth(); // { user, loading }

  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "ADMIN" || user?.role === "SUPPORT";

  const title = useMemo(() => {
    const p = loc.pathname.replace(/\/+$/, "");
    if (p === "/admin" || p === "/admin/") return "Dashboard";
    if (p.startsWith("/admin/products")) return "Productos";
    if (p.startsWith("/admin/categories")) return "Categorías";
    if (p.startsWith("/admin/orders")) return "Órdenes";
    if (p.startsWith("/admin/users")) return "Usuarios";
    if (p.startsWith("/admin/fx")) return "Tasas FX";
    if (p.startsWith("/admin/support")) return "Soporte";
    return "Administración";
  }, [loc.pathname]);

  const linkCls =
    "px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm hover:opacity-90 flex items-center gap-2";
  const active =
    "border-[var(--primary)] text-[var(--primary-foreground)] bg-[var(--primary)]";

  return (
    <Container className="py-8">
      <h1 className="text-2xl font-bold mb-4">{title}</h1>

      <nav
        aria-label="Navegación de administración"
        className="flex gap-2 mb-6 flex-wrap"
      >
        {/* ADMIN ve todo */}
        {isAdmin && (
          <>
            <NavLink
              to="/admin"
              end
              className={({ isActive }) =>
                `${linkCls} ${isActive ? active : ""}`
              }
            >
              <BarChart3 size={16} />
              <span>Dashboard</span>
            </NavLink>
            <NavLink
              to="/admin/products"
              className={({ isActive }) =>
                `${linkCls} ${isActive ? active : ""}`
              }
            >
              <Package size={16} />
              <span>Productos</span>
            </NavLink>
            <NavLink
              to="/admin/categories"
              className={({ isActive }) =>
                `${linkCls} ${isActive ? active : ""}`
              }
            >
              <FolderTree size={16} />
              <span>Categorías</span>
            </NavLink>
            <NavLink
              to="/admin/orders"
              className={({ isActive }) =>
                `${linkCls} ${isActive ? active : ""}`
              }
            >
              <Receipt size={16} />
              <span>Órdenes</span>
            </NavLink>
            <NavLink
              to="/admin/users"
              className={({ isActive }) =>
                `${linkCls} ${isActive ? active : ""}`
              }
            >
              <Users size={16} />
              <span>Usuarios</span>
            </NavLink>
            <NavLink
              to="/admin/fx"
              className={({ isActive }) =>
                `${linkCls} ${isActive ? active : ""}`
              }
            >
              <Banknote size={16} />
              <span>Tasas&nbsp;FX</span>
            </NavLink>
          </>
        )}

        {/* STAFF (ADMIN o SUPPORT) ven “Soporte” */}
        {isStaff && (
          <NavLink
            to="/admin/support"
            className={({ isActive }) => `${linkCls} ${isActive ? active : ""}`}
          >
            <LifeBuoy size={16} />
            <span>Soporte</span>
          </NavLink>
        )}
      </nav>

      <Outlet />
    </Container>
  );
}
