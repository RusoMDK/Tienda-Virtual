import { NavLink, Outlet } from "react-router-dom";
import Container from "@/layout/Container";

export default function AccountLayout() {
  const linkCls =
    "px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm hover:opacity-90";
  const active =
    "border-[var(--primary)] text-[var(--primary-foreground)] bg-[var(--primary)]";
  return (
    <Container className="py-8">
      <h1 className="text-2xl font-bold mb-4">Mi cuenta</h1>

      <div className="flex gap-2 mb-6 flex-wrap">
        <NavLink
          to="/account/profile"
          className={({ isActive }) => `${linkCls} ${isActive ? active : ""}`}
        >
          Información personal
        </NavLink>
        <NavLink
          to="/account/addresses"
          className={({ isActive }) => `${linkCls} ${isActive ? active : ""}`}
        >
          Direcciones de entrega
        </NavLink>
        <NavLink
          to="/account/orders"
          className={({ isActive }) => `${linkCls} ${isActive ? active : ""}`}
        >
          Pedidos
        </NavLink>
        <NavLink
          to="/account/security"
          className={({ isActive }) => `${linkCls} ${isActive ? active : ""}`}
        >
          Seguridad
        </NavLink>
      </div>

      <Outlet />
    </Container>
  );
}
