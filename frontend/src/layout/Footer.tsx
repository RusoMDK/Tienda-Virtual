import Container from "./Container";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Button, Input, Label } from "@/ui";
import { useToast } from "@/ui";

export default function Footer() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const year = new Date().getFullYear();

  function validEmail(v: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  async function onSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!validEmail(email)) {
      toast({ title: "Correo no válido", variant: "error" });
      return;
    }
    toast({
      title: "¡Suscripción exitosa!",
      description: "Te enviaremos novedades y ofertas.",
      variant: "success",
    });
    setEmail("");
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const linkCls =
    "text-sm opacity-80 hover:opacity-100 transition hover:underline underline-offset-4 decoration-[var(--ring)]";

  return (
    <footer className="mt-10 border-t border-[rgb(var(--border-rgb))] bg-[color-mix(in_oklab,var(--card) 92%,transparent)]">
      {/* Footer full-width tipo Amazon */}
      <Container className="!max-w-none px-4 sm:px-6 lg:px-10 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <Link to="/" className="inline-block">
              <span className="text-xl font-extrabold bg-gradient-to-r from-[var(--brand-start)] to-[var(--brand-end)] bg-clip-text text-transparent">
                tienda
              </span>
            </Link>
            <p className="text-sm opacity-80 leading-relaxed">
              Experiencia de compra simple, rápida y segura. Pagos protegidos,
              envíos con tracking y soporte humano.
            </p>

            {/* “Sellos”/confianza */}
            <ul className="flex flex-wrap gap-2 text-[11px] opacity-80">
              <li className="rounded-lg border border-[rgb(var(--border-rgb))] px-2 py-1 bg-[rgb(var(--card-2-rgb))]">
                Stripe Secure
              </li>
              <li className="rounded-lg border border-[rgb(var(--border-rgb))] px-2 py-1 bg-[rgb(var(--card-2-rgb))]">
                SSL
              </li>
              <li className="rounded-lg border border-[rgb(var(--border-rgb))] px-2 py-1 bg-[rgb(var(--card-2-rgb))]">
                Devolución 30 días
              </li>
            </ul>
          </div>

          {/* Tienda */}
          <nav aria-label="Tienda" className="space-y-3">
            <h3 className="text-sm font-semibold">Tienda</h3>
            <ul className="space-y-2">
              <li>
                <Link className={linkCls} to="/?sort=createdAt:desc">
                  Novedades
                </Link>
              </li>
              <li>
                <Link className={linkCls} to="/?sort=price:asc">
                  Precios ↑
                </Link>
              </li>
              <li>
                <Link className={linkCls} to="/?sort=price:desc">
                  Precios ↓
                </Link>
              </li>
              <li>
                <Link className={linkCls} to="/">
                  Ver todo
                </Link>
              </li>
              <li>
                <Link className={linkCls} to="/cart">
                  Carrito
                </Link>
              </li>
            </ul>
          </nav>

          {/* Soporte */}
          <nav aria-label="Soporte" className="space-y-3">
            <h3 className="text-sm font-semibold">Soporte</h3>
            <ul className="space-y-2">
              <li>
                <Link className={linkCls} to="/orders">
                  Mis pedidos
                </Link>
              </li>
              <li>
                <Link className={linkCls} to="/account/addresses">
                  Direcciones
                </Link>
              </li>
              <li>
                <Link className={linkCls} to="/legal/terms">
                  Términos
                </Link>
              </li>
              <li>
                <Link className={linkCls} to="/legal/privacy">
                  Privacidad
                </Link>
              </li>
              <li>
                <button onClick={scrollTop} className={linkCls}>
                  Volver arriba
                </button>
              </li>
            </ul>
          </nav>

          {/* Newsletter */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Newsletter</h3>
            <p className="text-sm opacity-80">
              Ofertas y novedades, sin spam. Cancela cuando quieras.
            </p>
            <form onSubmit={onSubscribe} className="grid gap-2">
              <Label htmlFor="newsletter" className="sr-only">
                Correo electrónico
              </Label>
              <Input
                id="newsletter"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[rgb(var(--card-2-rgb))] border border-[rgb(var(--border-rgb))]"
                autoComplete="email"
              />
              <Button type="submit" className="w-full">
                Suscribirme
              </Button>
            </form>

            {/* Social minimal */}
            <div className="pt-1 flex items-center gap-3 text-sm opacity-80">
              <a
                href="#"
                aria-label="Instagram"
                className="hover:opacity-100 transition"
              >
                IG
              </a>
              <a
                href="#"
                aria-label="Twitter/X"
                className="hover:opacity-100 transition"
              >
                X
              </a>
              <a
                href="#"
                aria-label="Facebook"
                className="hover:opacity-100 transition"
              >
                FB
              </a>
            </div>
          </div>
        </div>

        {/* Barra inferior */}
        <div className="mt-8 pt-6 border-t border-[rgb(var(--border-rgb))] flex flex-col md:flex-row items-center justify-between gap-3 text-sm opacity-80">
          <div>© {year} tienda. Todos los derechos reservados.</div>
          <div className="flex items-center gap-4">
            <Link to="/legal/terms" className={linkCls}>
              Términos
            </Link>
            <Link to="/legal/privacy" className={linkCls}>
              Privacidad
            </Link>
            <Link to="/contact" className={linkCls}>
              Contacto
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
