// src/router/AppRouter.tsx
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  Link,
  useParams,
} from "react-router-dom";
import {
  Suspense,
  useEffect,
  useState,
  Component,
  type ReactNode,
} from "react";

import Navbar from "@/layout/Navbar";
import Footer from "@/layout/Footer";

// Admin
import AdminRoute from "@/features/admin/guards/AdminRoute";
import StaffRoute from "@/features/admin/guards/StaffRoute"; // ← STAFF (ADMIN o SUPPORT)
import AdminLayout from "@/features/admin/layout/AdminLayout";
import AdminDashboardPage from "@/features/admin/pages/AdminDashboardPage";
import AdminProductsPage from "@/features/admin/pages/AdminProductsPage";
import AdminCategoriesPage from "@/features/admin/pages/AdminCategoriesPage";
import AdminProductEditorPage from "@/features/admin/pages/AdminProductEditorPage";
import AdminOrdersPage from "@/features/admin/pages/AdminOrdersPage";
import AdminUsersPage from "@/features/admin/pages/AdminUsersPage";
import AdminProductImportPage from "@/features/admin/pages/AdminProductImportPage";
import AdminFxPage from "@/features/admin/pages/AdminFxPage";
import AdminSupportPage from "@/features/admin/pages/AdminSupportPage";
import AdminHomePage from "@/features/admin/pages/AdminHomePage"; // 👈 tu página para secciones de home

// Support (thread page)
import SupportConversationPage from "@/features/support/pages/SupportConversationPage";

// Home (landing)
import HomePage from "@/features/home/pages/HomePage";

// Públicas
import CatalogPage from "@/features/products/pages/CatalogPage";
import ProductDetailPage from "@/features/products/pages/ProductDetailPage";
import CartPage from "@/features/cart/pages/CartPage";
import LoginPage from "@/features/auth/pages/LoginPage";
import RegisterPage from "@/features/auth/pages/RegisterPage";
import LegalTermsPage from "@/features/legal/pages/LegalTermsPage";
import LegalPrivacyPage from "@/features/legal/pages/LegalPrivacyPage";
import ContactPage from "@/features/legal/pages/ContactPage";
import HelpPage from "@/features/Help/pages/HelpPage";
import WishlistPage from "@/features/wishlist/pages/WishlistPage";

// Checkout
import CheckoutPage from "@/features/checkout/pages/CheckoutPage";
import CheckoutSuccessPage from "@/features/checkout/pages/CheckoutSuccessPage";
import CheckoutCancelPage from "@/features/checkout/pages/CheckoutCancelPage";

// Cuenta
import AccountLayout from "@/features/account/layout/AccountLayout";
import ProfilePage from "@/features/account/pages/ProfilePage";
import AddressesPage from "@/features/account/pages/AddressesPage";
import OrdersPage from "@/features/account/pages/OrdersPage";
import OrderDetailPage from "@/features/account/pages/OrderDetailPage";
import SecurityPage from "@/features/account/pages/SecurityPage";

//Search
import SearchPage from "../features/Search/page/SearchPage";

// Infra
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useAuthBootstrap } from "@/hooks/useAuthBootstrap";

// 💬 Burbuja de soporte (cliente)
import SupportWidget from "@/features/support/components/SupportWidget";

// ─────────── Helpers UI ───────────
function ScrollToTop() {
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [loc.pathname, loc.search]);
  return null;
}

function FullscreenSpinner({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] px-5 py-4 text-sm opacity-80">
        {label}
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    console.error("Render error:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="container py-10">
          <div className="rounded-2xl border border-red-900/40 bg-red-900/10 p-5">
            <h2 className="text-lg font-semibold">Algo salió mal 😵‍💫</h2>
            <p className="text-sm opacity-80">Intenta recargar la página.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────── Guards ───────────
function ProtectedRoute({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.accessToken);
  const setToken = useAuthStore((s) => s.setToken);
  const loc = useLocation();
  const [state, setState] = useState<"checking" | "allowed" | "denied">(
    token ? "allowed" : "checking"
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (token) {
        setState("allowed");
        return;
      }
      try {
        const res = await api.post("/auth/refresh");
        const newToken = res.data?.accessToken || null;
        if (!mounted) return;
        setToken(newToken);
        setState(newToken ? "allowed" : "denied");
      } catch {
        if (!mounted) return;
        setState("denied");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token, setToken]);

  if (state === "checking") return <FullscreenSpinner label="Autenticando…" />;
  if (state === "denied") {
    return (
      <Navigate
        to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`}
        replace
      />
    );
  }
  return children;
}

function GuestOnly({ children }: { children: JSX.Element }) {
  const token = useAuthStore((s) => s.accessToken);
  const loc = useLocation();
  if (token) {
    const params = new URLSearchParams(loc.search);
    const next = params.get("next") || "/";
    return <Navigate to={next} replace />;
  }
  return children;
}

// Redirección con :id para compatibilidad /orders/:id → /account/orders/:id
function LegacyOrderRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/account/orders/${id}`} replace />;
}

// ─────────── 404 ───────────
function NotFoundPage() {
  return (
    <div className="container py-10">
      <div className="rounded-2xl border border-zinc-800 bg-[var(--card)] p-6 text-center">
        <h2 className="text-xl font-semibold">No encontrado</h2>
        <p className="opacity-70 text-sm">La ruta que buscas no existe.</p>
        <Link className="underline text-sm mt-3 inline-block" to="/tienda">
          Volver al catálogo
        </Link>
      </div>
    </div>
  );
}

// ─────────── Router ───────────
export default function AppRouter() {
  useAuthBootstrap(); // refresca sesión y carga /me al montar

  // ⚠️ Mostrar la burbuja SOLO si hay sesión y NO estamos en /admin/* ni /support/*
  const token = useAuthStore((s) => s.accessToken);
  const loc = useLocation();
  const showSupportWidget =
    !!token &&
    !loc.pathname.startsWith("/admin") &&
    !loc.pathname.startsWith("/support");

  return (
    <div className="min-h-screen flex flex-col">
      <ScrollToTop />
      <Navbar />
      <div className="flex-1">
        <ErrorBoundary>
          <Suspense fallback={<FullscreenSpinner />}>
            <Routes>
              {/* Home pública (landing tipo Amazon) */}
              <Route path="/" element={<HomePage />} />

              {/* Catálogo / tienda */}
              <Route path="/tienda" element={<CatalogPage />} />

              <Route path="/search" element={<SearchPage />} />

              {/* Públicas */}
              <Route path="/product/:slug" element={<ProductDetailPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route
                path="/login"
                element={
                  <GuestOnly>
                    <LoginPage />
                  </GuestOnly>
                }
              />
              <Route
                path="/register"
                element={
                  <GuestOnly>
                    <RegisterPage />
                  </GuestOnly>
                }
              />

              <Route path="/wishlist" element={<WishlistPage />} />

              {/* Legales, contacto y ayuda (PÚBLICAS) */}
              <Route path="/legal/terms" element={<LegalTermsPage />} />
              <Route path="/legal/privacy" element={<LegalPrivacyPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/help" element={<HelpPage />} />

              {/* Protegidas */}
              <Route
                path="/checkout"
                element={
                  <ProtectedRoute>
                    <CheckoutPage />
                  </ProtectedRoute>
                }
              />

              {/* Cuenta: layout + secciones */}
              <Route
                path="/account"
                element={
                  <ProtectedRoute>
                    <AccountLayout />
                  </ProtectedRoute>
                }
              >
                <Route
                  index
                  element={<Navigate to="/account/profile" replace />}
                />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="addresses" element={<AddressesPage />} />
                <Route path="orders" element={<OrdersPage />} />
                <Route path="orders/:id" element={<OrderDetailPage />} />
                <Route path="security" element={<SecurityPage />} />
              </Route>

              {/* Compatibilidad: /me → /account/profile */}
              <Route
                path="/me"
                element={
                  <ProtectedRoute>
                    <Navigate to="/account/profile" replace />
                  </ProtectedRoute>
                }
              />

              {/* Admin (solo ADMIN) */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                }
              >
                {/* /admin → dashboard */}
                <Route index element={<AdminDashboardPage />} />

                {/* /admin/home → gestión de secciones del home */}
                <Route path="home" element={<AdminHomePage />} />

                {/* /admin/products */}
                <Route path="products" element={<AdminProductsPage />} />
                <Route
                  path="products/new"
                  element={<AdminProductEditorPage />}
                />
                <Route
                  path="products/:id"
                  element={<AdminProductEditorPage />}
                />

                {/* /admin/orders */}
                <Route path="orders" element={<AdminOrdersPage />} />

                {/* /admin/users */}
                <Route path="users" element={<AdminUsersPage />} />

                {/* /admin/products/import */}
                <Route
                  path="products/import"
                  element={<AdminProductImportPage />}
                />

                {/* /admin/categories */}
                <Route path="categories" element={<AdminCategoriesPage />} />

                {/* /admin/fx */}
                <Route path="fx" element={<AdminFxPage />} />

                {/* 404 admin */}
                <Route path="*" element={<NotFoundPage />} />
              </Route>

              {/* Support NUEVO (ADMIN o SUPPORT) */}
              <Route
                path="/support"
                element={
                  <StaffRoute>
                    <AdminLayout />
                  </StaffRoute>
                }
              >
                <Route index element={<AdminSupportPage />} />
                <Route path=":id" element={<SupportConversationPage />} />
              </Route>

              {/* Support legado bajo /admin/support (alias) */}
              <Route
                path="/admin/support"
                element={
                  <StaffRoute>
                    <AdminLayout />
                  </StaffRoute>
                }
              >
                <Route index element={<AdminSupportPage />} />
                <Route path=":id" element={<SupportConversationPage />} />
              </Route>

              {/* Post-checkout (públicas para redirecciones de Stripe) */}
              <Route
                path="/checkout/success"
                element={<CheckoutSuccessPage />}
              />
              <Route path="/checkout/cancel" element={<CheckoutCancelPage />} />

              {/* Redirects de compatibilidad para pedidos */}
              <Route
                path="/orders"
                element={<Navigate to="/account/orders" replace />}
              />
              <Route path="/orders/:id" element={<LegacyOrderRedirect />} />

              {/* 404 global */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </div>

      {/* 💬 Burbuja de soporte (solo usuarios logueados y fuera de /admin y /support) */}
      {showSupportWidget && <SupportWidget />}

      <Footer />
    </div>
  );
}
