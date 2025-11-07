// src/features/admin/layout/AdminLayout.tsx
import { useMemo } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  Package,
  FolderTree,
  Receipt,
  Users,
  Banknote,
  LifeBuoy,
  LayoutTemplate,
  Home as HomeIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import AdminContainer from "./AdminContainer";

export default function AdminLayout() {
  const loc = useLocation();
  const { user, loading } = useAuth();

  const isAdmin = user?.role === "ADMIN";
  const isStaff = user?.role === "ADMIN" || user?.role === "SUPPORT";

  const title = useMemo(() => {
    const p = loc.pathname.replace(/\/+$/, "");
    if (p === "/admin" || p === "/admin/") return "Dashboard";
    if (p.startsWith("/admin/home")) return "Inicio";
    if (p.startsWith("/admin/products")) return "Productos";
    if (p.startsWith("/admin/categories")) return "Categorías";
    if (p.startsWith("/admin/orders")) return "Órdenes";
    if (p.startsWith("/admin/users")) return "Usuarios";
    if (p.startsWith("/admin/fx")) return "Tasas FX";
    if (p.startsWith("/admin/support")) return "Soporte";
    return "Administración";
  }, [loc.pathname]);

  const roleLabel = useMemo(() => {
    if (!user?.role) return "Sin rol";
    if (user.role === "ADMIN") return "Administrador";
    if (user.role === "SUPPORT") return "Soporte";
    return user.role;
  }, [user?.role]);

  const baseLinkCls =
    "px-3 py-2 rounded-xl border text-sm flex items-center gap-2 transition-colors whitespace-nowrap";
  const inactiveLinkCls =
    "border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] hover:bg-[rgb(var(--muted-rgb))]/70";
  const activeLinkCls =
    "border-[rgb(var(--accent-rgb))] bg-[rgb(var(--accent-rgb))] text-black";

  if (!loading && !isAdmin && !isStaff) {
    return (
      <AdminContainer className="py-8">
        <div className="rounded-2xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] p-6">
          <h1 className="text-xl font-semibold mb-2">Sin permisos</h1>
          <p className="text-sm opacity-80 mb-4">
            No tienes acceso al panel de administración.
          </p>
          <NavLink
            to="/"
            className="inline-flex items-center gap-2 text-sm rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] px-3 py-2 hover:bg-[rgb(var(--muted-rgb))]/70"
          >
            <HomeIcon size={16} />
            <span>Volver a la tienda</span>
          </NavLink>
        </div>
      </AdminContainer>
    );
  }

  return (
    <div className="w-full">
      <AdminContainer className="py-6 lg:py-8">
        {/* Header */}
        <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm opacity-70 mt-1">
              Panel de administración • {user?.email || "Usuario sin email"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] px-3 py-1 text-xs uppercase tracking-wide opacity-80">
              <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent-rgb))]" />
              {roleLabel}
            </span>

            <NavLink
              to="/"
              className="inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--border-rgb))] bg-[rgb(var(--card-rgb))] px-3 py-2 text-sm hover:bg-[rgb(var(--muted-rgb))]/70"
            >
              <HomeIcon size={16} />
              <span>Ver tienda</span>
            </NavLink>
          </div>
        </header>

        {/* Nav */}
        <nav
          aria-label="Navegación de administración"
          className="mb-6 -mx-1 overflow-x-auto pb-1"
        >
          <div className="flex flex-nowrap items-center gap-2 px-1">
            {isAdmin && (
              <>
                <NavLink
                  to="/admin"
                  end
                  className={({ isActive }) =>
                    [
                      baseLinkCls,
                      isActive ? activeLinkCls : inactiveLinkCls,
                    ].join(" ")
                  }
                >
                  <BarChart3 size={16} />
                  <span>Dashboard</span>
                </NavLink>

                <NavLink
                  to="/admin/home"
                  className={({ isActive }) =>
                    [
                      baseLinkCls,
                      isActive ? activeLinkCls : inactiveLinkCls,
                    ].join(" ")
                  }
                >
                  <LayoutTemplate size={16} />
                  <span>Inicio</span>
                </NavLink>

                <NavLink
                  to="/admin/products"
                  className={({ isActive }) =>
                    [
                      baseLinkCls,
                      isActive ? activeLinkCls : inactiveLinkCls,
                    ].join(" ")
                  }
                >
                  <Package size={16} />
                  <span>Productos</span>
                </NavLink>

                <NavLink
                  to="/admin/categories"
                  className={({ isActive }) =>
                    [
                      baseLinkCls,
                      isActive ? activeLinkCls : inactiveLinkCls,
                    ].join(" ")
                  }
                >
                  <FolderTree size={16} />
                  <span>Categorías</span>
                </NavLink>

                <NavLink
                  to="/admin/orders"
                  className={({ isActive }) =>
                    [
                      baseLinkCls,
                      isActive ? activeLinkCls : inactiveLinkCls,
                    ].join(" ")
                  }
                >
                  <Receipt size={16} />
                  <span>Órdenes</span>
                </NavLink>

                <NavLink
                  to="/admin/users"
                  className={({ isActive }) =>
                    [
                      baseLinkCls,
                      isActive ? activeLinkCls : inactiveLinkCls,
                    ].join(" ")
                  }
                >
                  <Users size={16} />
                  <span>Usuarios</span>
                </NavLink>

                <NavLink
                  to="/admin/fx"
                  className={({ isActive }) =>
                    [
                      baseLinkCls,
                      isActive ? activeLinkCls : inactiveLinkCls,
                    ].join(" ")
                  }
                >
                  <Banknote size={16} />
                  <span>Tasas&nbsp;FX</span>
                </NavLink>
              </>
            )}

            {isStaff && (
              <NavLink
                to="/admin/support"
                className={({ isActive }) =>
                  [
                    baseLinkCls,
                    isActive ? activeLinkCls : inactiveLinkCls,
                  ].join(" ")
                }
              >
                <LifeBuoy size={16} />
                <span>Soporte</span>
              </NavLink>
            )}
          </div>
        </nav>

        <div className="space-y-6">
          <Outlet />
        </div>
      </AdminContainer>
    </div>
  );
}
